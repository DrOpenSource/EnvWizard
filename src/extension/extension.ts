import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PortScanner } from '../core/PortScanner.js';
import { ProcessInspector } from '../core/ProcessInspector.js';
import { ProcessTerminator } from '../core/ProcessTerminator.js';
import { EnvHealer } from '../core/EnvHealer.js';
import { LicenseManager } from '../core/LicenseManager.js';
import { StatusBarController } from './StatusBar.js';
import { DevDeckViewProvider } from './DevDeckView.js';
import { PortServices, ProcessDetailsCache, cleanSlate, confirmAndUnjam } from './actions.js';
import { TerminalJamAlerts } from './terminalAlert.js';
import { isProFeatureEnabled } from './pro.js';

// Pricing section of the website (Pro status and what's coming; see docs/CLAIMS.md)
const PRODUCT_URL = 'https://envwizard.taqnik.in/#pricing';

/**
 * The folder to audit: the one containing the active editor, otherwise the first workspace folder.
 */
function getWorkspaceRoot(): string | undefined {
  const active = vscode.window.activeTextEditor?.document.uri;
  const folder = (active && vscode.workspace.getWorkspaceFolder(active)) || vscode.workspace.workspaceFolders?.[0];
  return folder?.uri.fsPath;
}

function getScanIntervalMs(): number {
  const seconds = vscode.workspace.getConfiguration('envwizard').get<number>('scanIntervalSeconds') ?? 5;
  return Math.max(2, seconds) * 1000;
}

