import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

vi.mock('../src/extension/terminalShutdown.js', () => ({
  politeUnjamPort: vi.fn(),
  sendCtrlCToTerminal: vi.fn(),
}));

import { politeUnjamPort, sendCtrlCToTerminal } from '../src/extension/terminalShutdown.js';
import {
  buildJamAlert,
  projectNameOf,
  JamHolder,
  TerminalJamAlerts,
  FREE_AND_RERUN,
  RERUN,
  DETAILS,
  SHOW_PORTS,
  freeAndRestart,
  canAutoUnjam,
  autoUnjamStatusText,
} from '../src/extension/terminalAlert.js';
import { TerminalJam } from '../src/core/TerminalJamDetector.js';
import { PortServices } from '../src/extension/actions.js';

const win = vscode.window as unknown as Record<string, unknown>;

const blocked: TerminalJam = { kind: 'blocked', tool: 'Node.js', port: 3000, line: 'Error: listen EADDRINUSE :::3000' };

function holder(overrides: Partial<JamHolder> = {}): JamHolder {
  return {
    port: 3000,
    pid: 4242,
    name: 'node',
    ownership: 'other-project',
    projectName: 'other-app',
    summary: 'node server.js',
    isProtected: false,
    isDatabase: false,
    ...overrides,
  };
}

