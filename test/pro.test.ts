import { describe, it, expect, vi } from 'vitest';
import { isProFeatureEnabled, PRO_FEATURES } from '../src/extension/pro.js';
import { LicenseManager } from '../src/core/LicenseManager.js';

class MockMemento {
  private map = new Map<string, unknown>();

  get<T>(key: string, defaultValue?: T): T {
    return (this.map.has(key) ? this.map.get(key) : defaultValue) as T;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }
}

describe('isProFeatureEnabled', () => {
  it('returns false when the feature setting is disabled, even if user is Pro', async () => {
    const proLicense = new LicenseManager('valid-key');
    const memento = new MockMemento();

    const enabled = await isProFeatureEnabled('autoUnjam', {
      licenseManager: proLicense,
      globalState: memento,
      configOverride: () => false,
    });

    expect(enabled).toBe(false);
  });

  it('returns true when the feature setting is enabled and user is Pro', async () => {
    const proLicense = new LicenseManager('valid-key');
    const memento = new MockMemento();

    const enabled = await isProFeatureEnabled('autoUnjam', {
      licenseManager: proLicense,
      globalState: memento,
      configOverride: () => true,
    });

    expect(enabled).toBe(true);
  });

  it('returns false when user is on Free tier and setting is disabled without showing notice', async () => {
    const freeLicense = new LicenseManager();
    const memento = new MockMemento();
    const showMsg = vi.fn().mockResolvedValue(undefined);

    const enabled = await isProFeatureEnabled('envWatcher', {
      licenseManager: freeLicense,
      globalState: memento,
      configOverride: () => false,
      showMessageFn: showMsg,
    });

    expect(enabled).toBe(false);
    expect(showMsg).not.toHaveBeenCalled();
  });

  it('shows a notice once when Free user turns on a Pro setting, and never repeats it', async () => {
    const freeLicense = new LicenseManager();
    const memento = new MockMemento();
    const showMsg = vi.fn().mockResolvedValue(undefined);

    // First call with setting enabled on free tier
    const res1 = await isProFeatureEnabled('autoUnjam', {
      licenseManager: freeLicense,
      globalState: memento,
      configOverride: () => true,
      showMessageFn: showMsg,
    });

    expect(res1).toBe(false);
    expect(showMsg).toHaveBeenCalledTimes(1);
    expect(showMsg).toHaveBeenCalledWith(
      expect.stringContaining('Background Auto-Unjam is an EnvWizard Pro feature'),
      'Learn More'
    );
    expect(memento.get('envwizard.proNoticeShown.autoUnjam')).toBe(true);

    // Second call: notice should not be repeated
    const res2 = await isProFeatureEnabled('autoUnjam', {
      licenseManager: freeLicense,
      globalState: memento,
      configOverride: () => true,
      showMessageFn: showMsg,
    });

    expect(res2).toBe(false);
    expect(showMsg).toHaveBeenCalledTimes(1); // Still 1!
  });

  it('triggers buy license callback when user clicks Learn More', async () => {
    const freeLicense = new LicenseManager();
    const memento = new MockMemento();
    const showMsg = vi.fn().mockResolvedValue('Learn More');
    const buyLicense = vi.fn().mockResolvedValue(undefined);

    await isProFeatureEnabled('snapshots', {
      licenseManager: freeLicense,
      globalState: memento,
      configOverride: () => true,
      showMessageFn: showMsg,
      openBuyLicenseFn: buyLicense,
    });

    expect(buyLicense).toHaveBeenCalledTimes(1);
  });
});
