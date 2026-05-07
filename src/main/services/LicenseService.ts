import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { LicenseRecord, LicenseStatus } from '@shared/types/license';

// License keys are 4 groups of 4 alphanumeric chars: LC-XXXX-XXXX-XXXX-XXXX
// Format: LC-<group1>-<group2>-<sig>
//   group1 = 4 chars derived from a hash of the licensee name
//   group2 = 4 chars random salt embedded in the key
//   sig    = first 4 chars of HMAC(secret, group1+group2)
//
// All groups use the alphabet [A-Z2-9] minus visually-confusable chars (I, L, O, 0, 1).
// 30^4 ≈ 810k combinations per group. With HMAC verification this is sufficient for
// a hobby-tier license system; not meant to deter determined attackers.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 chars (no I, L, O, 0, 1)
const KEY_RE = /^LC-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})$/;

function getSecret(): string | null {
  return process.env['LICENSE_SECRET'] || null;
}

function alphaEncode(buf: Buffer, len: number): string {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET[buf[i]! % ALPHABET.length];
  }
  return out;
}

function nameHash(name: string): string {
  // 4-char fingerprint of the name; not a security feature, just so the key
  // can't be reused for a different licensee without re-issuing.
  const buf = createHmac('sha256', 'lskh-name-salt')
    .update(name.trim().toLowerCase())
    .digest();
  return alphaEncode(buf, 4);
}

function sign(secret: string, payload: string): string {
  // 8 chars (two groups of 4) deterministic per (secret, payload).
  const buf = createHmac('sha256', secret).update(payload).digest();
  return alphaEncode(buf, 8);
}

// NOTE: Key generation lives only in scripts/generate-license.mjs (a Node CLI).
// We intentionally don't expose generation from the running app — keys should
// only ever be issued by the owner with their private LICENSE_SECRET, not by
// the user-facing app. Validation alone is what the app needs.

/** Validate a license key against the secret + a name. */
export function validateKey(key: string, name: string): boolean {
  const secret = getSecret();
  if (!secret) return false;
  const m = key.toUpperCase().match(KEY_RE);
  if (!m) return false;
  const [, g1, g2, sig1, sig2] = m;
  if (g1 !== nameHash(name)) return false;
  const expected = sign(secret, `${g1}${g2}`);
  return expected === `${sig1}${sig2}`;
}

// ── Persistence ──────────────────────────────────────────────────────────────

function file(): string {
  return join(app.getPath('userData'), 'license.json');
}

let cache: LicenseRecord | null | undefined; // undefined = not yet read

function read(): LicenseRecord | null {
  if (cache !== undefined) return cache;
  const path = file();
  if (!existsSync(path)) {
    cache = null;
    return null;
  }
  try {
    cache = JSON.parse(readFileSync(path, 'utf8')) as LicenseRecord;
    return cache;
  } catch {
    cache = null;
    return null;
  }
}

function write(rec: LicenseRecord | null): void {
  cache = rec;
  if (rec === null) {
    try {
      // Remove file by writing empty then ignoring; simpler: just leave it deleted by
      // writing null to disk and treating null on read.
      writeFileSync(file(), JSON.stringify(null), 'utf8');
    } catch {
      // ignore
    }
    return;
  }
  writeFileSync(file(), JSON.stringify(rec, null, 2), 'utf8');
}

export const LicenseService = {
  status(): LicenseStatus {
    const rec = read();
    if (!rec) return { licensed: false };
    // Re-validate stored record so a leaked LICENSE_SECRET change invalidates
    // existing licenses on next launch. Cheap: HMAC.
    if (!validateKey(rec.key, rec.name)) return { licensed: false };
    return { licensed: true, name: rec.name };
  },

  activate(name: string, key: string): LicenseStatus {
    const trimmed = name.trim();
    const upperKey = key.trim().toUpperCase();
    if (!validateKey(upperKey, trimmed)) {
      return { licensed: false };
    }
    const rec: LicenseRecord = {
      key: upperKey,
      name: trimmed,
      validatedAt: new Date().toISOString(),
    };
    write(rec);
    return { licensed: true, name: trimmed };
  },

  deactivate(): LicenseStatus {
    write(null);
    return { licensed: false };
  },
};
