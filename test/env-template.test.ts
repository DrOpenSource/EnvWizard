import { describe, it, expect } from 'vitest';
import { buildEnvExample, findValueHints } from '../src/core/EnvTemplate.js';
import { EnvHealer } from '../src/core/EnvHealer.js';

const ENV = [
  '# Database',
  'DATABASE_URL=postgres://me:hunter2@localhost/db',
  '',
  'export STRIPE_KEY="sk_live_abc" # live key',
  'PRIVATE_KEY="-----BEGIN KEY-----',
  'c2VjcmV0LXNlY3JldA==',
  '-----END KEY-----"',
  'EMPTY=',
  'stray-secret-without-equals',
  '# trailing comment',
].join('\n');

describe('buildEnvExample', () => {
  it('keeps keys, comments, blank lines and order with every value removed', () => {
    expect(buildEnvExample(ENV)).toBe(
      ['# Database', 'DATABASE_URL=', '', 'export STRIPE_KEY=', 'PRIVATE_KEY=', 'EMPTY=', '# trailing comment'].join('\n')
    );
  });

  it('never carries over a secret', () => {
    const out = buildEnvExample(ENV);
    for (const secret of ['hunter2', 'sk_live_abc', 'c2VjcmV0', 'BEGIN KEY', 'stray-secret', 'live key']) {
      expect(out).not.toContain(secret);
    }
  });

  it('keeps Windows line endings and parses back to the same keys', () => {
    const out = buildEnvExample(ENV.replace(/\n/g, '\r\n'));
    expect(out).toContain('\r\n');
    const healer = new EnvHealer();
    expect([...healer.parseEnv(out).keys()]).toEqual([...healer.parseEnv(ENV).keys()]);
    expect([...healer.parseEnv(out).values()].every((v) => v === '')).toBe(true);
  });
});

describe('findValueHints', () => {
  const hintsFor = (line: string) => findValueHints(line, '.env').map((h) => h.hint);

  it('flags doubled quotes', () => {
    expect(hintsFor('A=""abc""')[0]).toMatch(/two sets of quotes/);
    expect(hintsFor(`A="'abc'"`)[0]).toMatch(/two sets of quotes/);
    expect(hintsFor('A="abc"')).toEqual([]);
    expect(hintsFor('A=""')).toEqual([]);
  });

  it('flags spaces inside quotes but not around unquoted values (dotenv trims those)', () => {
    expect(hintsFor('A=" abc"')[0]).toMatch(/space at the start or end/);
    expect(hintsFor('A=abc   ')).toEqual([]);
  });

  it('checks OpenAI keys and URLs', () => {
    expect(hintsFor('OPENAI_API_KEY=abc123')[0]).toMatch(/sk-/);
    expect(hintsFor('OPENAI_API_KEY=sk-proj-abc')).toEqual([]);
    expect(hintsFor('API_URL=localhost:3000')[0]).toMatch(/full URL/);
    expect(hintsFor('API_URL=https://api.example.com')).toEqual([]);
    expect(hintsFor('DATABASE_URL=postgres://u:p@h/db')).toEqual([]);
    expect(hintsFor('API_URL=${BASE}/v1')).toEqual([]);
    expect(hintsFor('API_URL=')).toEqual([]);
  });

  it('names the key and file, never the value', () => {
    const [hint] = findValueHints('OPENAI_API_KEY=my-secret-value', 'apps/web/.env.local');
    expect(hint).toMatchObject({ key: 'OPENAI_API_KEY', file: 'apps/web/.env.local' });
    expect(JSON.stringify(hint)).not.toContain('my-secret-value');
  });
});
