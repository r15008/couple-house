const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.COUPLE_PORT || 8787);
const DATA_DIR = process.env.COUPLE_DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');
const subscribers = new Map();
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadRooms() {
  try { return new Map(Object.entries(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')))); } catch { return new Map(); }
}
const rooms = loadRooms();
function persistRooms() { fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(rooms), null, 2)); }
function newCode() { return `LUV-${Math.floor(1000 + Math.random() * 9000)}`; }
function sendJson(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); }
function readBody(request) { return new Promise((resolve, reject) => { let body = ''; request.on('data', chunk => { body += chunk; if (body.length > 2_000_000) reject(new Error('payload too large')); }); request.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); } }); request.on('error', reject); }); }
function publish(room, payload) { const message = `data: ${JSON.stringify(payload)}\n\n`; (subscribers.get(room) || new Set()).forEach(response => response.write(message)); }
function createRoom() { let code; do { code = newCode(); } while (rooms.has(code)); const state = { theme: 'pink', mood: '甜甜的', bound: false, partnerName: '', tasks: [true, false, false], records: [{ id: 1, date: '今天 · 10:24', text: '一起把小屋的窗帘换成了喜欢的颜色。', author: '你们', tone: 'pink' }], wishes: [{ id: 1, text: '一起去看海', done: false }, { id: 2, text: '养一只真正的小猫', done: false }] }; rooms.set(code, state); persistRooms(); return { room: code, state }; }

function serveStatic(response, pathname) {
  if (pathname.includes('/data/') || path.extname(pathname) === '.json') return sendJson(response, 404, { error: 'not found' });
  const requested = pathname === '/' ? '/couple-house/index.html' : pathname;
  let filePath = path.resolve(ROOT, `.${requested}`);
  if (requested.endsWith('/') && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!filePath.startsWith(path.resolve(ROOT)) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendJson(response, 404, { error: 'not found' });
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json' };
  response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' }); fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const room = (url.searchParams.get('room') || '').toUpperCase();
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') return sendJson(response, 200, { ok: true, rooms: rooms.size, persistent: true });
    if (request.method === 'POST' && url.pathname === '/api/room/create') return sendJson(response, 201, createRoom());
    if (request.method === 'POST' && url.pathname === '/api/room/join') {
      const payload = await readBody(request); const code = String(payload.code || '').trim().toUpperCase(); const state = rooms.get(code);
      if (!state) return sendJson(response, 404, { error: 'invite code not found' });
      state.bound = true; state.partnerName = payload.name || 'TA'; rooms.set(code, state); persistRooms(); publish(code, { state, source: payload.source || null }); return sendJson(response, 200, { room: code, state });
    }
    if (request.method === 'GET' && url.pathname === '/api/state') return sendJson(response, 200, { state: rooms.get(room) || null });
    if (request.method === 'POST' && url.pathname === '/api/state') {
      const payload = await readBody(request); const code = String(payload.room || room).trim().toUpperCase();
      if (!payload.state || !code) return sendJson(response, 400, { error: 'room and state are required' });
      rooms.set(code, payload.state); persistRooms(); publish(code, { state: payload.state, source: payload.source || null }); return sendJson(response, 200, { ok: true });
    }
    if (request.method === 'GET' && url.pathname === '/api/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' }); response.write(': connected\n\n');
      if (!subscribers.has(room)) subscribers.set(room, new Set()); subscribers.get(room).add(response); const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 25_000);
      request.on('close', () => { clearInterval(heartbeat); subscribers.get(room)?.delete(response); }); return;
    }
    serveStatic(response, url.pathname);
  } catch (error) { sendJson(response, 400, { error: error.message }); }
});

server.listen(PORT, () => console.log(`情侣小屋已启动：http://localhost:${PORT}/couple-house/`));
