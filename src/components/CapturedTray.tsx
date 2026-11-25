import React from 'react';
import { PIECE_LABELS, type PieceType, type Side } from '../engine/types';

interface CapturedStripProps {
  side: Side;
  pieces: PieceType[];
}

/** Minimal horizontal strip tucked cleanly above or below the wooden board */
export const CapturedStrip: React.FC<CapturedStripProps> = ({ side, pieces }) => {
  return (
    <div
      className={`captured-strip ${pieces.length === 0 ? 'empty' : ''}`}
      aria-label={`${side === 'red' ? '红方' : '黑方'}被吃棋子`}
    >
      {pieces.length > 0 && (
        <>
          <span className={`captured-strip-label ${side}`}>
            {side === 'red' ? '红失' : '黑失'}
          </span>
          <div className="captured-strip-pieces">
            {pieces.map((type, idx) => (
              <div
                key={`${side}-${type}-${idx}`}
                className={`mini-piece ${side}`}
                title={`${side === 'red' ? '红' : '黑'}${PIECE_LABELS[side][type]}`}
              >
                {PIECE_LABELS[side][type]}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
