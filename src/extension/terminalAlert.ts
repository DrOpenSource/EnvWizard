import * as vscode from 'vscode';
import { TerminalJam, TerminalJamDetector } from '../core/TerminalJamDetector.js';
import { ProcessOwnership, classify, isPathInside, projectNameOf } from '../core/ProcessOwnership.js';
import { SafetyShieldError, isDatabaseProcess } from '../core/ProcessTerminator.js';
import { WindowsReservedCheckResult, checkWindowsReservedPort } from '../core/WindowsReservedPorts.js';
import { PortServices, getTerminalShellPids, summarizeCommand } from './actions.js';
import { politeUnjamPort, sendCtrlCToTerminal } from './terminalShutdown.js';

export const FREE_AND_RERUN = 'Free & Rerun';
export const RERUN = 'Rerun';
export const DETAILS = 'Details';
export const SHOW_PORTS = 'Show Ports';
export { projectNameOf };

export const freeAndRestart = (port: number) => `Free ${port} & Restart`;

/** What is holding the jammed port, in the terms the toast needs. */
export interface JamHolder {
  port: number;
  pid: number;
  name: string;
  ownership: ProcessOwnership;
  /** Folder name of the project the holder runs from, when known (e.g. "other-app"). */
  projectName?: string;
  summary?: string;
  isProtected: boolean;
  isDatabase: boolean;
}

export interface JamAlert {
  message: string;
  /** Toast buttons, most useful first. */
  actions: string[];
  /** Extra lines for the Details dialog. */
  detail?: string;
}

function describeHolder(h: JamHolder): string {
  switch (h.ownership) {
    case 'this-terminal':
      return `a ${h.name} server still running in one of your VS Code terminals`;
    case 'this-project':
      return `an old ${h.name} server from this project`;
    case 'other-project':
      return `a ${h.name} server from ${h.projectName ? `"${h.projectName}"` : 'another project'}`;
    default:
      return `another program (${h.name})`;
  }
}

function protectedNote(h: JamHolder): string {
  return (
    `"${h.name}" is a protected program (system, editor, Docker or WSL), so EnvWizard won't stop it.` +
    (/docker|wsl|vpnkit/i.test(h.name) ? ' Stop the container or the server inside WSL instead.' : '')
  );
}

/**
 * Turns a detected jam into a calm, plain-English toast. Pure: no I/O.
 * `holder` is undefined when nothing is listening on the port any more.
 */
export function buildJamAlert(jam: TerminalJam, holder?: JamHolder, reserved?: WindowsReservedCheckResult): JamAlert {
  const port = jam.port;
  const detail = holder
    ? [holder.summary || holder.name, holder.ownership === 'other-project' && holder.projectName ? `Project: ${holder.projectName}` : '']
        .filter(Boolean)
        .join('\n')
    : undefined;

  if (jam.kind === 'shifted') {
    const moved =
      jam.newPort !== undefined
        ? `🔀 Your app started on port ${jam.newPort} instead of ${port} because ${port} is busy.`
        : `🔀 Your app moved off port ${port} because it is busy.`;
    const risk = ` Login callbacks and CORS settings that expect ${port} may break.`;
    if (!holder || port === undefined) return { message: moved + risk, actions: [] };
    if (holder.isProtected) return { message: `${moved}${risk} ${protectedNote(holder)}`, actions: [] };
    return {
      message: `${moved}${risk} It's held by ${describeHolder(holder)}.`,
      actions: holder.isDatabase ? [DETAILS] : [freeAndRestart(port), DETAILS],
      detail,
    };
  }

  if (port === undefined) {
    return {
      message: "🚦 Port Traffic Jam: your dev server couldn't start because its port is already in use.",
      actions: [SHOW_PORTS],
    };
  }

  if (!holder) {
    if (reserved?.isReserved) {
      return { message: `🚧 Port ${port} isn't jammed: ${reserved.message}`, actions: [] };
    }
    return { message: `🚦 Port ${port} is free now: whatever was holding it has stopped.`, actions: [RERUN] };
  }

  if (holder.isProtected) {
    return { message: `🛡️ Port ${port} is busy. ${protectedNote(holder)}`, actions: [] };
  }

  if (holder.isDatabase) {
    return {
      message: `🚦 Port ${port} jam: a local database (${holder.name}) is using it. Stopping it may interrupt other apps.`,
      actions: [DETAILS],
      detail,
    };
  }

  return {
    message: `🚦 Port ${port} jam: ${describeHolder(holder)} is holding it.`,
    actions: [FREE_AND_RERUN, DETAILS],
    detail,
  };
}

