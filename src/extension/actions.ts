import * as vscode from 'vscode';
import { DEFAULT_DEV_PORTS, PortScanner } from '../core/PortScanner.js';
import { ProcessInspector } from '../core/ProcessInspector.js';
import { ProcessTerminator, SafetyShieldError, isDatabaseProcess } from '../core/ProcessTerminator.js';
import { PortInfo, ProcessDetails } from '../shared/types.js';
import { translateError } from '../shared/glossary.js';
import { politeUnjamPort } from './terminalShutdown.js';

export function getWatchedPorts(): number[] {
  const configured = vscode.workspace.getConfiguration('envwizard').get<number[]>('watchedPorts');
  const valid = (configured || []).filter((p) => Number.isInteger(p) && p > 0 && p <= 65535);
  return valid.length > 0 ? valid : DEFAULT_DEV_PORTS;
}

/**
 * Caches process lookups per PID: on Windows each lookup spawns PowerShell (~1s).
 */
export class ProcessDetailsCache {
  private cache = new Map<number, Promise<ProcessDetails>>();

  constructor(private readonly inspector: ProcessInspector) {}

  get(pid: number): Promise<ProcessDetails> {
    let entry = this.cache.get(pid);
    if (!entry) {
      entry = this.inspector.inspectProcess(pid);
      this.cache.set(pid, entry);
    }
    return entry;
  }

  /** Drop PIDs that are no longer listening, so a reused PID never shows a stale name. */
  retain(pids: number[]) {
    const keep = new Set(pids);
    for (const pid of this.cache.keys()) {
      if (!keep.has(pid)) this.cache.delete(pid);
    }
  }

  forget(pid: number) {
    this.cache.delete(pid);
  }
}

export interface EnrichedPort extends PortInfo {
  isProtected: boolean;
  isDatabase: boolean;
  summary?: string;
}

export interface PortServices {
  scanner: PortScanner;
  terminator: ProcessTerminator;
  cache: ProcessDetailsCache;
}

export async function enrichPorts(ports: PortInfo[], services: PortServices): Promise<EnrichedPort[]> {
  services.cache.retain(ports.map((p) => p.pid));
  return Promise.all(
    ports.map(async (p) => {
      const details = await services.cache.get(p.pid);
      const name = details.name || p.processName || 'Unknown';
      return {
        ...p,
        processName: name,
        cwd: details.cwd,
        commandLine: details.commandLine,
        isProtected: services.terminator.isProtected(name, p.pid),
        isDatabase: isDatabaseProcess(name),
        summary: summarizeCommand(details),
      };
    })
  );
}

/**
 * Short, human description of what a process is, e.g. `node … next dev` in `my-app`.
 */
export function summarizeCommand(details: ProcessDetails): string | undefined {
  const cmd = details.commandLine?.trim();
  if (!cmd) return undefined;
  // The executable may be quoted because its path contains spaces ("C:\Program Files\...")
  const exeMatch = cmd.match(/^"([^"]+)"|^(\S+)/);
  const exePath = exeMatch?.[1] || exeMatch?.[2] || cmd;
  const exe = (exePath.split(/[\\/]/).pop() || exePath).replace(/\.exe$/i, '');
  const args = cmd.slice(exeMatch?.[0].length ?? cmd.length).replace(/"/g, '').trim().split(/\s+/).filter(Boolean);
  const rest = args.map((a) => (a.length > 40 && /[\\/]/.test(a) ? '…' + a.slice(-30) : a)).join(' ');
  const text = `${exe} ${rest}`.trim();
  return text.length > 90 ? text.slice(0, 87) + '…' : text;
}

/**
 * Asks for confirmation with a plain-English preview, then frees the port.
 * Never throws: Safety Shield refusals and failures become friendly messages.
 */
