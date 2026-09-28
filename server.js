import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = new Set(['index.html', 'style.css', 'app.js', 'music.js']);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const server = http.createServer(async (req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!files.has(name)) { res.writeHead(404).end('Not found'); return; }
  try {
    const data = await readFile(path.join(root, name));
    res.writeHead(200, { 'Content-Type': `${types[path.extname(name)]}; charset=utf-8`, 'Cache-Control': 'no-store' }).end(data);
  } catch { res.writeHead(500).end('Could not load game'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Chord Quest: http://localhost:4173 — press Ctrl+C to stop.'));
server.on('error', e => { console.error(e.message); process.exitCode = 1; });
