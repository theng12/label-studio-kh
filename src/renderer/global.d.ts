// Pull in Vite's ambient client types so query-suffix imports like ?raw,
// ?url, ?inline, etc. resolve correctly during type-check. WhatsNew.tsx
// uses `import changelog from '...CHANGELOG.md?raw'`.
/// <reference types="vite/client" />

// Re-declare the preload API on window for the renderer's type-check.
// The actual implementation lives in src/preload/index.ts.
import type { Api } from '../preload/index';

declare global {
  interface Window {
    api: Api;
  }
}

export {};
