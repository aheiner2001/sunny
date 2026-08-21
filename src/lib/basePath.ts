/**
 * The GitHub Pages subpath the app is served from. Must stay in sync with
 * `basePath` in next.config.mjs — Next only prepends basePath to next/image and
 * static imports, so any hand-built URL (plain <img src>, QR code targets,
 * redirects) has to prepend it explicitly via `asset()`.
 */
export const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH ||
  (process.env.NODE_ENV === 'production' ? '/sunny' : '');

/** Prefix a root-relative path (e.g. '/sunny-logo.png') with the base path. */
export const asset = (path: string) => `${BASE_PATH}${path}`;
