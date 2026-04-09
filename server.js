/**
 * AETHERIA: Endless Frontiers – Local Development Server
 * Zero external dependencies – uses only Node.js built-ins.
 * Works on Windows, Linux (Ubuntu/Debian/Arch) and macOS.
 *
 * Usage:
 *   node server.js           → http://localhost:8080
 *   node server.js 3000      → http://localhost:3000
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT = parseInt(process.argv[2] || process.env.PORT || '8080', 10);
const ROOT = __dirname;

const MIME = {
    '.html' : 'text/html; charset=utf-8',
    '.js'   : 'application/javascript; charset=utf-8',
    '.mjs'  : 'application/javascript; charset=utf-8',
    '.css'  : 'text/css; charset=utf-8',
    '.json' : 'application/json; charset=utf-8',
    '.png'  : 'image/png',
    '.jpg'  : 'image/jpeg',
    '.jpeg' : 'image/jpeg',
    '.gif'  : 'image/gif',
    '.svg'  : 'image/svg+xml',
    '.ico'  : 'image/x-icon',
    '.woff' : 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf'  : 'font/ttf',
    '.wasm' : 'application/wasm',
    '.mp3'  : 'audio/mpeg',
    '.ogg'  : 'audio/ogg',
    '.wav'  : 'audio/wav',
};

function getLocalIP() {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const server = http.createServer((req, res) => {
    // Sanitise URL – strip query strings, prevent directory traversal
    let urlPath;
    try {
        urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (_) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('400 – Bad Request');
        return;
    }
    // Strip leading slashes so path.join doesn't treat it as absolute,
    // then resolve and verify the result stays inside ROOT.
    const stripped = urlPath.replace(/^\/+/, '') || 'index.html';
    const filePath = path.resolve(ROOT, stripped);
    if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 – Forbidden');
        return;
    }
    const ext         = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end(`404 – Not found: ${urlPath}`);
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`500 – Server error: ${err.message}`);
            }
            return;
        }
        res.writeHead(200, {
            'Content-Type'  : contentType,
            'Cache-Control' : 'no-cache',
            // Allow SharedArrayBuffer if needed for future workers
            'Cross-Origin-Opener-Policy'   : 'same-origin',
            'Cross-Origin-Embedder-Policy' : 'credentialless',
        });
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    const banner  = `
╔══════════════════════════════════════════════════════╗
║         AETHERIA : ENDLESS FRONTIERS                 ║
║         AAA Browser 3-D Game Server                  ║
╠══════════════════════════════════════════════════════╣
║  Local   → http://localhost:${PORT}                    ║
║  Network → http://${localIP}:${PORT}                ║
╚══════════════════════════════════════════════════════╝
  Open one of the URLs above in Chrome / Firefox / Edge.
  Press Ctrl+C to stop the server.
`;
    console.log(banner);
});
