import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 8083;

// Root of the hook-transpiler repo
const repoRoot = path.join(__dirname, '../..');

// 1. Unified WASM serving location
// All wasm files from any package can be served from /wasm/<filename>
const wasmDir = path.join(repoRoot, 'wasm');
const themedStylerWasmDir = path.join(__dirname, 'node_modules/@clevertree/themed-styler/wasm');

app.use('/wasm', (req, res, next) => {
  const filename = req.path.split('/').pop();
  if (!filename.endsWith('.wasm')) return next();

  // Try hook-transpiler wasm first
  const hookWasmPath = path.join(wasmDir, filename);
  if (fs.existsSync(hookWasmPath)) {
    res.setHeader('Content-Type', 'application/wasm');
    return res.sendFile(hookWasmPath, (err) => {
      if (err) {
        if (!res.headersSent) res.status(500).send(err.message);
      }
    });
  }

  // Try themed-styler wasm
  const stylerWasmPath = path.join(themedStylerWasmDir, filename);
  if (fs.existsSync(stylerWasmPath)) {
    res.setHeader('Content-Type', 'application/wasm');
    return res.sendFile(stylerWasmPath, (err) => {
      if (err) {
        if (!res.headersSent) res.status(500).send(err.message);
      }
    });
  }

  res.status(404).send('WASM not found');
});

// Serve hook-transpiler JS glue from wasm dir too
app.use('/wasm', express.static(wasmDir));
app.use('/wasm', express.static(themedStylerWasmDir));

// Serve static files with correct MIME types
app.use(express.static(path.join(__dirname, 'public')));

// Serve hook-transpiler dist
app.use('/hook-transpiler/dist', express.static(path.join(repoRoot, 'dist')));

// Serve themed-styler from local node_modules (tests/web/node_modules)
app.use('/themed-styler', express.static(path.join(__dirname, 'node_modules/@clevertree/themed-styler/dist')));

// Also serve the wasm files from themed-styler if needed
app.use('/node_modules/@clevertree/themed-styler/wasm', express.static(path.join(__dirname, 'node_modules/@clevertree/themed-styler/wasm'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
}));

// Serve react from repo root node_modules
app.use('/react', express.static(path.join(repoRoot, 'node_modules/react/umd')));
app.use('/react-dom', express.static(path.join(repoRoot, 'node_modules/react-dom/umd')));

// Serve a test hook
app.get('/hooks/test-hook.jsx', (req, res) => {
  res.setHeader('Content-Type', 'text/javascript');
  res.send(`
    import React from 'react';
    export default function TestHook() {
      return (
        <div className="p-4 bg-blue-500 text-white rounded shadow-lg">
          <h1 className="text-2xl font-bold">Hello from Test Hook!</h1>
          <p className="mt-2">This hook was transpiled and rendered by HookRenderer.</p>
          <div className="mt-4 p-2 bg-white text-blue-800 rounded">
            Tailwind class 'bg-blue-500' should be active if themed-styler is working.
          </div>
        </div>
      );
    }
  `);
});

// Explicitly handle 404 for missing files to avoid serving index.html for everything
app.get('*', (req, res, next) => {
  // If it looks like a file (has extension), 404 it if not found yet
  if (req.path.includes('.')) {
    return res.status(404).send('404: Not Found');
  }
  next();
});

// Fallback for SPA (only for non-file paths)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
});
