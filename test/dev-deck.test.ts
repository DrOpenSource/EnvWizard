import { describe, it, expect } from 'vitest';
import * as vm from 'node:vm';
import { DevDeckViewProvider } from '../src/extension/DevDeckView.js';
import { summarizeCommand } from '../src/extension/actions.js';

function renderHtml(): string {
  const provider = new DevDeckViewProvider(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    () => undefined
  );
  const webview = { cspSource: 'vscode-resource:' };
  return (provider as unknown as { getHtmlForWebview(w: unknown): string }).getHtmlForWebview(webview);
}

describe('Dev Deck webview', () => {
  it('ships a script that parses (a syntax error here blanks the whole panel)', () => {
    const html = renderHtml();
    const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];

    expect(script).toBeDefined();
    expect(() => new vm.Script(script!)).not.toThrow();
  });

  it('uses a nonce-based CSP and no inline event handlers', () => {
    const html = renderHtml();

    expect(html).toContain('Content-Security-Policy');
    expect(html).not.toMatch(/\son(click|load|error)=/i);
  });

  it('renders state updates and escapes process names', () => {
    const html = renderHtml();
    const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)![1];

    // Tiny DOM stand-in: enough for the render functions
    const elements: Record<string, { innerHTML: string; textContent: string; classList: { add(): void } }> = {};
    const el = (id: string) =>
      (elements[id] ??= { innerHTML: '', textContent: '', classList: { add() {} } });
    let onMessage: ((e: { data: unknown }) => void) | undefined;
    const posted: unknown[] = [];

    vm.runInNewContext(script, {
      acquireVsCodeApi: () => ({ postMessage: (m: unknown) => posted.push(m) }),
      document: { getElementById: el, addEventListener() {} },
      window: { addEventListener: (_: string, fn: typeof onMessage) => (onMessage = fn) },
    });

    expect(posted).toEqual([{ type: 'ready' }]);

    onMessage!({
      data: {
        type: 'stateUpdate',
        scanOk: true,
        ports: [{ port: 3000, pid: 1, processName: '<img src=x>', isProtected: false, isDatabase: false }],
        envReport: {
          envFilesFound: ['.env'],
          notGitignored: [],
          totalKeysDefined: 2,
          missingInEnv: [{ key: 'OPENAI_API_KEY', sourceFiles: ['src/a.ts'] }],
          emptyInEnv: [],
          templateDrift: [],
        },
        licenseStatus: { isPro: false },
      },
    });

    expect(elements.portsList.innerHTML).toContain('data-port="3000"');
    expect(elements.portsList.innerHTML).toContain('&lt;img src=x&gt;');
    expect(elements.envStatus.innerHTML).toContain('OPENAI_API_KEY');
    expect(elements.envStatus.innerHTML).not.toContain('${');
  });
});

describe('summarizeCommand', () => {
  it('turns a raw command line into a short, readable description', () => {
    expect(
      summarizeCommand({ pid: 1, name: 'node.exe', commandLine: '"C:\\Program Files\\nodejs\\node.exe" node_modules/.bin/next dev' })
    ).toBe('node node_modules/.bin/next dev');
    expect(summarizeCommand({ pid: 1, name: 'x' })).toBeUndefined();
  });
});
