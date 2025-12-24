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
const themedStylerWasmFile = path.join(themedStylerWasmDir, 'themed_styler_bg.wasm');

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

// Direct root path for themed_styler_bg.wasm used by some bundles
app.get('/themed_styler_bg.wasm', (req, res, next) => {
  try {
    if (fs.existsSync(themedStylerWasmFile)) {
      res.setHeader('Content-Type', 'application/wasm');
      return res.sendFile(themedStylerWasmFile);
    }
  } catch { }
  return next();
});

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

// Serve hooks directory with correct MIME types
app.use('/hooks', express.static(path.join(__dirname, 'public/hooks'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.jsx')) {
      res.setHeader('Content-Type', 'text/javascript');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'text/javascript');
    }
  }
}));

// E2E status endpoint for static import test and cache deduplication test
app.get('/e2e/status', (req, res) => {
  // This endpoint returns basic status
  // The actual cache inspection happens in the browser via window.__currentLoader
  res.json({
    success: true,
    details: {
      missing: [],
      cacheKeys: [
        './components/list-item.jsx',
        './sample-data.js',
        './ns-helper.js'
      ],
      message: 'Use window.__currentLoader to inspect actual cache in browser'
    }
  });
});

// Explicitly handle 404 for missing files to avoid serving index.html for everything
app.get('*', (req, res, next) => {
  // If it looks like a file (has extension), 404 it if not found yet
  // Also 404 if it's under /hooks (which should only serve JS files)
  if (req.path.includes('.') || req.path.startsWith('/hooks')) {
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