/**
 * F2 safety rule: EnvWizard may free a port without asking only when the holder is an old copy of
 * this project (or runs in one of its terminals), is not protected or a database, and the failed
 * command ran from inside the workspace. Moved ports (Vite/Next still running) always ask.
 */
export function canAutoUnjam(
  jam: TerminalJam,
  holder: JamHolder | undefined,
  commandCwd: string | undefined,
  workspaceFolders: string[]
): boolean {
  return (
    jam.kind === 'blocked' &&
    jam.port !== undefined &&
    !!holder &&
    (holder.ownership === 'this-project' || holder.ownership === 'this-terminal') &&
    !holder.isProtected &&
    !holder.isDatabase &&
    !!commandCwd &&
    workspaceFolders.some((f) => isPathInside(commandCwd, f))
  );
}

export function autoUnjamStatusText(port: number, holder: JamHolder, rerun: boolean): string {
  const who = holder.ownership === 'this-terminal' ? 'a server in another terminal' : 'old copy of this project';
  return `$(zap) Freed :${port} (${who})${rerun ? ' and restarted' : ''}`;
}

/** An auto-restarter (nodemon, --reload) can re-jam forever: auto-unjam a port at most once a minute. */
const AUTO_UNJAM_COOLDOWN_MS = 60_000;

export type JamOutcome = 'freed-rerun' | 'freed' | 'rerun' | 'dismissed' | 'explained' | 'failed';

export interface TerminalAlertDeps {
  services: PortServices;
  workspaceFolders: () => string[];
  /** Refresh the status bar and Dev Deck after a port changes hands. */
  onDidFreePort?: () => unknown;
  isEnabled?: () => boolean;
  checkReserved?: (port: number) => Promise<WindowsReservedCheckResult>;
  /** F2 (Pro, opt-in): free and rerun without asking when `canAutoUnjam` allows it. */
  isAutoUnjamEnabled?: () => Promise<boolean>;
  /** Writes details of automatic actions to the EnvWizard output channel. */
  log?: (line: string) => void;
}

/**
 * F1: watches commands run in the integrated terminal (shell integration) and, when a dev
 * server hits a port jam, offers a 1-click "Free & Rerun" right there. Free tier.
 * F2 (Pro, opt-in): does the same without asking when `canAutoUnjam` allows it.
 * Degrades to nothing when the API or shell integration is unavailable.
 */
export class TerminalJamAlerts implements vscode.Disposable {
  /** Shows the toast. Integration tests replace it to click a button. */
  chooseAction: (alert: JamAlert) => Thenable<string | undefined> = (alert) =>
    vscode.window.showWarningMessage(alert.message, ...alert.actions);

  private readonly disposables: vscode.Disposable[] = [];
  private readonly ended = new WeakSet<vscode.TerminalShellExecution>();
  private readonly endWaiters = new Map<vscode.TerminalShellExecution, () => void>();
  private readonly outcomeListeners: ((outcome: JamOutcome, jam: TerminalJam) => void)[] = [];
  private readonly lastAutoUnjam = new Map<number, number>();

  constructor(private readonly deps: TerminalAlertDeps) {}

  /** Starts listening. Returns false when this editor has no shell-integration API. */
  start(): boolean {
    const win = vscode.window as Partial<typeof vscode.window>;
    if (typeof win.onDidStartTerminalShellExecution !== 'function' || typeof win.onDidEndTerminalShellExecution !== 'function') {
      return false;
    }
    this.disposables.push(
      win.onDidStartTerminalShellExecution((e) => void this.watchExecution(e.terminal, e.execution)),
      win.onDidEndTerminalShellExecution((e) => {
        this.ended.add(e.execution);
        this.endWaiters.get(e.execution)?.();
      })
    );
    return true;
  }

