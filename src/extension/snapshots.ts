import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ENV_SOURCE_FILES } from '../core/EnvHealer.js';
import { SNAPSHOT_KEY_BYTES, SnapshotInfo, SnapshotStore, generateSnapshotKey } from '../core/EnvSnapshots.js';

export const SNAPSHOT_SCHEME = 'envwizard-snapshot';
export const SNAPSHOT_KEY_SECRET = 'envwizard_snapshot_key';

export function isEnvFileName(name: string): boolean {
  return /^\.env(\.[\w.-]+)?$/.test(name);
}

export function describeAge(then: Date, now = new Date()): string {
  const minutes = Math.round((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export interface EnvSnapshotsDeps {
  secrets: vscode.SecretStorage;
  storageDir: string;
  /** Pro gate (opt-in setting + license) for taking new snapshots. Restoring is always allowed. */
  isEnabled: () => Promise<boolean>;
  log?: (line: string) => void;
}

/**
 * F5 (Pro, opt-in): encrypted local snapshots of env files, taken before EnvWizard writes to one
 * and around every save, with a restore command that previews the difference in memory only.
 */
export class EnvSnapshots implements vscode.Disposable, vscode.TextDocumentContentProvider {
  readonly store: SnapshotStore;
  private keyPromise: Promise<Buffer> | undefined;
  /** Decrypted snapshot text for open previews, keyed by preview URI. Memory only. */
  private readonly previews = new Map<string, string>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly deps: EnvSnapshotsDeps) {
    this.store = new SnapshotStore(path.join(deps.storageDir, 'snapshots'), () => this.getKey());
  }

  start() {
    this.disposables.push(
      vscode.workspace.registerTextDocumentContentProvider(SNAPSHOT_SCHEME, this),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        if (doc.uri.scheme === SNAPSHOT_SCHEME) this.previews.delete(doc.uri.toString());
      }),
      // Before a save, keep what is on disk; after it, keep what was saved
      vscode.workspace.onWillSaveTextDocument((e) => {
        if (this.isEnvDocument(e.document)) e.waitUntil(this.snapshotQuietly(e.document.uri.fsPath));
      }),
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this.isEnvDocument(doc)) void this.snapshotQuietly(doc.uri.fsPath, doc.getText());
      })
    );
    void this.snapshotWorkspaceRoots();
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.previews.get(uri.toString()) ?? '';
  }

  /** The snapshot key, created on first use and kept in the editor's secret storage. */
  getKey(): Promise<Buffer> {
    this.keyPromise ??= (async () => {
      const stored = await this.deps.secrets.get(SNAPSHOT_KEY_SECRET);
      const existing = stored ? Buffer.from(stored, 'base64') : undefined;
      if (existing?.length === SNAPSHOT_KEY_BYTES) return existing;
      const key = generateSnapshotKey();
      await this.deps.secrets.store(SNAPSHOT_KEY_SECRET, key.toString('base64'));
      return key;
    })().catch((err) => {
      this.keyPromise = undefined; // Retry next time
      throw err;
    });
    return this.keyPromise;
  }

  /**
   * Runs before EnvWizard writes to an env file. Throws if the snapshot fails, so the
   * caller doesn't write without a safety copy. Does nothing when snapshots are off.
   */
  async beforeEnvWrite(envPath: string): Promise<void> {
    const root = this.rootFor(envPath);
    if (!root || !(await this.deps.isEnabled())) return;
    await this.store.save(root, envPath);
  }

  /** Command: EnvWizard: Restore .env Snapshot… */
  async restore(root: string | undefined): Promise<void> {
    if (!root) {
      vscode.window.showWarningMessage('Open a project folder to restore an env file.');
      return;
    }
    const files = this.store.listEnvFiles(root);
    if (files.length === 0) {
      vscode.window.showInformationMessage(
        (await this.deps.isEnabled())
          ? 'No snapshots yet. EnvWizard saves one every time you save an env file.'
          : 'No snapshots yet. Encrypted .env snapshots are a Pro feature: turn on "envwizard.snapshots" to start keeping them.'
      );
      return;
    }

    const envFile = files.length === 1 ? files[0] : await vscode.window.showQuickPick(files, { title: 'Restore which env file?' });
    if (!envFile) return;
    const envPath = path.join(root, ...envFile.split('/'));

    const snapshots = this.store.list(root, envPath);
    const picked = await vscode.window.showQuickPick(
      snapshots.map((info) => ({ label: info.createdAt.toLocaleString(), description: describeAge(info.createdAt), info })),
      { title: `Restore ${envFile}: pick a snapshot`, placeHolder: 'You will see the difference before anything changes' }
    );
    if (!picked) return;

    let content: string;
    try {
      content = await this.store.read(picked.info);
    } catch (err) {
      vscode.window.showErrorMessage(`❌ ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : undefined;
    if (current === content) {
      vscode.window.showInformationMessage(`✅ ${envFile} already matches that snapshot.`);
      return;
    }

    const when = picked.label;
    await this.showPreview(picked.info, content, envPath, current !== undefined);

    const restore = 'Restore';
    const answer = await vscode.window.showWarningMessage(
      `Restore ${envFile} to the snapshot from ${when}? EnvWizard keeps a snapshot of the current version first, so you can undo this.`,
      restore
    );
    if (answer !== restore) return;

    const open = vscode.workspace.textDocuments.find((d) => d.uri.scheme === 'file' && d.uri.fsPath === envPath);
    if (open?.isDirty) {
      vscode.window.showWarningMessage(`${envFile} has unsaved changes. Save or close it, then restore again.`);
      return;
    }

    try {
      if (current !== undefined) await this.store.save(root, envPath, current);
      fs.mkdirSync(path.dirname(envPath), { recursive: true });
      fs.writeFileSync(envPath, content, 'utf8');
    } catch (err) {
      vscode.window.showErrorMessage(`❌ Couldn't restore ${envFile}: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    this.deps.log?.(`${new Date().toLocaleTimeString()} Restored ${envFile} to the snapshot from ${when}.`);
    vscode.window.showInformationMessage(`↩️ Restored ${envFile} to the snapshot from ${when}.`);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.previews.clear();
  }

  private async showPreview(info: SnapshotInfo, content: string, envPath: string, fileExists: boolean) {
    const preview = vscode.Uri.from({ scheme: SNAPSHOT_SCHEME, path: `/${info.envFile}`, query: String(info.createdAt.getTime()) });
    this.previews.set(preview.toString(), content);
    if (fileExists) {
      await vscode.commands.executeCommand(
        'vscode.diff',
        preview,
        vscode.Uri.file(envPath),
        `${info.envFile}: snapshot ↔ current`,
        { preview: true }
      );
    } else {
      await vscode.window.showTextDocument(preview, { preview: true });
    }
  }

  /** Snapshots taken around saves must never block or break saving. */
  private async snapshotQuietly(envPath: string, content?: string) {
    try {
      const root = this.rootFor(envPath);
      if (root && (await this.deps.isEnabled())) await this.store.save(root, envPath, content);
    } catch (err) {
      this.deps.log?.(`Couldn't snapshot ${path.basename(envPath)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** A baseline when the editor opens, so the first save of the session can be undone too. */
  private async snapshotWorkspaceRoots() {
    for (const folder of vscode.workspace.workspaceFolders || []) {
      for (const name of ENV_SOURCE_FILES) {
        await this.snapshotQuietly(path.join(folder.uri.fsPath, name));
      }
    }
  }

  private isEnvDocument(doc: vscode.TextDocument): boolean {
    return doc.uri.scheme === 'file' && isEnvFileName(path.basename(doc.uri.fsPath));
  }

  private rootFor(envPath: string): string | undefined {
    return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(envPath))?.uri.fsPath;
  }
}
