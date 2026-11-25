import { type Board, type Move, PIECE_LABELS, type PieceType, type Side, oppositeSide } from './types';
import { moveToChineseNotation } from './notation';
import { applyMove, generateAllLegalMoves, isInCheck } from './xiangqi';

export interface MoveExplanation {
  move: Move;
  notation: string;
  headline: string;
  tags: string[];
  reasons: string[];
}

export interface PlayerFeedback {
  verdict: 'great' | 'good' | 'inaccuracy';
  label: string;
  text: string;
}

const PIECE_VALUE_SIMPLE: Record<PieceType, number> = {
  K: 100,
  R: 9,
  C: 4.5,
  H: 4,
  E: 2,
  A: 2,
  P: 1,
};

const PIECE_NAME: Record<PieceType, string> = {
  K: '将帅',
  R: '大车',
  C: '炮',
  H: '马',
  E: '象',
  A: '仕',
  P: '兵卒',
};

/** Check if a square (r, c) is attacked by `attackerSide` */
function isSquareAttackedBy(board: Board, r: number, c: number, attackerSide: Side): boolean {
  const enemyMoves = generateAllLegalMoves(board, attackerSide);
  return enemyMoves.some((m) => m.to.r === r && m.to.c === c);
}

/** Recognize classic Xiangqi opening moves in the first few plies */
function detectOpeningMotif(move: Move, moveCount: number): { name: string; desc: string } | null {
  if (moveCount > 5) return null;
  const { from, to, piece } = move;
  const { side, type } = piece;

  // 中炮 (Cannon to center col 4)
  if (type === 'C' && to.c === 4 && (from.r === 7 || from.r === 2) && to.r === from.r) {
    return {
      name: '当头炮',
      desc: '架起中炮直指对方中卒，强势争夺中路主导权，是最具攻击性的经典开局。',
    };
  }

  // 仙人指路 (Advancing 3rd or 7th soldier by 1 step)
  if (
    type === 'P' &&
    (from.c === 2 || from.c === 6) &&
    Math.abs(to.r - from.r) === 1 &&
    to.c === from.c
  ) {
    return {
      name: '仙人指路',
      desc: '挺起三/七路兵试探对方阵型，同时为己方马打开向前跃出的通道。',
    };
  }

  // 屏风马 / 正马 (Horse from back rank to col 2 or 6)
  if (
    type === 'H' &&
    ((side === 'red' && from.r === 9 && to.r === 7) ||
      (side === 'black' && from.r === 0 && to.r === 2)) &&
    (to.c === 2 || to.c === 6)
  ) {
    return {
      name: '跃出正马',
      desc: '跳起正马既能牢牢护住中兵/中卒，又给底线大车让出通道，攻守兼备。',
    };
  }

  // 飞相局 (Elephant to center col 4)
  if (
    type === 'E' &&
    to.c === 4 &&
    ((side === 'red' && from.r === 9 && to.r === 7) ||
      (side === 'black' && from.r === 0 && to.r === 2))
  ) {
    return {
      name: '飞相稳阵',
      desc: '飞相巩固中路防线，阵型厚实稳健，以柔克刚等待反击时机。',
    };
  }

  // 亮直车 (Rook moving 1 step horizontally from corner)
  if (
    type === 'R' &&
    (from.c === 0 || from.c === 8) &&
    (to.c === 1 || to.c === 7) &&
    from.r === to.r
  ) {
    return {
      name: '出动直车',
      desc: '迅速开出主力大车抢占纵线要道，所谓「三步不出车，必定要输棋」。',
    };
  }

  return null;
}

/**
 * Analyze a move on `boardBefore` and produce clear, authentic Chinese Xiangqi explanations.
 */
