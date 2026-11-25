import React from 'react';
import { type Board, type Move, PIECE_LABELS, type Pos, type Side } from '../engine/types';
import { COLS, ROWS } from '../engine/xiangqi';

interface BoardProps {
  board: Board;
  flipped: boolean;
  selectedPos: Pos | null;
  legalTargets: Move[];
  lastMove: Move | null;
  hintMove: Move | null;
  checkedKingPos: Pos | null;
  interactiveSide: Side | null;
  showCheckToast: boolean;
  isReplaying: boolean;
  replayStepLabel?: string;
  isSandbox?: boolean;
  sandboxMoveCount?: number;
  onSquareClick: (r: number, c: number) => void;
  onReturnToLive?: () => void;
  onResumeFromReplay?: () => void;
  onExitSandbox?: () => void;
}

/** Star mark positions (cannon & soldier crosshairs) in logical (r, c) */
const STAR_POSITIONS: [number, number][] = [
  [2, 1],
  [2, 7],
  [3, 0],
  [3, 2],
  [3, 4],
  [3, 6],
  [3, 8],
  [6, 0],
  [6, 2],
  [6, 4],
  [6, 6],
  [6, 8],
  [7, 1],
  [7, 7],
];

function renderStarMark(c: number, r: number) {
  const cx = (c + 0.5) * 100;
  const cy = (r + 0.5) * 100;
  const gap = 8;
  const len = 18;
  const segments: string[] = [];

  // Left corners (skip if col === 0)
  if (c > 0) {
    segments.push(`M ${cx - gap - len} ${cy - gap} H ${cx - gap} V ${cy - gap - len}`);
    segments.push(`M ${cx - gap - len} ${cy + gap} H ${cx - gap} V ${cy + gap + len}`);
  }
  // Right corners (skip if col === 8)
  if (c < COLS - 1) {
    segments.push(`M ${cx + gap + len} ${cy - gap} H ${cx + gap} V ${cy - gap - len}`);
    segments.push(`M ${cx + gap + len} ${cy + gap} H ${cx + gap} V ${cy + gap + len}`);
  }

  return (
    <path
      key={`star-${r}-${c}`}
      d={segments.join(' ')}
      fill="none"
      stroke="#442815"
      strokeWidth="2.4"
      strokeLinecap="square"
    />
  );
}

