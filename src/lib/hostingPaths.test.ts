import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

describe('printed QR and logo destinations', () => {
  it.each([
    ['/sunny', 'https://aheiner2001.github.io/sunny/return', 'https://aheiner2001.github.io/sunny/inspect?id=van-3', 'https://aheiner2001.github.io/sunny/sunny-logo.png'],
    ['', 'https://preview.vercel.app/return', 'https://preview.vercel.app/inspect?id=van-3', 'https://preview.vercel.app/sunny-logo.png'],
  ])('uses hosting base path %s', async (basePath, returnUrl, vehicleUrl, logoUrl) => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_APP_BASE_PATH', basePath);
    const { absoluteAssetUrl } = await import('./basePath');
    const origin = basePath ? 'https://aheiner2001.github.io' : 'https://preview.vercel.app';
    expect(absoluteAssetUrl(origin, '/return')).toBe(returnUrl);
    expect(absoluteAssetUrl(origin, '/inspect?id=van-3')).toBe(vehicleUrl);
    expect(absoluteAssetUrl(origin, '/sunny-logo.png')).toBe(logoUrl);
  });
});
