/**
 * Recognizes "port already in use" failures in terminal output from common dev tools.
 * Platform-agnostic (no IDE dependencies): the extension feeds it terminal output chunks.
 */

export type JamKind =
  /** The server failed to start because the port is taken. */
  | 'blocked'
  /** The tool silently moved to another port (Vite, Next.js): the app runs, but on an unexpected port. */
  | 'shifted';

export interface TerminalJam {
  kind: JamKind;
  /** The port that was busy, when it can be determined. */
  port?: number;
  /** For 'shifted': the port the tool moved to, when it says so. */
  newPort?: number;
  tool: string;
  /** The output line that matched (ANSI codes removed). */
  line: string;
  /**
   * Windows reports a port inside a Hyper-V / WSL / Docker reserved range with the same error
   * as a busy port (WinError 10013). If no process is listening, the port is reserved, not jammed.
   */
  mayBeWindowsReserved?: boolean;
}

interface JamPattern {
  kind: JamKind;
  tool: string;
  regex: RegExp;
  /** Capture group holding the busy port, if the message includes it. */
  portGroup?: number;
  newPortGroup?: number;
  mayBeWindowsReserved?: boolean;
}

// Ordered most specific first: the first match wins.
const PATTERNS: JamPattern[] = [
  // Next.js: "⚠ Port 3000 is in use, trying 3001 instead."
  { kind: 'shifted', tool: 'Next.js', regex: /Port (\d+) is in use, trying (\d+) instead/i, portGroup: 1, newPortGroup: 2 },
  // Vite / Astro / SvelteKit: "Port 5173 is in use, trying another one..."
  { kind: 'shifted', tool: 'Vite', regex: /Port (\d+) is in use, trying another one/i, portGroup: 1 },
  // Create React App: "Something is already running on port 3000."
  { kind: 'blocked', tool: 'Create React App', regex: /Something is already running on port (\d+)/i, portGroup: 1 },
  // Node / Express / Nest: "Error: listen EADDRINUSE: address already in use :::3000"
  { kind: 'blocked', tool: 'Node.js', regex: /listen EADDRINUSE:?[^\n]*?:(\d+)\s*$/i, portGroup: 1 },
  // Rails / Puma: 'Address already in use - bind(2) for "127.0.0.1" port 3000 (Errno::EADDRINUSE)'
  { kind: 'blocked', tool: 'Ruby', regex: /bind\(2\) for "?[^"]*"? port (\d+)/i, portGroup: 1 },
  // Uvicorn / asyncio: "[Errno 98] error while attempting to bind on address ('127.0.0.1', 8000): address already in use"
  // Windows variant: "[WinError 10048] error while attempting to bind on address ('127.0.0.1', 8000): only one usage..."
  { kind: 'blocked', tool: 'Python', regex: /attempting to bind on address \('[^']*', (\d+)\)/i, portGroup: 1 },
  // Flask / Werkzeug: "Port 5000 is in use by another program."
  { kind: 'blocked', tool: 'Flask', regex: /Port (\d+) is in use by another program/i, portGroup: 1 },
  // Bun: "error: Failed to start server. Is port 3000 in use?"
  { kind: 'blocked', tool: 'Bun', regex: /Failed to start server\. Is port (\d+) in use/i, portGroup: 1 },
  // Go: "listen tcp :8080: bind: address already in use"
  { kind: 'blocked', tool: 'Go', regex: /listen tcp [^\s]*:(\d+): bind: address already in use/i, portGroup: 1 },
  // Django: "Error: That port is already in use."
  { kind: 'blocked', tool: 'Django', regex: /That port is already in use/i },
  // Generic fallbacks (port inferred from the command line by the caller)
  { kind: 'blocked', tool: 'Node.js', regex: /EADDRINUSE[^\n]*?:(\d+)/i, portGroup: 1 },
  { kind: 'blocked', tool: 'Windows', regex: /Only one usage of each socket address/i },
  // Python on Windows: "PermissionError: [WinError 10013] An attempt was made to access a socket in a way forbidden..."
  { kind: 'blocked', tool: 'Windows', regex: /WinError 10013|forbidden by its access permissions/i, mayBeWindowsReserved: true },
  { kind: 'blocked', tool: 'unknown', regex: /address already in use/i },
];

// CSI / OSC escape sequences (colors, cursor moves, VS Code shell-integration markers)
const ANSI_REGEX = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

/**
 * Finds the first jam in a block of (already ANSI-stripped) output.
 */
export function detectJam(text: string): TerminalJam | undefined {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    for (const p of PATTERNS) {
      const m = line.match(p.regex);
      if (m) {
        return {
          kind: p.kind,
          tool: p.tool,
          line,
          port: p.portGroup ? toPort(m[p.portGroup]) : undefined,
          newPort: p.newPortGroup ? toPort(m[p.newPortGroup]) : undefined,
          ...(p.mayBeWindowsReserved ? { mayBeWindowsReserved: true } : {}),
        };
      }
    }
  }
  return undefined;
}

/**
 * Best-effort port from a command line, for messages that don't name the port
 * (Django, "address already in use"). Explicit flags win over tool defaults.
 */
export function inferPortFromCommand(commandLine: string): number | undefined {
  // http.server takes a bare port argument: `python -m http.server 8080`
  const httpServer = commandLine.match(/http\.server\s+(\d{2,5})\b/);
  if (httpServer) return toPort(httpServer[1]);

  const explicit = commandLine.match(/(?:--port[= ]|-p[= ]?|\bPORT=)(\d{2,5})\b/i) || commandLine.match(/\b(?:0\.0\.0\.0|127\.0\.0\.1|localhost):(\d{2,5})\b/);
  if (explicit) return toPort(explicit[1]);

  // `manage.py runserver 8080`
  const runserver = commandLine.match(/runserver\s+(?:[\w.]+:)?(\d{2,5})\b/);
  if (runserver) return toPort(runserver[1]);

  if (/\brunserver\b/.test(commandLine) || /\buvicorn\b/.test(commandLine)) return 8000;
  if (/\bflask\b/.test(commandLine)) return 5000;
  if (/\brails\s+s(erver)?\b/.test(commandLine)) return 3000;
  return undefined;
}

/**
 * Incremental detector for streamed terminal output. Output arrives in arbitrary chunks,
 * so partial lines are buffered until their newline arrives. Reports at most one jam.
 */
export class TerminalJamDetector {
  private pending = '';
  private reported = false;

  constructor(private readonly commandLine = '') {}

  feed(chunk: string): TerminalJam | undefined {
    if (this.reported) return undefined;

    this.pending += stripAnsi(chunk);
    const lastNewline = this.pending.lastIndexOf('\n');
    if (lastNewline === -1) {
      // Guard against unbounded growth from output without newlines (progress bars)
      if (this.pending.length > 8192) this.pending = this.pending.slice(-4096);
      return undefined;
    }

    const complete = this.pending.slice(0, lastNewline);
    this.pending = this.pending.slice(lastNewline + 1);
    return this.check(complete);
  }

  /** Call when the command ends, to check a final line that had no trailing newline. */
  flush(): TerminalJam | undefined {
    if (this.reported || !this.pending) return undefined;
    const rest = this.pending;
    this.pending = '';
    return this.check(rest);
  }

  private check(text: string): TerminalJam | undefined {
    const jam = detectJam(text);
    if (!jam) return undefined;
    if (jam.port === undefined && jam.kind === 'blocked') {
      jam.port = inferPortFromCommand(this.commandLine);
    }
    this.reported = true;
    return jam;
  }
}

function toPort(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : undefined;
}
