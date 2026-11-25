export type Side = 'red' | 'black';

/**
 * Piece types:
 * K = General (帥/將)
 * A = Advisor (仕/士)
 * E = Elephant (相/象)
 * H = Horse (傌/馬)
 * R = Chariot (俥/車)
 * C = Cannon (炮/砲)
 * P = Soldier (兵/卒)
 */
export type PieceType = 'K' | 'A' | 'E' | 'H' | 'R' | 'C' | 'P';

export interface Piece {
  side: Side;
  type: PieceType;
}

/** 10 rows (0..9, top=Black, bottom=Red) x 9 cols (0..8) */
export type Board = (Piece | null)[][];

export interface Pos {
  r: number;
  c: number;
}

export interface Move {
  from: Pos;
  to: Pos;
  piece: Piece;
  captured: Piece | null;
}

export interface MoveRecord {
  move: Move;
  notation: string;
  boardAfter: Board;
  inCheck: boolean;
  fenAfter: string;
}

export type Difficulty = 'beginner' | 'intermediate' | 'master';

export type GameStatus =
  | { state: 'playing'; inCheck: boolean }
  | { state: 'checkmate'; winner: Side }
  | { state: 'draw'; reason: string };

export const PIECE_LABELS: Record<Side, Record<PieceType, string>> = {
  red: {
    K: '帥',
    A: '仕',
    E: '相',
    H: '傌',
    R: '俥',
    C: '炮',
    P: '兵',
  },
  black: {
    K: '將',
    A: '士',
    E: '象',
    H: '馬',
    R: '車',
    C: '砲',
    P: '卒',
  },
};

export function oppositeSide(side: Side): Side {
  return side === 'red' ? 'black' : 'red';
}