describe('buildJamAlert', () => {
  it('names the other project holding the port and offers Free & Rerun', () => {
    const alert = buildJamAlert(blocked, holder());
    expect(alert.message).toBe('🚦 Port 3000 jam: a node server from "other-app" is holding it.');
    expect(alert.actions).toEqual([FREE_AND_RERUN, DETAILS]);
    expect(alert.detail).toContain('node server.js');
  });

  it('describes each kind of owner in plain English', () => {
    expect(buildJamAlert(blocked, holder({ ownership: 'this-project' })).message).toContain('an old node server from this project');
    expect(buildJamAlert(blocked, holder({ ownership: 'this-terminal' })).message).toContain('one of your VS Code terminals');
    expect(buildJamAlert(blocked, holder({ ownership: 'unknown' })).message).toContain('another program (node)');
    expect(buildJamAlert(blocked, holder({ projectName: undefined })).message).toContain('from another project');
  });

  it('never offers a fix for protected programs and hints at Docker', () => {
    const alert = buildJamAlert(blocked, holder({ name: 'com.docker.backend', isProtected: true }));
    expect(alert.actions).toEqual([]);
    expect(alert.message).toMatch(/protected program.*won't stop it/);
    expect(alert.message).toContain('Stop the container');
  });

  it('asks for a confirmation dialog before stopping a database', () => {
    const alert = buildJamAlert(blocked, holder({ name: 'postgres', isDatabase: true }));
    expect(alert.actions).toEqual([DETAILS]);
    expect(alert.message).toContain('local database');
  });

  it('explains Windows reserved ports instead of offering a fix', () => {
    const alert = buildJamAlert({ ...blocked, mayBeWindowsReserved: true }, undefined, {
      isReserved: true,
      message: 'Windows has reserved ports 2869–2968 for Hyper-V/WSL/Docker. Nothing to stop.',
    });
    expect(alert.actions).toEqual([]);
    expect(alert.message).toContain("Port 3000 isn't jammed");
  });

  it('offers a plain rerun when the holder already exited', () => {
    const alert = buildJamAlert(blocked, undefined, { isReserved: false });
    expect(alert.actions).toEqual([RERUN]);
  });

  it('points to the port list when the port is unknown', () => {
    const alert = buildJamAlert({ kind: 'blocked', tool: 'unknown', line: 'address already in use' });
    expect(alert.actions).toEqual([SHOW_PORTS]);
  });

  it('warns about shifted ports (Next.js) and offers Free & Restart', () => {
    const alert = buildJamAlert({ kind: 'shifted', tool: 'Next.js', port: 3000, newPort: 3001, line: '' }, holder());
    expect(alert.message).toContain('started on port 3001 instead of 3000');
    expect(alert.message).toContain('Login callbacks and CORS');
    expect(alert.actions).toEqual([freeAndRestart(3000), DETAILS]);
  });

  it('handles Vite shifts where the new port is not stated', () => {
    const alert = buildJamAlert({ kind: 'shifted', tool: 'Vite', port: 5173, line: '' }, undefined);
    expect(alert.message).toContain('moved off port 5173');
    expect(alert.actions).toEqual([]);
  });

  it('never surfaces raw PIDs or socket constants in the toast', () => {
    const alert = buildJamAlert(blocked, holder());
    expect(alert.message).not.toMatch(/4242|EADDRINUSE|SIG(TERM|KILL)/);
  });
});

describe('projectNameOf', () => {
  it('uses the cwd folder name', () => {
    expect(projectNameOf({ pid: 1, name: 'node', cwd: '/home/me/code/other-app' }, 'linux')).toBe('other-app');
  });

  it('falls back to a script path in the command line', () => {
    expect(projectNameOf({ pid: 1, name: 'node', commandLine: '"C:\\Program Files\\nodejs\\node.exe" C:\\work\\shop\\server.js' }, 'win32')).toBe('shop');
  });

  it('cuts node_modules paths at the project root', () => {
    expect(
      projectNameOf({ pid: 1, name: 'node', commandLine: 'node C:\\work\\blog\\node_modules\\vite\\bin\\vite.js' }, 'win32')
    ).toBe('blog');
  });

  it('returns undefined when nothing useful is known', () => {
    expect(projectNameOf({ pid: 1, name: 'node' }, 'linux')).toBeUndefined();
  });
});

describe('TerminalJamAlerts', () => {
  let executeCommand: ReturnType<typeof vi.fn>;
  let showInfo: ReturnType<typeof vi.fn>;

  function fakeTerminal(): vscode.Terminal {
    executeCommand = vi.fn();
    return {
      processId: Promise.resolve(777),
      shellIntegration: { executeCommand },
      exitStatus: undefined,
      show: vi.fn(),
      sendText: vi.fn(),
    } as unknown as vscode.Terminal;
  }

  function fakeExecution(confidence = vscode.TerminalShellExecutionCommandLineConfidence.High) {
    return { commandLine: { value: 'npm run dev', confidence, isTrusted: true } } as unknown as vscode.TerminalShellExecution;
  }

  function fakeServices(listening = true): PortServices {
    return {
      scanner: { scanPort: vi.fn().mockResolvedValue(listening ? { port: 3000, pid: 4242 } : undefined) },
      cache: { get: vi.fn().mockResolvedValue({ pid: 4242, name: 'node', cwd: '/elsewhere/other-app' }) },
      terminator: { isProtected: vi.fn().mockReturnValue(false) },
    } as unknown as PortServices;
  }

  function alertsFor(services: PortServices, choice: string | undefined) {
    const alerts = new TerminalJamAlerts({ services, workspaceFolders: () => ['/work/my-app'], checkReserved: async () => ({ isReserved: false }) });
    alerts.chooseAction = vi.fn().mockResolvedValue(choice);
    return alerts;
  }

  beforeEach(() => {
    vi.mocked(politeUnjamPort).mockReset();
    vi.mocked(sendCtrlCToTerminal).mockReset();
    showInfo = vi.fn();
    win.showInformationMessage = showInfo;
    win.showWarningMessage = vi.fn();
    win.showErrorMessage = vi.fn();
    win.withProgress = (_opts: unknown, task: () => Promise<unknown>) => task();
    win.terminals = [];
  });

  it('frees the port and reruns the same command on "Free & Rerun"', async () => {
    vi.mocked(politeUnjamPort).mockResolvedValue({ success: true, port: 3000, pid: 4242, message: 'ok', graceful: true });
    const services = fakeServices();
    const onFree = vi.fn();
    const alerts = new TerminalJamAlerts({ services, workspaceFolders: () => ['/work/my-app'], onDidFreePort: onFree });
    alerts.chooseAction = vi.fn().mockResolvedValue(FREE_AND_RERUN);
    const terminal = fakeTerminal();
    const execution = fakeExecution();
    markEnded(alerts, execution);

    const outcome = await alerts.handleJam(blocked, terminal, execution);

    expect(outcome).toBe('freed-rerun');
    expect(politeUnjamPort).toHaveBeenCalledWith(3000, services);
    expect(onFree).toHaveBeenCalled();
    expect(executeCommand).toHaveBeenCalledWith('npm run dev');
    expect(showInfo).toHaveBeenCalledWith('✨ Port 3000 is free. Running `npm run dev` again.');
  });

  it('asks the user to press ↑ when the command line is uncertain', async () => {
    vi.mocked(politeUnjamPort).mockResolvedValue({ success: true, port: 3000, pid: 4242, message: 'ok', graceful: true });
    const alerts = alertsFor(fakeServices(), FREE_AND_RERUN);
    const terminal = fakeTerminal();
    const execution = fakeExecution(vscode.TerminalShellExecutionCommandLineConfidence.Low);
    markEnded(alerts, execution);

    expect(await alerts.handleJam(blocked, terminal, execution)).toBe('freed');
    expect(executeCommand).not.toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith('✨ Port 3000 is free. Press ↑ and Enter in the terminal to run it again.');
  });

  it('does nothing when the toast is dismissed', async () => {
    const alerts = alertsFor(fakeServices(), undefined);
    const terminal = fakeTerminal();
    expect(await alerts.handleJam(blocked, terminal, fakeExecution())).toBe('dismissed');
    expect(politeUnjamPort).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('does not rerun when freeing the port fails', async () => {
    vi.mocked(politeUnjamPort).mockResolvedValue({ success: false, port: 3000, pid: 4242, message: 'refused', graceful: false });
    const alerts = alertsFor(fakeServices(), FREE_AND_RERUN);
    const terminal = fakeTerminal();
    const execution = fakeExecution();
    markEnded(alerts, execution);

    expect(await alerts.handleJam(blocked, terminal, execution)).toBe('failed');
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('stops the shifted run with Ctrl+C before freeing the original port', async () => {
    vi.mocked(politeUnjamPort).mockResolvedValue({ success: true, port: 3000, pid: 4242, message: 'ok', graceful: true });
    const alerts = alertsFor(fakeServices(), freeAndRestart(3000));
    const terminal = fakeTerminal();
    const execution = fakeExecution();
    markEnded(alerts, execution);

    const shifted: TerminalJam = { kind: 'shifted', tool: 'Next.js', port: 3000, newPort: 3001, line: '' };
    expect(await alerts.handleJam(shifted, terminal, execution)).toBe('freed-rerun');
    expect(sendCtrlCToTerminal).toHaveBeenCalledWith(terminal);
    expect(vi.mocked(sendCtrlCToTerminal).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(politeUnjamPort).mock.invocationCallOrder[0]);
  });

  it('reports each outcome to listeners', async () => {
    const alerts = alertsFor(fakeServices(), undefined);
    const seen: string[] = [];
    alerts.onDidHandleJam((o) => seen.push(o));
    await alerts.handleJam(blocked, fakeTerminal(), fakeExecution());
    expect(seen).toEqual(['dismissed']);
  });

  it('stays off when the editor has no shell-integration API', () => {
    const alerts = alertsFor(fakeServices(), undefined);
    expect(alerts.start()).toBe(false);
  });

  it('feeds terminal output to the detector and shows one toast per command', async () => {
    let onStart: ((e: unknown) => void) | undefined;
    win.onDidStartTerminalShellExecution = (l: (e: unknown) => void) => ((onStart = l), { dispose() {} });
    win.onDidEndTerminalShellExecution = () => ({ dispose() {} });
    const alerts = alertsFor(fakeServices(), undefined);
    expect(alerts.start()).toBe(true);

    const handled = new Promise<string>((resolve) => alerts.onDidHandleJam((o) => resolve(o)));
    async function* read() {
      yield '> dev\r\n\x1b[31mError: listen EADDRINUSE: address';
      yield ' already in use :::3000\x1b[0m\r\n';
      yield 'Error: listen EADDRINUSE: address already in use :::3000\r\n';
    }
    onStart!({ terminal: fakeTerminal(), execution: { ...fakeExecution(), read } });

    expect(await handled).toBe('dismissed');
    expect(alerts.chooseAction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(alerts.chooseAction).mock.calls[0][0].message).toContain('Port 3000 jam');
    delete win.onDidStartTerminalShellExecution;
    delete win.onDidEndTerminalShellExecution;
  });
});

function markEnded(alerts: TerminalJamAlerts, execution: vscode.TerminalShellExecution) {
  (alerts as unknown as { ended: WeakSet<object> }).ended.add(execution);
}

describe('canAutoUnjam (F2 safety rule)', () => {
  const ws = ['/work/my-app'];
  const mine = holder({ ownership: 'this-project', projectName: 'my-app' });

  it('allows an old copy of this project when the command ran in the workspace', () => {
    expect(canAutoUnjam(blocked, mine, '/work/my-app', ws)).toBe(true);
    expect(canAutoUnjam(blocked, holder({ ownership: 'this-terminal' }), '/work/my-app/packages/web', ws)).toBe(true);
  });

  it.each([
    ['another project', holder({ ownership: 'other-project' })],
    ['an unknown program', holder({ ownership: 'unknown' })],
    ['a protected program', holder({ ownership: 'this-project', isProtected: true })],
    ['a database', holder({ ownership: 'this-project', isDatabase: true })],
  ])('never touches %s', (_name, h) => {
    expect(canAutoUnjam(blocked, h, '/work/my-app', ws)).toBe(false);
  });

  it('asks when the command ran outside the workspace or its folder is unknown', () => {
    expect(canAutoUnjam(blocked, mine, '/elsewhere', ws)).toBe(false);
    expect(canAutoUnjam(blocked, mine, undefined, ws)).toBe(false);
  });

  it('asks for moved ports and unknown ports', () => {
    expect(canAutoUnjam({ ...blocked, kind: 'shifted', newPort: 3001 }, mine, '/work/my-app', ws)).toBe(false);
    expect(canAutoUnjam({ ...blocked, port: undefined }, mine, '/work/my-app', ws)).toBe(false);
    expect(canAutoUnjam(blocked, undefined, '/work/my-app', ws)).toBe(false);
  });

  it('words the status bar note calmly', () => {
    expect(autoUnjamStatusText(3000, mine, true)).toBe('$(zap) Freed :3000 (old copy of this project) and restarted');
    expect(autoUnjamStatusText(3000, holder({ ownership: 'this-terminal' }), false)).toBe('$(zap) Freed :3000 (a server in another terminal)');
  });
});

describe('TerminalJamAlerts auto-unjam (F2)', () => {
  let executeCommand: ReturnType<typeof vi.fn>;
  let setStatus: ReturnType<typeof vi.fn>;

  const terminal = () => {
    executeCommand = vi.fn();
    return { shellIntegration: { executeCommand }, exitStatus: undefined, show: vi.fn(), sendText: vi.fn() } as unknown as vscode.Terminal;
  };
  const execution = (cwd = '/work/my-app') =>
    ({
      cwd: { fsPath: cwd },
      commandLine: { value: 'npm run dev', confidence: vscode.TerminalShellExecutionCommandLineConfidence.High, isTrusted: true },
    }) as unknown as vscode.TerminalShellExecution;

  function setup(opts: { holderCwd?: string; holderName?: string; enabled?: boolean } = {}) {
    const services = {
      scanner: { scanPort: vi.fn().mockResolvedValue({ port: 3000, pid: 4242 }) },
      cache: { get: vi.fn().mockResolvedValue({ pid: 4242, name: opts.holderName ?? 'node', cwd: opts.holderCwd ?? '/work/my-app' }) },
      terminator: { isProtected: vi.fn().mockReturnValue(false) },
    } as unknown as PortServices;
    const isAutoUnjamEnabled = vi.fn().mockResolvedValue(opts.enabled ?? true);
    const log = vi.fn();
    const alerts = new TerminalJamAlerts({ services, workspaceFolders: () => ['/work/my-app'], isAutoUnjamEnabled, log });
    alerts.chooseAction = vi.fn().mockResolvedValue(undefined);
    return { alerts, isAutoUnjamEnabled, log };
  }

  async function jamOnce(alerts: TerminalJamAlerts, exec = execution()) {
    markEnded(alerts, exec);
    return alerts.handleJam(blocked, terminal(), exec);
  }

  beforeEach(() => {
    vi.mocked(politeUnjamPort).mockReset();
    vi.mocked(politeUnjamPort).mockResolvedValue({ success: true, port: 3000, pid: 4242, message: 'ok', graceful: true });
    setStatus = vi.fn();
    win.setStatusBarMessage = setStatus;
    win.showInformationMessage = vi.fn();
    win.withProgress = vi.fn((_o: unknown, task: () => Promise<unknown>) => task());
    win.terminals = [];
  });

  it('frees and reruns an old copy of this project without asking', async () => {
    const { alerts, log } = setup();
    expect(await jamOnce(alerts)).toBe('freed-rerun');
    expect(alerts.chooseAction).not.toHaveBeenCalled();
    expect(executeCommand).toHaveBeenCalledWith('npm run dev');
    expect(setStatus).toHaveBeenCalledWith('$(zap) Freed :3000 (old copy of this project) and restarted', 8000);
    // Quiet: no progress notification or toast
    expect(win.withProgress).not.toHaveBeenCalled();
    expect(win.showInformationMessage).not.toHaveBeenCalled();
    expect(log.mock.calls.join('\n')).toContain('Auto-unjam port 3000');
  });

  it('shows the toast and does not even check Pro for another project', async () => {
    const { alerts, isAutoUnjamEnabled } = setup({ holderCwd: '/elsewhere/other-app' });
    expect(await jamOnce(alerts)).toBe('dismissed');
    expect(isAutoUnjamEnabled).not.toHaveBeenCalled();
    expect(alerts.chooseAction).toHaveBeenCalledTimes(1);
    expect(politeUnjamPort).not.toHaveBeenCalled();
  });

  it('shows the toast for a database in this project', async () => {
    const { alerts } = setup({ holderName: 'postgres' });
    await jamOnce(alerts);
    expect(alerts.chooseAction).toHaveBeenCalledTimes(1);
    expect(politeUnjamPort).not.toHaveBeenCalled();
  });

  it('shows the toast when auto-unjam is off or not licensed', async () => {
    const { alerts } = setup({ enabled: false });
    expect(await jamOnce(alerts)).toBe('dismissed');
    expect(alerts.chooseAction).toHaveBeenCalledTimes(1);
    expect(politeUnjamPort).not.toHaveBeenCalled();
  });

  it("uses the terminal's folder when the shell doesn't report the command's (PowerShell)", async () => {
    const { alerts } = setup();
    const exec = { ...execution(), cwd: undefined } as unknown as vscode.TerminalShellExecution;
    const term = terminal() as unknown as { shellIntegration: Record<string, unknown> };
    term.shellIntegration.cwd = { fsPath: '/work/my-app' };
    markEnded(alerts, exec);
    expect(await alerts.handleJam(blocked, term as unknown as vscode.Terminal, exec)).toBe('freed-rerun');
    expect(alerts.chooseAction).not.toHaveBeenCalled();
  });

  it('shows the toast when no folder is known at all', async () => {
    const { alerts } = setup();
    const exec = { ...execution(), cwd: undefined } as unknown as vscode.TerminalShellExecution;
    markEnded(alerts, exec);
    await alerts.handleJam(blocked, terminal(), exec);
    expect(alerts.chooseAction).toHaveBeenCalledTimes(1);
  });

  it('shows the toast when the command ran outside the workspace', async () => {
    const { alerts } = setup();
    await jamOnce(alerts, execution('/tmp/scratch'));
    expect(alerts.chooseAction).toHaveBeenCalledTimes(1);
  });

  it('asks instead of looping when the same port jams again within a minute', async () => {
    const { alerts, log } = setup();
    expect(await jamOnce(alerts)).toBe('freed-rerun');
    expect(await jamOnce(alerts)).toBe('dismissed');
    expect(alerts.chooseAction).toHaveBeenCalledTimes(1);
    expect(politeUnjamPort).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.join('\n')).toContain('jammed again within a minute');
  });
});
