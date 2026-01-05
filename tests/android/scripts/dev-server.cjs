const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');

const PORT = 8081;
const ASSETS_DIR = path.join(__dirname, '../app/src/main/assets');

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', assetsDir: ASSETS_DIR }));
        return;
    }

    // Serve static files from assets
    const filePath = path.join(ASSETS_DIR, req.url);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        console.log(`Serving: ${req.url}`);
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        let contentType = 'text/plain';
        if (ext === '.jsx') contentType = 'text/javascript';
        if (ext === '.js') contentType = 'text/javascript';
        if (ext === '.json') contentType = 'application/json';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('Android client connected');
    ws.on('close', () => console.log('Android client disconnected'));
});

function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(JSON.stringify(data));
        }
    });
}

// Watch assets for changes
chokidar.watch(ASSETS_DIR).on('change', (filePath) => {
    console.log(`File change: ${filePath}`);
    console.log('Broadcasting reload to clients...');
    broadcast({ type: 'reload', path: path.relative(ASSETS_DIR, filePath) });
});

server.listen(PORT, () => {
    console.log(`Dev server listening on http://localhost:${PORT}`);
    console.log(`Watching assets in: ${ASSETS_DIR}`);
});
