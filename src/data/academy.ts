import type { Board, PieceType, Pos, Side } from '../engine/types';
import { COLS, ROWS, createInitialBoard } from '../engine/xiangqi';

export interface PiecePlacement {
  r: number;
  c: number;
  side: Side;
  type: PieceType;
}

export function createBoardFromPieces(pieces: PiecePlacement[]): Board {
  const board: Board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null)
  );
  for (const p of pieces) {
    board[p.r][p.c] = { side: p.side, type: p.type };
  }
  return board;
}

/* ============================================================
 * 1. 基础微课 (Interactive Micro-Lessons)
 * ============================================================ */

export interface LessonStep {
  title: string;
  explanation: string;
  formula?: string;
  kind: 'demo' | 'practice';
  pieces?: PiecePlacement[];
  useInitialBoard?: boolean;
  highlightCoords?: boolean;
  targetSquares?: Pos[];
  expectedMoves: { from: Pos; to: Pos }[];
  successTip: string;
  wrongHint: string;
}

export interface MicroLesson {
  id: string;
  category: 'notation' | 'pieces';
  title: string;
  subtitle: string;
  duration: string;
  steps: LessonStep[];
}

export const MICRO_LESSONS: MicroLesson[] = [
  {
    id: 'notation-1',
    category: 'notation',
    title: '四字记谱法（一）：路数与「平」',
    subtitle: '2 分钟看懂“炮二平五”的秘密',
    duration: '2 分钟',
    steps: [
      {
        title: '第一步：先认清 9 条竖线（路）',
        explanation:
          '中国象棋记录着法只需四个字。看棋盘底部的「九八七六五四三二一」——红方永远从自己的【右往左】数一到九路；黑方也从自己的右往左数 1 到 9 路。点下方按钮看「炮二平五」怎么走。',
        formula: '炮（棋子）· 二（原路）· 平（横移）· 五（目标路）',
        kind: 'demo',
        useInitialBoard: true,
        highlightCoords: true,
        expectedMoves: [{ from: { r: 7, c: 7 }, to: { r: 7, c: 4 } }],
        successTip: '看！红方右侧的炮原本在「二路」，横向平移到中间「五路」，就记作「炮二平五」。',
        wrongHint: '点击下方「演示这一步」观察着法。',
      },
      {
        title: '动手试试：走出「炮二平五」',
        explanation:
          '轮到你了！请在棋盘上找到红方二路的炮，把它平移到五路，走出大名鼎鼎的“当头炮”。',
        formula: '目标着法：炮二平五',
        kind: 'practice',
        useInitialBoard: true,
        highlightCoords: true,
        targetSquares: [{ r: 7, c: 4 }],
        expectedMoves: [{ from: { r: 7, c: 7 }, to: { r: 7, c: 4 } }],
        successTip: '漂亮！只要是横向左右移动，第三个字一律用「平」，第四个字就是到达的路数。',
        wrongHint: '从红方右边数第 2 条竖线是二路，点那颗红炮，再点中间五路的位置。',
      },
      {
        title: '再来一题：走出「炮八平五」',
        explanation:
          '换成左翼的炮试试看！从红方右边数第 8 条竖线是「八路」，把它平移到中间「五路」。',
        formula: '目标着法：炮八平五',
        kind: 'practice',
        useInitialBoard: true,
        highlightCoords: true,
        expectedMoves: [{ from: { r: 7, c: 1 }, to: { r: 7, c: 4 } }],
        successTip: '完全正确！你已经掌握了路数方向和「平」字诀。',
        wrongHint: '红方八路在左侧（靠近左边第二条线），选中左边的红炮平移到五路。',
      },
    ],
  },
  {
    id: 'notation-2',
    category: 'notation',
    title: '四字记谱法（二）：「进/退」与直斜之别',
    subtitle: '直走算步数，斜走算落点路数',
    duration: '2 分钟',
    steps: [
      {
        title: '核心口诀：直走看步数，斜走看路数',
        explanation:
          '往前走叫「进」，往回退叫「退」。最关键的区别在第四个字：车、炮、兵、帅【走直线】时，第四字写走了几步；而马、相、士【走斜线】时，第四字写落点在哪一路。',
        formula: '兵七进一（直走 1 步） vs 马二进三（斜跳到三路）',
        kind: 'demo',
        useInitialBoard: true,
        highlightCoords: true,
        expectedMoves: [{ from: { r: 9, c: 7 }, to: { r: 7, c: 6 } }],
        successTip: '红马原本在「二路」，往前斜跳到「三路」，所以记作「马二进三」。',
        wrongHint: '点击下方「演示这一步」观察着法。',
      },
      {
        title: '动手练习：走出「马八进七」',
        explanation:
          '找到红方左翼八路的马，往前跳到七路（正马位置）。记住：马走斜线，第四字看落点路数！',
        formula: '目标着法：马八进七',
        kind: 'practice',
        useInitialBoard: true,
        highlightCoords: true,
        expectedMoves: [{ from: { r: 9, c: 1 }, to: { r: 7, c: 2 } }],
        successTip: '答对了！红马从八路跳到七路，这就是象棋最常用的「马八进七」。',
        wrongHint: '选中左侧八路的红马，往右前方跳到七路（不要跳到九路边线上）。',
      },
      {
        title: '直线练习：走出「兵七进一」',
        explanation:
          '现在试试直线子力：把红方七路的兵往前拱一步（仙人指路开局）。直线前进 1 格，第四字就是「一」。',
        formula: '目标着法：兵七进一',
        kind: 'practice',
        useInitialBoard: true,
        highlightCoords: true,
        expectedMoves: [{ from: { r: 6, c: 2 }, to: { r: 5, c: 2 } }],
        successTip: '完美！直走算步数、斜走算路数，四字记谱法 90% 的精髓已经到手。',
        wrongHint: '找到底部标注「七」字正上方的红兵，往前走 1 步。',
      },
    ],
  },
  {
    id: 'notation-3',
    category: 'notation',
    title: '四字记谱法（三）：同路「前/后」区分',
    subtitle: '两颗一样的子在同一条竖线怎么记？',
    duration: '1 分钟',
    steps: [
      {
        title: '同一路有两个炮，怎么分？',
        explanation:
          '当同一方两颗相同的棋子（比如双炮、双车、双马）正好站在同一条竖线上时，不用写原路数，直接用「前」（更靠近对方底线）和「后」（更靠近己方底线）来区分！',
        formula: '前炮平五（靠前的炮平移到五路）',
        kind: 'demo',
        pieces: [
          { r: 0, c: 3, side: 'black', type: 'K' },
          { r: 9, c: 5, side: 'red', type: 'K' },
          { r: 4, c: 7, side: 'red', type: 'C' },
          { r: 7, c: 7, side: 'red', type: 'C' },
        ],
        highlightCoords: true,
        expectedMoves: [{ from: { r: 4, c: 7 }, to: { r: 4, c: 4 } }],
        successTip: '靠前的红炮移到五路，记作「前炮平五」，清晰无歧义。',
        wrongHint: '点击下方「演示这一步」。',
      },
      {
        title: '动手试试：走出「后炮平五」',
        explanation: '这次请移动【靠后】的那颗红炮，平移到五路。',
        formula: '目标着法：后炮平五',
        kind: 'practice',
        pieces: [
          { r: 0, c: 3, side: 'black', type: 'K' },
          { r: 9, c: 5, side: 'red', type: 'K' },
          { r: 4, c: 7, side: 'red', type: 'C' },
          { r: 7, c: 7, side: 'red', type: 'C' },
        ],
        highlightCoords: true,
        expectedMoves: [{ from: { r: 7, c: 7 }, to: { r: 7, c: 4 } }],
        successTip: '恭喜！至此你已经彻底掌握中国象棋的全部记谱规则，全天下的棋谱都能自己读了！',
        wrongHint: '「后炮」是更靠近红方底线（下方）的那颗炮，把它平移到中间五路。',
      },
    ],
  },
  {
    id: 'piece-horse',
    category: 'pieces',
    title: '单子练手：马走日与蹩马腿',
    subtitle: '避开障碍，体会“八面威风”的马步',
    duration: '2 分钟',
    steps: [
      {
        title: '第 1 关：绕开蹩马腿',
        explanation:
          '马走「日」字（先直走一格，再斜走一格）。如果直走的那一格有棋子挡着，就叫「蹩马腿」，那个方向跳不过去。请先往右跳一步，绕开正上方挡路的黑象！',
        formula: '规则：马走日，紧邻方向有子则蹩脚',
        kind: 'practice',
        pieces: [
          { r: 0, c: 3, side: 'black', type: 'K' },
          { r: 9, c: 5, side: 'red', type: 'K' },
          { r: 6, c: 4, side: 'red', type: 'H' },
          { r: 5, c: 4, side: 'black', type: 'E' },
          { r: 3, c: 5, side: 'black', type: 'P' },
        ],
        targetSquares: [{ r: 5, c: 6 }],
        expectedMoves: [{ from: { r: 6, c: 4 }, to: { r: 5, c: 6 } }],
        successTip: '很好！正上方被黑象蹩了腿，往右跳到三路就彻底海阔天空了。',
        wrongHint: '注意红马正上方有黑象蹩脚，试试往右上方跳到高亮目标格。',
      },
      {
        title: '第 2 关：一跃吃掉黑卒！',
        explanation: '现在马脚畅通，直接走一个「日」字吃掉上方的黑卒！',
        formula: '目标：用红马吃掉黑卒',
        kind: 'practice',
        pieces: [
          { r: 0, c: 3, side: 'black', type: 'K' },
          { r: 9, c: 5, side: 'red', type: 'K' },
          { r: 5, c: 6, side: 'red', type: 'H' },
          { r: 5, c: 4, side: 'black', type: 'E' },
          { r: 3, c: 5, side: 'black', type: 'P' },
        ],
        targetSquares: [{ r: 3, c: 5 }],
        expectedMoves: [{ from: { r: 5, c: 6 }, to: { r: 3, c: 5 } }],
        successTip: '漂亮！以后下棋时记得先瞄一眼马四周紧邻的四个格，看看有没有被蹩脚。',
        wrongHint: '选中三路的红马，直接点击黑卒所在格吃掉它。',
      },
    ],
  },
  {
    id: 'piece-cannon',
    category: 'pieces',
    title: '单子练手：炮打隔山',
    subtitle: '走法如车，吃子必须翻过一座“炮架”',
    duration: '1 分钟',
    steps: [
      {
        title: '第 1 关：借炮架打掉黑车',
        explanation:
          '炮平时不吃子时和车一样走直线；但吃子时，中间必须隔着【恰好一颗】棋子（敌我皆可，称为炮架）。请用红炮隔山打掉顶部的黑车！',
        formula: '规则：炮吃子必须隔 1 颗棋子',
        kind: 'practice',
        pieces: [
          { r: 0, c: 3, side: 'black', type: 'K' },
          { r: 9, c: 5, side: 'red', type: 'K' },
          { r: 7, c: 2, side: 'red', type: 'C' },
          { r: 4, c: 2, side: 'black', type: 'P' },
          { r: 1, c: 2, side: 'black', type: 'R' },
        ],
        targetSquares: [{ r: 1, c: 2 }],
        expectedMoves: [{ from: { r: 7, c: 2 }, to: { r: 1, c: 2 } }],
        successTip: '干脆利落！记住：炮既不能直接吃紧邻的子，也不能隔两颗子吃。',
        wrongHint: '点击七路红炮，翻过中间的黑卒，直接点击上方的黑车。',
      },
      {
        title: '第 2 关：先平移找炮架！',
        explanation:
          '现在红炮和黑马不在同一条线上，请先横向移动红炮，借中间黑卒当炮架瞄准黑马！',
        formula: '思路：炮平时像车，先占线再打子',
        kind: 'practice',
        pieces: [
          { r: 0, c: 3, side: 'black', type: 'K' },
          { r: 9, c: 5, side: 'red', type: 'K' },
          { r: 7, c: 7, side: 'red', type: 'C' },
          { r: 4, c: 6, side: 'black', type: 'P' },
          { r: 1, c: 6, side: 'black', type: 'H' },
        ],
        targetSquares: [{ r: 7, c: 6 }],
        expectedMoves: [{ from: { r: 7, c: 7 }, to: { r: 7, c: 6 } }],
        successTip: '妙啊！这就是实战中常说的「借子架炮」，下一步黑马就跑不掉了。',
        wrongHint: '把红炮往左平移一格到三路（和黑卒、黑马成一条竖线）。',
      },
    ],
  },
  {
    id: 'piece-elephant',
    category: 'pieces',
    title: '单子练手：相飞田与塞象眼',
    subtitle: '防守大将：不过河，田心有子不能飞',
    duration: '1 分钟',
    steps: [
      {
        title: '飞相吃掉过河黑卒',
        explanation:
          '相（黑方称象）走「田」字对角线，且永远不能过楚河汉界。如果「田」字正中心有棋子挡着（塞象眼），就飞不过去。请用红相吃掉中路的过河黑卒！',
        formula: '规则：相走田、不过河、防塞象眼',
        kind: 'practice',
        pieces: [
          { r: 0, c: 3, side: 'black', type: 'K' },
          { r: 9, c: 5, side: 'red', type: 'K' },
          { r: 9, c: 6, side: 'red', type: 'E' },
          { r: 7, c: 4, side: 'black', type: 'P' },
        ],
        targetSquares: [{ r: 7, c: 4 }],
        expectedMoves: [{ from: { r: 9, c: 6 }, to: { r: 7, c: 4 } }],
        successTip: '稳健！中路飞相（相三进五）是象棋最经典的防守阵型之一。',
        wrongHint: '选中红方三路底线的红相，斜飞到五路吃掉黑卒。',
      },
    ],
  },
];

