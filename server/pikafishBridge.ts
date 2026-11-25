import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

interface AnalyzeRequest {
  fen: string;
  movetime?: number;
  depth?: number;
  skillLevel?: number;
}

interface AnalyzeResponse {
  bestmove: string | null;
  pv: string[];
  /** Always from Red's perspective */
  scoreCp: number;
  /** Positive = Red mates in N, Negative = Black mates in N */
  mate: number | null;
  depth: number;
  engine: 'pikafish';
}

class PikafishEngine {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private ready = false;
  private available = false;
  private binPath: string;
  private workDir: string;
  private lineBuffer = '';
  private currentResolve: ((res: AnalyzeResponse) => void) | null = null;
  private currentReject: ((err: Error) => void) | null = null;
  private currentTurn: 'red' | 'black' = 'red';
  private lastInfo = { depth: 0, scoreCp: 0, mate: null as number | null, pv: [] as string[] };
  private queue: Promise<void> = Promise.resolve();
  private initPromise: Promise<boolean> | null = null;

  constructor(rootDir: string) {
    this.workDir = path.join(rootDir, 'engine-bin');
    this.binPath = path.join(this.workDir, 'pikafish');
  }

  public isInstalled(): boolean {
    return fs.existsSync(this.binPath);
  }

  public async ensureStarted(): Promise<boolean> {
    if (this.ready && this.proc && !this.proc.killed) return true;
    if (!this.isInstalled()) {
      this.available = false;
      return false;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<boolean>((resolve) => {
      try {
        const proc = spawn(this.binPath, [], {
          cwd: this.workDir,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.proc = proc;

        let uciOk = false;
        const onInitData = (chunk: Buffer) => {
          const text = chunk.toString('utf8');
          if (!uciOk && text.includes('uciok')) {
            uciOk = true;
            proc.stdin.write('setoption name Threads value 4\n');
            proc.stdin.write('setoption name Hash value 64\n');
            proc.stdin.write('isready\n');
          }
          if (uciOk && text.includes('readyok')) {
            proc.stdout.off('data', onInitData);
            proc.stdout.on('data', (buf: Buffer) => this.handleStdout(buf));
            this.ready = true;
            this.available = true;
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
          this.available = false;
          this.initPromise = null;
          resolve(false);
        });

        proc.stdin.write('uci\n');
      } catch {
        this.available = false;
        this.initPromise = null;
        resolve(false);
      }
    });

    return this.initPromise;
  }

  private handleStdout(chunk: Buffer): void {
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

        if (depthMatch) {
          this.lastInfo.depth = Number(depthMatch[1]);
        }
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

  public analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
    const task = this.queue.then(async () => {
      const ok = await this.ensureStarted();
      if (!ok || !this.proc) {
        throw new Error('Pikafish engine not available');
      }

      const fenParts = req.fen.trim().split(/\s+/);
      this.currentTurn = fenParts[1] === 'b' ? 'black' : 'red';
      this.lastInfo = { depth: 0, scoreCp: 0, mate: null, pv: [] };

      const skill = typeof req.skillLevel === 'number' ? Math.max(0, Math.min(20, req.skillLevel)) : 20;
      const movetime = Math.max(80, Math.min(3500, req.movetime ?? 550));

      return new Promise<AnalyzeResponse>((resolve, reject) => {
        this.currentResolve = resolve;
        this.currentReject = reject;

        this.proc!.stdin.write(`setoption name Skill Level value ${skill}\n`);
        this.proc!.stdin.write(`position fen ${req.fen.trim()}\n`);
        if (typeof req.depth === 'number' && req.depth > 0) {
          this.proc!.stdin.write(`go depth ${req.depth} movetime ${movetime}\n`);
        } else {
          this.proc!.stdin.write(`go movetime ${movetime}\n`);
        }
      });
    });

    this.queue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  public shutdown(): void {
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

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 100_000) {
        reject(new Error('Body too large'));
      }
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

export function pikafishVitePlugin(rootDir: string): Plugin {
  const engine = new PikafishEngine(rootDir);

  return {
    name: 'pikafish-uci-bridge',
    configureServer(server) {
      server.httpServer?.once('close', () => engine.shutdown());

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/pikafish')) {
          return next();
        }

        if (req.url === '/api/pikafish/status' && req.method === 'GET') {
          const ok = await engine.ensureStarted();
          return sendJson(res, 200, {
            available: ok,
            engine: ok ? 'Pikafish NNUE' : 'fallback',
          });
        }

        if (req.url === '/api/pikafish/analyze' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const fen = typeof body.fen === 'string' ? body.fen : '';
            if (!fen) {
              return sendJson(res, 400, { error: 'Missing fen' });
            }
            const result = await engine.analyze({
              fen,
              movetime: typeof body.movetime === 'number' ? body.movetime : 550,
              depth: typeof body.depth === 'number' ? body.depth : undefined,
              skillLevel: typeof body.skillLevel === 'number' ? body.skillLevel : 20,
            });
            return sendJson(res, 200, result);
          } catch (err) {
            return sendJson(res, 503, {
              error: err instanceof Error ? err.message : 'Pikafish analyze failed',
            });
          }
        }

        return next();
      });
    },
  };
}
