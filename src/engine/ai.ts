import { moveToChineseNotation } from './notation';
import { type Board, type Difficulty, type Move, type PieceType, type Side, oppositeSide } from './types';
import {
  COLS,
  ROWS,
  applyMove,
  cloneBoard,
  generateAllLegalMoves,
  isInCheck,
  makeMoveInPlace,
  unmakeMoveInPlace,
} from './xiangqi';

const INF = 100000;
const MATE_SCORE = 50000;

const PIECE_VALUES: Record<PieceType, number> = {
  K: 10000,
  R: 900,
  C: 450,
  H: 400,
  E: 200,
  A: 200,
  P: 100,
};

/**
 * Piece-Square Tables from Red's perspective (row 0 = Black back rank, row 9 = Red back rank).
 * For Black, we mirror row: pst[9 - r][c].
 */
const PST: Record<PieceType, number[][]> = {
  K: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 2, 2, 2, 0, 0, 0],
    [0, 0, 0, 11, 15, 11, 0, 0, 0],
  ],
  A: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 20, 0, 20, 0, 0, 0],
    [0, 0, 0, 0, 23, 0, 0, 0, 0],
    [0, 0, 0, 20, 0, 20, 0, 0, 0],
  ],
  E: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 20, 0, 0, 0, 20, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [18, 0, 0, 0, 23, 0, 0, 0, 18],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 20, 0, 0, 0, 20, 0, 0],
  ],
  H: [
    [4, 8, 16, 12, 4, 12, 16, 8, 4],
    [4, 10, 28, 16, 8, 16, 28, 10, 4],
    [12, 14, 16, 20, 18, 20, 16, 14, 12],
    [8, 24, 18, 24, 20, 24, 18, 24, 8],
    [6, 16, 14, 18, 16, 18, 14, 16, 6],
    [4, 12, 16, 14, 12, 14, 16, 12, 4],
    [2, 6, 8, 6, 10, 6, 8, 6, 2],
    [4, 2, 8, 8, 4, 8, 8, 2, 4],
    [0, 2, 4, 4, -2, 4, 4, 2, 0],
    [0, -4, 0, 0, 0, 0, 0, -4, 0],
  ],
  R: [
    [14, 14, 12, 18, 16, 18, 12, 14, 14],
    [16, 20, 18, 24, 26, 24, 18, 20, 16],
    [12, 12, 12, 18, 18, 18, 12, 12, 12],
    [12, 18, 16, 22, 22, 22, 16, 18, 12],
    [12, 14, 12, 18, 18, 18, 12, 14, 12],
    [12, 16, 14, 20, 20, 20, 14, 16, 12],
    [6, 10, 8, 14, 14, 14, 8, 10, 6],
    [4, 8, 6, 14, 12, 14, 6, 8, 4],
    [8, 4, 8, 16, 8, 16, 8, 4, 8],
    [-2, 10, 6, 14, 12, 14, 6, 10, -2],
  ],
  C: [
    [6, 4, 0, -10, -12, -10, 0, 4, 6],
    [2, 2, 0, -4, -14, -4, 0, 2, 2],
    [2, 2, 0, -10, -8, -10, 0, 2, 2],
    [0, 0, -2, 4, 10, 4, -2, 0, 0],
    [0, 0, 0, 2, 8, 2, 0, 0, 0],
    [-2, 0, 4, 2, 6, 2, 4, 0, -2],
    [0, 0, 0, 2, 4, 2, 0, 0, 0],
    [4, 0, 8, 6, 10, 6, 8, 0, 4],
    [0, 2, 4, 6, 6, 6, 4, 2, 0],
    [0, 0, 2, 6, 6, 6, 2, 0, 0],
  ],
  P: [
    [0, 3, 6, 9, 12, 9, 6, 3, 0],
    [18, 36, 56, 80, 120, 80, 56, 36, 18],
    [14, 26, 42, 60, 80, 60, 42, 26, 14],
    [10, 20, 30, 34, 40, 34, 30, 20, 10],
    [6, 12, 18, 18, 20, 18, 18, 12, 6],
    [2, 0, 8, 0, 8, 0, 8, 0, 2],
    [0, 0, -2, 0, 4, 0, -2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
};

function evaluateBoard(board: Board, side: Side): number {
  let redScore = 0;
  let blackScore = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      const base = PIECE_VALUES[p.type];
      if (p.side === 'red') {
        redScore += base + PST[p.type][r][c];
      } else {
        blackScore += base + PST[p.type][9 - r][c];
      }
    }
  }

  return side === 'red' ? redScore - blackScore : blackScore - redScore;
}

