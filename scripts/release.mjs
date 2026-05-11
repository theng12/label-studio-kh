#!/usr/bin/env node
// Release automation. Reads .env for the GitHub token, runs electron-builder
// with --publish always (which builds AND uploads release assets via the
// GitHub API in one step), and pushes a matching git tag.
//
// Usage:
//   npm run release          # build mac DMGs + publish to GitHub Releases
//   node scripts/release.mjs --dry-run     # build only, skip upload + tag
//   node scripts/release.mjs --target=mac  # explicit target (default: mac)
//
// Why this exists: electron-builder's CLI takes a bunch of env vars and
// flags. Wrapping it here means the release flow is one command,
// .env-driven, with a single source of truth for "what target are we
// publishing right now."

import { readFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// ── CLI args ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const targetArg = argv.find((a) => a.startsWith('--target='));
const target = (targetArg?.split('=')[1] ?? 'mac').toLowerCase();
if (!['mac', 'win', 'all'].includes(target)) {
  fail(`--target must be one of: mac, win, all (got "${target}")`);
}

// ── Load .env into process.env (lightweight inline parser) ──────────────────
// Same rules as src/main/services/EnvLoader.ts: KEY=VALUE per line, strip
// matching quotes, don't override existing env. .env lives at repo root.

function loadEnv() {
  const envPath = join(repoRoot, '.env');
  if (!existsSync(envPath)) {
    console.warn('[release] No .env at repo root; GH_TOKEN must already be in your shell.');
    return;
  }
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[m[1]] = value;
  }
}

loadEnv();

// ── Sanity checks ───────────────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const version = pkg.version;
if (!version) fail('package.json has no `version`. Bump it before releasing.');

if (!dryRun) {
  if (!process.env.GH_TOKEN) {
    fail(
      'GH_TOKEN is not set. Add it to .env (see .env.example) and try again.\n' +
        'Without it, electron-builder cannot upload release assets to GitHub.',
    );
  }
}

// Refuse to release if the working tree is dirty — uncommitted changes
// would mean the published binary doesn't match any commit, which makes
// debugging "what's in v0.2.X?" much harder later. The git tag below will
// point at HEAD, so HEAD needs to be clean.
const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
if (status.stdout.trim().length > 0) {
  fail(
    'Working tree is dirty. Commit or stash before releasing so the git tag\n' +
      'points at a real state of the code. Files with changes:\n' +
      status.stdout,
  );
}

// And the local branch must be in sync with origin/main — otherwise the tag
// will land at a commit that isn't on the remote, and `git push --tags` will
// fail in confusing ways.
spawnSync('git', ['fetch', 'origin', 'main'], { stdio: 'inherit' });
const localHead = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const remoteHead = spawnSync('git', ['rev-parse', 'origin/main'], {
  encoding: 'utf8',
}).stdout.trim();
if (localHead !== remoteHead) {
  console.warn(
    `[release] Warning: HEAD (${localHead.slice(0, 7)}) is not the same as origin/main (${remoteHead.slice(0, 7)}).`,
  );
  console.warn(
    '          Did you forget to `git push`? Continuing in 3s, ^C to abort.',
  );
  await new Promise((r) => setTimeout(r, 3000));
}

// ── Resolve target → electron-builder args ──────────────────────────────────

const targetFlags =
  target === 'mac' ? ['--mac'] : target === 'win' ? ['--win'] : ['--mac', '--win'];

console.log(`[release] Publishing v${version} (target: ${target}, dryRun: ${dryRun})`);

// ── Build (always) ──────────────────────────────────────────────────────────
// electron-vite produces the unpacked app under out/.

const vite = spawnSync('npx', ['electron-vite', 'build'], {
  stdio: 'inherit',
  cwd: repoRoot,
});
if (vite.status !== 0) fail(`electron-vite build failed (exit ${vite.status})`);

// ── Package + publish ───────────────────────────────────────────────────────
// electron-builder reads GH_TOKEN from env, packages each target into dist/,
// then (with --publish always) creates / updates the GitHub Release tagged
// v${version} and uploads every artifact. Missing assets on an existing
// release get filled in; assets already present are skipped.

const publishFlag = dryRun ? 'never' : 'always';
const builder = spawnSync(
  'npx',
  ['electron-builder', ...targetFlags, '--publish', publishFlag],
  { stdio: 'inherit', cwd: repoRoot, env: process.env },
);
if (builder.status !== 0) fail(`electron-builder failed (exit ${builder.status})`);

// ── Tag the commit ──────────────────────────────────────────────────────────
// electron-builder creates the *GitHub Release* tag, but not a local git tag.
// We push one so the repo's tag list matches Releases — useful for
// `git checkout v0.2.8` to reproduce a specific release locally.

if (!dryRun) {
  const tag = `v${version}`;
  const existing = spawnSync('git', ['tag', '-l', tag], { encoding: 'utf8' }).stdout.trim();
  if (existing) {
    console.log(`[release] Tag ${tag} already exists locally — skipping tag step.`);
  } else {
    const tagResult = spawnSync('git', ['tag', '-a', tag, '-m', `Release ${tag}`], {
      stdio: 'inherit',
    });
    if (tagResult.status === 0) {
      spawnSync('git', ['push', 'origin', tag], { stdio: 'inherit' });
      console.log(`[release] Tagged and pushed ${tag}.`);
    } else {
      console.warn(`[release] Couldn't create tag ${tag}; release published anyway.`);
    }
  }
}

// ── Done ────────────────────────────────────────────────────────────────────

if (dryRun) {
  console.log(`\n✓ Dry-run complete. Artifacts in dist/ but nothing was uploaded.`);
} else {
  const owner = pkg.repository?.url?.match(/github\.com[:/]([^/]+)\/([^/.]+)/)?.[1];
  const repo = pkg.repository?.url?.match(/github\.com[:/]([^/]+)\/([^/.]+)/)?.[2];
  const url = owner && repo ? `https://github.com/${owner}/${repo}/releases/tag/v${version}` : null;
  console.log(`\n✓ v${version} published.`);
  if (url) console.log(`  Visit: ${url}`);
}

// Report dist/ contents so the user sees what was uploaded.
const dist = join(repoRoot, 'dist');
if (existsSync(dist)) {
  const fs = await import('node:fs/promises');
  const entries = (await fs.readdir(dist)).filter((f) =>
    /\.(dmg|exe|yml|blockmap)$/.test(f),
  );
  if (entries.length > 0) {
    console.log('\nArtifacts in dist/:');
    for (const e of entries) {
      const size = statSync(join(dist, e)).size;
      const mb = (size / (1024 * 1024)).toFixed(1);
      console.log(`  ${e.padEnd(50)}  ${mb} MB`);
    }
  }
}

function fail(msg) {
  console.error(`[release] ${msg}`);
  process.exit(1);
}
