import { type Board, type GameStatus, type Move, type Piece, type PieceType, type Pos, type Side, oppositeSide } from './types';

export const ROWS = 10;
export const COLS = 9;

export const INITIAL_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

const FEN_CHAR_TO_TYPE: Record<string, PieceType> = {
  k: 'K',
  a: 'A',
  b: 'E',
  e: 'E',
  n: 'H',
  h: 'H',
  r: 'R',
  c: 'C',
  p: 'P',
};

const TYPE_TO_FEN_CHAR: Record<PieceType, string> = {
  K: 'k',
  A: 'a',
  E: 'b',
  H: 'n',
  R: 'r',
  C: 'c',
  P: 'p',
};

export function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Piece | null>(COLS).fill(null));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function boardFromFen(fen: string): { board: Board; turn: Side } {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split('/');
  const board = createEmptyBoard();

  for (let r = 0; r < ROWS && r < rows.length; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '9') {
        c += Number(ch);
      } else {
        const lower = ch.toLowerCase();
        const type = FEN_CHAR_TO_TYPE[lower];
        if (type && c < COLS) {
          board[r][c] = {
            side: ch === lower ? 'black' : 'red',
            type,
          };
          c++;
        }
      }
    }
  }

  const turn: Side = parts[1] === 'b' ? 'black' : 'red';
  return { board, turn };
}

export function boardToFen(board: Board, turn: Side, halfMoveClock = 0, fullMoveNumber = 1): string {
  const rowStrs: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    let empty = 0;
    let s = '';
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) {
          s += String(empty);
          empty = 0;
        }
        const ch = TYPE_TO_FEN_CHAR[p.type];
        s += p.side === 'red' ? ch.toUpperCase() : ch;
      }
    }
    if (empty > 0) s += String(empty);
    rowStrs.push(s);
  }
  return `${rowStrs.join('/')} ${turn === 'red' ? 'w' : 'b'} - - ${halfMoveClock} ${fullMoveNumber}`;
}

export function createInitialBoard(): Board {
  return boardFromFen(INITIAL_FEN).board;
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function inPalace(r: number, c: number, side: Side): boolean {
  if (c < 3 || c > 5) return false;
  return side === 'red' ? r >= 7 && r <= 9 : r >= 0 && r <= 2;
}

export function findGeneral(board: Board, side: Side): Pos | null {
  const rStart = side === 'red' ? 7 : 0;
  const rEnd = side === 'red' ? 9 : 2;
  for (let r = rStart; r <= rEnd; r++) {
    for (let c = 3; c <= 5; c++) {
      const p = board[r][c];
      if (p && p.side === side && p.type === 'K') {
        return { r, c };
      }
    }
  }
  return null;
}

/** Check if the two generals face each other directly on the same file with no pieces between */
export function generalsFacing(board: Board): boolean {
  const redK = findGeneral(board, 'red');
  const blackK = findGeneral(board, 'black');
  if (!redK || !blackK) return false;
  if (redK.c !== blackK.c) return false;
  for (let r = blackK.r + 1; r < redK.r; r++) {
    if (board[r][redK.c]) return false;
  }
  return true;
}

/** Generate pseudo-legal moves for a single piece at (r, c) */
export function generatePseudoMovesForPiece(board: Board, r: number, c: number): Move[] {
  const piece = board[r][c];
  if (!piece) return [];

  const moves: Move[] = [];
  const { side, type } = piece;

  const tryAdd = (nr: number, nc: number) => {
    if (!inBounds(nr, nc)) return;
    const target = board[nr][nc];
    if (target && target.side === side) return;
    moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece, captured: target });
  };

  switch (type) {
    case 'K': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (inPalace(nr, nc, side)) {
          tryAdd(nr, nc);
        }
      }
      // Flying general capture (if enemy general is directly visible on the same file)
      const enemyK = findGeneral(board, oppositeSide(side));
      if (enemyK && enemyK.c === c) {
        const rMin = Math.min(r, enemyK.r) + 1;
        const rMax = Math.max(r, enemyK.r);
        let clear = true;
        for (let rr = rMin; rr < rMax; rr++) {
          if (board[rr][c]) {
            clear = false;
            break;
          }
        }
        if (clear) {
          tryAdd(enemyK.r, enemyK.c);
        }
      }
      break;
    }

    case 'A': {
      const dirs = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (inPalace(nr, nc, side)) {
          tryAdd(nr, nc);
        }
      }
      break;
    }

    case 'E': {
      const dirs = [
        [-2, -2],
        [-2, 2],
        [2, -2],
        [2, 2],
      ];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        // Elephants cannot cross the river
        if (side === 'red' && nr < 5) continue;
        if (side === 'black' && nr > 4) continue;
        // Blocking eye (塞象眼)
        const eyeR = r + dr / 2;
        const eyeC = c + dc / 2;
        if (board[eyeR][eyeC]) continue;
        tryAdd(nr, nc);
      }
      break;
    }

    case 'H': {
      const steps: [number, number, number, number][] = [
        [-2, -1, -1, 0],
        [-2, 1, -1, 0],
        [2, -1, 1, 0],
        [2, 1, 1, 0],
        [-1, -2, 0, -1],
        [1, -2, 0, -1],
        [-1, 2, 0, 1],
        [1, 2, 0, 1],
      ];
      for (const [dr, dc, legDr, legDc] of steps) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        // Hobbling leg (蹩马腿)
        if (board[r + legDr][c + legDc]) continue;
        tryAdd(nr, nc);
      }
      break;
    }

    case 'R': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!target) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece, captured: null });
          } else {
            if (target.side !== side) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece, captured: target });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }

    case 'C': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        let jumped = false;
        while (inBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!jumped) {
            if (!target) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece, captured: null });
            } else {
              jumped = true;
            }
          } else {
            if (target) {
              if (target.side !== side) {
                moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece, captured: target });
              }
              break;
            }
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }

    case 'P': {
      const forward = side === 'red' ? -1 : 1;
      tryAdd(r + forward, c);
      const crossedRiver = side === 'red' ? r <= 4 : r >= 5;
      if (crossedRiver) {
        tryAdd(r, c - 1);
        tryAdd(r, c + 1);
      }
      break;
    }
  }

  return moves;
}

