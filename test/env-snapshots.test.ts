import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  SnapshotStore,
  SnapshotDecryptError,
  generateSnapshotKey,
  encryptSnapshot,
  decryptSnapshot,
  envFileId,
} from '../src/core/EnvSnapshots.js';

const SECRET = 'sk_live_51HxSuperSecretValue';
const ENV = `# Payments\nSTRIPE_SECRET_KEY=${SECRET}\nDATABASE_URL="postgres://me:pw@localhost/db"\n`;

let tmp: string;
let root: string;
let base: string;
let key: Buffer;

function allFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? allFiles(p) : [p];
  });
}

function store(options: ConstructorParameters<typeof SnapshotStore>[2] = {}) {
  return new SnapshotStore(base, async () => key, options);
}

function clock(start = Date.UTC(2026, 9, 23, 10, 0, 0)) {
  let t = start;
  return () => new Date((t += 1000));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'envwizard-snap-'));
  root = path.join(tmp, 'project');
  base = path.join(tmp, 'storage', 'snapshots');
  fs.mkdirSync(root);
  key = generateSnapshotKey();
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('snapshot encryption', () => {
  it('round-trips and never contains the plaintext', () => {
    const data = encryptSnapshot(key, ENV, '.env');
    expect(data.includes(Buffer.from(SECRET))).toBe(false);
    expect(data.includes(Buffer.from('STRIPE_SECRET_KEY'))).toBe(false);
    expect(decryptSnapshot(key, data, '.env')).toBe(ENV);
  });

  it('uses a fresh IV every time', () => {
    expect(encryptSnapshot(key, ENV, '.env').equals(encryptSnapshot(key, ENV, '.env'))).toBe(false);
  });

  it('refuses a different key, tampering, or another file name', () => {
    const data = encryptSnapshot(key, ENV, '.env');
    expect(() => decryptSnapshot(generateSnapshotKey(), data, '.env')).toThrow(SnapshotDecryptError);
    const tampered = Buffer.from(data);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptSnapshot(key, tampered, '.env')).toThrow(SnapshotDecryptError);
    expect(() => decryptSnapshot(key, data, '.env.local')).toThrow(SnapshotDecryptError);
    expect(() => decryptSnapshot(key, Buffer.from('plain text'), '.env')).toThrow(/not an EnvWizard snapshot/);
  });
});

describe('SnapshotStore', () => {
  it('saves and restores a snapshot; no plaintext anywhere on disk', async () => {
    const envPath = path.join(root, '.env');
    fs.writeFileSync(envPath, ENV);
    const s = store();

    const info = await s.save(root, envPath);
    expect(info).toBeDefined();
    expect(await s.read(s.list(root, envPath)[0])).toBe(ENV);

    for (const file of allFiles(base)) {
      const bytes = fs.readFileSync(file);
      expect(bytes.includes(Buffer.from(SECRET)), file).toBe(false);
      expect(bytes.includes(Buffer.from('DATABASE_URL')), file).toBe(false);
    }
    // The workspace path is hashed, not stored
    expect(allFiles(base).some((f) => f.includes('project'))).toBe(false);
  });

  it('skips missing files and unchanged content', async () => {
    const envPath = path.join(root, '.env');
    const s = store({ now: clock() });
    expect(await s.save(root, envPath)).toBeUndefined();

    fs.writeFileSync(envPath, ENV);
    expect(await s.save(root, envPath)).toBeDefined();
    expect(await s.save(root, envPath)).toBeUndefined();
    expect(await s.save(root, envPath, ENV + 'NEW=1\n')).toBeDefined();
    expect(s.list(root, envPath)).toHaveLength(2);
  });

  it('lists newest first and keeps only the newest N', async () => {
    const envPath = path.join(root, '.env');
    const s = store({ keep: 3, now: clock() });
    for (let i = 1; i <= 5; i++) await s.save(root, envPath, `V=${i}\n`);

    const list = s.list(root, envPath);
    expect(list).toHaveLength(3);
    expect(await Promise.all(list.map((i) => s.read(i)))).toEqual(['V=5\n', 'V=4\n', 'V=3\n']);
  });

  it('never overwrites a snapshot taken in the same millisecond', async () => {
    const envPath = path.join(root, '.env');
    const fixed = new Date(Date.UTC(2026, 9, 23));
    const s = store({ now: () => fixed });
    await s.save(root, envPath, 'A=1\n');
    await s.save(root, envPath, 'A=2\n');
    expect(s.list(root, envPath)).toHaveLength(2);
  });

  it('keeps each env file separate and lists them, including odd folder names', async () => {
    const s = store({ now: clock() });
    await s.save(root, path.join(root, '.env'), 'A=1\n');
    await s.save(root, path.join(root, 'apps', 'web', '.env.local'), 'B=1\n');
    await s.save(root, path.join(root, 'my__app', '.env'), 'C=1\n');
    expect(s.listEnvFiles(root)).toEqual(['.env', 'apps/web/.env.local', 'my__app/.env']);
    const odd = s.list(root, path.join(root, 'my__app', '.env'));
    expect(await s.read(odd[0])).toBe('C=1\n');
  });

  it('keeps workspaces apart', async () => {
    const other = path.join(tmp, 'other');
    fs.mkdirSync(other);
    const s = store();
    await s.save(root, path.join(root, '.env'), 'A=1\n');
    expect(s.list(other, path.join(other, '.env'))).toEqual([]);
    expect(s.listEnvFiles(other)).toEqual([]);
  });

  it('reports a friendly error when the key changed', async () => {
    const envPath = path.join(root, '.env');
    await store().save(root, envPath, ENV);
    key = generateSnapshotKey();
    await expect(store().read(store().list(root, envPath)[0])).rejects.toThrow(/different key/);
  });

  it.skipIf(process.platform === 'win32')('writes snapshots readable by the owner only', async () => {
    const info = await store().save(root, path.join(root, '.env'), ENV);
    expect(fs.statSync(info!.file).mode & 0o777).toBe(0o600);
  });

  it('makes safe folder names', () => {
    expect(envFileId('apps/web/.env.local')).toBe('apps__web__.env.local');
    expect(envFileId('weird dir/.env')).toBe('weird_dir__.env');
  });
});
