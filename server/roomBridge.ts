import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

interface RoomMove {
  from: { r: number; c: number };
  to: { r: number; c: number };
}

interface RoomClient {
  res: ServerResponse;
  side: 'red' | 'black' | 'spectator';
  token: string;
}

interface RoomRecord {
  code: string;
  createdAt: number;
  updatedAt: number;
  redToken: string | null;
  blackToken: string | null;
  version: number;
  moves: RoomMove[];
  clients: Set<RoomClient>;
}

export interface PublicRoomState {
  code: string;
  version: number;
  redConnected: boolean;
  blackConnected: boolean;
  moves: RoomMove[];
}

const ROOM_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

class RoomManager {
  private rooms = new Map<string, RoomRecord>();

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (room.clients.size === 0 && now - room.updatedAt > ROOM_TTL_MS) {
        this.rooms.delete(code);
      }
    }
  }

  private generateCode(): string {
    for (let i = 0; i < 50; i++) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      if (!this.rooms.has(code)) return code;
    }
    return String(Math.floor(10000 + Math.random() * 90000));
  }

  private newToken(): string {
    return crypto.randomBytes(12).toString('hex');
  }

  public toPublicState(room: RoomRecord): PublicRoomState {
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

  public broadcast(room: RoomRecord): void {
    const payload = `event: state\ndata: ${JSON.stringify(this.toPublicState(room))}\n\n`;
    for (const client of room.clients) {
      try {
        client.res.write(payload);
      } catch {
        room.clients.delete(client);
      }
    }
  }

  public createRoom(preferredSide: 'red' | 'black' = 'red') {
    this.cleanupExpired();
    const code = this.generateCode();
    const token = this.newToken();
    const now = Date.now();

    const room: RoomRecord = {
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

    return {
      code,
      side: preferredSide,
      token,
      state: this.toPublicState(room),
    };
  }

  public joinRoom(code: string, existingToken?: string) {
    this.cleanupExpired();
    const room = this.rooms.get(code.trim());
    if (!room) return null;

    let side: 'red' | 'black' | 'spectator';
    let token = existingToken?.trim() || '';

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
    return {
      code: room.code,
      side,
      token,
      state: this.toPublicState(room),
    };
  }

  public attachClient(code: string, token: string, res: ServerResponse): boolean {
    const room = this.rooms.get(code.trim());
    if (!room) return false;

    const side: 'red' | 'black' | 'spectator' =
      room.redToken === token ? 'red' : room.blackToken === token ? 'black' : 'spectator';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    const client: RoomClient = { res, side, token };
    room.clients.add(client);
    room.updatedAt = Date.now();

    // Broadcast immediately so both sides see presence update
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

  public submitMove(code: string, token: string, move: RoomMove) {
    const room = this.rooms.get(code.trim());
    if (!room) return { ok: false, error: '房间不存在或已过期' };

    const expectedSide: 'red' | 'black' = room.moves.length % 2 === 0 ? 'red' : 'black';
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

  public undoMove(code: string, token: string) {
    const room = this.rooms.get(code.trim());
    if (!room) return { ok: false, error: '房间不存在' };
    if (token !== room.redToken && token !== room.blackToken) {
      return { ok: false, error: '观战者无法悔棋' };
    }
    if (room.moves.length === 0) {
      return { ok: true, state: this.toPublicState(room) };
    }
    room.moves.pop();
    room.version++;
    room.updatedAt = Date.now();
    this.broadcast(room);
    return { ok: true, state: this.toPublicState(room) };
  }

  public resetRoom(code: string, token: string) {
    const room = this.rooms.get(code.trim());
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

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 50_000) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? (JSON.parse(data) as Record<string, unknown>) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function roomVitePlugin(): Plugin {
  const manager = new RoomManager();

  return {
    name: 'xiangqi-room-sync',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/rooms')) {
          return next();
        }

        const parsedUrl = new URL(req.url, 'http://localhost');
        const pathname = parsedUrl.pathname;

        try {
          if (pathname === '/api/rooms/create' && req.method === 'POST') {
            const body = await readJsonBody(req);
            const preferred = body.preferredSide === 'black' ? 'black' : 'red';
            const created = manager.createRoom(preferred);
            return sendJson(res, 200, created);
          }

          if (pathname === '/api/rooms/join' && req.method === 'POST') {
            const body = await readJsonBody(req);
            const code = typeof body.code === 'string' ? body.code : '';
            const token = typeof body.token === 'string' ? body.token : undefined;
            const joined = manager.joinRoom(code, token);
            if (!joined) {
              return sendJson(res, 404, { error: '未找到该房间，请核对 4 位房号' });
            }
            return sendJson(res, 200, joined);
          }

          if (pathname === '/api/rooms/stream' && req.method === 'GET') {
            const code = parsedUrl.searchParams.get('code') ?? '';
            const token = parsedUrl.searchParams.get('token') ?? '';
            const ok = manager.attachClient(code, token, res);
            if (!ok) {
              return sendJson(res, 404, { error: '房间不存在' });
            }
            return;
          }

          if (pathname === '/api/rooms/move' && req.method === 'POST') {
            const body = await readJsonBody(req);
            const code = typeof body.code === 'string' ? body.code : '';
            const token = typeof body.token === 'string' ? body.token : '';
            const move = body.move as RoomMove | undefined;
            if (!move?.from || !move?.to) {
              return sendJson(res, 400, { error: '无效着法' });
            }
            const result = manager.submitMove(code, token, move);
            return sendJson(res, result.ok ? 200 : 400, result);
          }

          if (pathname === '/api/rooms/undo' && req.method === 'POST') {
            const body = await readJsonBody(req);
            const code = typeof body.code === 'string' ? body.code : '';
            const token = typeof body.token === 'string' ? body.token : '';
            const result = manager.undoMove(code, token);
            return sendJson(res, result.ok ? 200 : 400, result);
          }

          if (pathname === '/api/rooms/reset' && req.method === 'POST') {
            const body = await readJsonBody(req);
            const code = typeof body.code === 'string' ? body.code : '';
            const token = typeof body.token === 'string' ? body.token : '';
            const result = manager.resetRoom(code, token);
            return sendJson(res, result.ok ? 200 : 400, result);
          }
        } catch (err) {
          return sendJson(res, 500, {
            error: err instanceof Error ? err.message : '房间服务异常',
          });
        }

        return next();
      });
    },
  };
}
