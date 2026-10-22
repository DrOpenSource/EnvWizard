
/**
 * Line-level tools for env files (F7, free): a `.env.example` generator and soft hints about
 * values that look wrong. Hints name the key and the problem, never the value.
 */

interface EnvLine {
  key: string;
  /** "export " when the line uses it. */
  prefix: string;
  /** Everything after "=" on the first line, untrimmed. */
  raw: string;
  /** The value as the app sees it (quotes removed, inline comment dropped). */
  value: string;
  quote?: string;
  /** Index of the first and last line this entry spans (multiline quoted values). */
  first: number;
  last: number;
}

function scanEnvLines(content: string): { lines: string[]; entries: EnvLine[] } {
  const lines = content.split(/\r?\n/);
  const entries: EnvLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = lines[i].indexOf('=');
    if (eq <= 0) continue;

    const left = lines[i].substring(0, eq).trim();
    const prefix = /^export\s+/.test(left) ? 'export ' : '';
    const key = left.replace(/^export\s+/, '');
    const raw = lines[i].substring(eq + 1);
    const first = i;
    let val = raw.trim();
    const quote = val[0] === '"' || val[0] === "'" || val[0] === '`' ? val[0] : undefined;

    if (quote) {
      let end = findClosingQuote(val, quote);
      while (end === -1 && i + 1 < lines.length) {
        val += '\n' + lines[++i];
        end = findClosingQuote(val, quote);
      }
      val = end === -1 ? val.substring(1) : val.substring(1, end);
    } else {
      const comment = val.search(/\s#/);
      if (comment !== -1) val = val.substring(0, comment).trimEnd();
    }
    entries.push({ key, prefix, raw, value: val, quote, first, last: i });
  }
  return { lines, entries };
}

/**
 * A `.env.example` from an env file: same keys, comments, blank lines and order, with every
 * value removed. Inline comments after values are dropped too, since they sit next to secrets.
 */
export function buildEnvExample(envContent: string): string {
  const eol = envContent.includes('\r\n') ? '\r\n' : '\n';
  const { lines, entries } = scanEnvLines(envContent);
  const byFirstLine = new Map(entries.map((e) => [e.first, e]));
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const entry = byFirstLine.get(i);
    if (entry) {
      out.push(`${entry.prefix}${entry.key}=`);
      i = entry.last;
    } else if (!lines[i].trim() || lines[i].trim().startsWith('#')) {
      out.push(lines[i]);
    }
    // Anything else (stray text without "=") could be a pasted secret: leave it out
  }
  return out.join(eol);
}

export interface ValueHint {
  key: string;
  /** Env file the key is in, relative to the workspace (e.g. ".env.local"). */
  file: string;
  hint: string;
}

/**
 * Soft hints for values that are probably a mistake. Never blocks anything.
 */
export function findValueHints(envContent: string, file: string): ValueHint[] {
  const hints: ValueHint[] = [];
  for (const e of scanEnvLines(envContent).entries) {
    const add = (hint: string) => hints.push({ key: e.key, file, hint });
    const v = e.value;
    const rawValue = e.raw.trim();

    // KEY=""abc"" parses as empty; KEY="'abc'" keeps the inner quote marks
    if (/^(""|'')[^"'\s]/.test(rawValue) || (e.quote && v.length >= 2 && /^(["'`]).*\1$/s.test(v))) {
      add('is wrapped in two sets of quotes, so the app will see the quote marks (or an empty value)');
      continue;
    }
    if (!v) continue;

    // dotenv trims unquoted values, so spaces only matter inside quotes
    if (e.quote && /^\s|\s$/.test(v)) {
      add('has a space at the start or end inside the quotes, which usually comes from copy-paste');
    }

    if (e.key === 'OPENAI_API_KEY' && !v.startsWith('sk-') && !v.includes('${')) {
      add('OpenAI keys start with "sk-"');
    }

    if (/_(URL|URI)$/.test(e.key) && !v.includes('${') && !/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(v)) {
      add('doesn\'t look like a full URL (e.g. "https://…" or "postgres://…")');
    }
  }
  return hints;
}

/** Index of the closing quote, skipping backslash-escaped characters; -1 if not on this text. */
export function findClosingQuote(val: string, quote: string): number {
  for (let i = 1; i < val.length; i++) {
    if (val[i] === '\\') {
      i++;
    } else if (val[i] === quote) {
      return i;
    }
  }
  return -1;
}
