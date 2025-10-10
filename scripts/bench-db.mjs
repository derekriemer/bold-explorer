#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { mode: 'web', runs: 5, verbose: false, spec: null, grep: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--mode' && args[i + 1]) { out.mode = args[++i]; continue; }
    if (a === '--runs' && args[i + 1]) { out.runs = parseInt(args[++i], 10) || out.runs; continue; }
    if (a === '-v' || a === '--verbose') { out.verbose = true; continue; }
    if (a === '--spec' && args[i + 1]) { out.spec = args[++i]; continue; }
    if ((a === '--grep' || a === '--name') && args[i + 1]) { out.grep = args[++i]; continue; }
  }
  if (!['web', 'native'].includes(out.mode)) {
    console.error(`Invalid --mode ${out.mode}. Use 'web' or 'native'.`);
    process.exit(1);
  }
  return out;
}

function runOnce({ mode, spec, grep }) {
  const isNative = mode === 'native';
  const targetSpec = spec || (isNative
    ? path.join('tests', 'unit', 'db.setup.native.spec.ts')
    : path.join('tests', 'unit', 'db.setup.web.spec.ts'));
  const env = { ...process.env };
  if (isNative) env.DB_NATIVE = '1';
  // For web: do not force enable; if IndexedDB is unavailable, test may be skipped
  const cmd = 'pnpm';
  const args = ['-s', 'vitest', 'run', targetSpec];
  if (grep) args.push('-t', grep);
  const res = spawnSync(cmd, args, { env, encoding: 'utf8' });
  if (res.error) {
    throw res.error;
  }
  const out = (res.stdout || '') + '\n' + (res.stderr || '');
  const reSetup = /\[(web|native)-setup\] took (\d+) ms/;
  const reLegacy = /\[(web|native)\] create\+list took (\d+) ms/;
  let m = out.match(reSetup);
  if (!m) m = out.match(reLegacy);
  if (!m) {
    // Could be skipped or failed; surface the vitest output for debugging
    return { ms: null, skipped: /1 skipped/.test(out), raw: out, code: res.status ?? 1 };
  }
  return { ms: parseInt(m[2], 10), skipped: false, raw: out, code: res.status ?? 0 };
}

function summarize(samples) {
  const nums = samples.filter((v) => typeof v === 'number');
  if (nums.length === 0) return null;
  nums.sort((a, b) => a - b);
  const sum = nums.reduce((a, b) => a + b, 0);
  const avg = sum / nums.length;
  // Sample standard deviation (n-1) for small sample sizes
  let stdev = 0;
  if (nums.length > 1) {
    const variance = nums.reduce((acc, x) => acc + Math.pow(x - avg, 2), 0) / (nums.length - 1);
    stdev = Math.sqrt(variance);
  }
  const min = nums[0];
  const max = nums[nums.length - 1];
  const median = nums.length % 2 === 1
    ? nums[(nums.length - 1) / 2]
    : (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2;
  return { count: nums.length, avg, stdev, min, max, median, samples: nums };
}

(function main() {
  const { mode, runs, verbose, spec, grep } = parseArgs();
  console.log(`DB bench (${mode}) — runs=${runs}${verbose ? ' (verbose)' : ''}`);
  if (spec) console.log(`spec: ${spec}`);
  if (grep) console.log(`grep: ${grep}`);
  const samples = [];
  const skipped = [];
  for (let i = 0; i < runs; i++) {
    const res = runOnce({ mode, spec, grep });
    if (res.ms == null) {
      skipped.push(i + 1);
      console.log(`Run ${i + 1}: no sample (skipped or failed)`);
      if (verbose) {
        console.log('----- vitest output start -----');
        console.log(res.raw);
        console.log('----- vitest output end -----');
      }
    } else {
      samples.push(res.ms);
      console.log(`Run ${i + 1}: ${res.ms} ms`);
      if (verbose) {
        console.log('----- vitest output start -----');
        console.log(res.raw);
        console.log('----- vitest output end -----');
      }
    }
  }
  const stats = summarize(samples);
  if (!stats) {
    console.log('No samples collected. Ensure the selected test is not skipped.');
    if (mode === 'web') {
      console.log('Tip: jsdom often lacks IndexedDB. Add a polyfill or run in a browser-like env.');
    } else {
      console.log('Tip: Native better-sqlite3 requires a working native build environment.');
    }
    process.exit(0);
  }
  console.log(`\nResults (${mode})`);
  console.log(`count:  ${stats.count}`);
  console.log(`avg:    ${stats.avg.toFixed(2)} ms`);
  console.log(`stdev:  ${stats.stdev.toFixed(2)} ms`);
  console.log(`median: ${stats.median} ms`);
  console.log(`min:    ${stats.min} ms`);
  console.log(`max:    ${stats.max} ms`);
  console.log(`samples: [${stats.samples.join(', ')}]`);
  if (skipped.length) {
    console.log(`skipped runs: ${skipped.join(', ')}`);
  }
})();