  onDidHandleJam(listener: (outcome: JamOutcome, jam: TerminalJam) => void): vscode.Disposable {
    this.outcomeListeners.push(listener);
    return { dispose: () => this.outcomeListeners.splice(this.outcomeListeners.indexOf(listener) >>> 0, 1) };
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
  }

  private async watchExecution(terminal: vscode.Terminal, execution: vscode.TerminalShellExecution) {
    if (this.deps.isEnabled && !this.deps.isEnabled()) return;
    const detector = new TerminalJamDetector(execution.commandLine.value);
    let jam: TerminalJam | undefined;
    try {
      for await (const chunk of execution.read()) {
        jam = detector.feed(chunk);
        if (jam) break;
      }
      jam ??= detector.flush();
    } catch {
      return; // Terminal closed mid-read
    }
    if (jam) await this.handleJam(jam, terminal, execution);
  }

  /** Public for tests. Shows at most one toast for this execution and acts on the choice. */
  async handleJam(jam: TerminalJam, terminal: vscode.Terminal, execution: vscode.TerminalShellExecution): Promise<JamOutcome> {
    let outcome: JamOutcome = 'failed';
    try {
      outcome = await this.respond(jam, terminal, execution);
    } finally {
      this.outcomeListeners.forEach((l) => l(outcome, jam));
    }
    return outcome;
  }

  private async respond(jam: TerminalJam, terminal: vscode.Terminal, execution: vscode.TerminalShellExecution): Promise<JamOutcome> {
    const holder = jam.port !== undefined ? await this.findHolder(jam.port) : undefined;
    const reserved =
      jam.kind === 'blocked' && jam.port !== undefined && !holder
        ? await (this.deps.checkReserved ?? checkWindowsReservedPort)(jam.port)
        : undefined;

    if (
      holder &&
      // PowerShell leaves execution.cwd undefined; the terminal's current folder is the fallback
      canAutoUnjam(jam, holder, (execution.cwd ?? terminal.shellIntegration?.cwd)?.fsPath, this.deps.workspaceFolders()) &&
      (await this.deps.isAutoUnjamEnabled?.()) &&
      this.claimAutoUnjam(holder.port)
    ) {
      return this.autoUnjam(holder, terminal, execution);
    }

    const alert = buildJamAlert(jam, holder, reserved);

    let choice = await this.chooseAction(alert);
    if (choice === DETAILS) {
      choice = await this.showDetails(jam, alert, holder);
    }

    switch (choice) {
      case SHOW_PORTS:
        await vscode.commands.executeCommand('envwizard.scanPorts');
        return 'explained';
      case RERUN:
        return (await this.rerun(terminal, execution)) ? 'rerun' : 'explained';
      case FREE_AND_RERUN:
        return this.freeAndRerun(jam.port!, terminal, execution, false);
      case freeAndRestart(jam.port ?? -1):
        return this.freeAndRerun(jam.port!, terminal, execution, true);
      default:
        return alert.actions.length === 0 ? 'explained' : 'dismissed';
    }
  }

  private claimAutoUnjam(port: number): boolean {
    const now = Date.now();
    const last = this.lastAutoUnjam.get(port);
    if (last !== undefined && now - last < AUTO_UNJAM_COOLDOWN_MS) {
      this.deps.log?.(`Port ${port} jammed again within a minute (an auto-restarter?), so asking instead of freeing it automatically.`);
      return false;
    }
    this.lastAutoUnjam.set(port, now);
    return true;
  }

  private async autoUnjam(holder: JamHolder, terminal: vscode.Terminal, execution: vscode.TerminalShellExecution): Promise<JamOutcome> {
    this.deps.log?.(
      `${new Date().toLocaleTimeString()} Auto-unjam port ${holder.port}: stopping ${holder.summary || holder.name} ` +
        `(process ${holder.pid}, ${holder.ownership === 'this-terminal' ? 'in a VS Code terminal' : 'from this project'}). ` +
        `Rerunning: ${execution.commandLine.value}`
    );
    const outcome = await this.freeAndRerun(holder.port, terminal, execution, false, true);
    if (outcome === 'freed-rerun' || outcome === 'freed') {
      vscode.window.setStatusBarMessage(autoUnjamStatusText(holder.port, holder, outcome === 'freed-rerun'), 8000);
    }
    this.deps.log?.(`  → ${outcome}. To bring the old server back, run its command again: ${holder.summary || holder.name}`);
    return outcome;
  }

