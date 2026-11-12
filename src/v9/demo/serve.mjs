#!/usr/bin/env node
// =====================================================================
// demo/serve.mjs —— 起一个只读静态服务器，方便开发时看 index.html（ES module 版）
//
//   node src/v9/demo/serve.mjs [port]
//   → http://127.0.0.1:8891/src/v9/demo/index.html
//
// 只是便利工具：demo.html 是打好的单文件，双击就能开（不需要服务器）。
// =====================================================================
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PORT = Number(process.argv[2] || 8891);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg'
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    const s = await stat(file).catch(() => null);
    if (s && s.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(body);
  } catch {
    res.writeHead(404, {'content-type': 'text/plain; charset=utf-8'}).end('not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${PORT}/src/v9/demo/index.html`);
});
