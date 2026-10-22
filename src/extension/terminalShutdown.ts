import * as vscode from 'vscode';
import { PortScanner } from '../core/PortScanner.js';
import { SafetyShieldError } from '../core/ProcessTerminator.js';
import { resolveProcessAncestors } from '../core/ProcessOwnership.js';
import { PortServices } from './actions.js';
import { UnjamResult } from '../shared/types.js';

export interface TerminalStopOptions {
  targetTerminal?: vscode.Terminal;
  ancestorPids?: number[];
  timeoutMs?: number;
  checkIntervalMs?: number;
  terminalsOverride?: readonly vscode.Terminal[];
}

/**
 * Finds the VS Code terminal that owns or spawned the process with the given PID.
 */
export async function findOwningTerminal(
  pid: number,
  ancestorPids: number[] = [],
  terminalsOverride?: readonly vscode.Terminal[]
): Promise<vscode.Terminal | undefined> {
  const terminals = terminalsOverride || vscode.window.terminals || [];
  const candidatePids = new Set([pid, ...ancestorPids].filter((p) => p > 0));

  for (const term of terminals) {
    try {
      const termPid = await term.processId;
      if (termPid && candidatePids.has(termPid)) {
        return term;
      }
    } catch {
      // Ignore terminal query error
    }
  }

  return undefined;
}

/**
 * Sends SIGINT (Ctrl+C: ASCII \x03) to a terminal to politely close a foreground dev server.
 */
export function sendCtrlCToTerminal(terminal: vscode.Terminal): void {
  terminal.sendText('\x03', false);
}

/**
 * Waits up to timeoutMs for a port to be released by its holding process.
 */
export async function waitForPortFree(
  port: number,
  scanner: PortScanner,
  timeoutMs = 3000,
  checkIntervalMs = 250
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, checkIntervalMs));
    const occupied = await scanner.scanPort(port);
    if (!occupied) {
      return true;
    }
  }

  return false;
}

/**
 * Polite unjammer: attempts graceful Ctrl+C via the owning terminal first (if running
 * inside VS Code terminal), and falls back to two-stage ProcessTerminator if needed.
 */
export async function politeUnjamPort(
  port: number,
  services: PortServices,
  options?: TerminalStopOptions
): Promise<UnjamResult> {
  const portInfo = await services.scanner.scanPort(port);
  if (!portInfo) {
    return {
      success: true,
      port,
      pid: 0,
      message: `Port ${port} is already free.`,
      graceful: true,
    };
  }

  const { pid } = portInfo;
  const details = await services.cache.get(pid);
  const processName = details.name || 'Unknown';

  if (services.terminator.isProtected(processName, pid)) {
    throw new SafetyShieldError(
      `Safety Shield: port ${port} is held by "${processName}", a protected program (system, editor, Docker or WSL). EnvWizard won't stop it.`
    );
  }

  // 1. Locate owning terminal if possible
  let terminal = options?.targetTerminal;
  if (!terminal) {
    const ancestors =
      options?.ancestorPids && options.ancestorPids.length > 0
        ? options.ancestorPids
        : await resolveProcessAncestors(pid);
    terminal = await findOwningTerminal(pid, ancestors, options?.terminalsOverride);
  }

  // 2. If owning terminal exists, attempt graceful Ctrl+C
  if (terminal) {
    sendCtrlCToTerminal(terminal);
    const timeout = options?.timeoutMs ?? 3000;
    const interval = options?.checkIntervalMs ?? 250;
    const freed = await waitForPortFree(port, services.scanner, timeout, interval);

    if (freed) {
      services.cache.forget(pid);
      return {
        success: true,
        port,
        pid,
        processName,
        message: `Successfully stopped ${processName} (PID ${pid}) via terminal Ctrl+C.`,
        graceful: true,
      };
    }
  }

  // 3. Fallback: standard two-stage ProcessTerminator (SIGTERM -> SIGKILL / taskkill)
  return services.terminator.unjamPort(port);
}
