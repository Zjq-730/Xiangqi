import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ENGINE_DIR = path.join(ROOT_DIR, 'engine-bin');
const PORT = Number(process.env.PORT || 3000);
const PIKAFISH_THREADS = Math.max(1, Number(process.env.PIKAFISH_THREADS || 2));
const PIKAFISH_HASH = Math.max(16, Number(process.env.PIKAFISH_HASH || 32));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readBodyBuffer(req, maxBytes = 200_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const buf = await readBodyBuffer(req, 100_000);
  if (buf.length === 0) return {};
  return JSON.parse(buf.toString('utf8'));
}

// ============================================================
// 1. Pikafish NNUE Engine Manager (UCI over stdio)
// ============================================================
class PikafishEngine {
  constructor() {
    this.proc = null;
    this.ready = false;
    this.binPath = path.join(ENGINE_DIR, 'pikafish');
    this.lineBuffer = '';
    this.currentResolve = null;
    this.currentReject = null;
    this.currentTurn = 'red';
    this.lastInfo = { depth: 0, scoreCp: 0, mate: null, pv: [] };
    this.queue = Promise.resolve();
    this.initPromise = null;
  }

  isInstalled() {
    return fs.existsSync(this.binPath);
  }

  async ensureStarted() {
    if (this.ready && this.proc && !this.proc.killed) return true;
    if (!this.isInstalled()) return false;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      try {
        const proc = spawn(this.binPath, [], {
          cwd: ENGINE_DIR,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.proc = proc;

        let uciOk = false;
        const onInitData = (chunk) => {
          const text = chunk.toString('utf8');
          if (!uciOk && text.includes('uciok')) {
            uciOk = true;
            proc.stdin.write(`setoption name Threads value ${PIKAFISH_THREADS}\n`);
            proc.stdin.write(`setoption name Hash value ${PIKAFISH_HASH}\n`);
            proc.stdin.write('isready\n');
          }
          if (uciOk && text.includes('readyok')) {
            proc.stdout.off('data', onInitData);
            proc.stdout.on('data', (buf) => this.handleStdout(buf));
            this.ready = true;
            this.initPromise = null;
            resolve(true);
          }
        };

        proc.stdout.on('data', onInitData);
        proc.on('exit', () => {
          this.ready = false;
          this.proc = null;
          if (this.currentReject) {
            this.currentReject(new Error('Pikafish process exited'));
            this.currentResolve = null;
            this.currentReject = null;
          }
        });
        proc.on('error', () => {
          this.ready = false;
          this.initPromise = null;
          resolve(false);
        });

        proc.stdin.write('uci\n');
      } catch {
        this.initPromise = null;
        resolve(false);
      }
    });

    return this.initPromise;
  }

  handleStdout(chunk) {
    this.lineBuffer += chunk.toString('utf8');
    const lines = this.lineBuffer.split('\n');
    this.lineBuffer = lines.pop() ?? '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (line.startsWith('info ') && line.includes(' pv ')) {
        const depthMatch = line.match(/\bdepth\s+(\d+)/);
        const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
        const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
        const pvIdx = line.indexOf(' pv ');

        if (depthMatch) this.lastInfo.depth = Number(depthMatch[1]);
        if (cpMatch) {
          const rawCp = Number(cpMatch[1]);
          this.lastInfo.scoreCp = this.currentTurn === 'red' ? rawCp : -rawCp;
          this.lastInfo.mate = null;
        } else if (mateMatch) {
          const rawMate = Number(mateMatch[1]);
          const signedMate = this.currentTurn === 'red' ? rawMate : -rawMate;
          this.lastInfo.mate = signedMate;
          this.lastInfo.scoreCp = signedMate > 0 ? 30000 : -30000;
        }
        if (pvIdx !== -1) {
          this.lastInfo.pv = line
            .slice(pvIdx + 4)
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        }
      } else if (line.startsWith('bestmove ')) {
        const parts = line.split(/\s+/);
        const best = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
        const resolve = this.currentResolve;
        this.currentResolve = null;
        this.currentReject = null;
        if (resolve) {
          resolve({
            bestmove: best,
            pv: this.lastInfo.pv.length > 0 ? this.lastInfo.pv : best ? [best] : [],
            scoreCp: this.lastInfo.scoreCp,
            mate: this.lastInfo.mate,
            depth: this.lastInfo.depth,
            engine: 'pikafish',
          });
        }
      }
    }
  }

  analyze({ fen, movetime = 550, depth, skillLevel = 20 }) {
    const task = this.queue.then(async () => {
      const ok = await this.ensureStarted();
      if (!ok || !this.proc) throw new Error('Pikafish engine not available');

      const fenParts = fen.trim().split(/\s+/);
      this.currentTurn = fenParts[1] === 'b' ? 'black' : 'red';
      this.lastInfo = { depth: 0, scoreCp: 0, mate: null, pv: [] };

      const skill = Math.max(0, Math.min(20, Number(skillLevel) || 20));
      const mt = Math.max(80, Math.min(3500, Number(movetime) || 550));

      return new Promise((resolve, reject) => {
        this.currentResolve = resolve;
        this.currentReject = reject;

        this.proc.stdin.write(`setoption name Skill Level value ${skill}\n`);
        this.proc.stdin.write(`position fen ${fen.trim()}\n`);
        if (typeof depth === 'number' && depth > 0) {
          this.proc.stdin.write(`go depth ${depth} movetime ${mt}\n`);
        } else {
          this.proc.stdin.write(`go movetime ${mt}\n`);
        }
      });
    });

    this.queue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  shutdown() {
    if (this.proc && !this.proc.killed) {
      try {
        this.proc.stdin.write('quit\n');
        this.proc.kill();
      } catch {
        // ignore
      }
    }
    this.proc = null;
    this.ready = false;
  }
}