export function explainMove(
  boardBefore: Board,
  move: Move,
  moveCount: number
): MoveExplanation {
  const notation = moveToChineseNotation(boardBefore, move);
  const { from, to, piece, captured } = move;
  const { side, type } = piece;
  const enemy = oppositeSide(side);
  const boardAfter = applyMove(boardBefore, move);

  const tags: string[] = [];
  const reasons: string[] = [];

  const wasInCheck = isInCheck(boardBefore, side);
  const givesCheck = isInCheck(boardAfter, enemy);

  // 1. Escaping check
  if (wasInCheck) {
    tags.push('应将解围');
    reasons.push('当前正被对方将军，这步棋可以稳妥化解杀机、保住老将安全。');
  }

  // 2. Checkmate or Check
  if (givesCheck) {
    const enemyReplies = generateAllLegalMoves(boardAfter, enemy);
    if (enemyReplies.length === 0) {
      tags.push('绝杀');
      reasons.push('一击绝杀！对方无子可救、无路可退，直接锁定胜局。');
    } else {
      tags.push('将军先手');
      reasons.push('直接叫将迫使对方应将，牢牢握住进攻先手。');
    }
  }

  // 3. Capture analysis
  if (captured) {
    const capLabel = PIECE_LABELS[captured.side][captured.type];
    const capVal = PIECE_VALUE_SIMPLE[captured.type];
    const myVal = PIECE_VALUE_SIMPLE[type];
    const defendedAfter = isSquareAttackedBy(boardAfter, to.r, to.c, enemy);

    if (!defendedAfter) {
      tags.push('白吃得子');
      reasons.push(`直接吃掉对方无根的「${capLabel}」，白赚子力，扩大盘面优势。`);
    } else if (capVal > myVal) {
      tags.push('以小换大');
      reasons.push(`吃掉对方高价值的「${capLabel}」，即便兑子也是净赚子力。`);
    } else if (capVal === myVal) {
      tags.push('兑子简化');
      reasons.push(`吃掉对方「${capLabel}」主动兑子，顺势简化局势或抢占好位。`);
    } else {
      tags.push('战术吃子');
      reasons.push(`先吃下对方「${capLabel}」破坏其阵型，为后续配合创造空间。`);
    }
  }

  // 4. Opening motif (if early game and not a forced tactical capture/check)
  const opening = detectOpeningMotif(move, moveCount);
  if (opening) {
    tags.push(opening.name);
    reasons.push(opening.desc);
  }

  // 5. Saving a piece that was under attack
  if (!wasInCheck && !captured) {
    const attackedBefore = isSquareAttackedBy(boardBefore, from.r, from.c, enemy);
    const attackedAfter = isSquareAttackedBy(boardAfter, to.r, to.c, enemy);
    if (attackedBefore && !attackedAfter && PIECE_VALUE_SIMPLE[type] >= 2) {
      tags.push('避锋保子');
      reasons.push(
        `己方「${PIECE_LABELS[side][type]}」原位置正受对方威胁，及时撤到安全格避免白丢大子。`
      );
    }
  }

  // 6. Newly created threats (targeting enemy R/C/H)
  if (!givesCheck) {
    const followUps = generateAllLegalMoves(boardAfter, side).filter(
      (m) => m.from.r === to.r && m.from.c === to.c && m.captured !== null
    );
    const bigTargets = followUps
      .filter((m) => m.captured && PIECE_VALUE_SIMPLE[m.captured.type] >= 4)
      .sort(
        (a, b) =>
          PIECE_VALUE_SIMPLE[b.captured!.type] - PIECE_VALUE_SIMPLE[a.captured!.type]
      );
    if (bigTargets.length > 0 && reasons.length < 2) {
      const target = bigTargets[0].captured!;
      tags.push('捉子施压');
      reasons.push(
        `落子后顺势瞄准对方「${PIECE_LABELS[target.side][target.type]}」，逼迫对手防守从而掌握主动。`
      );
    }
  }

  // 7. Positional / strategic explanation if we still need more context
  if (reasons.length === 0) {
    switch (type) {
      case 'R': {
        const isRiver = side === 'red' ? to.r === 5 : to.r === 4;
        const isRib = to.c === 3 || to.c === 5;
        const isBottom = side === 'red' ? to.r === 0 : to.r === 9;
        if (isBottom) {
          tags.push('沉底压迫');
          reasons.push('大车沉底牵制对方底线，配合马炮极易形成杀势。');
        } else if (isRib) {
          tags.push('抢占肋道');
          reasons.push('大车抢占四/六路肋道，直逼对方九宫侧翼，控制力极强。');
        } else if (isRiver) {
          tags.push('巡河护阵');
          reasons.push('巡河车既能守住河口防线，又能随时左右调动支援两翼。');
        } else {
          tags.push('调动大车');
          reasons.push('调整大车位置到通畅线路，充分发挥车「一车十子寒」的威力。');
        }
        break;
      }
      case 'H': {
        const crossed = side === 'red' ? to.r <= 4 : to.r >= 5;
        if (crossed) {
          tags.push('跃马过河');
          reasons.push('马跃过河深入敌阵，距离对方九宫更近，威胁骤增。');
        } else {
          tags.push('盘活马路');
          reasons.push('将马调到视野开阔的好位置，避开蹩脚并准备后续出击。');
        }
        break;
      }
      case 'C': {
        if (to.c === 4) {
          tags.push('中炮控局');
          reasons.push('炮归中路威慑中腹，既能牵制对方中路子力，又方便随时借架打子。');
        } else {
          tags.push('调炮布阵');
          reasons.push('灵活调整炮位，寻找炮架封锁对方要道或准备侧面发难。');
        }
        break;
      }
      case 'P': {
        const crossedBefore = side === 'red' ? from.r <= 4 : from.r >= 5;
        const crossedAfter = side === 'red' ? to.r <= 4 : to.r >= 5;
        if (!crossedBefore && crossedAfter) {
          tags.push('小兵过河');
          reasons.push('兵卒过河后可左右横移，威力大增，俗称「过河卒子顶半个车」。');
        } else if (crossedAfter) {
          tags.push('逼近九宫');
          reasons.push('过河兵继续推进挤压对方防线，配合大子协同作战。');
        } else {
          tags.push('挺兵活路');
          reasons.push('挺进兵卒扩大空间，同时疏通己方马路或限制对方子力活动。');
        }
        break;
      }
      case 'A':
      case 'E': {
        tags.push('巩固防守');
        reasons.push(`补起${PIECE_NAME[type]}完善九宫防线，防患于未然，让前方主力无后顾之忧。`);
        break;
      }
      case 'K': {
        tags.push('稳固老将');
        reasons.push('调整将帅站位避开潜在直线威胁，有时还能借「助攻」牵制对手。');
        break;
      }
    }
  }

  // Deduplicate tags and keep at most 2 concise tags
  const uniqueTags = Array.from(new Set(tags)).slice(0, 2);
  const headline = uniqueTags.length > 0 ? `${notation} · ${uniqueTags[0]}` : notation;

  return {
    move,
    notation,
    headline,
    tags: uniqueTags,
    reasons: reasons.slice(0, 2),
  };
}

