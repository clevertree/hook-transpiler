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
    import React, { useState, useEffect } from 'react';
    
    const ListItem = ({ item }) => (
      <div className="p-2 border-b border-gray-200">
        <span className="font-medium">{item.name}</span>
        {item.tags && (
          <div className="flex gap-1 mt-1">
            {item.tags.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 px-1 rounded">{tag}</span>
            ))}
          </div>
        )}
      </div>
    );

    export default function(context) {
      return <TestHook />;
    }

    function TestHook() {
      const [items, setItems] = useState([
        { id: 1, name: 'Item 1', tags: ['urgent', 'bug'] },
        { id: 2, name: 'Item 2', tags: ['feature'] },
        { id: 3, name: 'Item 3' }
      ]);

      const [lazyData, setLazyData] = useState(null);

      useEffect(() => {
        // Test lazy load import()
        import('./lazy-data.js').then(mod => {
          setLazyData(mod.default);
        }).catch(err => {
          console.error("Failed to load lazy data", err);
          setLazyData("Lazy data failed to load (expected if file missing)");
        });
      }, []);

      return (
        <div className="p-4 bg-white text-gray-800 rounded shadow-lg">
          <h1 className="text-2xl font-bold mb-4">Mapped Hierarchy Test</h1>
          
          <div className="space-y-2">
            {items.map(item => (
              <ListItem key={item.id} item={item} />
            ))}
          </div>

          <div className="mt-4 p-2 bg-blue-50 text-blue-800 rounded">
            <p>Lazy Data: {lazyData || 'Loading...'}</p>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            {/* Test JSX-like string in an expression */}
            <p>This string contains JSX-like text: {"<div>test</div>"}</p>
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