// ============================================================
// 2. Two-Device Online Room Sync Manager (SSE + REST)
// ============================================================
const ROOM_TTL_MS = 1000 * 60 * 60 * 4;

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (room.clients.size === 0 && now - room.updatedAt > ROOM_TTL_MS) {
        this.rooms.delete(code);
      }
    }
  }

  generateCode() {
    for (let i = 0; i < 50; i++) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      if (!this.rooms.has(code)) return code;
    }
    return String(Math.floor(10000 + Math.random() * 90000));
  }

  newToken() {
    return crypto.randomBytes(12).toString('hex');
  }

  toPublicState(room) {
    let redConnected = false;
    let blackConnected = false;
    for (const c of room.clients) {
      if (c.side === 'red') redConnected = true;
      if (c.side === 'black') blackConnected = true;
    }
    return {
      code: room.code,
      version: room.version,
      redConnected,
      blackConnected,
      moves: room.moves,
    };
  }

  broadcast(room) {
    const payload = `event: state\ndata: ${JSON.stringify(this.toPublicState(room))}\n\n`;
    for (const client of room.clients) {
      try {
        client.res.write(payload);
      } catch {
        room.clients.delete(client);
      }
    }
  }

  createRoom(preferredSide = 'red') {
    this.cleanupExpired();
    const code = this.generateCode();
    const token = this.newToken();
    const now = Date.now();

    const room = {
      code,
      createdAt: now,
      updatedAt: now,
      redToken: preferredSide === 'red' ? token : null,
      blackToken: preferredSide === 'black' ? token : null,
      version: 1,
      moves: [],
      clients: new Set(),
    };
    this.rooms.set(code, room);
    return { code, side: preferredSide, token, state: this.toPublicState(room) };
  }

  joinRoom(code, existingToken) {
    this.cleanupExpired();
    const room = this.rooms.get(String(code || '').trim());
    if (!room) return null;

    let side;
    let token = String(existingToken || '').trim();

    if (token && room.redToken === token) {
      side = 'red';
    } else if (token && room.blackToken === token) {
      side = 'black';
    } else if (!room.blackToken) {
      token = this.newToken();
      room.blackToken = token;
      side = 'black';
    } else if (!room.redToken) {
      token = this.newToken();
      room.redToken = token;
      side = 'red';
    } else {
      token = this.newToken();
      side = 'spectator';
    }

    room.updatedAt = Date.now();
    return { code: room.code, side, token, state: this.toPublicState(room) };
  }

  attachClient(code, token, res) {
    const room = this.rooms.get(String(code || '').trim());
    if (!room) return false;

    const side =
      room.redToken === token ? 'red' : room.blackToken === token ? 'black' : 'spectator';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const client = { res, side, token };
    room.clients.add(client);
    room.updatedAt = Date.now();
    this.broadcast(room);

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 20000);

    res.on('close', () => {
      clearInterval(heartbeat);
      room.clients.delete(client);
      room.updatedAt = Date.now();
      this.broadcast(room);
    });

    return true;
  }

  submitMove(code, token, move) {
    const room = this.rooms.get(String(code || '').trim());
    if (!room) return { ok: false, error: '房间不存在或已过期' };
    const expectedSide = room.moves.length % 2 === 0 ? 'red' : 'black';
    const expectedToken = expectedSide === 'red' ? room.redToken : room.blackToken;
    if (!expectedToken || token !== expectedToken) {
      return { ok: false, error: '当前未轮到你落子' };
    }
    room.moves.push(move);
    room.version++;
    room.updatedAt = Date.now();
    this.broadcast(room);
    return { ok: true, state: this.toPublicState(room) };
  }

  undoMove(code, token) {
    const room = this.rooms.get(String(code || '').trim());
    if (!room) return { ok: false, error: '房间不存在' };
    if (token !== room.redToken && token !== room.blackToken) {
      return { ok: false, error: '观战者无法悔棋' };
    }
    if (room.moves.length > 0) {
      room.moves.pop();
      room.version++;
      room.updatedAt = Date.now();
      this.broadcast(room);
    }
    return { ok: true, state: this.toPublicState(room) };
  }

  resetRoom(code, token) {
    const room = this.rooms.get(String(code || '').trim());
    if (!room) return { ok: false, error: '房间不存在' };
    if (token !== room.redToken && token !== room.blackToken) {
      return { ok: false, error: '观战者无法重开' };
    }
    room.moves = [];
    room.version++;
    room.updatedAt = Date.now();
    this.broadcast(room);
    return { ok: true, state: this.toPublicState(room) };
  }
}

