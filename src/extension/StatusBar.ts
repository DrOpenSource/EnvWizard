import * as vscode from 'vscode';
import { PortInfo } from '../shared/types.js';
import { translateError } from '../shared/glossary.js';
import {
  PortServices,
  confirmAndUnjam,
  enrichPorts,
  getWatchedPorts,
  radarOfflineMessage,
} from './actions.js';

interface PortPickItem extends vscode.QuickPickItem {
  port?: number;
  cleanSlate?: boolean;
}

export class StatusBarController {
  private statusBarItem: vscode.StatusBarItem;
  private timer?: NodeJS.Timeout;
  private scanning = false;
  private readonly onDidScanEmitter = new vscode.EventEmitter<{ ports: PortInfo[]; scanOk: boolean }>();
  /** Fires after every background scan so the Dev Deck can stay in sync without its own polling. */
  public readonly onDidScan = this.onDidScanEmitter.event;

  constructor(private readonly services: PortServices) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'envwizard.scanPorts';
    this.statusBarItem.text = '$(plug) Dev';
    this.statusBarItem.show();
  }

  startMonitoring(intervalMs = 5000) {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.checkHealth();
    this.timer = setInterval(() => this.checkHealth(), intervalMs);
  }

  stopMonitoring() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.statusBarItem.dispose();
    this.onDidScanEmitter.dispose();
  }

  async checkHealth() {
    // Skip a tick rather than piling up overlapping netstat/lsof calls on slow machines
    if (this.scanning) return;
    this.scanning = true;
    try {
      const busy = await this.services.scanner.scanDevPorts(getWatchedPorts());
      const scanOk = this.services.scanner.lastScanOk;

      if (!scanOk) {
        this.statusBarItem.text = '$(plug) Dev: Radar Offline';
        this.statusBarItem.tooltip = radarOfflineMessage();
        this.statusBarItem.backgroundColor = undefined;
      } else if (busy.length === 0) {
        this.statusBarItem.text = '$(plug) Dev: All Clear';
        this.statusBarItem.tooltip = 'EnvWizard: All watched dev ports are free and ready!';
        this.statusBarItem.backgroundColor = undefined;
      } else {
        const ports = [...new Set(busy.map((b) => b.port))].sort((a, b) => a - b);
        const shown = ports.slice(0, 3).map((p) => `:${p}`).join(' ');
        const more = ports.length > 3 ? ` +${ports.length - 3}` : '';
        this.statusBarItem.text = `$(plug) Busy ${shown}${more}`;
        this.statusBarItem.tooltip = `EnvWizard: Ports ${ports.join(', ')} are in use. Click to see what's running or free them.`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.warningBackground'
        );
      }

      this.onDidScanEmitter.fire({ ports: busy, scanOk });
    } catch {
      // Quiet fallback
    } finally {
      this.scanning = false;
    }
  }

  async showPortMenu() {
    const raw = await this.services.scanner.scanDevPorts(getWatchedPorts());

    if (!this.services.scanner.lastScanOk) {
      vscode.window.showWarningMessage(radarOfflineMessage());
      return;
    }

    if (raw.length === 0) {
      const choice = await vscode.window.showInformationMessage(
        '🔌 EnvWizard: All watched dev ports are clean & free!',
        'Check .env Health',
        'Done'
      );
      if (choice === 'Check .env Health') {
        vscode.commands.executeCommand('envwizard.auditEnv');
      }
      return;
    }

    const busy = await enrichPorts(raw, this.services);
    const translation = translateError('EADDRINUSE');
    const items: PortPickItem[] = busy.map((p) => ({
      port: p.port,
      label: `${p.isProtected ? '$(shield)' : '$(debug-disconnect)'} Port :${p.port}`,
      description: `${p.processName}${p.isDatabase ? ' (database)' : ''}`,
      detail: p.isProtected
        ? 'Protected program — EnvWizard will not stop it.'
        : p.summary || `${translation.headline} — select to safely free this port.`,
    }));

    items.push({
      cleanSlate: true,
      label: '$(trash) 1-Click Clean Slate',
      description: 'Stop all background dev servers',
      detail: 'Databases and protected programs are left alone.',
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a busy port to free it safely:',
    });

    if (!selected) {
      return;
    }

    if (selected.cleanSlate) {
      await vscode.commands.executeCommand('envwizard.cleanSlate');
    } else if (selected.port) {
      await confirmAndUnjam(selected.port, this.services);
      await this.checkHealth();
    }
  }
}
