import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EnvAuditReport, EnvVariableIssue } from '../shared/types.js';

export interface EnvEntry {
  key: string;
  value?: string;
  comment?: string;
  raw: string;
}

// Files frameworks (Next.js, Vite, dotenv-flow, python-dotenv) load as real values, in no particular priority.
export const ENV_SOURCE_FILES = ['.env', '.env.local', '.env.development', '.env.development.local'];

// Variables supplied by the OS, shell, package manager or hosting platform rather than by a .env file.
export const RUNTIME_PROVIDED_KEYS = new Set([
  'NODE_ENV', 'PORT', 'HOST', 'HOSTNAME', 'CI', 'DEBUG', 'HOME', 'PATH', 'PWD', 'USER', 'USERNAME',
  'SHELL', 'TZ', 'LANG', 'TMPDIR', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE',
  'VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'NEXT_RUNTIME', 'NEXT_PHASE', 'NETLIFY', 'RENDER',
  'RAILWAY_ENVIRONMENT', 'FLY_APP_NAME', 'GITHUB_ACTIONS',
]);

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.vscode', '.idea', 'coverage',
  'venv', '__pycache__', 'site-packages', 'target', 'vendor', 'bower_components', 'Pods',
]);
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.vue', '.svelte', '.astro']);
const MAX_FILE_BYTES = 512 * 1024; // larger files are almost always bundles or generated code
const MAX_FILES = 5000;

