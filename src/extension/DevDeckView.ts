import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import { EnvHealer } from '../core/EnvHealer.js';
import { LicenseManager } from '../core/LicenseManager.js';
import { PortInfo } from '../shared/types.js';
import { PortServices, enrichPorts, getWatchedPorts } from './actions.js';

export class DevDeckViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'envwizard.devDeck';
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly services: PortServices,
    private readonly healer: EnvHealer,
    private readonly licenseManager: LicenseManager,
    private readonly getWorkspaceRoot: () => string | undefined
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.updateDeckState();
    });

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'ready':
        case 'refresh':
          await this.updateDeckState();
          break;
        case 'unjam':
          if (typeof data.port === 'number') {
            await vscode.commands.executeCommand('envwizard.unjamPort', data.port);
          }
          break;
        case 'cleanSlate':
          await vscode.commands.executeCommand('envwizard.cleanSlate');
          break;
        case 'healEnv':
          await vscode.commands.executeCommand('envwizard.auditEnv');
          break;
        case 'activateLicense':
          await vscode.commands.executeCommand('envwizard.activateLicense');
          break;
        case 'buyLicense':
          await vscode.commands.executeCommand('envwizard.buyLicense');
          break;
      }
    });
  }

  /** Cheap update from the status bar's background scan (ports only, no workspace scan). */
  public async updatePorts(ports: PortInfo[], scanOk: boolean) {
    if (!this.view?.visible) return;
    try {
      const enriched = await enrichPorts(ports, this.services);
      this.view.webview.postMessage({ type: 'ports', ports: enriched, scanOk });
    } catch {
      // Quiet
    }
  }

  public async updateDeckState() {
    if (!this.view) return;

    try {
      const raw = await this.services.scanner.scanDevPorts(getWatchedPorts());
      const ports = await enrichPorts(raw, this.services);
      const root = this.getWorkspaceRoot();
      const envReport = root ? this.healer.auditWorkspace(root) : null;

      this.view.webview.postMessage({
        type: 'stateUpdate',
        ports,
        scanOk: this.services.scanner.lastScanOk,
        envReport,
        licenseStatus: this.licenseManager.getStatus(),
      });
    } catch {
      // Quiet
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EnvWizard Dev Deck</title>
  <style>
    :root {
      --bg: var(--vscode-sideBar-background);
      --card-bg: var(--vscode-editorWidget-background, rgba(127, 127, 127, 0.06));
      --border: var(--vscode-widget-border, rgba(127, 127, 127, 0.25));
      --text: var(--vscode-foreground);
      --accent: var(--vscode-button-background, #6366f1);
      --accent-text: var(--vscode-button-foreground, #fff);
      --accent-hover: var(--vscode-button-hoverBackground, #4f46e5);
      --secondary: var(--vscode-button-secondaryBackground, rgba(127, 127, 127, 0.15));
      --secondary-text: var(--vscode-button-secondaryForeground, var(--text));
      --green: var(--vscode-testing-iconPassed, #10b981);
      --amber: var(--vscode-editorWarning-foreground, #f59e0b);
      --red: var(--vscode-errorForeground, #ef4444);
    }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      padding: 12px;
      color: var(--text);
      background: var(--bg);
      margin: 0;
    }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .header h2 { margin: 0; font-size: 1.05rem; font-weight: 700; }
    .badge {
      font-size: 0.7rem; padding: 2px 8px; border-radius: 9999px; font-weight: 600;
      border: 1px solid var(--border); opacity: 0.85;
    }
    .badge.pro { color: var(--green); border-color: var(--green); }
    .btn {
      background: var(--accent); color: var(--accent-text); border: none; padding: 6px 12px;
      border-radius: 4px; font: inherit; font-size: 0.85em; font-weight: 600; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; gap: 4px;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
    .btn-secondary { background: var(--secondary); color: var(--secondary-text); }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground, rgba(127,127,127,0.25)); }
    .btn-block { width: 100%; margin-top: 8px; }
    .row { display: flex; gap: 8px; margin-bottom: 12px; }
    .row .btn { flex: 1; }
    .section-title {
      font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7;
      margin: 16px 0 8px; display: flex; justify-content: space-between; align-items: center;
    }
    .card {
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px;
      padding: 10px; margin-bottom: 8px;
    }
    .port-card { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .port-num { font-weight: 700; }
    .meta { font-size: 0.8em; opacity: 0.75; margin-top: 2px; overflow-wrap: anywhere; }
    .tag { font-size: 0.7em; padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border); margin-left: 4px; }
    .empty-state { padding: 14px; text-align: center; border: 1px dashed var(--border); border-radius: 6px; opacity: 0.85; }
    .issue-head { font-weight: 600; font-size: 0.8em; margin: 6px 0 4px; }
    .issue-head.amber { color: var(--amber); }
    .issue-head.red { color: var(--red); }
    .issue { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--border); font-size: 0.85em; }
    .issue code { font-family: var(--vscode-editor-font-family, monospace); }
    .issue .where { opacity: 0.6; font-size: 0.85em; text-align: right; overflow-wrap: anywhere; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--border); text-align: center; font-size: 0.8em; }
  </style>
</head>
<body>
  <div class="header">
    <h2>🔌 EnvWizard</h2>
    <span class="badge" id="licenseBadge">Free</span>
  </div>

  <div class="row">
    <button class="btn btn-secondary" data-action="refresh">🔄 Refresh</button>
    <button class="btn btn-secondary" data-action="cleanSlate">🧹 Clean Slate</button>
  </div>

  <div class="section-title">
    <span>Port Radar</span>
    <span id="activeCount"></span>
  </div>
  <div id="portsList"><div class="empty-state">Scanning ports…</div></div>

  <div class="section-title"><span>Secret Box (.env) Health</span></div>
  <div id="envStatus"><div class="empty-state">Scanning workspace…</div></div>

  <div class="footer" id="licenseFooter">
    <div style="margin-bottom: 6px;"><strong>EnvWizard Pro</strong> <span style="opacity: 0.7;">• coming in v0.2</span></div>
    <div class="meta" style="margin-bottom: 6px;">Auto-unjam &amp; rerun, a live .env watcher and encrypted .env snapshots. $9.99 once for a personal license. Everything above stays free.</div>
    <button class="btn btn-secondary btn-block" data-action="buyLicense">See what's coming</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function send(type, data) {
      vscode.postMessage(Object.assign({ type }, data || {}));
    }

    function esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const port = target.dataset.port ? Number(target.dataset.port) : undefined;
      send(target.dataset.action, port ? { port } : {});
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'stateUpdate') {
        renderPorts(msg.ports || [], msg.scanOk);
        renderEnv(msg.envReport);
        renderLicense(msg.licenseStatus);
      } else if (msg.type === 'ports') {
        renderPorts(msg.ports || [], msg.scanOk);
      }
    });

    function renderPorts(ports, scanOk) {
      const container = document.getElementById('portsList');
      const countBadge = document.getElementById('activeCount');

      if (scanOk === false) {
        countBadge.textContent = 'offline';
        container.innerHTML = '<div class="empty-state">⚠️ Couldn\\'t read the port list on this machine. On macOS/Linux, make sure <code>lsof</code> (or <code>ss</code>) is installed.</div>';
        return;
      }

      countBadge.textContent = ports.length + ' busy';
      if (ports.length === 0) {
        container.innerHTML = '<div class="empty-state">✨ All watched dev ports are free!</div>';
        return;
      }

      container.innerHTML = ports.map((p) => {
        const tags = (p.isDatabase ? '<span class="tag">database</span>' : '') + (p.isProtected ? '<span class="tag">protected</span>' : '');
        const action = p.isProtected
          ? '<span title="Protected program — EnvWizard will not stop it">🛡️</span>'
          : '<button class="btn btn-secondary" data-action="unjam" data-port="' + esc(p.port) + '">⚡ Free</button>';
        return '<div class="card port-card"><div>'
          + '<div class="port-num">Port :' + esc(p.port) + tags + '</div>'
          + '<div class="meta">' + esc(p.processName || 'dev process') + (p.cwd ? ' • ' + esc(p.cwd) : '') + '</div>'
          + (p.summary ? '<div class="meta">' + esc(p.summary) + '</div>' : '')
          + '</div>' + action + '</div>';
      }).join('');
    }

    function issueList(title, cls, items, whereFn) {
      if (!items.length) return '';
      return '<div class="issue-head ' + cls + '">' + title + '</div>'
        + items.map((m) => '<div class="issue"><code>' + esc(m.key) + '</code><span class="where">' + esc(whereFn(m)) + '</span></div>').join('');
    }

    function renderEnv(report) {
      const container = document.getElementById('envStatus');
      if (!report) {
        container.innerHTML = '<div class="empty-state">Open a project folder to check its .env health.</div>';
        return;
      }

      const files = (report.envFilesFound || []).join(', ') || 'no .env file yet';
      const total = report.missingInEnv.length + report.templateDrift.length + report.emptyInEnv.length;
      let html = '';

      if ((report.notGitignored || []).length) {
        html += '<div class="card"><div class="issue-head red">⚠️ Not in .gitignore: ' + esc(report.notGitignored.join(', ')) + '</div>'
          + '<div class="meta">Your secret keys could be committed to git.</div>'
          + '<button class="btn btn-block" data-action="healEnv">🛡️ Fix .env…</button></div>';
      }

      if ((report.trackedByGit || []).length) {
        html += '<div class="card"><div class="issue-head red">⚠️ Already committed to git: ' + esc(report.trackedByGit.join(', ')) + '</div>'
          + '<div class="meta">.gitignore alone won\\'t stop it. Use Fix .env to stop tracking it.</div>'
          + '<button class="btn btn-block" data-action="healEnv">🛡️ Fix .env…</button></div>';
      }

      if (total === 0) {
        html += '<div class="empty-state">✅ Secret box is in sync with your code (' + esc(report.totalKeysDefined) + ' keys in ' + esc(files) + ')</div>';
        container.innerHTML = html;
        return;
      }

      const usedIn = (m) => 'used in ' + m.sourceFiles.slice(0, 2).join(', ') + (m.sourceFiles.length > 2 ? ' +' + (m.sourceFiles.length - 2) : '');
      html += '<div class="card">';
      html += issueList('🧩 Missing (' + report.missingInEnv.length + ')', 'amber', report.missingInEnv, usedIn);
      html += issueList('✏️ Empty — needs a value (' + report.emptyInEnv.length + ')', 'amber', report.emptyInEnv, usedIn);
      html += issueList('📋 In .env.example only (' + report.templateDrift.length + ')', '', report.templateDrift, () => 'template');
      html += '<div class="meta" style="margin-top: 6px;">Checked: ' + esc(files) + '</div>';
      html += '<button class="btn btn-block" data-action="healEnv">✨ Fix .env…</button>';
      html += '</div>';
      container.innerHTML = html;
    }

    function renderLicense(license) {
      const badge = document.getElementById('licenseBadge');
      const footer = document.getElementById('licenseFooter');

      if (license && license.isPro) {
        badge.textContent = '⭐ Pro';
        badge.classList.add('pro');
        footer.innerHTML = '<span>⭐ Pro activated — thank you for supporting EnvWizard!</span>';
      } else {
        badge.textContent = 'Free';
      }
    }

    send('ready');
  </script>
</body>
</html>`;
  }
}