export const ChessBoard: React.FC<BoardProps> = ({
  board,
  flipped,
  selectedPos,
  legalTargets,
  lastMove,
  hintMove,
  checkedKingPos,
  interactiveSide,
  showCheckToast,
  isReplaying,
  replayStepLabel,
  isSandbox = false,
  sandboxMoveCount = 0,
  onSquareClick,
  onReturnToLive,
  onResumeFromReplay,
  onExitSandbox,
}) => {
  const legalMap = new Map<string, Move>();
  for (const m of legalTargets) {
    legalMap.set(`${m.to.r},${m.to.c}`, m);
  }

  // Convert logical (r, c) to visual (vr, vc)
  const toVisual = (r: number, c: number) => ({
    vr: flipped ? ROWS - 1 - r : r,
    vc: flipped ? COLS - 1 - c : c,
  });

  // Hint arrow coordinates in SVG viewBox (900 x 1000)
  const hintCoords = hintMove
    ? (() => {
        const fromV = toVisual(hintMove.from.r, hintMove.from.c);
        const toV = toVisual(hintMove.to.r, hintMove.to.c);
        return {
          x1: (fromV.vc + 0.5) * 100,
          y1: (fromV.vr + 0.5) * 100,
          x2: (toV.vc + 0.5) * 100,
          y2: (toV.vr + 0.5) * 100,
        };
      })()
    : null;

  const topNums = flipped
    ? ['一', '二', '三', '四', '五', '六', '七', '八', '九']
    : ['１', '２', '３', '４', '５', '６', '７', '８', '９'];
  const bottomNums = flipped
    ? ['９', '８', '７', '６', '５', '４', '３', '２', '１']
    : ['九', '八', '七', '六', '五', '四', '三', '二', '一'];

  const cells: React.ReactNode[] = [];
  for (let vr = 0; vr < ROWS; vr++) {
    for (let vc = 0; vc < COLS; vc++) {
      const r = flipped ? ROWS - 1 - vr : vr;
      const c = flipped ? COLS - 1 - vc : vc;
      const piece = board[r][c];
      const isSelected = selectedPos?.r === r && selectedPos?.c === c;
      const legalMove = legalMap.get(`${r},${c}`);
      const isLastFrom = lastMove?.from.r === r && lastMove?.from.c === c;
      const isLastTo = lastMove?.to.r === r && lastMove?.to.c === c;
      const isHintFrom = hintMove?.from.r === r && hintMove?.from.c === c;
      const isHintTo = hintMove?.to.r === r && hintMove?.to.c === c;
      const isCheckedKing = checkedKingPos?.r === r && checkedKingPos?.c === c;
      const isPlayable = Boolean(piece && interactiveSide && piece.side === interactiveSide && !isReplaying);

      cells.push(
        <div
          key={`${r}-${c}`}
          className="board-cell"
          onClick={() => onSquareClick(r, c)}
        >
          {isLastFrom && <div className="last-move-marker from" />}
          {isLastTo && <div className="last-move-marker" />}
          {(isHintFrom || isHintTo) && <div className="hint-marker" />}

          {piece && (
            <div
              className={[
                'piece',
                piece.side,
                isPlayable ? 'playable' : '',
                isSelected ? 'selected' : '',
                isCheckedKing ? 'checked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {PIECE_LABELS[piece.side][piece.type]}
            </div>
          )}

          {legalMove && !piece && <div className="legal-dot" />}
          {legalMove && piece && <div className="legal-capture-ring" />}
        </div>
      );
    }
  }

  return (
    <div className="board-stage">
      <div className={`wood-frame ${isSandbox ? 'sandbox-frame' : ''}`}>
        <div className="board-surface">
          {/* SVG Board Lines, Palace Diagonals, River Calligraphy, File Labels & Hint Arrow */}
          <svg className="board-svg" viewBox="0 0 900 1000" preserveAspectRatio="none">
            {/* Double outer decorative border */}
            <rect
              x="40"
              y="40"
              width="820"
              height="920"
              fill="none"
              stroke="#442815"
              strokeWidth="4.5"
            />
            <rect
              x="50"
              y="50"
              width="800"
              height="900"
              fill="none"
              stroke="#442815"
              strokeWidth="2.4"
            />

            {/* Horizontal lines (rows 1..8; 0 and 9 are the inner border) */}
            {Array.from({ length: 8 }, (_, idx) => {
              const y = (idx + 1.5) * 100;
              return (
                <line
                  key={`h-${idx}`}
                  x1="50"
                  y1={y}
                  x2="850"
                  y2={y}
                  stroke="#442815"
                  strokeWidth="2.2"
                />
              );
            })}

            {/* Vertical lines (cols 1..7 split at river) */}
            {Array.from({ length: 7 }, (_, idx) => {
              const x = (idx + 1.5) * 100;
              return (
                <g key={`v-${idx}`}>
                  <line x1={x} y1="50" x2={x} y2="450" stroke="#442815" strokeWidth="2.2" />
                  <line x1={x} y1="550" x2={x} y2="950" stroke="#442815" strokeWidth="2.2" />
                </g>
              );
            })}

            {/* Top Nine-Palace Diagonals */}
            <line x1="350" y1="50" x2="550" y2="250" stroke="#442815" strokeWidth="2.2" />
            <line x1="550" y1="50" x2="350" y2="250" stroke="#442815" strokeWidth="2.2" />

            {/* Bottom Nine-Palace Diagonals */}
            <line x1="350" y1="750" x2="550" y2="950" stroke="#442815" strokeWidth="2.2" />
            <line x1="550" y1="750" x2="350" y2="950" stroke="#442815" strokeWidth="2.2" />

            {/* Cannon & Soldier Star Marks */}
            {STAR_POSITIONS.map(([r, c]) => renderStarMark(c, r))}

            {/* River Calligraphy: 楚河 汉界 */}
            <text
              x="255"
              y="518"
              textAnchor="middle"
              fill="#4d2c16"
              opacity="0.78"
              fontSize="50"
              fontFamily='"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif'
              letterSpacing="14"
            >
              楚河
            </text>
            <text
              x="645"
              y="518"
              textAnchor="middle"
              fill="#4d2c16"
              opacity="0.78"
              fontSize="50"
              fontFamily='"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif'
              letterSpacing="14"
            >
              汉界
            </text>

            {/* Subtle file coordinates along top & bottom */}
            {topNums.map((label, i) => (
              <text
                key={`top-${i}`}
                x={(i + 0.5) * 100}
                y="26"
                textAnchor="middle"
                fill="#5c391e"
                opacity="0.65"
                fontSize="20"
                fontFamily='"Kaiti SC", "STKaiti", "KaiTi", serif'
              >
                {label}
              </text>
            ))}
            {bottomNums.map((label, i) => (
              <text
                key={`bot-${i}`}
                x={(i + 0.5) * 100}
                y="988"
                textAnchor="middle"
                fill="#5c391e"
                opacity="0.65"
                fontSize="20"
                fontFamily='"Kaiti SC", "STKaiti", "KaiTi", serif'
              >
                {label}
              </text>
            ))}

            {/* Hint / Sandbox Counter Arrow Overlay */}
            {hintCoords && (
              <g opacity="0.86">
                <defs>
                  <marker
                    id="hint-arrowhead"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 4, 0 8" fill={isSandbox ? '#c026d3' : '#1f7a5c'} />
                  </marker>
                </defs>
                <line
                  x1={hintCoords.x1}
                  y1={hintCoords.y1}
                  x2={hintCoords.x2}
                  y2={hintCoords.y2}
                  stroke={isSandbox ? '#c026d3' : '#1f7a5c'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="14 10"
                  markerEnd="url(#hint-arrowhead)"
                />
              </g>
            )}
          </svg>

          {/* Interactive Pieces & Click Targets */}
          <div className="board-cells">{cells}</div>

          {/* Floating Check Toast */}
          {showCheckToast && <div className="check-toast">將軍</div>}
        </div>
      </div>

      {/* Sandbox Banner (below board frame so it never covers pieces) */}
      {isSandbox && (
        <div className="board-status-bar sandbox-banner">
          <span>
            试走摆变化{sandboxMoveCount > 0 ? ` · 已走 ${sandboxMoveCount} 步` : ' · 点棋子试走'}
          </span>
          {onExitSandbox && (
            <button type="button" onClick={onExitSandbox}>
              退出试走
            </button>
          )}
        </div>
      )}

      {/* Replay Banner (below board frame so it never covers pieces) */}
      {!isSandbox && isReplaying && (
        <div className="board-status-bar">
          <span>复盘预览 · {replayStepLabel}</span>
          {onReturnToLive && (
            <button type="button" onClick={onReturnToLive}>
              回到最新
            </button>
          )}
          {onResumeFromReplay && (
            <button type="button" onClick={onResumeFromReplay}>
              从此步续下
            </button>
          )}
        </div>
      )}
    </div>
  );
};
