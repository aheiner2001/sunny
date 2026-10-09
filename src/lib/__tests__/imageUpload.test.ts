import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { imageErrorFallback, prepareImageUpload } from '../imageUpload';

let width = 2400; let height = 1200; let decodeFails = false;
let canvas: HTMLCanvasElement;
let encoder: ReturnType<typeof vi.fn>;
const drawImage = vi.fn();
beforeEach(() => {
  width = 2400; height = 1200; decodeFails = false;
  vi.stubGlobal('Image', class {
    width = width; height = height; naturalWidth = width; naturalHeight = height;
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    set src(_: string) { queueMicrotask(() => decodeFails ? this.onerror?.() : this.onload?.()); }
  });
  vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
    Object.defineProperty(this, 'result', { configurable: true, value: 'data:image/jpeg;base64,metadata-original' });
    queueMicrotask(() => this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>));
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    canvas = this;
    return { drawImage, fillRect: vi.fn(), fillStyle: '' } as unknown as CanvasRenderingContext2D;
  });
  encoder = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,Y2xlYW4=');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); drawImage.mockClear(); });

describe('bounded image uploads', () => {
  it.each(['image/gif', 'image/svg+xml', 'application/octet-stream'])('rejects %s before reading the file', async type => {
    await expect(prepareImageUpload(new File(['image'], 'upload', { type }))).rejects.toThrow(/JPEG|JPG|PNG|WebP/i);
    expect(FileReader.prototype.readAsDataURL).not.toHaveBeenCalled();
  });
  it('rejects input larger than five MB before reading the file', async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
    await expect(prepareImageUpload(file)).rejects.toThrow(/5\s?MB/i);
    expect(FileReader.prototype.readAsDataURL).not.toHaveBeenCalled();
  });
  it.each(['image/jpeg', 'image/png', 'image/webp'])('reencodes %s with aspect-preserving 640 pixel maximum and discards original metadata', async type => {
    const result = await prepareImageUpload(new File(['image'], 'upload', { type }));
    expect([canvas.width, canvas.height]).toEqual([640, 320]);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 640, 320);
    expect(result).toBe('data:image/jpeg;base64,Y2xlYW4=');
    expect(result).not.toContain('metadata-original');
  });
  it('keeps small images at their original dimensions', async () => {
    width = 100; height = 200;
    await prepareImageUpload(new File(['image'], 'small.png', { type: 'image/png' }));
    expect([canvas.width, canvas.height]).toEqual([100, 200]);
  });
  it('reduces encoding until the saved data URL is within 300KB', async () => {
    encoder.mockReturnValueOnce('data:image/jpeg;base64,' + 'x'.repeat(400 * 1024));
    const result = await prepareImageUpload(new File(['image'], 'large.png', { type: 'image/png' }));
    expect(result.length).toBeLessThanOrEqual(300 * 1024);
    expect(encoder).toHaveBeenCalledTimes(2);
  });
  it('rejects images that cannot be encoded within the output limit', async () => {
    encoder.mockReturnValue('data:image/jpeg;base64,' + 'x'.repeat(400 * 1024));
    await expect(prepareImageUpload(new File(['image'], 'large.png', { type: 'image/png' }))).rejects.toThrow(/300\s?KB/i);
  });
  it('reports decode failures instead of leaving a pending upload', async () => {
    decodeFails = true;
    await expect(prepareImageUpload(new File(['bad'], 'broken.png', { type: 'image/png' }))).rejects.toThrow(/read|decode|image/i);
  });
  it('never saves the original unbounded image when canvas rendering is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(prepareImageUpload(new File(['image'], 'image.png', { type: 'image/png' }))).rejects.toThrow(/image|canvas/i);
  });
  it('replaces a broken image with a visible fallback and does not retry that fallback', () => {
    const target = document.createElement('img'); target.src = 'broken.jpg'; target.alt = 'Vehicle';
    imageErrorFallback({ currentTarget: target });
    expect(target.src).toContain('data:image/svg+xml');
    expect(decodeURIComponent(target.src)).toContain('No photo');
    const first = target.src; imageErrorFallback({ currentTarget: target }); expect(target.src).toBe(first);
  });
});