/** Fast check detection: is `side`'s General currently attacked by `oppositeSide(side)`? */
export function isInCheck(board: Board, side: Side): boolean {
  const kingPos = findGeneral(board, side);
  if (!kingPos) return true;
  const enemy = oppositeSide(side);
  const { r: kr, c: kc } = kingPos;

  // 1. Orthogonal rays: Rook, Cannon, Flying General
  const orthoDirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of orthoDirs) {
    let nr = kr + dr;
    let nc = kc + dc;
    let screens = 0;
    while (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (screens === 0) {
          if (p.side === enemy && (p.type === 'R' || p.type === 'K')) {
            return true;
          }
          screens = 1;
        } else {
          if (p.side === enemy && p.type === 'C') {
            return true;
          }
          break;
        }
      }
      nr += dr;
      nc += dc;
    }
  }

  // 2. Enemy Horse attacks
  // If an enemy horse is at (kr + dr, kc + dc), its blocking leg is at (kr + legDr, kc + legDc)
  const horseChecks: [number, number, number, number][] = [
    [-2, -1, -1, -1],
    [-2, 1, -1, 1],
    [2, -1, 1, -1],
    [2, 1, 1, 1],
    [-1, -2, -1, -1],
    [1, -2, 1, -1],
    [-1, 2, -1, 1],
    [1, 2, 1, 1],
  ];
  for (const [dr, dc, legDr, legDc] of horseChecks) {
    const hr = kr + dr;
    const hc = kc + dc;
    if (!inBounds(hr, hc)) continue;
    const p = board[hr][hc];
    if (p && p.side === enemy && p.type === 'H') {
      if (!board[kr + legDr][kc + legDc]) {
        return true;
      }
    }
  }

  // 3. Enemy Soldier attacks
  // Enemy soldier moves toward our king:
  // If we are red, black soldier moves +1 row (so it attacks from kr - 1) or sideways (kr, kc +- 1)
  const enemyPawnFromR = side === 'red' ? kr - 1 : kr + 1;
  const pawnPositions = [
    [enemyPawnFromR, kc],
    [kr, kc - 1],
    [kr, kc + 1],
  ];
  for (const [pr, pc] of pawnPositions) {
    if (!inBounds(pr, pc)) continue;
    const p = board[pr][pc];
    if (p && p.side === enemy && p.type === 'P') {
      return true;
    }
  }

  return false;
}

