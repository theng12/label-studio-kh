import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { app } from 'electron';

// Tiny .env reader. Looks for a .env file at the project root in dev, or next
// to the packaged app's resources in production. Sets each KEY=VALUE onto
// process.env unless that key is already set (so OS-level env wins).
//
// We write our own instead of pulling in `dotenv` because we need *exactly*
// one feature — a few key/value lines — and a 30-line implementation is
// trivially auditable (this file holds your private LICENSE_SECRET).
export function loadEnv(): void {
  const candidates = app.isPackaged
    ? [join(dirname(app.getPath('exe')), '..', 'Resources', '.env')]
    : [join(process.cwd(), '.env'), join(process.cwd(), '..', '.env')];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const text = readFileSync(path, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!m) continue;
        const key = m[1]!;
        if (process.env[key]) continue; // already set, don't override
        let value = m[2]!;
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
      return; // first match wins
    } catch (err) {
      console.error('Failed to read .env:', err);
    }
  }
}