export async function activate(context: vscode.ExtensionContext) {
  const scanner = new PortScanner();
  const services: PortServices = {
    scanner,
    terminator: new ProcessTerminator(),
    cache: new ProcessDetailsCache(new ProcessInspector()),
  };
  const healer = new EnvHealer();

  // Load stored license key from secure storage
  const storedLicense = await context.secrets.get('envwizard_license_key');
  const licenseManager = new LicenseManager(storedLicense);

  const statusBar = new StatusBarController(services);
  statusBar.startMonitoring(getScanIntervalMs());
  context.subscriptions.push({ dispose: () => statusBar.stopMonitoring() });

  const devDeckProvider = new DevDeckViewProvider(
    context.extensionUri,
    services,
    healer,
    licenseManager,
    getWorkspaceRoot
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DevDeckViewProvider.viewType, devDeckProvider),
    statusBar.onDidScan(({ ports, scanOk }) => devDeckProvider.updatePorts(ports, scanOk)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('envwizard')) {
        statusBar.startMonitoring(getScanIntervalMs());
        devDeckProvider.updateDeckState();
      }
    })
  );

  const output = vscode.window.createOutputChannel('EnvWizard');
  context.subscriptions.push(output);
  const proGating = { licenseManager, globalState: context.globalState };

  // F1: offer "Free & Rerun" when a dev server in the integrated terminal hits a port jam.
  // F2 (Pro, opt-in): free and rerun old copies of this project without asking.
  const terminalAlerts = new TerminalJamAlerts({
    services,
    workspaceFolders: () => (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath),
    isEnabled: () => vscode.workspace.getConfiguration('envwizard').get<boolean>('terminalDetection') ?? true,
    onDidFreePort: async () => {
      await statusBar.checkHealth();
      await devDeckProvider.updateDeckState();
    },
    isAutoUnjamEnabled: () => isProFeatureEnabled('autoUnjam', proGating),
    log: (line) => output.appendLine(line),
  });
  terminalAlerts.start();
  context.subscriptions.push(
    // A free user who turns on a Pro setting hears about it once, right away
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('envwizard.autoUnjam')) void isProFeatureEnabled('autoUnjam', proGating);
    })
  );
  context.subscriptions.push(terminalAlerts);

  // Re-audit when an env file is saved (debounced)
  let envRefreshTimer: NodeJS.Timeout | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (/^\.env/.test(path.basename(doc.uri.fsPath)) || path.basename(doc.uri.fsPath) === '.gitignore') {
        clearTimeout(envRefreshTimer);
        envRefreshTimer = setTimeout(() => devDeckProvider.updateDeckState(), 1000);
      }
    }),
    { dispose: () => clearTimeout(envRefreshTimer) }
  );

  // Command: Scan & Show Menu
  context.subscriptions.push(
    vscode.commands.registerCommand('envwizard.scanPorts', async () => {
      await statusBar.showPortMenu();
      await devDeckProvider.updateDeckState();
    })
  );

  // Command: Unjam Port (optionally called with a port number from the Dev Deck)
  context.subscriptions.push(
    vscode.commands.registerCommand('envwizard.unjamPort', async (portArg?: number) => {
      let port = typeof portArg === 'number' ? portArg : undefined;
      if (port === undefined) {
        const input = await vscode.window.showInputBox({
          prompt: 'Enter the port number to free (e.g. 3000, 5173, 8000):',
          validateInput: (val) => {
            const num = Number(val);
            return !Number.isInteger(num) || num <= 0 || num > 65535
              ? 'Please enter a valid port number (1-65535)'
              : null;
          },
        });
        if (!input) return;
        port = Number(input);
      }

      await confirmAndUnjam(port, services);
      await statusBar.checkHealth();
      await devDeckProvider.updateDeckState();
    })
  );

  // Command: Clean Slate (stop all dev servers on watched ports)
  context.subscriptions.push(
    vscode.commands.registerCommand('envwizard.cleanSlate', async () => {
      await cleanSlate(services);
      await statusBar.checkHealth();
      await devDeckProvider.updateDeckState();
    })
  );

  // Command: Audit & Heal .env
  context.subscriptions.push(
    vscode.commands.registerCommand('envwizard.auditEnv', async () => {
      const root = getWorkspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage('Please open a project folder to check .env health.');
        return;
      }

      const report = healer.auditWorkspace(root);

      if (report.notGitignored.length > 0) {
        const fix = 'Add to .gitignore';
        const choice = await vscode.window.showWarningMessage(
          `⚠️ ${report.notGitignored.join(', ')} ${report.notGitignored.length === 1 ? 'is' : 'are'} not in .gitignore — your secret keys could be committed to git.`,
          fix,
          'Ignore'
        );
        if (choice === fix) {
          appendToGitignore(root, report.notGitignored);
        }
      }

      if (report.trackedByGit.length > 0) {
        const untrack = 'Stop Tracking (keep file)';
        const files = report.trackedByGit.join(', ');
        const choice = await vscode.window.showWarningMessage(
          `⚠️ ${files} ${report.trackedByGit.length === 1 ? 'is' : 'are'} already committed to git, so .gitignore alone won't keep your secrets out of future commits.`,
          {
            modal: true,
            detail:
              'EnvWizard can stop git tracking the file. Your file stays on disk, unchanged. Commit the change afterwards.\n\n' +
              'If you already pushed it, treat those keys as leaked and create new ones.',
          },
          untrack
        );
        if (choice === untrack) {
          try {
            healer.untrackFiles(root, report.trackedByGit);
            vscode.window.showInformationMessage(`🛡️ git no longer tracks ${files}. Commit this change to make it stick.`);
          } catch (err) {
            vscode.window.showErrorMessage(`❌ Couldn't untrack ${files}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      const toAdd = [
        ...report.missingInEnv.map((m) => ({ key: m.key, defaultValue: m.suggestedValue || '' })),
        ...report.templateDrift.map((d) => ({ key: d.key, defaultValue: d.suggestedValue || '' })),
      ];
      const targetName = path.basename(report.healTargetPath);

      if (toAdd.length === 0) {
        if (report.emptyInEnv.length > 0) {
          const keys = report.emptyInEnv.map((e) => e.key);
          const open = 'Open .env';
          const choice = await vscode.window.showWarningMessage(
            `✏️ ${keys.length} key${keys.length === 1 ? ' is' : 's are'} still blank: ${summarizeKeys(keys)}. Your app may not work until you fill ${keys.length === 1 ? 'it' : 'them'} in.`,
            open
          );
          if (choice === open) {
            await openEnvAtKey(report.envPath || report.healTargetPath, keys[0]);
          }
        } else {
          vscode.window.showInformationMessage(
            `✅ Secret Box Healthy: every variable your code uses has a value (${report.totalKeysDefined} keys defined).`
          );
        }
        await devDeckProvider.updateDeckState();
        return;
      }

      const add = `✨ Add to ${targetName}`;
      const choice = await vscode.window.showInformationMessage(
        `🧩 Your code uses ${toAdd.length} variable${toAdd.length === 1 ? '' : 's'} that ${toAdd.length === 1 ? "isn't" : "aren't"} in your env files: ${summarizeKeys(toAdd.map((m) => m.key))}. Add placeholders to ${targetName} so you can fill them in?`,
        add,
        'Cancel'
      );

      if (choice === add) {
        healer.appendMissingKeys(report.healTargetPath, toAdd);
        await openEnvAtKey(report.healTargetPath, toAdd[0].key);
        vscode.window.showInformationMessage(
          `✨ Added ${toAdd.length} placeholder${toAdd.length === 1 ? '' : 's'} to ${targetName}. Paste in the real values and save.`
        );
      }
      await devDeckProvider.updateDeckState();
    })
  );

  // Command: Activate Pro License
  context.subscriptions.push(
    vscode.commands.registerCommand('envwizard.activateLicense', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter your EnvWizard Pro License Key (from your Gumroad receipt):',
        placeHolder: 'XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX',
        ignoreFocusOut: true,
      });

      if (!input) return;

      const success = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Checking your license…' },
        () => licenseManager.activate(input)
      );
      if (success) {
        await context.secrets.store('envwizard_license_key', input.trim());
        vscode.window.showInformationMessage('⭐ EnvWizard Pro activated. Thank you for your support!');
      } else if (licenseManager.lastActivationError === 'offline') {
        vscode.window.showErrorMessage(
          "🌐 Couldn't reach the license server. Activation needs internet once; after that Pro works offline."
        );
      } else {
        vscode.window.showErrorMessage(
          '❌ That license key was not recognized. Copy it exactly from your Gumroad receipt, or email support@taqnik.in.'
        );
      }

      await devDeckProvider.updateDeckState();
    })
  );

  // Command: About EnvWizard Pro (opens the pricing page)
  context.subscriptions.push(
    vscode.commands.registerCommand('envwizard.buyLicense', async () => {
      await vscode.env.openExternal(vscode.Uri.parse(PRODUCT_URL));
    })
  );

  // Integration tests drive the terminal alert through this; nothing is exported otherwise
  return context.extensionMode === vscode.ExtensionMode.Test ? { terminalAlerts } : undefined;
}

function summarizeKeys(keys: string[]): string {
  return keys.length <= 4 ? keys.join(', ') : `${keys.slice(0, 4).join(', ')} +${keys.length - 4} more`;
}

async function openEnvAtKey(envPath: string, key: string) {
  const doc = await vscode.workspace.openTextDocument(envPath);
  const line = doc.getText().split(/\r?\n/).findIndex((l) => l.startsWith(`${key}=`));
  const pos = new vscode.Position(Math.max(0, line), key.length + 1);
  await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos) });
}

/**
 * Appends env file names to .gitignore without touching existing lines.
 */
function appendToGitignore(root: string, files: string[]) {
  const gitignorePath = path.join(root, '.gitignore');
  const current = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  const prefix = current && !current.endsWith('\n') ? current + eol : current;
  fs.writeFileSync(
    gitignorePath,
    prefix + `${prefix ? eol : ''}# Secret env files (added by EnvWizard)${eol}${files.join(eol)}${eol}`,
    'utf8'
  );
  vscode.window.showInformationMessage(`🛡️ Added ${files.join(', ')} to .gitignore.`);
}

export function deactivate() {}
