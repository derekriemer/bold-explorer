// Vitest setup for running @capacitor-community/sqlite on web (jsdom)
// via the jeep-sqlite custom element. Also polyfills fetch for sql.js assets
// so the wasm is resolvable from node_modules or public assets during tests.

// Try to enable in-memory IndexedDB polyfill for jsdom when available.
// If not installed in the environment, continue without it (DB tests may skip).
try {
  const mod = 'fake-indexeddb/auto';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - dynamic import, optional dep
  await import(/* @vite-ignore */ mod);
} catch (e) {
  console.warn('[tests/setup] optional fake-indexeddb not available', e);
}
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Register the web component and ensure an element exists in the DOM.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  jeepSqlite(window);
  const tag = 'jeep-sqlite';
  if (!customElements.get(tag)) {
    // custom element definition is async; jeepSqlite(window) should handle it.
  }
  if (!document.querySelector(tag)) {
    const el = document.createElement(tag);
    document.body.appendChild(el);
  }
}

// Resolve sql.js asset path (sql-wasm.wasm / sql-wasm.js)
function resolveSqlJsAsset(name: string): string | null {
  // Try public/assets first (if copy script was run)
  const publicCandidate = path.join(process.cwd(), 'public', 'assets', name);
  if (fs.existsSync(publicCandidate)) {
    return publicCandidate;
  }

  // Try node resolution (direct dep)
  try {
    const pkg = require.resolve('sql.js/package.json');
    const root = path.dirname(pkg);
    const direct = path.join(root, 'dist', name);
    if (fs.existsSync(direct)) {
      return direct;
    }
  } catch (e) {
    console.warn('[tests/setup] resolveSqlJsAsset (node resolution) failed', e);
  }

  // Try pnpm nested path: node_modules/.pnpm/sql.js@*/node_modules/sql.js/dist
  try {
    const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
    const entries = fs
      .readdirSync(pnpmDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('sql.js@'))
      .map((d) => path.join(pnpmDir, d.name, 'node_modules', 'sql.js', 'dist', name));
    for (const candidate of entries) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch (e) {
    console.warn('[tests/setup] resolveSqlJsAsset (pnpm path) failed', e);
  }

  return null;
}

// Patch fetch to serve sql.js assets from disk during tests
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input?.url;
  if (typeof url === 'string' && /sql-wasm\.(wasm|js)$/.test(url)) {
    const filename = url.split('/').pop()!;
    const full = resolveSqlJsAsset(filename);
    if (full && fs.existsSync(full)) {
      const buf = fs.readFileSync(full);
      const contentType = filename.endsWith('.wasm') ? 'application/wasm' : 'text/javascript';
      return new Response(buf, { status: 200, headers: { 'Content-Type': contentType } });
    }
  }
  return originalFetch(input as any, init);
}) as typeof fetch;

// Tell Capacitor we are on web and initialize the web store if available.
try {
  // In jsdom, Capacitor.getPlatform() should return 'web'; ensure init for plugin
  if (Capacitor.getPlatform() === 'web' && (CapacitorSQLite as any)?.initWebStore) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (CapacitorSQLite as any).initWebStore();
  }
} catch (e) {
  console.warn('[tests/setup] CapacitorSQLite.initWebStore not available', e);
}