/**
 * Public position evaluation from Red's perspective (in centipawn-like units; 100 ≈ 1 兵).
 * Positive = Red advantage, Negative = Black advantage.
 */
export function evaluateRedAdvantage(board: Board): number {
  return evaluateBoard(board, 'red');
}

function moveKey(m: Move): number {
  return (m.from.r << 12) | (m.from.c << 8) | (m.to.r << 4) | m.to.c;
}

function scoreMove(m: Move, ttBestMoveKey: number): number {
  if (ttBestMoveKey && moveKey(m) === ttBestMoveKey) return 100000;
  let score = 0;
  if (m.captured) {
    // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
    score += 10000 + PIECE_VALUES[m.captured.type] * 10 - PIECE_VALUES[m.piece.type];
  }
  const pst = PST[m.piece.type];
  const fromVal = m.piece.side === 'red' ? pst[m.from.r][m.from.c] : pst[9 - m.from.r][m.from.c];
  const toVal = m.piece.side === 'red' ? pst[m.to.r][m.to.c] : pst[9 - m.to.r][m.to.c];
  score += toVal - fromVal;
  return score;
}

// Simple deterministic Zobrist hashing for Transposition Table
const PIECE_TYPES: PieceType[] = ['K', 'A', 'E', 'H', 'R', 'C', 'P'];
const ZOBRIST: number[][][] = [];
let seed = 0x9e3779b9;
function nextRand32(): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
}

for (let p = 0; p < 14; p++) {
  ZOBRIST[p] = [];
  for (let r = 0; r < ROWS; r++) {
    ZOBRIST[p][r] = [];
    for (let c = 0; c < COLS; c++) {
      ZOBRIST[p][r][c] = nextRand32();
    }
  }
}
const ZOBRIST_SIDE = nextRand32();

function pieceIndex(side: Side, type: PieceType): number {
  return (side === 'red' ? 0 : 7) + PIECE_TYPES.indexOf(type);
}

function computeHash(board: Board, side: Side): number {
  let h = side === 'black' ? ZOBRIST_SIDE : 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p) {
        h ^= ZOBRIST[pieceIndex(p.side, p.type)][r][c];
      }
    }
  }
  return h >>> 0;
}

interface TTEntry {
  depth: number;
  score: number;
  flag: 'exact' | 'lower' | 'upper';
  bestMoveKey: number;
}

const MAX_TT_SIZE = 65536;
const tt = new Map<number, TTEntry>();

function ttSet(hash: number, entry: TTEntry) {
  if (tt.size >= MAX_TT_SIZE) {
    tt.clear();
  }
  tt.set(hash, entry);
}

interface SearchContext {
  startTime: number;
  timeLimitMs: number;
  aborted: boolean;
  nodes: number;
}