/**
 * Evaluate how good the player's actual move was compared to the coach's recommended move.
 */
export function evaluatePlayerMoveFeedback(
  playedMove: Move,
  recommendedMove: Move | null,
  evalBeforeForPlayer: number,
  evalAfterForPlayer: number,
  evalRecommendedForPlayer: number | null,
  recommendedNotation: string | null
): PlayerFeedback {
  const isSameAsRecommended =
    recommendedMove !== null &&
    playedMove.from.r === recommendedMove.from.r &&
    playedMove.from.c === recommendedMove.from.c &&
    playedMove.to.r === recommendedMove.to.r &&
    playedMove.to.c === recommendedMove.to.c;

  if (isSameAsRecommended) {
    return {
      verdict: 'great',
      label: '正合我意',
      text: '走出了私教推荐的最佳着法，思路非常清晰！',
    };
  }

  const loss =
    evalRecommendedForPlayer !== null
      ? evalRecommendedForPlayer - evalAfterForPlayer
      : evalBeforeForPlayer - evalAfterForPlayer;

  if (loss <= 40) {
    return {
      verdict: 'great',
      label: '好棋',
      text: '这步棋同样很稳健，与最佳着法几乎不相上下。',
    };
  }

  if (loss <= 140) {
    return {
      verdict: 'good',
      label: '可行',
      text: recommendedNotation
        ? `这一步可以下；如果刚才走「${recommendedNotation}」，局势会稍微更主动一点。`
        : '这一步稳妥可行，继续保持节奏。',
    };
  }

  return {
    verdict: 'inaccuracy',
    label: '略有疏漏',
    text: recommendedNotation
      ? `这一步估值略亏（约 -${(loss / 100).toFixed(1)}），刚才若走「${recommendedNotation}」会更有利。你也可以随时点「悔棋」重试。`
      : '这一步稍显冒进，注意保护己方大子和防守要点。',
  };
}
