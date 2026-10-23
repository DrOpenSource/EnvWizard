import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { EnvHealer } from '../src/core/EnvHealer.js';
import { EnvWatcher, missingKeysMessage } from '../src/extension/envWatcher.js';

const win = vscode.window as unknown as Record<string, unknown>;
const ws = vscode.workspace as unknown as Record<string, unknown>;

let root: string;
const write = (rel: string, content: string) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'envwizard-watch-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('EnvHealer.findMissingKeysInFile', () => {
  const healer = new EnvHealer();
  const keys = (file: string, code: string) => healer.findMissingKeysInFile(root, file, code).map((m) => m.key);

  it('checks only the env files the saved file can see (its folder and parents)', () => {
    write('.env', 'ROOT_KEY=1\n');
    write('apps/web/.env.local', 'WEB_KEY=2\n');
    write('apps/api/.env', 'API_KEY=3\n');
    const file = write('apps/web/src/page.ts', '');
    expect(keys(file, 'process.env.ROOT_KEY; process.env.WEB_KEY; process.env.API_KEY; process.env.NEW_KEY')).toEqual([
      'API_KEY',
      'NEW_KEY',
    ]);
  });

  it('counts blank placeholders as defined and ignores runtime keys', () => {
    write('.env', 'PLACEHOLDER=\n');
    const file = write('src/a.ts', '');
    expect(keys(file, 'process.env.PLACEHOLDER; process.env.NODE_ENV; process.env.PORT')).toEqual([]);
  });

  it('suggests values from .env.example', () => {
    write('.env.example', 'STRIPE_KEY=sk_test_xxx\n');
    const file = write('src/pay.ts', '');
    expect(healer.findMissingKeysInFile(root, file, 'process.env.STRIPE_KEY')).toEqual([
      { key: 'STRIPE_KEY', suggestedValue: 'sk_test_xxx' },
    ]);
  });

  it('ignores files outside the workspace, in node_modules, hidden folders, or not code', () => {
    const code = 'process.env.SECRET';
    expect(healer.findMissingKeysInFile(root, path.join(os.tmpdir(), 'elsewhere.ts'), code)).toEqual([]);
    expect(keys(write('node_modules/pkg/index.js', ''), code)).toEqual([]);
    expect(keys(write('.vscode/x.js', ''), code)).toEqual([]);
    expect(keys(write('notes.md', ''), code)).toEqual([]);
    expect(keys(write('types.d.ts', ''), code)).toEqual([]);
  });
});

