#!/usr/bin/env node
/*
 Copy sql.js WebAssembly file from node_modules to public so the web
 Capacitor SQLite plugin can load it with the correct MIME type.
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function resolveSqlJsDist() {
  // Try normal Node resolution first (works when sql.js is a direct dep)
  try {
    const pkg = require.resolve('sql.js/package.json');
    const root = path.dirname(pkg);
    return path.join(root, 'dist');
  } catch {}

  // Fallback: search pnpm nested path: node_modules/.pnpm/sql.js@*/node_modules/sql.js/dist
  try {
    const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
    const entries = fs.readdirSync(pnpmDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith('sql.js@'))
      .map(d => path.join(pnpmDir, d.name, 'node_modules', 'sql.js', 'dist'));
    for (const candidate of entries) {
      if (fs.existsSync(path.join(candidate, 'sql-wasm.wasm'))) {
        return candidate;
      }
    }
  } catch {}

  console.error('[copy-sqljs-wasm] Could not locate sql.js/dist. Ensure sql.js is installed.');
  process.exit(1);
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`[copy-sqljs-wasm] Copied ${src} -> ${dst}`);
}

function hashFile(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(file);
    s.on('error', reject);
    s.on('data', (chunk) => h.update(chunk));
    s.on('end', () => resolve(h.digest('hex')));
  });
}

(async function main() {
  const dist = resolveSqlJsDist();
  const srcs = ['sql-wasm.wasm', 'sql-wasm.js'];
  for (const name of srcs) {
    const src = path.join(dist, name);
    if (!fs.existsSync(src)) {
      console.error(`[copy-sqljs-wasm] Source not found: ${src}`);
      process.exit(1);
    }
    // Per @capacitor-community/sqlite docs for Vue/React, place under public/assets
    const dst = path.join(__dirname, '..', 'public', 'assets', name);

    const dstExists = fs.existsSync(dst);
    if (dstExists) {
      const srcStat = fs.statSync(src);
      const dstStat = fs.statSync(dst);
      // Fast path: if sizes differ, copy immediately
      if (srcStat.size !== dstStat.size) {
        copyFile(src, dst);
        continue;
      }
      try {
        const [srcHash, dstHash] = await Promise.all([hashFile(src), hashFile(dst)]);
        if (srcHash === dstHash) {
          console.log(`[copy-sqljs-wasm] Unchanged, skip ${name}`);
          continue;
        }
      } catch (e) {
        console.warn(`[copy-sqljs-wasm] Hash check failed for ${name}:`, e?.message || e);
        // fall through to copy
      }
    }
    copyFile(src, dst);
  }
})();
