/** Stored media paths are relative (`static/…`); the browser loads them through the same-origin proxy. */
export const mediaUrl = (path: string | null | undefined) => (path ? '/' + path.replace(/^\/+/, '') : '');

const withSuffix = (path: string, suffix: string) => path.replace(/\.[^./]+$/, '') + suffix;

/** 400 px WebP thumbnail next to an image (may be missing: fall back to the original on error). */
export const thumbOf = (path: string | null | undefined) => (path ? mediaUrl(withSuffix(path, '_thumb.webp')) : '');

/** 640 px JPEG poster frame next to a video. */
export const posterOf = (path: string | null | undefined) => (path ? mediaUrl(withSuffix(path, '_poster.jpg')) : '');
