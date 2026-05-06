// Re-declare the preload API on window for the renderer's type-check.
// The actual implementation lives in src/preload/index.ts.
import type { Api } from '../preload/index';

declare global {
  interface Window {
    api: Api;
  }
}

export {};