export class EnvHealer {
  /**
   * Extracts environment variable references from code text.
   * Matches:
   * - process.env.MY_VAR / process.env['MY_VAR'] / const { MY_VAR } = process.env
   * - import.meta.env.VITE_MY_VAR
   * - os.environ["MY_VAR"], os.environ.get("MY_VAR"[, default]), os.getenv("MY_VAR"[, default])
   * - Deno.env.get("MY_VAR"), Bun.env.MY_VAR
   */
  extractVariablesFromCode(code: string): Set<string> {
    const keys = new Set<string>();
    const add = (key: string | undefined) => {
      if (key && !RUNTIME_PROVIDED_KEYS.has(key) && !key.startsWith('npm_')) {
        keys.add(key);
      }
    };

    // Node / Next.js / Express: process.env.VAR_NAME or process.env['VAR_NAME']
    const processEnvRegex = /process\.env(?:\??\.([A-Z0-9_]+)|(?:\?\.)?\[['"]([A-Z0-9_]+)['"]\])/g;
    let match: RegExpExecArray | null;

    while ((match = processEnvRegex.exec(code)) !== null) {
      add(match[1] || match[2]);
    }

    // Vite / Astro: import.meta.env.VITE_VAR
    const importMetaRegex = /import\.meta\.env(?:\.([A-Z0-9_]+)|\[['"]([A-Z0-9_]+)['"]\])/g;
    while ((match = importMetaRegex.exec(code)) !== null) {
      const key = match[1] || match[2];
      if (key && !['BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR'].includes(key)) {
        add(key);
      }
    }

    // Destructuring: const { API_KEY, DB_URL: dbUrl, REGION = 'us' } = process.env
    const destructureRegex = /\{([^{}]*)\}\s*=\s*(?:process\.env|import\.meta\.env)\b/g;
    while ((match = destructureRegex.exec(code)) !== null) {
      for (const member of match[1].split(',')) {
        const name = member.trim().replace(/^\.\.\./, '').split(/[:=]/)[0].trim();
        if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
          add(name);
        }
      }
    }

    // Python: os.environ[...], os.environ.get(..., default), os.getenv(..., default)
    const pythonEnvRegex =
      /os\.(?:environ\s*\[\s*['"]([A-Z0-9_]+)['"]\s*\]|environ\.get\(\s*['"]([A-Z0-9_]+)['"]|getenv\(\s*['"]([A-Z0-9_]+)['"])/g;
    while ((match = pythonEnvRegex.exec(code)) !== null) {
      add(match[1] || match[2] || match[3]);
    }

    // Deno / Bun
    const denoBunRegex = /(?:Deno\.env\.get\(\s*['"]([A-Z0-9_]+)['"]|Bun\.env\.([A-Z0-9_]+))/g;
    while ((match = denoBunRegex.exec(code)) !== null) {
      add(match[1] || match[2]);
    }

    return keys;
  }

  /**
   * Parses a .env file content into key/value pairs.
   * Supports `export KEY=`, quoted values (including multiline double/single/backtick quotes
   * and escaped quotes) and inline `# comments` after unquoted values.
   */
  parseEnv(envContent: string): Map<string, string> {
    const map = new Map<string, string>();
    const lines = envContent.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const equalIndex = line.indexOf('=');
      if (equalIndex <= 0) {
        continue;
      }

      const key = line.substring(0, equalIndex).trim().replace(/^export\s+/, '');
      let val = line.substring(equalIndex + 1).trim();
      const quote = val[0];

      if (quote === '"' || quote === "'" || quote === '`') {
        // Quoted values may span several lines until the closing quote
        let end = findClosingQuote(val, quote);
        while (end === -1 && i + 1 < lines.length) {
          val += '\n' + lines[++i];
          end = findClosingQuote(val, quote);
        }
        val = end === -1 ? val.substring(1) : val.substring(1, end);
      } else {
        const commentStart = val.search(/\s#/);
        if (commentStart !== -1) {
          val = val.substring(0, commentStart).trimEnd();
        }
      }

      map.set(key, val);
    }

    return map;
  }

  /**
   * Scans a workspace directory, finds code files and .env files, and generates an audit report.
   */
  auditWorkspace(workspacePath: string): EnvAuditReport {
    // Env files per directory ('' = workspace root). Monorepo packages (apps/web/.env.local)
    // are collected during the code scan below.
    const envByDir = new Map<string, Map<string, string>>();
    const envFilesFound: string[] = [];
    this.collectEnvFiles(workspacePath, '', envByDir, envFilesFound);

    const envExamplePath = path.join(workspacePath, '.env.example');
    let exampleKeys = new Map<string, string>();
    if (fs.existsSync(envExamplePath)) {
      exampleKeys = this.parseEnv(fs.readFileSync(envExamplePath, 'utf8'));
    }

    const referencedKeys = new Map<string, string[]>();
    this.scanDirectoryForKeys(workspacePath, workspacePath, referencedKeys, { count: 0 }, envByDir, envFilesFound);

    // Every key defined anywhere (for counts and the "unused" list)
    const definedKeys = new Map<string, string>();
    for (const env of envByDir.values()) {
      for (const [key, val] of env) {
        if (!definedKeys.get(key)) definedKeys.set(key, val);
      }
    }

    const missingInEnv: EnvVariableIssue[] = [];
    const templateDrift: EnvVariableIssue[] = [];
    const emptyInEnv: EnvVariableIssue[] = [];
    const unusedInCode: EnvVariableIssue[] = [];

    for (const [key, files] of referencedKeys.entries()) {
      // Each file sees env files in its own folder and every parent folder up to the root,
      // so in a monorepo a key can be fine for one package and missing for another.
      const values = files.map((file) => lookupKeyForFile(key, file, envByDir));
      const blindFiles = files.filter((_, i) => values[i] === undefined);
      if (blindFiles.length > 0) {
        missingInEnv.push({
          key,
          type: 'missing_in_env',
          sourceFiles: blindFiles,
          suggestedValue: exampleKeys.get(key) || '',
        });
      } else if (values.includes('')) {
        emptyInEnv.push({ key, type: 'empty_value', sourceFiles: files });
      }
    }

    // Template drift (.env.example has keys that no env file defines)
    for (const [key, val] of exampleKeys.entries()) {
      if (!definedKeys.has(key) && !referencedKeys.has(key)) {
        templateDrift.push({
          key,
          type: 'drift_from_template',
          sourceFiles: ['.env.example'],
          suggestedValue: val,
        });
      }
    }

    for (const key of definedKeys.keys()) {
      if (!referencedKeys.has(key) && !key.startsWith('npm_')) {
        unusedInCode.push({
          key,
          type: 'missing_in_code',
          sourceFiles: envFilesFound,
        });
      }
    }

    const healTargetPath = this.getHealTarget(workspacePath);

    return {
      envFileExists: envFilesFound.length > 0,
      envPath: envFilesFound.length > 0 ? path.join(workspacePath, envFilesFound[0]) : undefined,
      envFilesFound,
      healTargetPath,
      totalKeysDefined: definedKeys.size,
      missingInEnv,
      templateDrift,
      emptyInEnv,
      unusedInCode,
      notGitignored: this.findUnignoredEnvFiles(workspacePath, envFilesFound),
      trackedByGit: this.findTrackedEnvFiles(workspacePath, envFilesFound),
    };
  }

  /** Where missing keys are added: `.env`, or `.env.local` when only that exists. */
  getHealTarget(workspacePath: string): string {
    const envPath = path.join(workspacePath, '.env');
    const envLocalPath = path.join(workspacePath, '.env.local');
    return !fs.existsSync(envPath) && fs.existsSync(envLocalPath) ? envLocalPath : envPath;
  }

  /**
   * Keys one code file uses that no env file it can see defines (its own folder and every parent
   * up to the workspace root). Blank values count as defined. Reads only those env files, so the
   * cost is O(file): no workspace scan. Used by the live env watcher on save.
   */
  findMissingKeysInFile(workspacePath: string, filePath: string, code: string): { key: string; suggestedValue: string }[] {
    const rel = path.relative(workspacePath, filePath).split(path.sep).join('/');
    if (!rel || rel.startsWith('../') || path.isAbsolute(rel) || !isScannableCodeFile(rel, code.length)) return [];
    if (path.posix.dirname(rel).split('/').some((seg) => IGNORE_DIRS.has(seg) || (seg.startsWith('.') && seg !== '.'))) return [];

    const keys = this.extractVariablesFromCode(code);
    if (keys.size === 0) return [];

    const envByDir = new Map<string, Map<string, string>>();
    for (let dir = path.posix.dirname(rel); ; dir = path.posix.dirname(dir)) {
      this.collectEnvFiles(workspacePath, dir === '.' ? '' : dir, envByDir, []);
      if (dir === '.' || dir === '') break;
    }

    const examplePath = path.join(workspacePath, '.env.example');
    let example = new Map<string, string>();
    try {
      if (fs.existsSync(examplePath)) example = this.parseEnv(fs.readFileSync(examplePath, 'utf8'));
    } catch {
      // Unreadable template: no suggested values
    }

    return [...keys]
      .filter((key) => lookupKeyForFile(key, rel, envByDir) === undefined)
      .sort()
      .map((key) => ({ key, suggestedValue: example.get(key) || '' }));
  }

  /**
   * Returns the env files git already tracks. Adding them to .gitignore does not stop
   * future commits of a tracked file; it must be untracked (`git rm --cached`).
   */
  findTrackedEnvFiles(workspacePath: string, envFiles: string[]): string[] {
    if (envFiles.length === 0 || !fs.existsSync(path.join(workspacePath, '.git'))) {
      return [];
    }
    try {
      const out = execFileSync('git', ['ls-files', '--', ...envFiles], {
        cwd: workspacePath,
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    } catch {
      return []; // git not installed or not a valid repo
    }
  }

  /**
   * Stops git tracking the given files while keeping them on disk (`git rm --cached`).
   */
  untrackFiles(workspacePath: string, files: string[]): void {
    execFileSync('git', ['rm', '--cached', '--quiet', '--', ...files], {
      cwd: workspacePath,
      timeout: 10000,
      stdio: 'ignore',
    });
  }

  private collectEnvFiles(root: string, relDir: string, envByDir: Map<string, Map<string, string>>, found: string[]) {
    const merged = new Map<string, string>();
    for (const name of ENV_SOURCE_FILES) {
      const rel = relDir ? `${relDir}/${name}` : name;
      const filePath = path.join(root, rel);
      if (!fs.existsSync(filePath)) continue;
      found.push(rel);
      try {
        for (const [key, val] of this.parseEnv(fs.readFileSync(filePath, 'utf8'))) {
          // A key counts as filled if any env file in the folder gives it a value
          if (!merged.get(key)) merged.set(key, val);
        }
      } catch {
        // Unreadable env file
      }
    }
    if (merged.size > 0 || relDir === '') {
      envByDir.set(relDir, merged);
    }
  }

  /**
   * Safely appends missing keys to an existing .env file with comments without touching existing lines.
   */
  appendMissingKeys(envPath: string, missingKeys: { key: string; defaultValue?: string }[]): string {
    let currentContent = '';
    if (fs.existsSync(envPath)) {
      currentContent = fs.readFileSync(envPath, 'utf8');
    }

    const eol = currentContent.includes('\r\n') ? '\r\n' : '\n';
    const currentMap = this.parseEnv(currentContent);
    const toAppend: string[] = [];

    for (const item of missingKeys) {
      if (!currentMap.has(item.key) && !toAppend.some((line) => line.startsWith(item.key + '='))) {
        const val = item.defaultValue !== undefined ? item.defaultValue : '';
        toAppend.push(`${item.key}=${val}`);
      }
    }

    if (toAppend.length === 0) {
      return currentContent;
    }

    // Existing bytes are kept exactly as they are; we only add after them.
    let prefix = currentContent;
    if (prefix && !prefix.endsWith('\n')) {
      prefix += eol;
    }
    const header = (prefix ? eol : '') + '# Added by EnvWizard: fill in the values below' + eol;
    const newContent = prefix + header + toAppend.join(eol) + eol;

    fs.writeFileSync(envPath, newContent, 'utf8');
    return newContent;
  }

  /**
   * Returns the env files that would be committed: the folder is a git repo and no
   * root .gitignore pattern matches them.
   */
  findUnignoredEnvFiles(workspacePath: string, envFiles: string[]): string[] {
    if (!fs.existsSync(path.join(workspacePath, '.git'))) {
      return [];
    }

    let patterns: string[] = [];
    try {
      patterns = fs
        .readFileSync(path.join(workspacePath, '.gitignore'), 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && !l.startsWith('!') && !l.endsWith('/'));
    } catch {
      // No .gitignore: nothing is ignored
    }

    // Git semantics: a pattern without a slash ("." prefix aside) matches the name at any depth;
    // a pattern with a slash is relative to the repo root.
    const matchers = patterns.map((p) => {
      const anchored = /\//.test(p.replace(/^\*\*\//, ''));
      return { anchored, re: globToRegExp(p.replace(/^\/|^\*\*\//g, '')) };
    });
    return envFiles.filter(
      (file) => !matchers.some(({ anchored, re }) => re.test(anchored ? file : path.posix.basename(file)))
    );
  }

  private scanDirectoryForKeys(
    root: string,
    dir: string,
    keysMap: Map<string, string[]>,
    budget: { count: number },
    envByDir: Map<string, Map<string, string>>,
    envFilesFound: string[],
    maxDepth = 8,
    currentDepth = 0
  ) {
    if (currentDepth > maxDepth || budget.count >= MAX_FILES) {
      return;
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      // Python virtualenvs can have any name; they always carry a pyvenv.cfg
      if (currentDepth > 0 && entries.some((e) => e.isFile() && e.name === 'pyvenv.cfg')) {
        return;
      }

      if (currentDepth > 0 && entries.some((e) => e.isFile() && ENV_SOURCE_FILES.includes(e.name))) {
        const relDir = path.relative(root, dir).split(path.sep).join('/');
        this.collectEnvFiles(root, relDir, envByDir, envFilesFound);
      }

      for (const entry of entries) {
        if (budget.count >= MAX_FILES) {
          return;
        }

        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            this.scanDirectoryForKeys(
              root, path.join(dir, entry.name), keysMap, budget, envByDir, envFilesFound, maxDepth, currentDepth + 1
            );
          }
        } else if (entry.isFile()) {
          if (!isScannableCodeFile(entry.name)) {
            continue;
          }

          const filePath = path.join(dir, entry.name);
          try {
            if (fs.statSync(filePath).size > MAX_FILE_BYTES) {
              continue;
            }
            budget.count++;
            const content = fs.readFileSync(filePath, 'utf8');
            const relative = path.relative(root, filePath).split(path.sep).join('/');
            for (const k of this.extractVariablesFromCode(content)) {
              const list = keysMap.get(k) || [];
              if (!list.includes(relative)) {
                list.push(relative);
              }
              keysMap.set(k, list);
            }
          } catch {
            // Ignore unreadable files
          }
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }
}

/** Code files the env scanner reads (not minified bundles, type declarations or oversized files). */
export function isScannableCodeFile(fileName: string, sizeBytes = 0): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) && !fileName.endsWith('.min.js') && !fileName.endsWith('.d.ts') && sizeBytes <= MAX_FILE_BYTES;
}

/**
 * Value of `key` as seen by one source file, which reads env files in its own folder and
 * every parent folder. Returns the first non-empty value, '' if only blank definitions
 * exist, or undefined if the file can't see the key at all.
 */
function lookupKeyForFile(
  key: string,
  file: string,
  envByDir: Map<string, Map<string, string>>
): string | undefined {
  let found: string | undefined;
  let dir = path.posix.dirname(file);
  for (;;) {
    const val = envByDir.get(dir === '.' ? '' : dir)?.get(key);
    if (val) return val;
    if (val === '') found = '';
    if (dir === '.' || dir === '') break;
    dir = path.posix.dirname(dir);
  }
  return found;
}

function findClosingQuote(val: string, quote: string): number {
  for (let i = 1; i < val.length; i++) {
    if (val[i] === '\\') {
      i++;
    } else if (val[i] === quote) {
      return i;
    }
  }
  return -1;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}
