import React from 'react';
import type { GameStatus } from '../engine/types';

interface EvalBarProps {
  evalScore: number;
  gameStatus: GameStatus;
  isReplaying: boolean;
  flipped: boolean;
}

export const EvalBar: React.FC<EvalBarProps> = ({
  evalScore,
  gameStatus,
  isReplaying,
  flipped,
}) => {
  const { redPercent, shortScore, fullLabel, winnerTone } = (() => {
    if (!isReplaying && gameStatus.state === 'checkmate') {
      return gameStatus.winner === 'red'
        ? { redPercent: 100, shortScore: '红胜', fullLabel: '红方绝杀', winnerTone: 'red' as const }
        : { redPercent: 0, shortScore: '黑胜', fullLabel: '黑方绝杀', winnerTone: 'black' as const };
    }

    const abs = Math.abs(evalScore);
    const pawns = (abs / 100).toFixed(1);
    const pct = Math.max(4, Math.min(96, 50 + 50 * Math.tanh(evalScore / 650)));

    if (abs < 25) {
      return { redPercent: 50, shortScore: '0.0', fullLabel: '局势均衡 (0.0)', winnerTone: 'even' as const };
    }
    if (evalScore > 0) {
      const prefix = abs >= 500 ? '红大优' : '红优';
      return {
        redPercent: pct,
        shortScore: `+${pawns}`,
        fullLabel: `${prefix} +${pawns}（约 1.0 = 1 个兵）`,
        winnerTone: 'red' as const,
      };
    }
    const prefix = abs >= 500 ? '黑大优' : '黑优';
    return {
      redPercent: pct,
      shortScore: `+${pawns}`,
      fullLabel: `${prefix} +${pawns}（约 1.0 = 1 个卒）`,
      winnerTone: 'black' as const,
    };
  })();

  // Pass percentage via CSS variable so desktop uses height (vertical) and mobile uses width (horizontal)
  const redStyle = {
    '--red-pct': `${redPercent}%`,
  } as React.CSSProperties;

  const showScoreAtTop =
    winnerTone === 'even'
      ? false
      : flipped
        ? winnerTone === 'red'
        : winnerTone === 'black';

  return (
    <div className="v-eval-wrap" title={`局面估值：${fullLabel}`}>
      <div className="v-eval-track">
        <div className={`v-eval-red ${flipped ? 'from-top' : 'from-bottom'}`} style={redStyle} />
        <div className="v-eval-mid" />
        <span className={`v-eval-num ${showScoreAtTop ? 'top' : 'bottom'} ${winnerTone}`}>
          {shortScore}
        </span>
      </div>
    </div>
  );
};
