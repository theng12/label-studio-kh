#!/usr/bin/env node
// Generate a Label Studio KH license key for a given licensee name.
//
// Usage:
//   LICENSE_SECRET=your-secret-here node scripts/generate-license.mjs "Jane Doe"
//
// or with a .env file (auto-loaded if present):
//   echo 'LICENSE_SECRET=your-secret-here' >> .env
//   node scripts/generate-license.mjs "Jane Doe"
//
// Output is a string like LC-XXXX-XXXX-XXXX-XXXX. Hand this + the licensee's
// name to the buyer; they enter both on Settings → Support to activate.
//
// IMPORTANT: keep LICENSE_SECRET private. Anyone with it can issue keys.

import { createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Tiny .env loader — avoids adding a `dotenv` dep for a one-script need.
const envFile = join(projectRoot, '.env');
if (existsSync(envFile)) {
  const lines = readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      let val = match[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

const SECRET = process.env.LICENSE_SECRET;
if (!SECRET) {
  console.error('ERROR: LICENSE_SECRET is not set.');
  console.error('Set it in .env or pass it on the command line:');
  console.error('  LICENSE_SECRET=... node scripts/generate-license.mjs "Name"');
  process.exit(1);
}

const name = process.argv.slice(2).join(' ').trim();
if (!name) {
  console.error('Usage: node scripts/generate-license.mjs "<licensee name>"');
  process.exit(1);
}

// Same encoding as src/main/services/LicenseService.ts. KEEP IN SYNC.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function alphaEncode(buf, len) {
  let out = '';
  for (let i = 0; i < len; i += 1) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}
function nameHash(n) {
  return alphaEncode(
    createHmac('sha256', 'lskh-name-salt').update(n.toLowerCase()).digest(),
    4,
  );
}
function sign(secret, payload) {
  return alphaEncode(createHmac('sha256', secret).update(payload).digest(), 8);
}
function randomGroup() {
  const buf = Buffer.alloc(4);
  for (let i = 0; i < 4; i += 1) buf[i] = Math.floor(Math.random() * 256);
  return alphaEncode(buf, 4);
}

const g1 = nameHash(name);
const g2 = randomGroup();
const sig = sign(SECRET, `${g1}${g2}`);
const key = `LC-${g1}-${g2}-${sig.slice(0, 4)}-${sig.slice(4, 8)}`.toUpperCase();

console.log('');
console.log(`Licensee: ${name}`);
console.log(`Key:      ${key}`);
console.log('');
console.log('Send the buyer both the name (exact spelling) and the key.');
