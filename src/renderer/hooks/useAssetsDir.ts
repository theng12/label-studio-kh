import { useEffect, useState } from 'react';

// Module-level cache: assetsDir doesn't change during a session, so we ask
// the main process exactly once and share the result across all callers.
let cached: string | null = null;
let pending: Promise<string> | null = null;

async function fetchAssetsDir(): Promise<string> {
  if (cached) return cached;
  if (pending) return pending;
  pending = window.api.app.getAssetsDir().then((dir) => {
    cached = dir;
    pending = null;
    return dir;
  });
  return pending;
}

/** Returns the assets root directory, e.g.
 *  `/Users/x/Library/Application Support/label-studio-kh/assets`.
 *  Resolves on first render; null while pending. */
export function useAssetsDir(): string | null {
  const [dir, setDir] = useState<string | null>(cached);
  useEffect(() => {
    if (cached) return;
    let alive = true;
    void fetchAssetsDir().then((d) => {
      if (alive) setDir(d);
    });
    return () => {
      alive = false;
    };
  }, []);
  return dir;
}

/** Build a renderer-loadable URL for a relative product-image path stored
 *  in the DB (e.g. `products/shelf-001-a1b2c3.jpg`). Returns null when the
 *  assets dir hasn't loaded yet — callers should render a placeholder. */
export function productImageUrl(
  assetsDir: string | null,
  relativePath: string,
): string | null {
  if (!assetsDir) return null;
  // lskh-file:// expects absolute paths with a leading slash on the
  // path component. encodeURI keeps spaces / unicode characters
  // working in the URL.
  return `lskh-file://local${encodeURI(`${assetsDir}/${relativePath}`)}`;
}