describe('EnvWatcher (F4)', () => {
  let badge: { text: string; show: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn>; dispose: () => void };

  function watcher(enabled = true, choice?: string) {
    const beforeEnvWrite = vi.fn(async (envPath: string) => {
      order.push(`snapshot:${path.basename(envPath)}`);
    });
    const w = new EnvWatcher({ healer: new EnvHealer(), isEnabled: async () => enabled, beforeEnvWrite, debounceMs: 10 });
    w.chooseAction = vi.fn().mockResolvedValue(choice);
    return { w, beforeEnvWrite };
  }
  let order: string[];

  beforeEach(() => {
    order = [];
    badge = { text: '', show: vi.fn(), hide: vi.fn(), dispose: () => {} };
    win.createStatusBarItem = () => badge;
    win.showTextDocument = vi.fn();
    win.showErrorMessage = vi.fn();
    ws.openTextDocument = vi.fn(async (p: string) => ({ getText: () => fs.readFileSync(p, 'utf8') }));
    ws.getWorkspaceFolder = () => ({ uri: { fsPath: root } });
  });

  it('announces a newly used key once and shows a badge', async () => {
    write('.env', 'A=1\n');
    const file = write('src/app.ts', '');
    const { w } = watcher();

    expect(await w.check(root, file, 'process.env.A; process.env.NEW_SECRET')).toEqual(['NEW_SECRET']);
    expect(w.chooseAction).toHaveBeenCalledWith(
      '🧩 Your code now uses NEW_SECRET, but no env file defines it. Add it to .env?',
      'Add to .env'
    );
    expect(badge.text).toBe('$(key) 1 missing env key');

    // Saving again doesn't repeat the toast; the badge stays
    expect(await w.check(root, file, 'process.env.A; process.env.NEW_SECRET')).toEqual([]);
    expect(w.chooseAction).toHaveBeenCalledTimes(1);
    expect(w.pendingKeys).toEqual(['NEW_SECRET']);
  });

  it('adds the key on click, after taking a snapshot, keeping existing lines', async () => {
    write('.env', '# my comment\nA="quoted"\n');
    const file = write('src/app.ts', '');
    const { w, beforeEnvWrite } = watcher(true, 'Add to .env');
    const appendSpy = vi.spyOn(EnvHealer.prototype, 'appendMissingKeys').mockImplementation(function (this: EnvHealer, ...args) {
      order.push('write');
      appendSpy.mockRestore();
      return this.appendMissingKeys(...args);
    });

    await w.check(root, file, 'process.env.NEW_SECRET');

    expect(beforeEnvWrite).toHaveBeenCalledWith(path.join(root, '.env'));
    expect(order).toEqual(['snapshot:.env', 'write']);
    const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
    expect(env.startsWith('# my comment\nA="quoted"\n')).toBe(true);
    expect(env).toContain('NEW_SECRET=');
    expect(w.pendingKeys).toEqual([]);
    expect(badge.hide).toHaveBeenCalled();
  });

  it('does not write when the snapshot fails', async () => {
    write('.env', 'A=1\n');
    const file = write('src/app.ts', '');
    const w = new EnvWatcher({
      healer: new EnvHealer(),
      isEnabled: async () => true,
      beforeEnvWrite: async () => {
        throw new Error('disk full');
      },
    });
    w.chooseAction = vi.fn().mockResolvedValue('Add to .env');
    await w.check(root, file, 'process.env.NEW_SECRET');
    expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toBe('A=1\n');
    expect(win.showErrorMessage).toHaveBeenCalled();
  });

  it('clears the badge when the user fills the key in by hand', async () => {
    write('.env', 'A=1\n');
    const file = write('src/app.ts', 'process.env.NEW_SECRET');
    const { w } = watcher();
    await w.check(root, file, 'process.env.NEW_SECRET');
    expect(w.pendingKeys).toEqual(['NEW_SECRET']);

    write('.env', 'A=1\nNEW_SECRET=abc\n');
    w.onSave({ fsPath: path.join(root, '.env') } as vscode.Uri, '');
    expect(w.pendingKeys).toEqual([]);
  });

  it('drops keys the file stops using', async () => {
    const file = write('src/app.ts', '');
    const { w } = watcher();
    await w.check(root, file, 'process.env.TEMP_KEY');
    await w.check(root, file, '// removed');
    expect(w.pendingKeys).toEqual([]);
  });

  it('does nothing when the feature is off or unlicensed', async () => {
    const file = write('src/app.ts', '');
    const { w } = watcher(false);
    expect(await w.check(root, file, 'process.env.NEW_SECRET')).toEqual([]);
    expect(w.chooseAction).not.toHaveBeenCalled();
  });

  it('debounces rapid saves into one check', async () => {
    write('.env', '');
    const file = write('src/app.ts', '');
    const { w } = watcher();
    const check = vi.spyOn(w, 'check');
    const uri = { fsPath: file } as vscode.Uri;
    w.onSave(uri, 'process.env.ONE');
    w.onSave(uri, 'process.env.ONE; process.env.TWO');
    await new Promise((r) => setTimeout(r, 50));
    expect(check).toHaveBeenCalledTimes(1);
    expect(check.mock.calls[0][2]).toContain('TWO');
  });

  it('summarizes many keys', () => {
    expect(missingKeysMessage(['A', 'B', 'C', 'D', 'E'], '.env.local')).toBe(
      '🧩 Your code now uses 5 variables that no env file defines: A, B, C, D +1 more. Add them to .env.local?'
    );
  });
});
