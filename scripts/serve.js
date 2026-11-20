import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { addEntry, makeEntry, sortEntries } from '../src/leaderboard.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LB_FILE = process.env.LEADERBOARD_FILE || join(ROOT, 'data', 'leaderboard.json');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
const ALLOWED = ['src', 'node_modules' + sep + 'three', 'game.contract.json'];

export function loadLeaderboard(file = LB_FILE) {
  try {
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    return sortEntries(Array.isArray(doc.entries) ? doc.entries : []);
  } catch {
    return [];
  }
}
function saveLeaderboard(entries, file = LB_FILE) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ entries }, null, 2) + '\n');
}

function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      chunks.push(c);
      size += c.length;
      if (size > 5e7) req.destroy();
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

const handlers = new Map();
export function onPost(path, fn) {
  handlers.set(path, fn);
}

export function startServer(port = Number(process.env.PORT) || 8080) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (code, obj) => {
      res.writeHead(code, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(obj));
    };
    if (url.pathname === '/api/leaderboard') {
      if (req.method === 'GET') return json(200, { entries: loadLeaderboard() });
      if (req.method === 'POST') {
        try {
          const body = JSON.parse(await readBody(req));
          const entry = makeEntry(body);
          const entries = addEntry(loadLeaderboard(), entry);
          saveLeaderboard(entries);
          return json(200, { entries, rank: entries.indexOf(entries.find((e) => e === entry || (e.name === entry.name && e.achieved_at === entry.achieved_at && e.score === entry.score))) + 1 });
        } catch (e) {
          return json(400, { error: e.message });
        }
      }
    }
    if (req.method === 'POST' && handlers.has(url.pathname)) {
      const body = await readBody(req);
      handlers.get(url.pathname)(body ? JSON.parse(body) : {});
      return json(200, { ok: true });
    }
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/src/web/index.html';
    const file = normalize(join(ROOT, path));
    const rel = file.slice(ROOT.length + 1);
    if (!file.startsWith(ROOT + sep) || !ALLOWED.some((a) => rel === a || rel.startsWith(a + sep))) {
      res.writeHead(404).end('not found');
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const ei = args.indexOf('--export-leaderboard');
  if (ei >= 0) {
    const out = args[ei + 1];
    if (!out) {
      process.stderr.write('error: --export-leaderboard needs an output path\n');
      process.exit(1);
    }
    writeFileSync(resolve(out), JSON.stringify({ entries: loadLeaderboard() }, null, 2) + '\n');
    process.exit(0);
  }
  if (!existsSync(join(ROOT, 'node_modules', 'three'))) process.stderr.write('warning: run "npm install" first (three.js missing)\n');
  startServer().then((s) => console.log(`Đảo Đèn Lồng: open http://localhost:${s.address().port}`));
}
