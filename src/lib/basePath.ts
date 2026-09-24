/**
 * The hosting base path for hand-built URLs. Next.js injects this value from
 * next.config.mjs so QR targets and public assets match its routing settings.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';

/** Prefix a root-relative path (e.g. '/sunny-logo.png') with the base path. */
export const asset = (path: string) => `${BASE_PATH}${path}`;
