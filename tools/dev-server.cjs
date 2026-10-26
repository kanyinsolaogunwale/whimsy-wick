/* Local no-cache static server for preview testing (dev only).
 * Run: node tools/dev-server.cjs [port]  → serves a directory tree with
 * Cache-Control: no-store so edited modules always re-fetch. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.cwd(), '..');       // serve the checkout root
const port = Number(process.argv[2]) || 8790;
const mime = { css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', html: 'text/html', json: 'application/json', svg: 'image/svg+xml', png: 'image/png' };

http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.resolve(root, '.' + p);
  if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }   // keep it inside
  fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found: ' + p); return; }
    res.writeHead(200, {
      'Content-Type': (mime[(path.extname(f).slice(1).toLowerCase())] || 'text/plain') + '; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  });
}).listen(port, '127.0.0.1', () => console.log('dev-server up on', port));
