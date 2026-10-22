import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

vi.mock('../src/extension/terminalShutdown.js', () => ({ politeUnjamPort: vi.fn() }));

import { politeUnjamPort } from '../src/extension/terminalShutdown.js';
import { OwnedPort, PortServices, buildCleanSlatePicks, cleanSlate } from '../src/extension/actions.js';

const win = vscode.window as unknown as Record<string, unknown>;
const ws = vscode.workspace as unknown as Record<string, unknown>;

function owned(port: number, overrides: Partial<OwnedPort> = {}): OwnedPort {
  return {
    port,
    pid: port + 10000,
    protocol: 'TCP',
    state: 'LISTENING',
    processName: 'node',
    isProtected: false,
    isDatabase: false,
    ownership: 'this-project',
    ...overrides,
  };
}

describe('buildCleanSlatePicks (F3)', () => {
  it('pre-checks this project and its terminals, leaves other projects unchecked', () => {
    const { items } = buildCleanSlatePicks([
      owned(3000, { ownership: 'this-project', summary: 'node next dev' }),
      owned(5173, { ownership: 'this-terminal' }),
      owned(8000, { ownership: 'other-project', projectName: 'shop' }),
      owned(4000, { ownership: 'unknown' }),
    ]);
    const rows = items.filter((i) => i.port !== undefined);
    expect(rows.map((i) => [i.port, i.picked, i.description])).toEqual([
      [3000, true, 'this project'],
      [5173, true, 'running in a VS Code terminal'],
      [8000, false, 'project "shop"'],
      [4000, false, 'unknown project'],
    ]);
    expect(rows[0].detail).toBe('node next dev');
    expect(items.filter((i) => i.kind === vscode.QuickPickItemKind.Separator).map((i) => i.label)).toEqual([
      'This project',
      'Other projects (not selected)',
    ]);
  });

  it('never offers databases or protected programs, even from this project', () => {
    const { items, leftAlone } = buildCleanSlatePicks([
      owned(5432, { processName: 'postgres', isDatabase: true }),
      owned(2375, { processName: 'com.docker.backend', isProtected: true }),
      owned(3000),
    ]);
    expect(items.filter((i) => i.port !== undefined).map((i) => i.port)).toEqual([3000]);
    expect(leftAlone.map((p) => p.port)).toEqual([5432, 2375]);
  });

  it('has no separators for empty groups', () => {
    const { items } = buildCleanSlatePicks([owned(8000, { ownership: 'other-project' })]);
    expect(items[0]).toMatchObject({ label: 'Other projects (not selected)' });
    expect(items).toHaveLength(2);
  });
});

describe('cleanSlate', () => {
  let showQuickPick: ReturnType<typeof vi.fn>;

  function services(ports: { port: number; pid: number; name: string; cwd?: string }[]): PortServices {
    return {
      scanner: {
        lastScanOk: true,
        scanDevPorts: vi.fn().mockResolvedValue(ports.map((p) => ({ port: p.port, pid: p.pid, protocol: 'TCP', state: 'LISTENING' }))),
      },
      cache: {
        get: vi.fn(async (pid: number) => {
          const p = ports.find((x) => x.pid === pid)!;
          return { pid, name: p.name, cwd: p.cwd };
        }),
        retain: vi.fn(),
        forget: vi.fn(),
      },
      terminator: { isProtected: vi.fn((name: string) => name === 'docker') },
    } as unknown as PortServices;
  }

  beforeEach(() => {
    vi.mocked(politeUnjamPort).mockReset();
    vi.mocked(politeUnjamPort).mockImplementation(async (port) => ({ success: true, port, pid: 1, message: 'ok', graceful: true }));
    showQuickPick = vi.fn();
    win.showQuickPick = showQuickPick;
    win.showInformationMessage = vi.fn();
    win.showWarningMessage = vi.fn();
    win.withProgress = (_o: unknown, task: () => Promise<unknown>) => task();
    win.terminals = [];
    ws.workspaceFolders = [{ uri: { fsPath: '/work/my-app' } }];
  });

  const mixed = [
    { port: 3000, pid: 1, name: 'node', cwd: '/work/my-app' },
    { port: 8000, pid: 2, name: 'python', cwd: '/work/shop' },
    { port: 5432, pid: 3, name: 'postgres', cwd: '/work/my-app' },
  ];

  it('stops only what the user picks', async () => {
    showQuickPick.mockImplementation(async (items: { port?: number; picked?: boolean }[]) => items.filter((i) => i.picked));
    await cleanSlate(services(mixed));

    const [items, options] = showQuickPick.mock.calls[0];
    expect(options).toMatchObject({ canPickMany: true });
    expect(options.placeHolder).toContain(':5432 postgres (database)');
    expect(items.some((i: { port?: number }) => i.port === 5432)).toBe(false);
    expect(vi.mocked(politeUnjamPort).mock.calls.map((c) => c[0])).toEqual([3000]);
    expect(win.showInformationMessage).toHaveBeenCalledWith('🧹 Clean slate! Freed 1 port.');
  });

  it('stops nothing when the picker is cancelled', async () => {
    showQuickPick.mockResolvedValue(undefined);
    await cleanSlate(services(mixed));
    expect(politeUnjamPort).not.toHaveBeenCalled();
  });

  it("doesn't open the picker when only databases and protected programs are running", async () => {
    await cleanSlate(
      services([
        { port: 5432, pid: 3, name: 'postgres' },
        { port: 2375, pid: 4, name: 'docker' },
      ])
    );
    expect(showQuickPick).not.toHaveBeenCalled();
    expect(win.showInformationMessage).toHaveBeenCalledWith(
      '✨ No dev servers to stop. Left alone: :5432 postgres (database), :2375 docker (protected).'
    );
  });
});