function quiescence(
  board: Board,
  side: Side,
  alpha: number,
  beta: number,
  qDepth: number,
  ctx: SearchContext
): number {
  ctx.nodes++;
  if ((ctx.nodes & 1023) === 0 && Date.now() - ctx.startTime > ctx.timeLimitMs) {
    ctx.aborted = true;
    return 0;
  }

  const standPat = evaluateBoard(board, side);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (qDepth <= 0) return alpha;

  const allMoves = generateAllLegalMoves(board, side);
  const captures = allMoves.filter((m) => m.captured !== null);
  captures.sort((a, b) => scoreMove(b, 0) - scoreMove(a, 0));

  for (const m of captures) {
    makeMoveInPlace(board, m);
    const score = -quiescence(board, oppositeSide(side), -beta, -alpha, qDepth - 1, ctx);
    unmakeMoveInPlace(board, m);

    if (ctx.aborted) return 0;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

function negamax(
  board: Board,
  side: Side,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  useQuiescence: boolean,
  ctx: SearchContext
): number {
  ctx.nodes++;
  if ((ctx.nodes & 1023) === 0 && Date.now() - ctx.startTime > ctx.timeLimitMs) {
    ctx.aborted = true;
    return 0;
  }

  const hash = computeHash(board, side);
  const origAlpha = alpha;
  const cached = tt.get(hash);
  if (cached && cached.depth >= depth) {
    if (cached.flag === 'exact') return cached.score;
    if (cached.flag === 'lower') alpha = Math.max(alpha, cached.score);
    else if (cached.flag === 'upper') beta = Math.min(beta, cached.score);
    if (alpha >= beta) return cached.score;
  }

  const moves = generateAllLegalMoves(board, side);
  if (moves.length === 0) {
    // Checkmate or stalemate: prefer faster mates
    return -MATE_SCORE + ply;
  }

  if (depth <= 0) {
    return useQuiescence
      ? quiescence(board, side, alpha, beta, 4, ctx)
      : evaluateBoard(board, side);
  }

  const ttBest = cached?.bestMoveKey ?? 0;
  moves.sort((a, b) => scoreMove(b, ttBest) - scoreMove(a, ttBest));

  let bestScore = -INF;
  let bestKey = 0;

  for (const m of moves) {
    makeMoveInPlace(board, m);
    // Slight check extension at shallow depths
    const givesCheck = depth === 1 && ply < 6 && isInCheck(board, oppositeSide(side));
    const nextDepth = givesCheck ? depth : depth - 1;
    const score = -negamax(board, oppositeSide(side), nextDepth, ply + 1, -beta, -alpha, useQuiescence, ctx);
    unmakeMoveInPlace(board, m);

    if (ctx.aborted) return 0;

    if (score > bestScore) {
      bestScore = score;
      bestKey = moveKey(m);
    }
    if (score > alpha) {
      alpha = score;
    }
    if (alpha >= beta) {
      break;
    }
  }

  let flag: 'exact' | 'lower' | 'upper' = 'exact';
  if (bestScore <= origAlpha) flag = 'upper';
  else if (bestScore >= beta) flag = 'lower';
  ttSet(hash, { depth, score: bestScore, flag, bestMoveKey: bestKey });

  return bestScore;
}

/** Curated opening book for natural, classic Chinese Chess openings */
interface BookEntry {
  from: [number, number];
  to: [number, number];
}

function tryOpeningBook(board: Board, side: Side, moveCount: number): Move | null {
  if (moveCount > 2) return null;

  let candidates: BookEntry[] = [];
  if (moveCount === 0 && side === 'red') {
    // Red's opening: 中炮(炮二平五/炮八平五), 仙人指路(兵三进一/兵七进一), 飞相局(相三进五), 起马局(马二进三)
    candidates = [
      { from: [7, 7], to: [7, 4] },
      { from: [7, 1], to: [7, 4] },
      { from: [6, 2], to: [5, 2] },
      { from: [6, 6], to: [5, 6] },
      { from: [9, 6], to: [7, 4] },
      { from: [9, 7], to: [7, 6] },
    ];
  } else if (moveCount === 1 && side === 'black') {
    // Classic Black replies: 屏风马(马8进7 / 马2进3), 顺炮(炮8平5 / 炮2平5), 挺卒
    candidates = [
      { from: [0, 7], to: [2, 6] },
      { from: [0, 1], to: [2, 2] },
      { from: [2, 7], to: [2, 4] },
      { from: [2, 1], to: [2, 4] },
    ];
  }

  if (candidates.length === 0) return null;

  const legal = generateAllLegalMoves(board, side);
  const validBookMoves = legal.filter((m) =>
    candidates.some(
      (c) => c.from[0] === m.from.r && c.from[1] === m.from.c && c.to[0] === m.to.r && c.to[1] === m.to.c
    )
  );

  if (validBookMoves.length === 0) return null;
  return validBookMoves[Math.floor(Math.random() * validBookMoves.length)];
}

export function findBestMove(
  inputBoard: Board,
  side: Side,
  difficulty: Difficulty,
  moveCount = 0
): Move | null {
  const board = cloneBoard(inputBoard);
  const legalMoves = generateAllLegalMoves(board, side);
  if (legalMoves.length === 0) return null;
  if (legalMoves.length === 1) return legalMoves[0];

  // Use opening book for intermediate & master
  if (difficulty !== 'beginner') {
    const bookMove = tryOpeningBook(board, side, moveCount);
    if (bookMove) return bookMove;
  }

  const maxDepth = difficulty === 'beginner' ? 2 : difficulty === 'intermediate' ? 3 : 4;
  const timeLimitMs = difficulty === 'beginner' ? 400 : difficulty === 'intermediate' ? 1200 : 2200;
  const useQuiescence = difficulty !== 'beginner';

  const ctx: SearchContext = {
    startTime: Date.now(),
    timeLimitMs,
    aborted: false,
    nodes: 0,
  };

  let bestMove: Move = legalMoves[0];

  // Iterative deepening so we always have a solid move within timeLimitMs
  for (let depth = 1; depth <= maxDepth; depth++) {
    let currentBestMove = bestMove;
    let bestScore = -INF;
    let alpha = -INF;
    const beta = INF;

    const hash = computeHash(board, side);
    const ttBest = tt.get(hash)?.bestMoveKey ?? moveKey(bestMove);
    legalMoves.sort((a, b) => scoreMove(b, ttBest) - scoreMove(a, ttBest));

    const scoredMoves: { move: Move; score: number }[] = [];

    for (const m of legalMoves) {
      makeMoveInPlace(board, m);
      const score = -negamax(board, oppositeSide(side), depth - 1, 1, -beta, -alpha, useQuiescence, ctx);
      unmakeMoveInPlace(board, m);

      if (ctx.aborted) break;

      scoredMoves.push({ move: m, score });
      if (score > bestScore) {
        bestScore = score;
        currentBestMove = m;
      }
      if (score > alpha) {
        alpha = score;
      }
    }

    if (!ctx.aborted) {
      if (difficulty === 'beginner' && depth === maxDepth && scoredMoves.length > 1) {
        // Add gentle variety for beginner mode without blundering obvious mates
        scoredMoves.sort((a, b) => b.score - a.score);
        const topScore = scoredMoves[0].score;
        const nearTop = scoredMoves.filter((s) => topScore - s.score <= 35);
        bestMove = nearTop[Math.floor(Math.random() * nearTop.length)].move;
      } else {
        bestMove = currentBestMove;
      }

      // Stop early if forced mate found
      if (Math.abs(bestScore) > MATE_SCORE - 100) {
        break;
      }
    } else {
      break;
    }
  }

  return bestMove;
}

export interface ReviewLineResult {
  bestMove: Move | null;
  bestNotation: string | null;
  /** Predicted next 3-4 plies starting from bestMove */
  futureLine: { side: Side; notation: string }[];
  evalAfterBest: number;
}

/**
 * Compute the engine's recommended better move and a 4-ply predicted continuation
 * ("如果这么走，未来几步可能是……") for Post-Game Review Mode.
 */
export function analyzePositionForReview(
  inputBoard: Board,
  side: Side,
  moveCount = 0
): ReviewLineResult {
  let simBoard = cloneBoard(inputBoard);
  let curSide: Side = side;
  let curMoveCount = moveCount;
  const futureLine: { side: Side; notation: string }[] = [];
  let bestMove: Move | null = null;
  let bestNotation: string | null = null;
  let evalAfterBest = evaluateRedAdvantage(simBoard);

  for (let ply = 0; ply < 4; ply++) {
    // First ply uses intermediate/master depth; follow-up plies use fast depth for snappy response
    const diff: Difficulty = ply === 0 ? 'intermediate' : 'beginner';
    const m = findBestMove(simBoard, curSide, diff, curMoveCount);
    if (!m) break;
    const notation = moveToChineseNotation(simBoard, m);
    futureLine.push({ side: curSide, notation });
    simBoard = applyMove(simBoard, m);

    if (ply === 0) {
      bestMove = m;
      bestNotation = notation;
      evalAfterBest = evaluateRedAdvantage(simBoard);
    }

    curSide = oppositeSide(curSide);
    curMoveCount++;
  }

  return {
    bestMove,
    bestNotation,
    futureLine,
    evalAfterBest,
  };
}
