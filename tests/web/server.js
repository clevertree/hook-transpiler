import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 8081;

// Root of the hook-transpiler repo
const repoRoot = path.join(__dirname, '../..');

// Serve static files with correct MIME types
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
}));

// Serve hook-transpiler dist and wasm
app.use('/hook-transpiler/dist', express.static(path.join(repoRoot, 'dist')));
app.use('/hook-transpiler/wasm', express.static(path.join(repoRoot, 'wasm'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
}));

// Serve themed-styler from local node_modules (tests/web/node_modules)
app.use('/themed-styler', express.static(path.join(__dirname, 'node_modules/@clevertree/themed-styler/dist')));

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

// Fallback for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
});
