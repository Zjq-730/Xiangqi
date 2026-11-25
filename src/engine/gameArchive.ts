import { evaluateRedAdvantage } from './ai';
import { type Board, type Difficulty, type Move, type MoveRecord, type Pos, type Side } from './types';
import { applyMove, createInitialBoard } from './xiangqi';

export interface SavedMove {
  from: Pos;
  to: Pos;
  notation: string;
  inCheck: boolean;
  /** Red advantage score after this move (100 ≈ 1 兵) */
  evalAfter: number;
}

export interface SavedGame {
  id: string;
  finishedAt: number;
  playerSide: Side;
  difficulty: Difficulty;
  wasTeachingMode: boolean;
  result: 'win' | 'loss' | 'draw';
  resultText: string;
  totalMoves: number;
  moves: SavedMove[];
}

export interface ReconstructedStep {
  boardBefore: Board;
  boardAfter: Board;
  move: Move;
  notation: string;
  inCheck: boolean;
  evalBefore: number;
  evalAfter: number;
}

export interface KeyMoment {
  /** 1-based step index */
  step: number;
  notation: string;
  side: Side;
  /** Positive means how much the mover lost in centipawns */
  loss: number;
  severity: 'blunder' | 'inaccuracy';
}

const ARCHIVE_KEY = 'xiangqi_saved_games_v1';
const MAX_SAVED_GAMES = 30;

export function loadSavedGames(): SavedGame[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedGame[]) : [];
  } catch {
    return [];
  }
}

export function saveGameToArchive(game: SavedGame): SavedGame[] {
  const existing = loadSavedGames();
  const next = [game, ...existing.filter((g) => g.id !== game.id)].slice(0, MAX_SAVED_GAMES);
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function deleteSavedGame(id: string): SavedGame[] {
  const next = loadSavedGames().filter((g) => g.id !== id);
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

export function buildSavedGameFromHistory(params: {
  id: string;
  history: MoveRecord[];
  playerSide: Side;
  difficulty: Difficulty;
  wasTeachingMode: boolean;
  result: 'win' | 'loss' | 'draw';
  resultText: string;
}): SavedGame {
  const moves: SavedMove[] = params.history.map((rec) => ({
    from: rec.move.from,
    to: rec.move.to,
    notation: rec.notation,
    inCheck: rec.inCheck,
    evalAfter: evaluateRedAdvantage(rec.boardAfter),
  }));

  return {
    id: params.id,
    finishedAt: Date.now(),
    playerSide: params.playerSide,
    difficulty: params.difficulty,
    wasTeachingMode: params.wasTeachingMode,
    result: params.result,
    resultText: params.resultText,
    totalMoves: moves.length,
    moves,
  };
}

/** Reconstruct every board frame and Move object for a SavedGame */
export function reconstructGameSteps(game: SavedGame): ReconstructedStep[] {
  const steps: ReconstructedStep[] = [];
  let board = createInitialBoard();
  let prevEval = evaluateRedAdvantage(board);

  for (const sm of game.moves) {
    const piece = board[sm.from.r]?.[sm.from.c];
    if (!piece) break;
    const captured = board[sm.to.r]?.[sm.to.c] ?? null;
    const move: Move = {
      from: sm.from,
      to: sm.to,
      piece,
      captured,
    };
    const boardAfter = applyMove(board, move);
    steps.push({
      boardBefore: board,
      boardAfter,
      move,
      notation: sm.notation,
      inCheck: sm.inCheck,
      evalBefore: prevEval,
      evalAfter: sm.evalAfter,
    });
    board = boardAfter;
    prevEval = sm.evalAfter;
  }

  return steps;
}

/** Identify critical mistakes / blunders made by the player during the game */
export function detectKeyMoments(game: SavedGame): KeyMoment[] {
  const moments: KeyMoment[] = [];
  let prevEval = 0;

  for (let i = 0; i < game.moves.length; i++) {
    const sm = game.moves[i];
    const side: Side = i % 2 === 0 ? 'red' : 'black';
    const sign = side === 'red' ? 1 : -1;
    const beforeForMover = prevEval * sign;
    const afterForMover = sm.evalAfter * sign;
    const loss = beforeForMover - afterForMover;

    // Highlight player's own mistakes primarily
    if (side === game.playerSide && loss >= 90) {
      moments.push({
        step: i + 1,
        notation: sm.notation,
        side,
        loss,
        severity: loss >= 180 ? 'blunder' : 'inaccuracy',
      });
    }

    prevEval = sm.evalAfter;
  }

  return moments.sort((a, b) => b.loss - a.loss).slice(0, 5);
}
