import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EnvHealer } from '../src/core/EnvHealer.js';

describe('EnvHealer', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envwizard-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts variables from TypeScript, Vite, and Python syntax', () => {
    const healer = new EnvHealer();

    const tsCode = `
      const apiKey = process.env.OPENAI_API_KEY;
      const dbUrl = process.env['DATABASE_URL'];
      const supabase = import.meta.env.VITE_SUPABASE_ANON_KEY;
    `;

    const pyCode = `
      token = os.environ.get("GITHUB_TOKEN")
      redis = os.environ["REDIS_HOST"]
      secret = os.getenv("JWT_SECRET")
    `;

    const tsKeys = healer.extractVariablesFromCode(tsCode);
    const pyKeys = healer.extractVariablesFromCode(pyCode);

    expect(Array.from(tsKeys)).toEqual(
      expect.arrayContaining(['OPENAI_API_KEY', 'DATABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
    );

    expect(Array.from(pyKeys)).toEqual(
      expect.arrayContaining(['GITHUB_TOKEN', 'REDIS_HOST', 'JWT_SECRET'])
    );
  });

  it('parses .env files preserving clean key-value pairs', () => {
    const healer = new EnvHealer();
    const envRaw = `
# Database configuration
PORT=3000
DATABASE_URL="postgres://user:pass@localhost:5432/db"
NODE_ENV=development
API_SECRET='super-secret-value'
`;

    const parsed = healer.parseEnv(envRaw);

    expect(parsed.get('PORT')).toBe('3000');
    expect(parsed.get('DATABASE_URL')).toBe('postgres://user:pass@localhost:5432/db');
    expect(parsed.get('NODE_ENV')).toBe('development');
    expect(parsed.get('API_SECRET')).toBe('super-secret-value');
  });

  it('safely appends missing keys without overwriting existing entries', () => {
    const healer = new EnvHealer();
    const envPath = path.join(tmpDir, '.env');

    fs.writeFileSync(envPath, 'EXISTING_VAR=original_value\n', 'utf8');

    const missingKeys = [
      { key: 'EXISTING_VAR', defaultValue: 'should_not_overwrite' },
      { key: 'NEW_API_KEY', defaultValue: 'default_dummy_key' },
      { key: 'STRIPE_WEBHOOK_SECRET', defaultValue: '' },
    ];

    healer.appendMissingKeys(envPath, missingKeys);

    const updatedContent = fs.readFileSync(envPath, 'utf8');
    const parsed = healer.parseEnv(updatedContent);

    // Existing must remain untouched
    expect(parsed.get('EXISTING_VAR')).toBe('original_value');
    // New variables added
    expect(parsed.get('NEW_API_KEY')).toBe('default_dummy_key');
    expect(parsed.get('STRIPE_WEBHOOK_SECRET')).toBe('');
    expect(updatedContent).toContain('# Added by EnvWizard');
  });

  it('extracts destructured keys, optional chaining, defaults, Deno and Bun', () => {
    const healer = new EnvHealer();
    const keys = healer.extractVariablesFromCode(`
      const { STRIPE_SECRET_KEY, RESEND_API_KEY: resend, REGION = 'us', ...rest } = process.env;
      const x = process.env?.SENTRY_DSN;
      db = os.environ.get("DATABASE_URL", "sqlite:///x")
      model = os.getenv('ANTHROPIC_API_KEY', None)
      const d = Deno.env.get("DENO_KEY"); const b = Bun.env.BUN_KEY;
    `);

    expect(Array.from(keys)).toEqual(
      expect.arrayContaining([
        'STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'REGION', 'SENTRY_DSN',
        'DATABASE_URL', 'ANTHROPIC_API_KEY', 'DENO_KEY', 'BUN_KEY',
      ])
    );
  });

  it('ignores variables provided by the runtime or host (PORT, NODE_ENV, CI)', () => {
    const healer = new EnvHealer();
    const keys = healer.extractVariablesFromCode('process.env.PORT; process.env.NODE_ENV; process.env.CI; process.env.npm_package_version;');
    expect(keys.size).toBe(0);
  });

  it('parses multiline values, escaped quotes, inline comments and CRLF', () => {
    const healer = new EnvHealer();
    const parsed = healer.parseEnv(
      'PRIVATE_KEY="-----BEGIN-----\nabc\n-----END-----"\r\nPLAIN=value # a comment\r\nESCAPED="say \\"hi\\""\r\nHASH_IN_QUOTES="a#b"\r\n'
    );

    expect(parsed.get('PRIVATE_KEY')).toBe('-----BEGIN-----\nabc\n-----END-----');
    expect(parsed.get('PLAIN')).toBe('value');
    expect(parsed.get('ESCAPED')).toBe('say \\"hi\\"');
    expect(parsed.get('HASH_IN_QUOTES')).toBe('a#b');
  });

  it('audits a realistic Next.js + Python project without false alarms', () => {
    const healer = new EnvHealer();
    const write = (rel: string, content: string) => {
      fs.mkdirSync(path.dirname(path.join(tmpDir, rel)), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, rel), content);
    };

    write('.env.local', 'OPENAI_API_KEY=sk-123\n');
    write('.env', 'EMPTY_ONE=\n');
    write('src/app/api/chat/route.ts', 'process.env.OPENAI_API_KEY; process.env.PORT; process.env.EMPTY_ONE;');
    write('apps/web/src/app/api/pay/deep/route.ts', 'const k = process.env.CLERK_SECRET_KEY;');
    write('.venv-custom-name/pyvenv.cfg', 'home = /usr/bin');
    write('my-venv/pyvenv.cfg', 'home = /usr/bin');
    write('my-venv/lib/site.py', 'os.environ.get("INTERNAL_VENV_VAR")');
    write('backend/main.py', 'os.getenv("ANTHROPIC_API_KEY", None)');

    const report = healer.auditWorkspace(tmpDir);
    const missing = report.missingInEnv.map((m) => m.key).sort();

    expect(missing).toEqual(['ANTHROPIC_API_KEY', 'CLERK_SECRET_KEY']);
    expect(report.emptyInEnv.map((m) => m.key)).toEqual(['EMPTY_ONE']);
    expect(report.envFilesFound).toEqual(['.env', '.env.local']);
    expect(report.missingInEnv.find((m) => m.key === 'CLERK_SECRET_KEY')?.sourceFiles).toEqual([
      'apps/web/src/app/api/pay/deep/route.ts',
    ]);
  });

  it('heals into .env.local when that is the only env file', () => {
    const healer = new EnvHealer();
    fs.writeFileSync(path.join(tmpDir, '.env.local'), 'A=1\n');
    expect(healer.auditWorkspace(tmpDir).healTargetPath).toBe(path.join(tmpDir, '.env.local'));
  });

  it('appends without altering existing bytes and keeps CRLF line endings', () => {
    const healer = new EnvHealer();
    const envPath = path.join(tmpDir, '.env');
    const original = '# my secrets\r\nDATABASE_URL="postgres://x"   \r\nLAST=1';
    fs.writeFileSync(envPath, original, 'utf8');

    const result = healer.appendMissingKeys(envPath, [{ key: 'NEW_KEY' }]);

    expect(result.startsWith(original)).toBe(true);
    expect(result).toContain('\r\nNEW_KEY=\r\n');
    expect(result.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('reads env files inside monorepo packages, scoped to that package', () => {
    const healer = new EnvHealer();
    const write = (rel: string, content: string) => {
      fs.mkdirSync(path.dirname(path.join(tmpDir, rel)), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, rel), content);
    };

    write('.env', 'SHARED_KEY=1\n');
    write('apps/web/.env.local', 'WEB_ONLY_KEY=abc\nBLANK_WEB=\n');
    write('apps/web/src/page.ts', 'process.env.WEB_ONLY_KEY; process.env.SHARED_KEY; process.env.BLANK_WEB;');
    write('apps/api/src/server.ts', 'process.env.WEB_ONLY_KEY;');

    const report = healer.auditWorkspace(tmpDir);

    expect(report.envFilesFound).toEqual(['.env', 'apps/web/.env.local']);
    // The api package can't see apps/web/.env.local, so the key is missing *for it*
    expect(report.missingInEnv.map((m) => m.key)).toEqual(['WEB_ONLY_KEY']);
    expect(report.missingInEnv[0].sourceFiles).toEqual(['apps/api/src/server.ts']);
    expect(report.emptyInEnv.map((m) => m.key)).toEqual(['BLANK_WEB']);
  });

  it('matches slash-less .gitignore patterns at any depth (git semantics)', () => {
    const healer = new EnvHealer();
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.env.local\n/.env\n');

    expect(healer.findUnignoredEnvFiles(tmpDir, ['.env', 'apps/web/.env.local', 'apps/web/.env'])).toEqual([
      'apps/web/.env',
    ]);
  });

  it('detects env files already tracked by git and can untrack them without deleting', () => {
    const healer = new EnvHealer();
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: tmpDir, stdio: 'ignore' });
    git('init', '-q');
    fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET=1\n');
    fs.writeFileSync(path.join(tmpDir, '.env.local'), 'LOCAL=1\n');
    git('add', '.env');
    git('commit', '-q', '-m', 'oops');

    expect(healer.findTrackedEnvFiles(tmpDir, ['.env', '.env.local'])).toEqual(['.env']);

    healer.untrackFiles(tmpDir, ['.env']);
    expect(healer.findTrackedEnvFiles(tmpDir, ['.env', '.env.local'])).toEqual([]);
    expect(fs.readFileSync(path.join(tmpDir, '.env'), 'utf8')).toBe('SECRET=1\n');
  });

  it('warns when secret env files in a git repo are not gitignored', () => {
    const healer = new EnvHealer();
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\n.env\n');

    expect(healer.findUnignoredEnvFiles(tmpDir, ['.env', '.env.local'])).toEqual(['.env.local']);

    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\n.env*\n!.env.example\n');
    expect(healer.findUnignoredEnvFiles(tmpDir, ['.env', '.env.local'])).toEqual([]);
  });
});
