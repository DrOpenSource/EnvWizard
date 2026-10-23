import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { EnvHealer } from '../src/core/EnvHealer.js';
import { envExampleMessage, syncEnvExample } from '../src/extension/envExample.js';

let root: string;
const healer = new EnvHealer();
const example = () => fs.readFileSync(path.join(root, '.env.example'), 'utf8');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'envwizard-example-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('syncEnvExample', () => {
  it('needs an env file to start from', () => {
    expect(syncEnvExample(root, healer)).toEqual({ kind: 'no-env' });
    expect(fs.existsSync(path.join(root, '.env.example'))).toBe(false);
  });

  it('creates .env.example from .env plus keys only in .env.local, with no values', () => {
    fs.writeFileSync(path.join(root, '.env'), '# Stripe\nSTRIPE_KEY=sk_live_secret\nDB_URL=postgres://x\n');
    fs.writeFileSync(path.join(root, '.env.local'), 'LOCAL_ONLY=topsecret\n');

    const result = syncEnvExample(root, healer);

    expect(result).toMatchObject({ kind: 'created', keys: 3 });
    expect(example()).toMatch(/^# Stripe\nSTRIPE_KEY=\nDB_URL=\n/);
    expect(example()).toContain('LOCAL_ONLY=');
    expect(example()).not.toMatch(/sk_live|postgres|topsecret/);
  });

  it('only appends missing keys to an existing .env.example, keeping its lines', () => {
    const mine = '# Set these before running\nSTRIPE_KEY=pk_test_placeholder\n';
    fs.writeFileSync(path.join(root, '.env.example'), mine);
    fs.writeFileSync(path.join(root, '.env'), 'STRIPE_KEY=sk_live_secret\nNEW_KEY=abc\n');

    const result = syncEnvExample(root, healer);

    expect(result).toMatchObject({ kind: 'updated', added: ['NEW_KEY'] });
    expect(example().startsWith(mine)).toBe(true);
    expect(example()).toContain('NEW_KEY=\n');
    expect(example()).not.toContain('abc');
  });

  it('reports when the template is already complete', () => {
    fs.writeFileSync(path.join(root, '.env'), 'A=1\n');
    syncEnvExample(root, healer);
    expect(syncEnvExample(root, healer)).toMatchObject({ kind: 'in-sync' });
  });

  it('words each result plainly', () => {
    expect(envExampleMessage({ kind: 'created', examplePath: '', keys: 1 })).toContain('1 key and no values');
    expect(envExampleMessage({ kind: 'updated', examplePath: '', added: ['A', 'B'] })).toContain('2 new keys');
  });
});
