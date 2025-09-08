#!/usr/bin/env node
/*
 Copy sql.js WebAssembly file from node_modules to public so the web
 Capacitor SQLite plugin can load it with the correct MIME type.
*/
const fs = require('fs');
const path = require('path');

function resolveSqlJsDist() {
  try {
    const pkg = require.resolve('sql.js/package.json');
    const root = path.dirname(pkg);
    return path.join(root, 'dist');
  } catch (e) {
    console.error('[copy-sqljs-wasm] Could not resolve sql.js/package.json');
    process.exit(1);
  }
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`[copy-sqljs-wasm] Copied ${src} -> ${dst}`);
}

(function main() {
  const dist = resolveSqlJsDist();
  const wasmSrc = path.join(dist, 'sql-wasm.wasm');
  if (!fs.existsSync(wasmSrc)) {
    console.error(`[copy-sqljs-wasm] Source not found: ${wasmSrc}`);
    process.exit(1);
  }
  const wasmDst = path.join(__dirname, '..', 'public', 'sqljs', 'sql-wasm.wasm');
  copyFile(wasmSrc, wasmDst);
})();

