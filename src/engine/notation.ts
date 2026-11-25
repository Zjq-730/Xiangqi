import { type Board, type Move, type MoveRecord, PIECE_LABELS, type Side } from './types';
import { ROWS } from './xiangqi';

const RED_NUMS = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
const RED_STEPS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const BLACK_NUMS = ['１', '２', '３', '４', '５', '６', '７', '８', '９'];
const BLACK_STEPS = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９'];

function fileLabel(col: number, side: Side): string {
  return side === 'red' ? RED_NUMS[col] : BLACK_NUMS[col];
}

function stepLabel(step: number, side: Side): string {
  return side === 'red' ? RED_STEPS[step] : BLACK_STEPS[step];
}

/**
 * Generate traditional Chinese Xiangqi notation (中文纵线记谱法)
 * e.g. 炮二平五, 馬８進７, 前兵進一
 */
export function moveToChineseNotation(boardBefore: Board, move: Move): string {
  const { from, to, piece } = move;
  const { side, type } = piece;
  const pieceChar = PIECE_LABELS[side][type];

  // Check if there are multiple pieces of the same type & side on the same column
  const sameColRows: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    const p = boardBefore[r][from.c];
    if (p && p.side === side && p.type === type) {
      sameColRows.push(r);
    }
  }

  let prefix: string;
  if (sameColRows.length > 1 && type !== 'A' && type !== 'E') {
    // Sort front-to-back relative to the moving side
    // Red's front is smaller row index; Black's front is larger row index
    const sorted = [...sameColRows].sort((a, b) => (side === 'red' ? a - b : b - a));
    const idx = sorted.indexOf(from.r);
    if (sorted.length === 2) {
      prefix = (idx === 0 ? '前' : '后') + pieceChar;
    } else if (sorted.length === 3) {
      prefix = (idx === 0 ? '前' : idx === 1 ? '中' : '后') + pieceChar;
    } else {
      const ordinals = ['一', '二', '三', '四', '五'];
      prefix = ordinals[idx] + pieceChar;
    }
  } else {
    prefix = pieceChar + fileLabel(from.c, side);
  }

  // Determine direction: 进 / 退 / 平
  const dr = to.r - from.r;
  let action: string;
  let target: string;

  if (dr === 0) {
    action = '平';
    target = fileLabel(to.c, side);
  } else {
    const isForward = side === 'red' ? dr < 0 : dr > 0;
    action = isForward ? '进' : '退';

    // Straight-moving pieces (K, R, C, P) use step count; diagonal/L-moving pieces (A, E, H) use destination file
    if (type === 'K' || type === 'R' || type === 'C' || type === 'P') {
      target = stepLabel(Math.abs(dr), side);
    } else {
      target = fileLabel(to.c, side);
    }
  }

  return `${prefix}${action}${target}`;
}

/**
 * Format full game record for clipboard copy or .txt download
 */
export function exportGameNotation(
  history: MoveRecord[],
  meta: {
    playerSide: Side;
    difficulty: string;
    resultText: string;
    currentFen: string;
  }
): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const lines: string[] = [
    '==============================',
    '        雅弈 · 中国象棋棋谱',
    '==============================',
    `日期：${dateStr}`,
    `执子：${meta.playerSide === 'red' ? '红方（先手）' : '黑方（后手）'} vs AI（${meta.difficulty}）`,
    `结果：${meta.resultText}`,
    `总步数：${history.length} 步`,
    '------------------------------',
  ];

  for (let i = 0; i < history.length; i += 2) {
    const round = Math.floor(i / 2) + 1;
    const redMove = history[i]?.notation ?? '';
    const blackMove = history[i + 1]?.notation ?? '';
    const num = String(round).padStart(2, ' ');
    lines.push(`${num}. ${redMove.padEnd(6, '　')}  ${blackMove}`);
  }

  lines.push('------------------------------');
  lines.push(`当前局面 FEN：`);
  lines.push(meta.currentFen);

  return lines.join('\n');
}
