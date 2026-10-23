import * as fs from 'node:fs';
import * as path from 'node:path';
import { ENV_SOURCE_FILES, EnvHealer } from '../core/EnvHealer.js';
import { buildEnvExample } from '../core/EnvTemplate.js';

export type EnvExampleResult =
  | { kind: 'no-env' }
  | { kind: 'created'; examplePath: string; keys: number }
  | { kind: 'updated'; examplePath: string; added: string[] }
  | { kind: 'in-sync'; examplePath: string };

/**
 * F7: creates `.env.example` from the env files in `root` (keys only, comments and order kept),
 * or, when it already exists, appends the keys it is missing. Never rewrites an existing file.
 */
export function syncEnvExample(root: string, healer: EnvHealer): EnvExampleResult {
  const sources = ENV_SOURCE_FILES.map((name) => path.join(root, name)).filter((p) => fs.existsSync(p));
  if (sources.length === 0) return { kind: 'no-env' };

  const examplePath = path.join(root, '.env.example');
  const created = !fs.existsSync(examplePath);
  if (created) {
    fs.writeFileSync(examplePath, buildEnvExample(fs.readFileSync(sources[0], 'utf8')), 'utf8');
  }

  const existing = healer.parseEnv(fs.readFileSync(examplePath, 'utf8'));
  const missing = new Set<string>();
  for (const source of sources) {
    for (const key of healer.parseEnv(fs.readFileSync(source, 'utf8')).keys()) {
      if (!existing.has(key)) missing.add(key);
    }
  }
  if (missing.size > 0) {
    healer.appendMissingKeys(examplePath, [...missing].map((key) => ({ key, defaultValue: '' })));
  }

  if (created) return { kind: 'created', examplePath, keys: healer.parseEnv(fs.readFileSync(examplePath, 'utf8')).size };
  return missing.size > 0 ? { kind: 'updated', examplePath, added: [...missing] } : { kind: 'in-sync', examplePath };
}

export function envExampleMessage(result: EnvExampleResult): string {
  switch (result.kind) {
    case 'no-env':
      return "There's no .env file in this folder to build a template from yet.";
    case 'created':
      return `📄 Created .env.example with ${result.keys} key${result.keys === 1 ? '' : 's'} and no values. It's safe to commit, so others know which keys to set.`;
    case 'updated':
      return `📄 Added ${result.added.length} new key${result.added.length === 1 ? '' : 's'} to .env.example. Existing lines were left as they were.`;
    case 'in-sync':
      return '✅ .env.example already lists every key in your env files.';
  }
}
