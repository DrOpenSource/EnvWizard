import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ProcessDetails } from '../shared/types.js';

const execAsync = promisify(exec);

export type ProcessOwnership = 'this-terminal' | 'this-project' | 'other-project' | 'unknown';

export interface ProcessOwnershipDetails {
  ownership: ProcessOwnership;
  matchedWorkspaceFolder?: string;
  matchedTerminalPid?: number;
  detectedPath?: string;
  ancestorChain?: number[];
}

/**
 * Normalizes a filesystem path for cross-platform comparison.
 * On Windows, paths are converted to lowercase with forward slashes.
 */
export function normalizePathForComparison(filePath: string, platformOverride?: NodeJS.Platform): string {
  const platform = platformOverride || os.platform();
  const pathLib = platform === 'win32' ? path.win32 : path.posix;
  let normalized = pathLib.normalize(filePath).trim().replace(/\\/g, '/');

  if (platform === 'win32') {
    normalized = normalized.toLowerCase();
    // Remove trailing slash unless it is a drive root like 'c:/'
    if (normalized.length > 3 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
  } else {
    // Unix
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
  }

  return normalized;
}

/**
 * Checks whether candidatePath is identical to, or inside parentFolder.
 */
export function isPathInside(
  candidatePath: string,
  parentFolder: string,
  platformOverride?: NodeJS.Platform
): boolean {
  if (!candidatePath || !parentFolder) return false;

  const platform = platformOverride || os.platform();
  const normCandidate = normalizePathForComparison(candidatePath, platform);
  const normParent = normalizePathForComparison(parentFolder, platform);

  if (normCandidate === normParent) {
    return true;
  }

  const prefix = normParent.endsWith('/') ? normParent : normParent + '/';
  return normCandidate.startsWith(prefix);
}

/**
 * Identifies whether a path points to standard OS system / runtime directories.
 */
export function isSystemPath(filePath: string, platformOverride?: NodeJS.Platform): boolean {
  const platform = platformOverride || os.platform();
  const norm = normalizePathForComparison(filePath, platform);

  if (platform === 'win32') {
    // Root drive only e.g. "c:" or "c:/"
    if (/^[a-z]:\/?$/.test(norm)) return true;
    if (
      norm.startsWith('c:/windows') ||
      norm.startsWith('c:/program files') ||
      norm.startsWith('c:/program files (x86)') ||
      norm.startsWith('c:/programdata')
    ) {
      return true;
    }
  } else {
    // Unix root or system trees
    if (norm === '/' || norm === '') return true;
    const systemPrefixes = [
      '/bin',
      '/usr/bin',
      '/usr/lib',
      '/usr/local/bin',
      '/sbin',
      '/etc',
      '/var',
      '/lib',
      '/lib64',
      '/sys',
      '/proc',
      '/dev',
      '/opt',
    ];
    if (systemPrefixes.some((p) => norm === p || norm.startsWith(p + '/'))) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts potential file/directory paths from a command line string.
 */
export function extractCandidatePaths(commandLine: string, platformOverride?: NodeJS.Platform): string[] {
  if (!commandLine || !commandLine.trim()) return [];

  const platform = platformOverride || os.platform();
  const paths: string[] = [];

  // Match quoted paths: "..." or '...'
  const quotedMatches = commandLine.matchAll(/["']([^"']+)["']/g);
  for (const m of quotedMatches) {
    const val = m[1].trim();
    if (looksLikePath(val, platform)) {
      paths.push(val);
    }
  }

  // Match unquoted paths
  if (platform === 'win32') {
    const winMatches = commandLine.matchAll(/(?:^|\s)([a-zA-Z]:[\\/][^\s"':;]+)/g);
    for (const m of winMatches) {
      paths.push(m[1].trim());
    }
  } else {
    const unixMatches = commandLine.matchAll(/(?:^|\s)(\/[^\s"':;]+)/g);
    for (const m of unixMatches) {
      paths.push(m[1].trim());
    }
  }

  return Array.from(new Set(paths));
}

function looksLikePath(val: string, platform: NodeJS.Platform): boolean {
  if (platform === 'win32') {
    return /^[a-zA-Z]:[\\/]/.test(val) || val.includes('\\');
  }
  return val.startsWith('/') || (val.includes('/') && !val.startsWith('-'));
}

/**
 * Parses "pid ppid" lines into a PID → parent PID map.
 */
export function parseParentTable(output: string): Map<number, number> {
  const table = new Map<number, number>();
  for (const line of output.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d+)\s+(\d+)$/);
    if (m) table.set(Number(m[1]), Number(m[2]));
  }
  return table;
}

// Each PowerShell spawn costs ~0.5s on Windows, so walking a parent chain reads the whole
// process table once and reuses it briefly (a jam lookup walks the chain more than once).
let windowsParentTable: { table: Promise<Map<number, number>>; expiresAt: number } | undefined;
const PARENT_TABLE_TTL_MS = 2000;

function getWindowsParentTable(): Promise<Map<number, number>> {
  const now = Date.now();
  if (!windowsParentTable || windowsParentTable.expiresAt <= now) {
    const psCommand =
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | ForEach-Object { \\"$($_.ProcessId) $($_.ParentProcessId)\\" }"';
    windowsParentTable = {
      table: execAsync(psCommand, { timeout: 8000, maxBuffer: 4 * 1024 * 1024 })
        .then(({ stdout }) => parseParentTable(stdout))
        .catch(() => {
          windowsParentTable = undefined; // Don't keep a failed read (e.g. PowerShell slow under load)
          return new Map<number, number>();
        }),
      expiresAt: now + PARENT_TABLE_TTL_MS,
    };
  }
  return windowsParentTable.table;
}

/**
 * Inspects the immediate parent PID of a process.
 */
export async function getProcessParentPid(
  pid: number,
  platformOverride?: NodeJS.Platform
): Promise<number | undefined> {
  if (pid <= 0) return undefined;
  const platform = platformOverride || os.platform();

  try {
    if (platform === 'win32') {
      const ppid = (await getWindowsParentTable()).get(pid);
      return ppid !== undefined && ppid > 0 ? ppid : undefined;
    } else if (platform === 'linux') {
      try {
        const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
        const closeParen = stat.lastIndexOf(')');
        if (closeParen !== -1) {
          const rest = stat.slice(closeParen + 2).trim().split(/\s+/);
          const ppid = parseInt(rest[1], 10);
          if (Number.isInteger(ppid) && ppid > 0) return ppid;
        }
      } catch {
        // Fall back to ps
      }
    }

    // Unix fallback (macOS, BSD, or Linux without /proc)
    const { stdout } = await execAsync(`ps -p ${pid} -o ppid=`, { timeout: 2000 });
    const ppid = parseInt(stdout.trim(), 10);
    return Number.isInteger(ppid) && ppid > 0 ? ppid : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the ancestor process chain up to maxDepth.
 */
export async function resolveProcessAncestors(
  pid: number,
  options?: {
    getParentPid?: (pid: number) => Promise<number | undefined>;
    platform?: NodeJS.Platform;
    maxDepth?: number;
    stopAtPids?: Set<number>;
  }
): Promise<number[]> {
  const maxDepth = options?.maxDepth ?? 8;
  const getParent = options?.getParentPid || ((p) => getProcessParentPid(p, options?.platform));
  const ancestors: number[] = [];
  let currentPid = pid;

  for (let depth = 0; depth < maxDepth; depth++) {
    const parentPid = await getParent(currentPid);
    if (!parentPid || parentPid <= 0 || parentPid === currentPid || ancestors.includes(parentPid)) {
      break;
    }
    ancestors.push(parentPid);
    if (options?.stopAtPids?.has(parentPid)) {
      break;
    }
    if (parentPid <= 4) {
      break;
    }
    currentPid = parentPid;
  }

  return ancestors;
}

/**
 * Pure synchronous ownership classifier using known process details and pre-resolved ancestors.
 */
export function classifyOwnership(
  details: ProcessDetails,
  workspaceFolders: string[],
  terminalShellPids: number[] = [],
  ancestorPids: number[] = [],
  platformOverride?: NodeJS.Platform
): ProcessOwnership {
  const platform = platformOverride || os.platform();

  // 1. Check this-terminal: does PID, parentPid, or any ancestor match a terminal shell?
  const terminalSet = new Set(terminalShellPids.filter((p) => p > 0));
  if (terminalSet.size > 0) {
    if (terminalSet.has(details.pid)) {
      return 'this-terminal';
    }
    if (details.parentPid && terminalSet.has(details.parentPid)) {
      return 'this-terminal';
    }
    if (ancestorPids.some((p) => terminalSet.has(p))) {
      return 'this-terminal';
    }
  }

  // 2. Check this-project: is cwd or any command-line path inside a workspace folder?
  if (details.cwd) {
    for (const folder of workspaceFolders) {
      if (isPathInside(details.cwd, folder, platform)) {
        return 'this-project';
      }
    }
  }

  const cmdPaths = details.commandLine ? extractCandidatePaths(details.commandLine, platform) : [];
  for (const cmdPath of cmdPaths) {
    for (const folder of workspaceFolders) {
      if (isPathInside(cmdPath, folder, platform)) {
        return 'this-project';
      }
    }
  }

  // 3. Check other-project: is cwd or a command-line path pointing to an external non-system location?
  if (details.cwd && !isSystemPath(details.cwd, platform)) {
    let insideAny = false;
    for (const folder of workspaceFolders) {
      if (isPathInside(details.cwd, folder, platform)) {
        insideAny = true;
        break;
      }
    }
    if (!insideAny) {
      return 'other-project';
    }
  }

  for (const cmdPath of cmdPaths) {
    if (!isSystemPath(cmdPath, platform)) {
      let insideAny = false;
      for (const folder of workspaceFolders) {
        if (isPathInside(cmdPath, folder, platform)) {
          insideAny = true;
          break;
        }
      }
      if (!insideAny) {
        return 'other-project';
      }
    }
  }

  // 4. Fallback: unknown
  return 'unknown';
}

/**
 * Classifies process ownership, automatically looking up process ancestors if necessary.
 */
export async function classify(
  details: ProcessDetails,
  workspaceFolders: string[],
  terminalShellPids: number[] = [],
  options?: {
    platform?: NodeJS.Platform;
    ancestorPids?: number[];
    getParentPid?: (pid: number) => Promise<number | undefined>;
    maxDepth?: number;
  }
): Promise<ProcessOwnership> {
  const platform = options?.platform || os.platform();
  const terminalSet = new Set(terminalShellPids.filter((p) => p > 0));

  // Quick check without resolving parent chain
  if (terminalSet.size > 0) {
    if (terminalSet.has(details.pid) || (details.parentPid && terminalSet.has(details.parentPid))) {
      return 'this-terminal';
    }
  }

  // Resolve ancestor chain if not supplied and terminals are active
  let ancestors: number[] = options?.ancestorPids || [];
  if (ancestors.length === 0 && terminalSet.size > 0 && details.pid > 0) {
    ancestors = await resolveProcessAncestors(details.pid, {
      getParentPid: options?.getParentPid,
      platform,
      maxDepth: options?.maxDepth,
      stopAtPids: terminalSet,
    });
  }

  return classifyOwnership(details, workspaceFolders, terminalShellPids, ancestors, platform);
}

export const classifyProcessOwnership = classify;

/**
 * Best-effort project folder name for a process: its cwd, otherwise the first
 * non-system path in its command line (cut at node_modules, files → their folder).
 */
export function projectNameOf(details: ProcessDetails, platform: NodeJS.Platform = os.platform()): string | undefined {
  const lib = platform === 'win32' ? path.win32 : path.posix;
  if (details.cwd && !isSystemPath(details.cwd, platform)) {
    return lib.basename(details.cwd) || undefined;
  }
  const candidate = extractCandidatePaths(details.commandLine || '', platform).find((p) => !isSystemPath(p, platform));
  if (!candidate) return undefined;
  const beforeModules = candidate.split(/[\\/]node_modules[\\/]/)[0];
  const dir = beforeModules !== candidate || !lib.extname(candidate) ? beforeModules : lib.dirname(candidate);
  return lib.basename(dir) || undefined;
}
