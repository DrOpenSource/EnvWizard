import * as vscode from 'vscode';
import { LicenseManager } from '../core/LicenseManager.js';

export type ProFeatureId = 'autoUnjam' | 'envWatcher' | 'snapshots' | 'portRouter';

export interface ProFeatureMetadata {
  id: ProFeatureId;
  settingKey: string;
  title: string;
  description: string;
}

export const PRO_FEATURES: Record<ProFeatureId, ProFeatureMetadata> = {
  autoUnjam: {
    id: 'autoUnjam',
    settingKey: 'envwizard.autoUnjam',
    title: 'Background Auto-Unjam',
    description: 'Automatically frees port jams caused by previous runs of this project without asking.',
  },
  envWatcher: {
    id: 'envWatcher',
    settingKey: 'envwizard.envWatcher',
    title: 'Live Env Watcher',
    description: 'Checks for newly referenced environment variables on file save.',
  },
  snapshots: {
    id: 'snapshots',
    settingKey: 'envwizard.snapshots',
    title: 'Encrypted .env Snapshots',
    description: 'Automatically creates encrypted local snapshots before env file modifications.',
  },
  portRouter: {
    id: 'portRouter',
    settingKey: 'envwizard.portRouter',
    title: 'Multi-Project Port Router',
    description: 'Reruns conflicting projects on alternate available ports.',
  },
};

export interface ProGatingServices {
  licenseManager: LicenseManager;
  globalState: vscode.Memento;
  configOverride?: (settingKey: string) => boolean | undefined;
  showMessageFn?: (msg: string, ...items: string[]) => Thenable<string | undefined>;
  openBuyLicenseFn?: () => Thenable<unknown>;
}

/**
 * Checks whether a Pro feature is enabled.
 * Returns true only if:
 * 1. The feature's own setting is enabled by the user (all Pro automations are opt-in).
 * 2. The user has an active Pro license.
 *
 * If a Free-tier user turns on a Pro setting, shows a single dismissible notification
 * with a "Learn More" link, remembers it in globalState, and never repeats it.
 */
export async function isProFeatureEnabled(
  id: ProFeatureId,
  services: ProGatingServices
): Promise<boolean> {
  const meta = PRO_FEATURES[id];
  if (!meta) return false;

  const configValue = services.configOverride
    ? services.configOverride(meta.settingKey)
    : vscode.workspace.getConfiguration('envwizard').get<boolean>(id, false);

  // If the user turned off the feature, it is disabled for both Free and Pro users.
  if (!configValue) {
    return false;
  }

  // If the user has an active Pro license, the feature is active.
  if (services.licenseManager.isPro()) {
    return true;
  }

  // Free user turned on a Pro setting: notify once per feature.
  const stateKey = `envwizard.proNoticeShown.${id}`;
  const alreadyNotified = services.globalState.get<boolean>(stateKey, false);

  if (!alreadyNotified) {
    await services.globalState.update(stateKey, true);

    const showMsg = services.showMessageFn || vscode.window.showInformationMessage;
    const actionPromise = showMsg(
      `⭐ ${meta.title} is an EnvWizard Pro feature. It stays off until a Pro license is activated.`,
      'Learn More'
    );

    actionPromise.then((selected) => {
      if (selected === 'Learn More') {
        if (services.openBuyLicenseFn) {
          services.openBuyLicenseFn();
        } else {
          vscode.commands.executeCommand('envwizard.buyLicense');
        }
      }
    });
  }

  return false;
}
