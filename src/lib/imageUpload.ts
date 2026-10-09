const INPUT_LIMIT = 5 * 1024 * 1024;
// Bound the entire stored ASCII data URL, including base64 overhead.
const OUTPUT_LIMIT = 300 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Reencode pixels on a fresh canvas so uploaded metadata never enters the record. */
export async function prepareImageUpload(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > INPUT_LIMIT) throw new Error('Choose an image no larger than 5MB.');

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read this image. Please choose another file.'));
    reader.onabort = () => reject(new Error('Image upload was canceled.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not read this image. Please choose another file.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('Could not decode this image. Please choose another file.'));
    image.onload = () => resolve(image);
    image.src = source;
  });
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (!imageWidth || !imageHeight) throw new Error('This image has no readable dimensions.');
  const scale = Math.min(1, 640 / Math.max(imageWidth, imageHeight));
  const canvas = document.createElement('canvas');
  let width = Math.max(1, Math.round(imageWidth * scale));
  let height = Math.max(1, Math.round(imageHeight * scale));

  // Lossy quality followed by progressively smaller dimensions gives noisy photos
  // a bounded fallback rather than saving the original full-size file.
  for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt++) {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the image. Please try another browser.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    for (const quality of [0.82, 0.65, 0.45]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.startsWith('data:image/') && result.length <= OUTPUT_LIMIT) return result;
    }
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
  }
  throw new Error('Could not reduce this image below 300KB. Please choose a smaller image.');
}

const FALLBACK_IMAGE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" fill="#e5e7eb"/><path d="M48 36h64v40H48zM52 72l18-18 12 12 10-8 16 14" fill="none" stroke="#6b7280" stroke-width="3"/><text x="80" y="100" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#4b5563">No photo</text></svg>')}`;

/** Safe to pass directly to an img's React onError; repeated failures do not loop. */
export function imageErrorFallback(event: { currentTarget: HTMLImageElement }): void {
  if (event.currentTarget.src !== FALLBACK_IMAGE) event.currentTarget.src = FALLBACK_IMAGE;
}