  private async showDetails(jam: TerminalJam, alert: JamAlert, holder?: JamHolder): Promise<string | undefined> {
    const primary = jam.kind === 'shifted' ? freeAndRestart(jam.port!) : FREE_AND_RERUN;
    const dbNote = holder?.isDatabase ? '\n\nHeads-up: this looks like a local database. Stopping it may interrupt other apps.' : '';
    return vscode.window.showWarningMessage(alert.message, { modal: true, detail: (alert.detail || '') + dbNote }, primary);
  }

  private async findHolder(port: number): Promise<JamHolder | undefined> {
    const { scanner, cache, terminator } = this.deps.services;
    const info = await scanner.scanPort(port);
    if (!info) return undefined;
    const details = await cache.get(info.pid);
    const name = details.name || info.processName || 'Unknown';
    const ownership = await classify(details, this.deps.workspaceFolders(), await getTerminalShellPids());
    return {
      port,
      pid: info.pid,
      name,
      ownership,
      projectName: projectNameOf(details),
      summary: summarizeCommand(details),
      isProtected: terminator.isProtected(name, info.pid),
      isDatabase: isDatabaseProcess(name),
    };
  }

  private async freeAndRerun(
    port: number,
    terminal: vscode.Terminal,
    execution: vscode.TerminalShellExecution,
    restart: boolean,
    quiet = false
  ): Promise<JamOutcome> {
    // The failed (or shifted) command must be gone before it can run again
    if (restart) sendCtrlCToTerminal(terminal);
    if (!(await this.waitForEnd(execution, restart ? 5000 : 3000))) {
      // e.g. nodemon "app crashed - waiting for file changes"
      sendCtrlCToTerminal(terminal);
      await this.waitForEnd(execution, 3000);
    }

    try {
      const res = quiet
        ? await politeUnjamPort(port, this.deps.services)
        : await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Freeing port ${port}…` },
            () => politeUnjamPort(port, this.deps.services)
          );
      await this.deps.onDidFreePort?.();
      if (!res.success) {
        vscode.window.showErrorMessage(`❌ ${res.message}`);
        return 'failed';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof SafetyShieldError) vscode.window.showWarningMessage(`🛡️ ${msg}`);
      else vscode.window.showErrorMessage(`❌ Couldn't free port ${port}: ${msg}`);
      return 'failed';
    }

    return (await this.rerun(terminal, execution, port, quiet)) ? 'freed-rerun' : 'freed';
  }

  /**
   * Runs the command again in its own terminal, but only when VS Code is confident it knows
   * the exact command line. Otherwise asks the user to press ↑ and Enter.
   */
  private async rerun(
    terminal: vscode.Terminal,
    execution: vscode.TerminalShellExecution,
    freedPort?: number,
    quiet = false
  ): Promise<boolean> {
    const freed = freedPort !== undefined ? `✨ Port ${freedPort} is free. ` : '';
    const { value, confidence } = execution.commandLine;
    const ended = this.ended.has(execution) || (await this.waitForEnd(execution, 3000));
    if (
      !ended ||
      !value.trim() ||
      confidence === vscode.TerminalShellExecutionCommandLineConfidence.Low ||
      !terminal.shellIntegration ||
      terminal.exitStatus
    ) {
      vscode.window.showInformationMessage(`${freed}Press ↑ and Enter in the terminal to run it again.`);
      return false;
    }
    terminal.show(true);
    terminal.shellIntegration.executeCommand(value);
    if (!quiet) vscode.window.showInformationMessage(`${freed}Running \`${value}\` again.`);
    return true;
  }

  private waitForEnd(execution: vscode.TerminalShellExecution, timeoutMs: number): Promise<boolean> {
    if (this.ended.has(execution)) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.endWaiters.delete(execution);
        resolve(false);
      }, timeoutMs);
      this.endWaiters.set(execution, () => {
        clearTimeout(timer);
        this.endWaiters.delete(execution);
        resolve(true);
      });
    });
  }
}
