import type { ReviewLineResult } from './ai';
import { moveToChineseNotation } from './notation';
import { type Board, type Difficulty, type Move, type Side, oppositeSide } from './types';
import { applyMove, boardToFen, cloneBoard, inBounds } from './xiangqi';

export interface PikafishAnalysis {
  bestMove: Move | null;
  bestNotation: string | null;
  futureLine: { side: Side; notation: string }[];
  scoreCp: number;
  mate: number | null;
  depth: number;
  engine: 'pikafish';
}

interface RawPikafishResponse {
  bestmove: string | null;
  pv: string[];
  scoreCp: number;
  mate: number | null;
  depth: number;
  engine: 'pikafish';
}

/** Convert standard Xiangqi UCI move (e.g. "h2e2") to our Move object on `board` */
export function uciToMove(board: Board, uci: string): Move | null {
  if (!uci || uci.length < 4) return null;
  const fromC = uci.charCodeAt(0) - 97;
  const fromRank = Number(uci[1]);
  const toC = uci.charCodeAt(2) - 97;
  const toRank = Number(uci[3]);

  if (Number.isNaN(fromRank) || Number.isNaN(toRank)) return null;
  const fromR = 9 - fromRank;
  const toR = 9 - toRank;

  if (!inBounds(fromR, fromC) || !inBounds(toR, toC)) return null;
  const piece = board[fromR][fromC];
  if (!piece) return null;

  return {
    from: { r: fromR, c: fromC },
    to: { r: toR, c: toC },
    piece,
    captured: board[toR][toC] ?? null,
  };
}

export async function checkPikafishStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/pikafish/status');
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return Boolean(data.available);
  } catch {
    return false;
  }
}

export async function analyzeWithPikafish(
  board: Board,
  side: Side,
  options: {
    movetime?: number;
    depth?: number;
    skillLevel?: number;
    maxPvPlies?: number;
  } = {},
  signal?: AbortSignal
): Promise<PikafishAnalysis | null> {
  const fen = boardToFen(board, side);

  try {
    const res = await fetch('/api/pikafish/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen,
        movetime: options.movetime ?? 550,
        depth: options.depth,
        skillLevel: options.skillLevel ?? 20,
      }),
      signal,
    });

    if (!res.ok) return null;
    const raw = (await res.json()) as RawPikafishResponse;

    const bestUci = raw.bestmove ?? raw.pv[0] ?? null;
    const bestMove = bestUci ? uciToMove(board, bestUci) : null;
    const bestNotation = bestMove ? moveToChineseNotation(board, bestMove) : null;

    // Convert up to maxPvPlies of UCI PV into authentic Chinese notation
    const maxPlies = options.maxPvPlies ?? 6;
    const futureLine: { side: Side; notation: string }[] = [];
    let simBoard = cloneBoard(board);
    let curSide: Side = side;

    for (const uci of raw.pv.slice(0, maxPlies)) {
      const m = uciToMove(simBoard, uci);
      if (!m || m.piece.side !== curSide) break;
      futureLine.push({
        side: curSide,
        notation: moveToChineseNotation(simBoard, m),
      });
      simBoard = applyMove(simBoard, m);
      curSide = oppositeSide(curSide);
    }

    return {
      bestMove,
      bestNotation,
      futureLine,
      scoreCp: raw.scoreCp,
      mate: raw.mate,
      depth: raw.depth,
      engine: 'pikafish',
    };
  } catch {
    return null;
  }
}

/** Map UI difficulty to Pikafish parameters */
export function difficultyToPikafishOpts(difficulty: Difficulty): {
  skillLevel: number;
  movetime: number;
  depth?: number;
} {
  if (difficulty === 'beginner') {
    return { skillLevel: 1, movetime: 150, depth: 2 };
  }
  if (difficulty === 'intermediate') {
    return { skillLevel: 8, movetime: 300, depth: 7 };
  }
  return { skillLevel: 20, movetime: 800 };
}

/** Convert PikafishAnalysis into ReviewLineResult for ReviewPanel */
export function pikafishToReviewResult(a: PikafishAnalysis): ReviewLineResult {
  return {
    bestMove: a.bestMove,
    bestNotation: a.bestNotation,
    futureLine: a.futureLine,
    evalAfterBest: a.scoreCp,
  };
}
