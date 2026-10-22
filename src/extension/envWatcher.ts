import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EnvHealer, isScannableCodeFile } from '../core/EnvHealer.js';

export interface EnvWatcherDeps {
  healer: EnvHealer;
  /** Pro gate (opt-in setting + license). Checked on every save, after the debounce. */
  isEnabled: () => Promise<boolean>;
  /** Runs before EnvWizard writes to an env file (F5 takes a snapshot here). */
  beforeEnvWrite?: (envPath: string) => Promise<void>;
  /** A new missing key was found or added: refresh the Dev Deck. */
  onDidChange?: () => unknown;
  debounceMs?: number;
}

export function missingKeysMessage(keys: string[], targetName: string): string {
  if (keys.length === 1) {
    return `🧩 Your code now uses ${keys[0]}, but no env file defines it. Add it to ${targetName}?`;
  }
  const list = keys.length <= 4 ? keys.join(', ') : `${keys.slice(0, 4).join(', ')} +${keys.length - 4} more`;
  return `🧩 Your code now uses ${keys.length} variables that no env file defines: ${list}. Add them to ${targetName}?`;
}

/**
 * F4 (Pro, opt-in): when a code file is saved, checks only that file for env variables that no
 * env file defines. New ones get one toast ("Add to .env") and a status-bar badge until they
 * are filled. Free users find the same keys with a manual audit, so nothing is crippled.
 */
export class EnvWatcher implements vscode.Disposable {
  /** Shows the toast. Tests replace it to click a button. */
  chooseAction: (message: string, ...items: string[]) => Thenable<string | undefined> = (message, ...items) =>
    vscode.window.showInformationMessage(message, ...items);

  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** Keys already announced, per workspace root: one toast per key per session. */
  private readonly announced = new Map<string, Set<string>>();
  /** Missing keys shown in the badge → the file that uses them (rechecked when env files are saved). */
  private readonly pending = new Map<string, { root: string; file: string }>();
  private badge: vscode.StatusBarItem | undefined;

  constructor(private readonly deps: EnvWatcherDeps) {}

  start() {
    this.disposables.push(vscode.workspace.onDidSaveTextDocument((doc) => this.onSave(doc.uri, doc.getText())));
  }

  /** Public for tests. */
  onSave(uri: vscode.Uri, text: string) {
    const name = path.basename(uri.fsPath);
    if (/^\.env/.test(name)) {
      this.recheckPending();
      return;
    }
    if (!isScannableCodeFile(name, text.length)) return;
    const root = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
    if (!root) return;

    clearTimeout(this.timers.get(uri.fsPath));
    this.timers.set(
      uri.fsPath,
      setTimeout(() => {
        this.timers.delete(uri.fsPath);
        void this.check(root, uri.fsPath, text);
      }, this.deps.debounceMs ?? 1000)
    );
  }

  /** Public for tests: checks one saved file and announces newly missing keys. */
  async check(root: string, filePath: string, code: string): Promise<string[]> {
    if (!(await this.deps.isEnabled())) {
      this.pending.clear();
      this.updateBadge();
      return [];
    }

    const missing = this.deps.healer.findMissingKeysInFile(root, filePath, code);
    // Keys this file no longer uses (or that are now defined) leave the badge
    for (const [key, where] of this.pending) {
      if (where.file === filePath && !missing.some((m) => m.key === key)) this.pending.delete(key);
    }
    for (const m of missing) this.pending.set(m.key, { root, file: filePath });

    const seen = this.announced.get(root) ?? new Set<string>();
    this.announced.set(root, seen);
    const fresh = missing.filter((m) => !seen.has(m.key));
    this.updateBadge();
    if (fresh.length === 0) return [];
    fresh.forEach((m) => seen.add(m.key));
    await this.deps.onDidChange?.();

    const target = this.deps.healer.getHealTarget(root);
    const targetName = path.basename(target);
    const add = `Add to ${targetName}`;
    const keys = fresh.map((m) => m.key);
    if ((await this.chooseAction(missingKeysMessage(keys, targetName), add)) === add) {
      try {
        await this.deps.beforeEnvWrite?.(target);
        this.deps.healer.appendMissingKeys(target, fresh.map((m) => ({ key: m.key, defaultValue: m.suggestedValue })));
      } catch (err) {
        vscode.window.showErrorMessage(`❌ Couldn't update ${targetName}: ${err instanceof Error ? err.message : String(err)}`);
        return keys;
      }
      keys.forEach((k) => this.pending.delete(k));
      this.updateBadge();
      await this.deps.onDidChange?.();
      await openEnvAtKey(target, keys[0]);
    }
    return keys;
  }

  /** Public for tests: drops badge keys that an env file now defines (blank placeholders count). */
  recheckPending() {
    const files = new Map<string, string>();
    for (const where of this.pending.values()) files.set(where.file, where.root);
    for (const [file, root] of files) {
      let stillMissing: Set<string>;
      try {
        stillMissing = new Set(this.deps.healer.findMissingKeysInFile(root, file, fs.readFileSync(file, 'utf8')).map((m) => m.key));
      } catch {
        stillMissing = new Set(); // File deleted or unreadable: stop tracking it
      }
      for (const [key, where] of this.pending) {
        if (where.file === file && !stillMissing.has(key)) this.pending.delete(key);
      }
    }
    this.updateBadge();
  }

  get pendingKeys(): string[] {
    return [...this.pending.keys()].sort();
  }

  dispose() {
    this.timers.forEach((t) => clearTimeout(t));
    this.disposables.forEach((d) => d.dispose());
    this.badge?.dispose();
  }

  private updateBadge() {
    const keys = this.pendingKeys;
    if (keys.length === 0) {
      this.badge?.hide();
      return;
    }
    this.badge ??= vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.badge.text = `$(key) ${keys.length} missing env key${keys.length === 1 ? '' : 's'}`;
    this.badge.tooltip = `Your code uses ${keys.join(', ')}, but no env file defines ${keys.length === 1 ? 'it' : 'them'}. Click to fix.`;
    this.badge.command = 'envwizard.auditEnv';
    this.badge.show();
  }
}

/** Opens an env file with the cursor on `key`'s value. */
export async function openEnvAtKey(envPath: string, key: string) {
  const doc = await vscode.workspace.openTextDocument(envPath);
  const line = doc.getText().split(/\r?\n/).findIndex((l) => l.startsWith(`${key}=`));
  const pos = new vscode.Position(Math.max(0, line), key.length + 1);
  await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos) });
}