/* ============================================================
 * 2. 杀法闯关 (Classic Checkmate Tactics Puzzles)
 * ============================================================ */

export interface PuzzleStep {
  playerMoves: { from: Pos; to: Pos }[];
  opponentReply?: { from: Pos; to: Pos };
  hintText: string;
}

export interface TacticPuzzle {
  id: string;
  name: string;
  difficulty: '1 步杀' | '2 步杀';
  tag: string;
  description: string;
  pieces: PiecePlacement[];
  steps: PuzzleStep[];
  takeaway: string;
}

export const TACTIC_PUZZLES: TacticPuzzle[] = [
  {
    id: 'white-face',
    name: '白脸将（对面笑）',
    difficulty: '1 步杀',
    tag: '借帅助攻',
    description:
      '老将与老帅不能在同一直线上直接照面。红帅已经在五路锁死黑将退路，红车只需一步横移就能完成绝杀！',
    pieces: [
      { r: 0, c: 3, side: 'black', type: 'K' },
      { r: 9, c: 4, side: 'red', type: 'K' },
      { r: 3, c: 5, side: 'red', type: 'R' },
    ],
    steps: [
      {
        playerMoves: [{ from: { r: 3, c: 5 }, to: { r: 3, c: 3 } }],
        hintText: '把红车平移到六路（黑将正下方）将军！黑将既不能上下躲，又不能往中路走（会白脸将）！',
      },
    ],
    takeaway: '残局中红帅本身就是一颗强大的助攻棋子，占住中路往往能帮车炮一击致命。',
  },
  {
    id: 'smothered',
    name: '闷宫杀',
    difficulty: '1 步杀',
    tag: '借敌堵门',
    description:
      '黑将四周被自己的双士和黑马堵得严严实实，无路可逃。红马只需一步跃起就能完成绝杀！',
    pieces: [
      { r: 0, c: 4, side: 'black', type: 'K' },
      { r: 0, c: 3, side: 'black', type: 'A' },
      { r: 0, c: 5, side: 'black', type: 'A' },
      { r: 1, c: 4, side: 'black', type: 'H' },
      { r: 9, c: 5, side: 'red', type: 'K' },
      { r: 4, c: 4, side: 'red', type: 'H' },
    ],
    steps: [
      {
        playerMoves: [
          { from: { r: 4, c: 4 }, to: { r: 2, c: 3 } },
          { from: { r: 4, c: 4 }, to: { r: 2, c: 5 } },
        ],
        hintText: '把五路红马往前跳到黑方九宫尖角（四路或六路）将军，黑将被自己子堵死，直接闷杀！',
      },
    ],
    takeaway: '己方子力堆在九宫里把老将堵死时，最怕对方马跳挂角直接“闷宫”。',
  },
  {
    id: 'double-cannon',
    name: '重炮杀',
    difficulty: '1 步杀',
    tag: '双炮联动',
    description:
      '两门红炮排在一条线上，前炮既是攻击者，也是后炮的天然炮架！找出一步绝杀。',
    pieces: [
      { r: 0, c: 4, side: 'black', type: 'K' },
      { r: 0, c: 3, side: 'black', type: 'A' },
      { r: 0, c: 5, side: 'black', type: 'A' },
      { r: 9, c: 5, side: 'red', type: 'K' },
      { r: 3, c: 4, side: 'red', type: 'C' },
      { r: 5, c: 1, side: 'red', type: 'C' },
    ],
    steps: [
      {
        playerMoves: [{ from: { r: 5, c: 1 }, to: { r: 5, c: 4 } }],
        hintText: '把八路的红炮平移到五路，和前炮组成中路重炮，黑将上不来、躲不开！',
      },
    ],
    takeaway: '重炮杀的核心在于「前炮镇住将门，后炮隔前炮发难」，被双士堵住时无解。',
  },
  {
    id: 'horse-cannon',
    name: '马后炮',
    difficulty: '1 步杀',
    tag: '马炮绝配',
    description:
      '成语“马后炮”就源自中国象棋！红马已经锁住了黑将左右出路，红炮跟在马后一击定音。',
    pieces: [
      { r: 0, c: 4, side: 'black', type: 'K' },
      { r: 2, c: 4, side: 'red', type: 'H' },
      { r: 5, c: 7, side: 'red', type: 'C' },
      { r: 9, c: 5, side: 'red', type: 'K' },
    ],
    steps: [
      {
        playerMoves: [{ from: { r: 5, c: 7 }, to: { r: 5, c: 4 } }],
        hintText: '把二路红炮平移到五路，站在红马正后方将军！黑将上二楼会被马吃，左右走又被马控制。',
      },
    ],
    takeaway: '马控制九宫两翼，炮借马为架将军——中残局里最常出现的杀招之一。',
  },
  {
    id: 'wo-cao-ma',
    name: '卧槽马',
    difficulty: '2 步杀',
    tag: '先马后车',
    description:
      '俗话说“马踏卧槽，神仙难逃”。先跳马到黑方九宫边角（卧槽位）将军逼出黑将，再用红车绝杀！',
    pieces: [
      { r: 0, c: 4, side: 'black', type: 'K' },
      { r: 0, c: 3, side: 'black', type: 'A' },
      { r: 0, c: 5, side: 'black', type: 'A' },
      { r: 3, c: 7, side: 'red', type: 'H' },
      { r: 4, c: 2, side: 'red', type: 'R' },
      { r: 9, c: 5, side: 'red', type: 'K' },
    ],
    steps: [
      {
        playerMoves: [{ from: { r: 3, c: 7 }, to: { r: 1, c: 6 } }],
        opponentReply: { from: { r: 0, c: 4 }, to: { r: 1, c: 4 } },
        hintText: '第 1 步：二路红马跳到三路底二线（卧槽位）将军，逼黑将上二楼。',
      },
      {
        playerMoves: [{ from: { r: 4, c: 2 }, to: { r: 1, c: 2 } }],
        hintText: '第 2 步：七路红车直冲二线将军！此时黑将上下退路全被卧槽马封死，绝杀！',
      },
    ],
    takeaway: '卧槽马不仅将军，还同时封住了老将上下两格退路，配合直车极易形成绝杀。',
  },
  {
    id: 'double-rook',
    name: '双车错',
    difficulty: '2 步杀',
    tag: '交替绝杀',
    description:
      '“双车错”是象棋最爽快的连环杀法：两辆红车轮流将军，把黑将一步步挤死在九宫里！',
    pieces: [
      { r: 0, c: 4, side: 'black', type: 'K' },
      { r: 2, c: 4, side: 'black', type: 'E' },
      { r: 9, c: 5, side: 'red', type: 'K' },
      { r: 2, c: 1, side: 'red', type: 'R' },
      { r: 3, c: 7, side: 'red', type: 'R' },
    ],
    steps: [
      {
        playerMoves: [{ from: { r: 3, c: 7 }, to: { r: 0, c: 7 } }],
        opponentReply: { from: { r: 0, c: 4 }, to: { r: 1, c: 4 } },
        hintText: '第 1 步：二路红车直接沉底将军，逼黑将上二楼。',
      },
      {
        playerMoves: [{ from: { r: 2, c: 1 }, to: { r: 1, c: 1 } }],
        hintText: '第 2 步：八路红车进一格将军！底线和二线全被双车封死，绝杀！',
      },
    ],
    takeaway: '双车错的关键是两车各占相邻两条线，交替将军，不给老将喘息之机。',
  },
  {
    id: 'iron-bolt',
    name: '铁门栓',
    difficulty: '2 步杀',
    tag: '中炮镇中',
    description:
      '中炮死死钉住黑方中士，红帅在六路虎视眈眈；红车沉底强攻，哪怕黑马退回垫将也挡不住红车砍杀！',
    pieces: [
      { r: 0, c: 4, side: 'black', type: 'K' },
      { r: 1, c: 4, side: 'black', type: 'A' },
      { r: 0, c: 5, side: 'black', type: 'A' },
      { r: 1, c: 1, side: 'black', type: 'H' },
      { r: 4, c: 4, side: 'red', type: 'C' },
      { r: 3, c: 4, side: 'red', type: 'P' },
      { r: 3, c: 2, side: 'red', type: 'R' },
      { r: 9, c: 3, side: 'red', type: 'K' },
    ],
    steps: [
      {
        playerMoves: [{ from: { r: 3, c: 2 }, to: { r: 0, c: 2 } }],
        opponentReply: { from: { r: 1, c: 1 }, to: { r: 0, c: 3 } },
        hintText: '第 1 步：七路红车直接沉底将军！黑方中士被中炮钉死动不了，只能跳马垫将。',
      },
      {
        playerMoves: [{ from: { r: 0, c: 2 }, to: { r: 0, c: 3 } }],
        hintText: '第 2 步：红车直接吃掉垫将的黑马！黑将不敢吃车（会被红帅白脸将），黑士又被中炮钉死，绝杀！',
      },
    ],
    takeaway: '铁门栓的威力全靠中炮死死钉住中士，再借老帅助攻，让对方防守瞬间瘫痪。',
  },
  {
    id: 'corner-horse',
    name: '挂角马',
    difficulty: '2 步杀',
    tag: '九宫尖角',
    description:
      '红马跳上黑方九宫上角（挂角位）将军，既攻将又封锁退路，再配合红车完成二步绝杀！',
    pieces: [
      { r: 0, c: 4, side: 'black', type: 'K' },
      { r: 0, c: 3, side: 'black', type: 'A' },
      { r: 1, c: 4, side: 'black', type: 'A' },
      { r: 4, c: 4, side: 'red', type: 'H' },
      { r: 3, c: 6, side: 'red', type: 'R' },
      { r: 9, c: 4, side: 'red', type: 'K' },
    ],
    steps: [
      {
        playerMoves: [{ from: { r: 4, c: 4 }, to: { r: 2, c: 3 } }],
        opponentReply: { from: { r: 0, c: 4 }, to: { r: 0, c: 5 } },
        hintText: '第 1 步：红马跳到六路（黑方九宫左下角）将军，逼黑将右移。',
      },
      {
        playerMoves: [{ from: { r: 3, c: 6 }, to: { r: 0, c: 6 } }],
        hintText: '第 2 步：三路红车直接沉底将军！黑将想上二楼也会被挂角马吃掉，绝杀！',
      },
    ],
    takeaway: '挂角马能同时控制将门和九宫退路，是中残局攻城拔寨的利器。',
  },
];

