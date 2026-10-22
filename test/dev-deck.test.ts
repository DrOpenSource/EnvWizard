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

describe('Dev Deck v0.2 sections', () => {
  function boot() {
    const script = renderHtml().match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)![1];
    const elements: Record<string, { innerHTML: string; textContent: string; classList: { add(): void } }> = {};
    const el = (id: string) => (elements[id] ??= { innerHTML: '', textContent: '', classList: { add() {} } });
    let onMessage: ((e: { data: unknown }) => void) | undefined;
    vm.runInNewContext(script, {
      acquireVsCodeApi: () => ({ postMessage() {} }),
      document: { getElementById: el, addEventListener() {} },
      window: { addEventListener: (_: string, fn: typeof onMessage) => (onMessage = fn) },
    });
    const update = (extra: Record<string, unknown>) =>
      onMessage!({
        data: {
          type: 'stateUpdate',
          scanOk: true,
          ports: [],
          envReport: {
            envFilesFound: ['.env'],
            notGitignored: [],
            trackedByGit: [],
            totalKeysDefined: 1,
            missingInEnv: [],
            emptyInEnv: [],
            templateDrift: [],
            valueHints: [{ key: 'API_URL', file: '.env', hint: 'doesn\'t look like a full URL <b>' }],
          },
          licenseStatus: { isPro: false },
          ...extra,
        },
      });
    return { elements, update };
  }

  it('shows a folder picker only for multi-root workspaces', () => {
    const { elements, update } = boot();
    update({ folders: [{ name: 'web', path: '/w/web' }], envRoot: '/w/web' });
    expect(elements.folderPicker.innerHTML).toBe('');
    update({ folders: [{ name: 'web', path: '/w/web' }, { name: 'api', path: '/w/api' }], envRoot: '/w/api' });
    expect(elements.folderPicker.innerHTML).toContain('<option value="/w/api" selected>');
  });

  it('shows value hints (escaped) and the .env.example button even when healthy', () => {
    const { elements, update } = boot();
    update({});
    expect(elements.envStatus.innerHTML).toContain('Secret box is in sync');
    expect(elements.envStatus.innerHTML).toContain('Worth a look (1)');
    expect(elements.envStatus.innerHTML).toContain('&lt;b&gt;');
    expect(elements.envStatus.innerHTML).toContain('data-action="envExample"');
  });

  it('tells Pro users their features are opt-in', () => {
    const { elements, update } = boot();
    update({ licenseStatus: { isPro: true } });
    expect(elements.licenseFooter.innerHTML).toContain('data-action="openSettings"');
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
