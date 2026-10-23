import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { EnvSnapshots, SNAPSHOT_KEY_SECRET, describeAge, isEnvFileName } from '../src/extension/snapshots.js';

const win = vscode.window as unknown as Record<string, unknown>;
const ws = vscode.workspace as unknown as Record<string, unknown>;
const cmds = vscode.commands as unknown as Record<string, unknown>;

let tmp: string;
let root: string;
let envPath: string;
let secrets: Map<string, string>;

function create(enabled = true) {
  const store = vi.fn(async (k: string, v: string) => void secrets.set(k, v));
  const snaps = new EnvSnapshots({
    secrets: { get: async (k: string) => secrets.get(k), store, delete: vi.fn(), onDidChange: vi.fn() } as unknown as vscode.SecretStorage,
    storageDir: path.join(tmp, 'storage'),
    isEnabled: async () => enabled,
  });
  return { snaps, store };
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'envwizard-snapext-'));
  root = path.join(tmp, 'project');
  fs.mkdirSync(root);
  envPath = path.join(root, '.env');
  secrets = new Map();
  ws.getWorkspaceFolder = () => ({ uri: { fsPath: root } });
  ws.textDocuments = [];
  win.showInformationMessage = vi.fn();
  win.showWarningMessage = vi.fn();
  win.showErrorMessage = vi.fn();
  win.showTextDocument = vi.fn();
  cmds.executeCommand = vi.fn();
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('snapshot key', () => {
  it('is created once, kept in secret storage, and reused', async () => {
    const { snaps, store } = create();
    const key = await snaps.getKey();
    expect(key).toHaveLength(32);
    expect(secrets.get(SNAPSHOT_KEY_SECRET)).toBe(key.toString('base64'));
    expect((await create().snaps.getKey()).equals(key)).toBe(true);
    expect(store).toHaveBeenCalledTimes(1);
  });
});

describe('beforeEnvWrite', () => {
  it('snapshots the current file when enabled', async () => {
    fs.writeFileSync(envPath, 'A=1\n');
    const { snaps } = create(true);
    await snaps.beforeEnvWrite(envPath);
    expect(snaps.store.list(root, envPath)).toHaveLength(1);
  });

  it('does nothing (and creates no key) when off or unlicensed', async () => {
    fs.writeFileSync(envPath, 'A=1\n');
    const { snaps } = create(false);
    await snaps.beforeEnvWrite(envPath);
    expect(snaps.store.list(root, envPath)).toHaveLength(0);
    expect(secrets.size).toBe(0);
  });
});

describe('restore', () => {
  async function withSnapshot(content: string) {
    const { snaps } = create();
    await snaps.store.save(root, envPath, content);
    return snaps;
  }
  const pickFirst = () => (win.showQuickPick = vi.fn(async (items: unknown[]) => items[0]));

  it('previews the difference in memory, then restores and keeps the current version', async () => {
    const snaps = await withSnapshot('SECRET=old\n');
    fs.writeFileSync(envPath, 'SECRET=broken\n');
    pickFirst();
    win.showWarningMessage = vi.fn().mockResolvedValue('Restore');

    await snaps.restore(root);

    // Preview: a diff of an in-memory document against the real file
    const [cmd, left, right] = vi.mocked(cmds.executeCommand as (...a: unknown[]) => unknown).mock.calls[0] as [string, vscode.Uri, vscode.Uri];
    expect(cmd).toBe('vscode.diff');
    expect(left.scheme).toBe('envwizard-snapshot');
    expect(snaps.provideTextDocumentContent(left)).toBe('SECRET=old\n');
    expect(right.fsPath).toBe(envPath);

    expect(fs.readFileSync(envPath, 'utf8')).toBe('SECRET=old\n');
    // The broken version was kept, so the restore can be undone
    const kept = await Promise.all(snaps.store.list(root, envPath).map((i) => snaps.store.read(i)));
    expect(kept).toContain('SECRET=broken\n');
  });

  it('changes nothing when the user does not confirm', async () => {
    const snaps = await withSnapshot('SECRET=old\n');
    fs.writeFileSync(envPath, 'SECRET=new\n');
    pickFirst();
    await snaps.restore(root);
    expect(fs.readFileSync(envPath, 'utf8')).toBe('SECRET=new\n');
  });

  it('refuses to overwrite unsaved edits', async () => {
    const snaps = await withSnapshot('SECRET=old\n');
    fs.writeFileSync(envPath, 'SECRET=new\n');
    pickFirst();
    win.showWarningMessage = vi.fn().mockResolvedValueOnce('Restore');
    ws.textDocuments = [{ uri: { scheme: 'file', fsPath: envPath }, isDirty: true }];
    await snaps.restore(root);
    expect(fs.readFileSync(envPath, 'utf8')).toBe('SECRET=new\n');
    expect(vi.mocked(win.showWarningMessage as (...a: unknown[]) => unknown).mock.calls[1][0]).toContain('unsaved changes');
  });

  it('says so when the snapshot matches the file', async () => {
    const snaps = await withSnapshot('A=1\n');
    fs.writeFileSync(envPath, 'A=1\n');
    pickFirst();
    await snaps.restore(root);
    expect(win.showInformationMessage).toHaveBeenCalledWith('✅ .env already matches that snapshot.');
    expect(cmds.executeCommand).not.toHaveBeenCalled();
  });

  it('explains when a snapshot was made with another key', async () => {
    await withSnapshot('A=1\n');
    secrets.clear();
    const fresh = create().snaps;
    pickFirst();
    await fresh.restore(root);
    expect(vi.mocked(win.showErrorMessage as (...a: unknown[]) => unknown).mock.calls[0][0]).toMatch(/different key/);
  });

  it('points free users to the setting when there are no snapshots', async () => {
    await create(false).snaps.restore(root);
    expect(vi.mocked(win.showInformationMessage as (...a: unknown[]) => unknown).mock.calls[0][0]).toContain('envwizard.snapshots');
  });
});

describe('helpers', () => {
  it('recognizes env file names', () => {
    for (const name of ['.env', '.env.local', '.env.development.local', '.env.example']) expect(isEnvFileName(name)).toBe(true);
    for (const name of ['env', '.envrc', 'app.env', '.environment']) expect(isEnvFileName(name)).toBe(false);
  });

  it('describes ages in plain words', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    expect(describeAge(new Date('2026-10-23T11:59:40Z'), now)).toBe('just now');
    expect(describeAge(new Date('2026-10-23T11:45:00Z'), now)).toBe('15 min ago');
    expect(describeAge(new Date('2026-10-23T09:00:00Z'), now)).toBe('3 hours ago');
    expect(describeAge(new Date('2026-10-21T12:00:00Z'), now)).toBe('2 days ago');
  });
});