/** Apply move immutably */
export function applyMove(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  next[move.to.r][move.to.c] = next[move.from.r][move.from.c];
  next[move.from.r][move.from.c] = null;
  return next;
}

/** Apply move in-place (for fast AI search) */
export function makeMoveInPlace(board: Board, move: Move): void {
  board[move.to.r][move.to.c] = move.piece;
  board[move.from.r][move.from.c] = null;
}

/** Undo move in-place (for fast AI search) */
export function unmakeMoveInPlace(board: Board, move: Move): void {
  board[move.from.r][move.from.c] = move.piece;
  board[move.to.r][move.to.c] = move.captured;
}

/** Generate all legal moves for a specific square */
export function getLegalMovesForSquare(board: Board, r: number, c: number): Move[] {
  const piece = board[r][c];
  if (!piece) return [];
  const pseudo = generatePseudoMovesForPiece(board, r, c);
  const legal: Move[] = [];
  for (const m of pseudo) {
    makeMoveInPlace(board, m);
    const illegal = isInCheck(board, piece.side);
    unmakeMoveInPlace(board, m);
    if (!illegal) {
      legal.push(m);
    }
  }
  return legal;
}

/** Generate all legal moves for `side` */
export function generateAllLegalMoves(board: Board, side: Side): Move[] {
  const legal: Move[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p || p.side !== side) continue;
      const pseudo = generatePseudoMovesForPiece(board, r, c);
      for (const m of pseudo) {
        makeMoveInPlace(board, m);
        const illegal = isInCheck(board, side);
        unmakeMoveInPlace(board, m);
        if (!illegal) {
          legal.push(m);
        }
      }
    }
  }
  return legal;
}

/** Evaluate game status for the side about to move */
export function evaluateGameStatus(
  board: Board,
  turn: Side,
  halfMovesSinceCapture = 0
): GameStatus {
  const legalMoves = generateAllLegalMoves(board, turn);
  const inCheck = isInCheck(board, turn);

  if (legalMoves.length === 0) {
    // In Xiangqi, both checkmate (绝杀) and stalemate (困毙) are a loss for the side with no legal moves
    return { state: 'checkmate', winner: oppositeSide(turn) };
  }

  if (halfMovesSinceCapture >= 120) {
    return { state: 'draw', reason: '六十回合自然限着和棋' };
  }

  return { state: 'playing', inCheck };
}

const INITIAL_COUNTS: Record<PieceType, number> = {
  K: 1,
  R: 2,
  C: 2,
  H: 2,
  E: 2,
  A: 2,
  P: 5,
};

const DISPLAY_ORDER: PieceType[] = ['R', 'C', 'H', 'E', 'A', 'P', 'K'];

/** Compute captured (lost) pieces for each side from any board state */
export function getCapturedPieces(board: Board): {
  redLost: PieceType[];
  blackLost: PieceType[];
} {
  const redPresent: Record<PieceType, number> = { K: 0, A: 0, E: 0, H: 0, R: 0, C: 0, P: 0 };
  const blackPresent: Record<PieceType, number> = { K: 0, A: 0, E: 0, H: 0, R: 0, C: 0, P: 0 };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (p.side === 'red') redPresent[p.type]++;
      else blackPresent[p.type]++;
    }
  }

  const redLost: PieceType[] = [];
  const blackLost: PieceType[] = [];

  for (const t of DISPLAY_ORDER) {
    const rDiff = Math.max(0, INITIAL_COUNTS[t] - redPresent[t]);
    for (let i = 0; i < rDiff; i++) redLost.push(t);
    const bDiff = Math.max(0, INITIAL_COUNTS[t] - blackPresent[t]);
    for (let i = 0; i < bDiff; i++) blackLost.push(t);
  }

  return { redLost, blackLost };
}