export async function confirmAndUnjam(port: number, services: PortServices): Promise<void> {
  const info = await services.scanner.scanPort(port);
  if (!info) {
    vscode.window.showInformationMessage(`✨ Port ${port} is already free.`);
    return;
  }

  const details = await services.cache.get(info.pid);
  const name = details.name || 'Unknown';
  if (services.terminator.isProtected(name, info.pid)) {
    vscode.window.showWarningMessage(
      `🛡️ Port ${port} is held by "${name}", a protected program (system, editor, Docker or WSL). EnvWizard won't stop it.` +
        (/docker|wsl|vpnkit/i.test(name) ? ' Stop the container or the server inside WSL instead.' : '')
    );
    return;
  }

  const t = translateError('EADDRINUSE');
  const where = details.cwd ? ` in ${details.cwd}` : '';
  const dbNote = isDatabaseProcess(name) ? '\n\nHeads-up: this looks like a local database. Stopping it may interrupt other apps.' : '';
  const action = `⚡ Free Port ${port}`;
  const answer = await vscode.window.showWarningMessage(
    `${t.icon} ${t.headline}: port ${port} is used by ${name}${where}. Stop it to free the port?`,
    { modal: true, detail: (summarizeCommand(details) || `Process ID ${info.pid}`) + dbNote },
    action
  );
  if (answer !== action) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Freeing port ${port}…` },
    async () => {
      try {
        const res = await politeUnjamPort(port, services);
        services.cache.forget(info.pid);
        if (res.success) {
          vscode.window.showInformationMessage(`✨ ${res.message}`);
        } else {
          vscode.window.showErrorMessage(`❌ ${res.message}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (err instanceof SafetyShieldError) {
          vscode.window.showWarningMessage(`🛡️ ${msg}`);
        } else {
          vscode.window.showErrorMessage(`❌ Couldn't free port ${port}: ${msg}`);
        }
      }
    }
  );
}

/**
 * Stops dev servers on the watched ports, skipping protected programs and databases.
 */
export async function cleanSlate(services: PortServices): Promise<void> {
  const ports = await enrichPorts(await services.scanner.scanDevPorts(getWatchedPorts()), services);
  if (!services.scanner.lastScanOk) {
    vscode.window.showWarningMessage(radarOfflineMessage());
    return;
  }

  const targets = ports.filter((p) => !p.isProtected && !p.isDatabase);
  const skipped = ports.filter((p) => p.isProtected || p.isDatabase);

  if (targets.length === 0) {
    vscode.window.showInformationMessage(
      skipped.length === 0
        ? '✨ All watched dev ports are already free!'
        : `✨ No dev servers to stop. Left alone: ${skipped.map((p) => `:${p.port} ${p.processName}`).join(', ')}.`
    );
    return;
  }

  const action = 'Yes, Stop Them';
  const answer = await vscode.window.showWarningMessage(
    `🧹 Clean Slate: stop ${targets.length} background server${targets.length === 1 ? '' : 's'}?`,
    {
      modal: true,
      detail:
        targets.map((p) => `• :${p.port} — ${p.summary || p.processName}`).join('\n') +
        (skipped.length
          ? `\n\nLeft alone (database or protected):\n` + skipped.map((p) => `• :${p.port} — ${p.processName}`).join('\n')
          : ''),
    },
    action
  );
  if (answer !== action) return;

  const failures: string[] = [];
  let freed = 0;
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: '🧹 Clean Slate…' },
    async () => {
      for (const p of targets) {
        try {
          const res = await politeUnjamPort(p.port, services);
          services.cache.forget(p.pid);
          if (res.success) freed++;
          else failures.push(res.message);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : String(err));
        }
      }
    }
  );

  if (failures.length === 0) {
    vscode.window.showInformationMessage(`🧹 Clean slate! Freed ${freed} port${freed === 1 ? '' : 's'}.`);
  } else {
    vscode.window.showWarningMessage(`🧹 Freed ${freed} of ${targets.length}. ${failures.join(' ')}`);
  }
}

export function radarOfflineMessage(): string {
  return process.platform === 'win32'
    ? 'EnvWizard could not read the port list (netstat failed). Ports may be busy even though none are shown.'
    : 'EnvWizard could not read the port list. Install "lsof" (or "ss" on Linux) so the port radar can work.';
}
