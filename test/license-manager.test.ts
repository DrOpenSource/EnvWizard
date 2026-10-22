import { describe, it, expect, vi, afterEach } from 'vitest';
import { LicenseManager } from '../src/core/LicenseManager.js';

function mockGumroad(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('LicenseManager (Gumroad $9.99 Lifetime)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts on free tier by default', () => {
    const manager = new LicenseManager();
    expect(manager.isPro()).toBe(false);
    expect(manager.getStatus().tier).toBe('free');
  });

  it('restores Pro from a key stored after a previous successful activation', () => {
    expect(new LicenseManager('A1B2C3D4-E5F6A7B8-C9D0E1F2-A3B4C5D6').isPro()).toBe(true);
  });

  it('activates a key Gumroad confirms', async () => {
    mockGumroad(200, { success: true, purchase: { refunded: false } });
    const manager = new LicenseManager();
    expect(await manager.activate('A1B2C3D4-E5F6A7B8-C9D0E1F2-A3B4C5D6')).toBe(true);
    expect(manager.getStatus().tier).toBe('pro_lifetime');
  });

  it('rejects made-up keys that Gumroad does not know (HTTP 404)', async () => {
    mockGumroad(404, { success: false, message: 'That license does not exist for the provided product.' });
    const manager = new LicenseManager();
    expect(await manager.activate('AAAA-BBBB-CCCC-DDDD')).toBe(false);
    expect(await manager.activate('4f8a1234-abcd-4567-89ef-0123456789ab')).toBe(false);
    expect(manager.lastActivationError).toBe('invalid');
    expect(manager.isPro()).toBe(false);
  });

  it('rejects refunded purchases', async () => {
    mockGumroad(200, { success: true, purchase: { refunded: true } });
    const manager = new LicenseManager();
    expect(await manager.activate('A1B2C3D4-E5F6A7B8-C9D0E1F2-A3B4C5D6')).toBe(false);
  });

  it('does not grant Pro when offline, and reports it as offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const manager = new LicenseManager();
    expect(await manager.activate('4f8a1234-abcd-4567-89ef-0123456789ab')).toBe(false);
    expect(manager.lastActivationError).toBe('offline');
  });

  it('rejects empty keys without calling the network', async () => {
    const fetchMock = mockGumroad(200, { success: true });
    const manager = new LicenseManager();
    expect(await manager.activate('   ')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