/* ============================================================
 * 3. 互动棋谱 (Interactive Opening & Ancient Manuals)
 * ============================================================ */

export interface ManualMove {
  from: Pos;
  to: Pos;
  comment: string;
  isQuiz?: boolean;
  quizHint?: string;
}

export interface InteractiveManual {
  id: string;
  title: string;
  source: string;
  difficulty: '入门必学' | '进阶定式';
  summary: string;
  moves: ManualMove[];
}

export const INTERACTIVE_MANUALS: InteractiveManual[] = [
  {
    id: 'central-cannon-screen-horse',
    title: '中炮对屏风马',
    source: '现代第一主流布局',
    difficulty: '入门必学',
    summary:
      '红方架中炮强攻中路，黑方跳双正马像屏风一样护住中卒，这是中国象棋最经典、胜负最均衡的攻防教科书。',
    moves: [
      {
        from: { r: 7, c: 7 },
        to: { r: 7, c: 4 },
        comment: '【炮二平五】当头炮直瞄黑方中卒，抢占中路先手，是象棋最具攻击性的开局第一手。',
        isQuiz: true,
        quizHint: '把右翼二路的红炮平移到中路五路，架起当头炮！',
      },
      {
        from: { r: 0, c: 7 },
        to: { r: 2, c: 6 },
        comment: '【马8进7】黑方跳正马保护中卒，不急于对攻，稳扎稳打。',
      },
      {
        from: { r: 9, c: 7 },
        to: { r: 7, c: 6 },
        comment: '【马二进三】红方跳正马，同时为右翼大车让出通路（准备亮车）。',
        isQuiz: true,
        quizHint: '把右翼二路的红马跳到三路正马位置，为红车开路。',
      },
      {
        from: { r: 0, c: 8 },
        to: { r: 0, c: 7 },
        comment: '【车9平8】黑方顺势出直车，占领重要竖线，准备压制红方左翼。',
      },
      {
        from: { r: 9, c: 8 },
        to: { r: 9, c: 7 },
        comment: '【车一平二】红方立刻出直车！开局核心口诀：“一车十子寒”，大车越早出动越好。',
        isQuiz: true,
        quizHint: '把右翼底角的一路红车平移到二路，抢先亮出主力大车！',
      },
      {
        from: { r: 0, c: 1 },
        to: { r: 2, c: 2 },
        comment: '【马2进3】黑方另一匹马也跳到正马位，双马如屏风护住中卒，经典的「屏风马」阵型成型！',
      },
      {
        from: { r: 6, c: 2 },
        to: { r: 5, c: 2 },
        comment: '【兵七进一】挺起七路兵，既活通自己左马的道路，又限制黑方三路马向前发展。',
      },
      {
        from: { r: 3, c: 6 },
        to: { r: 4, c: 6 },
        comment: '【卒7进1】黑方针锋相对拱起 7 路卒，同样活通己方 7 路马，双方阵型工整，中局大战一触即发！',
      },
    ],
  },
  {
    id: 'same-direction-cannon',
    title: '顺炮直车对横车',
    source: '《橘中秘》经典对攻',
    difficulty: '入门必学',
    summary:
      '双方都在同一侧架起中炮，一个出直车、一个出横车，节奏极快、杀气腾腾，最能锻炼新手的进攻意识。',
    moves: [
      {
        from: { r: 7, c: 7 },
        to: { r: 7, c: 4 },
        comment: '【炮二平五】红方架起当头炮，直指中路。',
      },
      {
        from: { r: 2, c: 7 },
        to: { r: 2, c: 4 },
        comment: '【炮8平5】黑方同侧回敬当头炮，形成针锋相对的「顺手炮」对攻局。',
      },
      {
        from: { r: 9, c: 7 },
        to: { r: 7, c: 6 },
        comment: '【马二进三】红方先跳正马护住中兵，同时腾出一路车的位置。',
        isQuiz: true,
        quizHint: '先跳右翼二路红马到三路，保护中兵并为红车让路。',
      },
      {
        from: { r: 0, c: 7 },
        to: { r: 2, c: 6 },
        comment: '【马8进7】黑方同样跳正马保中卒。',
      },
      {
        from: { r: 9, c: 8 },
        to: { r: 9, c: 7 },
        comment: '【车一平二】红方选择出「直车」，准备直冲过河压制黑方马腿。',
        isQuiz: true,
        quizHint: '把右翼一路红车平移到二路，亮出直车！',
      },
      {
        from: { r: 0, c: 8 },
        to: { r: 1, c: 8 },
        comment: '【车9进1】黑方走「横车」——准备下一步平到肋道（4 路或 6 路）快速参战！',
      },
      {
        from: { r: 9, c: 1 },
        to: { r: 7, c: 2 },
        comment: '【马八进七】红方补齐左翼正马，双马盘河阵型稳固。',
        isQuiz: true,
        quizHint: '跳起左翼八路红马到七路，完善己方阵型。',
      },
      {
        from: { r: 1, c: 8 },
        to: { r: 1, c: 3 },
        comment: '【车9平4】黑方横车占领 4 路肋道，直接瞄准红方宫顶，双方正式展开对攻！',
      },
    ],
  },
  {
    id: 'angel-guide',
    title: '仙人指路对卒底炮',
    source: '柔性经典布局',
    difficulty: '进阶定式',
    summary:
      '不急着亮中炮，先拱一步兵试探对手虚实——这就是充满东方智慧的“仙人指路”，后发制人、变化万千。',
    moves: [
      {
        from: { r: 6, c: 2 },
        to: { r: 5, c: 2 },
        comment: '【兵七进一】「仙人指路」！先拱七路兵，既活通马路又试探黑方意图，以静制动。',
        isQuiz: true,
        quizHint: '拱起七路红兵一步，走出优雅的“仙人指路”！',
      },
      {
        from: { r: 2, c: 1 },
        to: { r: 2, c: 2 },
        comment: '【炮2平3】「卒底炮」反击！黑炮躲在 3 路卒后面，直瞄红方七路兵和底层三路相。',
      },
      {
        from: { r: 7, c: 7 },
        to: { r: 7, c: 4 },
        comment: '【炮二平五】红方见黑方出卒底炮，顺势架起中炮抢攻中路，攻守兼备。',
        isQuiz: true,
        quizHint: '把右翼二路红炮平移到五路，架起中炮反抢主动。',
      },
      {
        from: { r: 0, c: 7 },
        to: { r: 2, c: 6 },
        comment: '【马8进7】黑方跳马保护中卒。',
      },
      {
        from: { r: 9, c: 7 },
        to: { r: 7, c: 6 },
        comment: '【马二进三】红方跳正马，准备出右直车。',
        isQuiz: true,
        quizHint: '跳起右翼二路红马到三路。',
      },
      {
        from: { r: 0, c: 2 },
        to: { r: 2, c: 4 },
        comment: '【象3进5】黑方飞中象稳固中路防线，防红方中炮攻势。',
      },
      {
        from: { r: 9, c: 8 },
        to: { r: 9, c: 7 },
        comment: '【车一平二】红方出直车占领二路要道，保持先手压力。',
      },
      {
        from: { r: 0, c: 1 },
        to: { r: 2, c: 0 },
        comment: '【马2进1】黑方跳边马让出 2 路车位，准备快速出车对攻，双方进入复杂中局。',
      },
    ],
  },
  {
    id: 'central-pawn-rush',
    title: '中炮急进中兵',
    source: '《梅花谱》锐利进攻',
    difficulty: '进阶定式',
    summary:
      '面对黑方屏风马，红方果断挺起中兵从正中间强行突破，体会“兵贵神速、中路开花”的霸道攻法。',
    moves: [
      {
        from: { r: 7, c: 7 },
        to: { r: 7, c: 4 },
        comment: '【炮二平五】红方当头炮开局，瞄准中路。',
      },
      {
        from: { r: 0, c: 7 },
        to: { r: 2, c: 6 },
        comment: '【马8进7】黑方屏风马应战。',
      },
      {
        from: { r: 9, c: 7 },
        to: { r: 7, c: 6 },
        comment: '【马二进三】红方跳正马。',
      },
      {
        from: { r: 0, c: 8 },
        to: { r: 0, c: 7 },
        comment: '【车9平8】黑方出直车。',
      },
      {
        from: { r: 9, c: 8 },
        to: { r: 9, c: 7 },
        comment: '【车一平二】红方出直车抢占要道。',
      },
      {
        from: { r: 0, c: 1 },
        to: { r: 2, c: 2 },
        comment: '【马2进3】黑方双正马屏风马成型。',
      },
      {
        from: { r: 6, c: 4 },
        to: { r: 5, c: 4 },
        comment: '【兵五进一】关键一手！红方直接挺中兵，准备从正面强行撕开黑方中路防线。',
        isQuiz: true,
        quizHint: '把中间五路的红兵往前拱一步，准备中路强攻！',
      },
      {
        from: { r: 0, c: 3 },
        to: { r: 1, c: 4 },
        comment: '【士4进5】黑方赶紧补士稳固中路，防止红方中兵过河后长驱直入。',
      },
    ],
  },
];

/* ============================================================
 * Progress Persistence
 * ============================================================ */

export interface AcademyProgress {
  completedLessons: string[];
  completedPuzzles: string[];
  completedManuals: string[];
}

const PROGRESS_KEY = 'xiangqi_academy_progress_v1';

export function loadAcademyProgress(): AcademyProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) {
      return { completedLessons: [], completedPuzzles: [], completedManuals: [] };
    }
    const parsed = JSON.parse(raw) as Partial<AcademyProgress>;
    return {
      completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
      completedPuzzles: Array.isArray(parsed.completedPuzzles) ? parsed.completedPuzzles : [],
      completedManuals: Array.isArray(parsed.completedManuals) ? parsed.completedManuals : [],
    };
  } catch {
    return { completedLessons: [], completedPuzzles: [], completedManuals: [] };
  }
}

export function saveAcademyProgress(progress: AcademyProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage errors
  }
}

export function getInitialLessonBoard(step: LessonStep): Board {
  if (step.useInitialBoard) return createInitialBoard();
  if (step.pieces) return createBoardFromPieces(step.pieces);
  return createInitialBoard();
}
