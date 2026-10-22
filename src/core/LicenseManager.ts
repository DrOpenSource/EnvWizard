import { LicenseStatus } from '../shared/types.js';

export type LicenseCheckResult = 'valid' | 'invalid' | 'offline';

export class LicenseManager {
  private currentStatus: LicenseStatus;
  private gumroadPermalink: string;
  private gumroadProductId: string;
  /** Why the last activate() call failed, so the UI can tell "wrong key" from "no internet". */
  public lastActivationError?: 'invalid' | 'offline';

  constructor(
    initialKey?: string,
    gumroadPermalink = 'envwizard',
    gumroadProductId = 'Xc_nOuX-mHDfiDIKjkQnwg=='
  ) {
    this.gumroadPermalink = gumroadPermalink;
    this.gumroadProductId = gumroadProductId;

    // A stored key was verified online when it was activated, so it keeps working offline.
    if (initialKey && initialKey.trim()) {
      this.currentStatus = {
        tier: 'pro_lifetime',
        isPro: true,
        licenseKey: initialKey,
      };
    } else {
      this.currentStatus = {
        tier: 'free',
        isPro: false,
      };
    }
  }

  /**
   * Verifies a key against the Gumroad License API. Only a confirmed, non-refunded
   * purchase counts as valid; unknown keys (HTTP 404) are invalid.
   */
  async verifyGumroadKey(licenseKey: string, permalink: string = this.gumroadPermalink): Promise<LicenseCheckResult> {
    const cleanKey = licenseKey.trim();
    if (!cleanKey) return 'invalid';

    let response: Response;
    try {
      response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          product_id: this.gumroadProductId,
          product_permalink: permalink,
          license_key: cleanKey,
          increment_uses_count: 'true',
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      return 'offline';
    }

    if (response.status >= 500) {
      return 'offline';
    }

    try {
      const data = (await response.json()) as {
        success?: boolean;
        purchase?: { refunded?: boolean; chargebacked?: boolean };
      };
      if (response.ok && data.success && !data.purchase?.refunded && !data.purchase?.chargebacked) {
        return 'valid';
      }
    } catch {
      // Unparseable body: treat as invalid
    }
    return 'invalid';
  }

  /**
   * Activates a Gumroad license key.
   */
  async activate(key: string): Promise<boolean> {
    const clean = key.trim();
    const result = await this.verifyGumroadKey(clean);

    if (result === 'valid') {
      this.lastActivationError = undefined;
      this.currentStatus = {
        tier: 'pro_lifetime',
        isPro: true,
        licenseKey: clean,
        activatedAt: new Date().toISOString(),
      };
      return true;
    }

    this.lastActivationError = result;
    return false;
  }

  getStatus(): LicenseStatus {
    return { ...this.currentStatus };
  }

  isPro(): boolean {
    return this.currentStatus.isPro;
  }
}