// ============================================================
// 3. Streaming DeepSeek Reverse Proxy
// ============================================================
async function proxyDeepSeek(req, res, pathname) {
  const upstreamPath = pathname.replace(/^\/api\/deepseek/, '');
  const targetUrl = `https://api.deepseek.com${upstreamPath}`;

  try {
    const bodyBuf = await readBodyBuffer(req, 300_000);
    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : bodyBuf,
    });

    res.statusCode = upstream.status;
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, 502, {
        error: { message: err instanceof Error ? err.message : 'DeepSeek 代理请求失败' },
      });
    } else {
      res.end();
    }
  }
}

// ============================================================
// 4. Static Frontend File Server (dist/)
// ============================================================
function serveStatic(res, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath === '/' ? 'index.html' : safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Frontend build (dist/) not found. Run npm run build first.');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  if (pathname.startsWith('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
  fs.createReadStream(filePath).pipe(res);
}

// ============================================================
// 5. HTTP Server Bootstrap
// ============================================================
const pikafish = new PikafishEngine();
const rooms = new RoomManager();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  if (pathname === '/health') {
    return sendJson(res, 200, { ok: true, pikafish: pikafish.isInstalled() });
  }

  // Pikafish endpoints
  if (pathname === '/api/pikafish/status' && req.method === 'GET') {
    const ok = await pikafish.ensureStarted();
    return sendJson(res, 200, { available: ok, engine: ok ? 'Pikafish NNUE' : 'fallback' });
  }

  if (pathname === '/api/pikafish/analyze' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (typeof body.fen !== 'string' || !body.fen) {
        return sendJson(res, 400, { error: 'Missing fen' });
      }
      const result = await pikafish.analyze({
        fen: body.fen,
        movetime: body.movetime,
        depth: body.depth,
        skillLevel: body.skillLevel,
      });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 503, { error: err instanceof Error ? err.message : 'Analyze failed' });
    }
  }

  // Two-Device Online Room endpoints
  if (pathname.startsWith('/api/rooms')) {
    try {
      if (pathname === '/api/rooms/create' && req.method === 'POST') {
        const body = await readJsonBody(req);
        return sendJson(res, 200, rooms.createRoom(body.preferredSide === 'black' ? 'black' : 'red'));
      }
      if (pathname === '/api/rooms/join' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const joined = rooms.joinRoom(body.code, body.token);
        if (!joined) return sendJson(res, 404, { error: '未找到该房间，请核对 4 位房号' });
        return sendJson(res, 200, joined);
      }
      if (pathname === '/api/rooms/stream' && req.method === 'GET') {
        const ok = rooms.attachClient(
          url.searchParams.get('code') || '',
          url.searchParams.get('token') || '',
          res
        );
        if (!ok) return sendJson(res, 404, { error: '房间不存在' });
        return;
      }
      if (pathname === '/api/rooms/move' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.move?.from || !body.move?.to) {
          return sendJson(res, 400, { error: '无效着法' });
        }
        const result = rooms.submitMove(body.code, body.token, body.move);
        return sendJson(res, result.ok ? 200 : 400, result);
      }
      if (pathname === '/api/rooms/undo' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const result = rooms.undoMove(body.code, body.token);
        return sendJson(res, result.ok ? 200 : 400, result);
      }
      if (pathname === '/api/rooms/reset' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const result = rooms.resetRoom(body.code, body.token);
        return sendJson(res, result.ok ? 200 : 400, result);
      }
    } catch (err) {
      return sendJson(res, 500, { error: err instanceof Error ? err.message : '房间服务异常' });
    }
  }

  // DeepSeek streaming reverse proxy
  if (pathname.startsWith('/api/deepseek/')) {
    return proxyDeepSeek(req, res, pathname);
  }

  // Static frontend assets
  return serveStatic(res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`雅弈 · 中国象棋生产服务已启动: http://0.0.0.0:${PORT}`);
  console.log(`Pikafish NNUE 状态: ${pikafish.isInstalled() ? '已就绪' : '未找到二进制，将自动使用内置轻量引擎'}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    pikafish.shutdown();
    server.close(() => process.exit(0));
  });
}
