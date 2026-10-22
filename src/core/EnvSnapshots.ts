import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Encrypted local snapshots of env files (F5, Pro). Each snapshot is AES-256-GCM encrypted with a
 * key the extension keeps in the editor's secret storage; plaintext is never written here.
 *
 * Layout: <baseDir>/<workspace id>/<env file id>/<timestamp>.bin
 * File:   "EWS1" | 12-byte IV | 16-byte auth tag | ciphertext
 * The env file's workspace-relative path is the GCM additional data, so a snapshot can't be
 * passed off as another file's.
 */

const MAGIC = Buffer.from('EWS1');
/** Holds the env file's workspace-relative path (not secret), so folder names never need decoding. */
const SOURCE_FILE = 'source.txt';
const IV_BYTES = 12;
const TAG_BYTES = 16;
export const SNAPSHOT_KEY_BYTES = 32;
export const DEFAULT_KEEP = 20;

export interface SnapshotInfo {
  /** Snapshot file path on disk (encrypted). */
  file: string;
  /** Workspace-relative env file path, e.g. ".env" or "apps/web/.env.local". */
  envFile: string;
  createdAt: Date;
}

export class SnapshotDecryptError extends Error {}

export function generateSnapshotKey(): Buffer {
  return crypto.randomBytes(SNAPSHOT_KEY_BYTES);
}

export function encryptSnapshot(key: Buffer, plaintext: string, envFile: string): Buffer {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(envFile, 'utf8'));
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export function decryptSnapshot(key: Buffer, data: Buffer, envFile: string): string {
  if (data.length < MAGIC.length + IV_BYTES + TAG_BYTES || !data.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new SnapshotDecryptError('This is not an EnvWizard snapshot.');
  }
  const iv = data.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = data.subarray(MAGIC.length + IV_BYTES, MAGIC.length + IV_BYTES + TAG_BYTES);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(envFile, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data.subarray(MAGIC.length + IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
  } catch {
    throw new SnapshotDecryptError(
      "This snapshot can't be opened: it was made with a different key (another computer or a reinstall) or it is damaged."
    );
  }
}

/** Stable, path-free folder name for a workspace. */
export function workspaceId(workspaceRoot: string): string {
  const normalized = path.resolve(workspaceRoot).replace(/\\/g, '/');
  const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/** Readable, filesystem-safe folder name for an env file: "apps/web/.env.local" → "apps__web__.env.local". */
export function envFileId(envFile: string): string {
  return envFile.replace(/\\/g, '/').split('/').map((seg) => seg.replace(/[^A-Za-z0-9._-]/g, '_')).join('__');
}

function timestampName(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function parseTimestampName(name: string): Date | undefined {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z(?:-\d+)?\.bin$/);
  if (!m) return undefined;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`);
  return isNaN(d.getTime()) ? undefined : d;
}

export interface SnapshotStoreOptions {
  keep?: number;
  now?: () => Date;
}

export class SnapshotStore {
  private readonly keep: number;
  private readonly now: () => Date;

  constructor(
    private readonly baseDir: string,
    private readonly getKey: () => Promise<Buffer>,
    options: SnapshotStoreOptions = {}
  ) {
    this.keep = Math.max(1, options.keep ?? DEFAULT_KEEP);
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Saves an encrypted snapshot of `envPath` (current disk content unless `content` is given).
   * Skips missing files and content identical to the latest snapshot. Keeps the newest `keep`.
   */
  async save(workspaceRoot: string, envPath: string, content?: string): Promise<SnapshotInfo | undefined> {
    if (content === undefined) {
      if (!fs.existsSync(envPath)) return undefined;
      content = fs.readFileSync(envPath, 'utf8');
    }
    const envFile = this.relative(workspaceRoot, envPath);
    const key = await this.getKey();

    const latest = this.list(workspaceRoot, envPath)[0];
    if (latest) {
      try {
        if (decryptSnapshot(key, fs.readFileSync(latest.file), envFile) === content) return undefined;
      } catch {
        // Unreadable latest snapshot: save a fresh one
      }
    }

    const dir = this.dirFor(workspaceRoot, envFile);
    fs.mkdirSync(dir, { recursive: true });
    const sourceFile = path.join(dir, SOURCE_FILE);
    if (!fs.existsSync(sourceFile)) fs.writeFileSync(sourceFile, envFile, 'utf8');
    const createdAt = this.now();
    let file = path.join(dir, `${timestampName(createdAt)}.bin`);
    for (let n = 1; fs.existsSync(file); n++) file = path.join(dir, `${timestampName(createdAt)}-${n}.bin`);
    fs.writeFileSync(file, encryptSnapshot(key, content, envFile), { mode: 0o600 });

    this.prune(workspaceRoot, envPath);
    return { file, envFile, createdAt };
  }

  /** Snapshots of one env file, newest first. */
  list(workspaceRoot: string, envPath: string): SnapshotInfo[] {
    const envFile = this.relative(workspaceRoot, envPath);
    const dir = this.dirFor(workspaceRoot, envFile);
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch {
      return [];
    }
    return names
      .map((name) => ({ name, createdAt: parseTimestampName(name) }))
      .filter((e): e is { name: string; createdAt: Date } => !!e.createdAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.name.localeCompare(a.name))
      .map((e) => ({ file: path.join(dir, e.name), envFile, createdAt: e.createdAt }));
  }

  /** Workspace-relative env files that have snapshots. */
  listEnvFiles(workspaceRoot: string): string[] {
    try {
      return fs
        .readdirSync(path.join(this.baseDir, workspaceId(workspaceRoot)), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => {
          try {
            return fs.readFileSync(path.join(this.baseDir, workspaceId(workspaceRoot), e.name, SOURCE_FILE), 'utf8').trim();
          } catch {
            return undefined;
          }
        })
        .filter((f): f is string => !!f)
        .sort();
    } catch {
      return [];
    }
  }

  /** Decrypts a snapshot in memory. Throws SnapshotDecryptError when it can't be opened. */
  async read(info: SnapshotInfo): Promise<string> {
    return decryptSnapshot(await this.getKey(), fs.readFileSync(info.file), info.envFile);
  }

  private prune(workspaceRoot: string, envPath: string) {
    for (const old of this.list(workspaceRoot, envPath).slice(this.keep)) {
      try {
        fs.unlinkSync(old.file);
      } catch {
        // Already gone
      }
    }
  }

  private relative(workspaceRoot: string, envPath: string): string {
    return path.relative(workspaceRoot, envPath).split(path.sep).join('/');
  }

  private dirFor(workspaceRoot: string, envFile: string): string {
    return path.join(this.baseDir, workspaceId(workspaceRoot), envFileId(envFile));
  }
}
