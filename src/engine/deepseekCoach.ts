import type { ReviewLineResult } from './ai';
import type { MoveExplanation } from './coach';
import type { KeyMoment, ReconstructedStep, SavedGame } from './gameArchive';
import { type Board, type MoveRecord, PIECE_LABELS, type Side } from './types';
import { COLS, ROWS, boardToFen } from './xiangqi';

export type DeepSeekModel = 'deepseek-flash' | 'deepseek-v4-pro' | (string & {});

export interface DeepSeekConfig {
  apiKey: string;
  model: DeepSeekModel;
  autoExplain: boolean;
}

const STORAGE_KEY = 'xiangqi_deepseek_config_v1';

const LEGACY_MODEL_MAP: Record<string, DeepSeekModel> = {
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-v4-pro',
};

export function loadDeepSeekConfig(): DeepSeekConfig {
  const envKey = (import.meta.env?.VITE_DEEPSEEK_API_KEY as string | undefined) ?? '';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeepSeekConfig>;
      const rawModel = parsed.model?.trim() || 'deepseek-flash';
      const migratedModel = LEGACY_MODEL_MAP[rawModel] ?? rawModel;
      return {
        apiKey: parsed.apiKey ?? envKey,
        model: migratedModel,
        autoExplain: parsed.autoExplain ?? true,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    apiKey: envKey,
    model: 'deepseek-flash',
    autoExplain: true,
  };
}

export function saveDeepSeekConfig(cfg: DeepSeekConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore storage errors
  }
}

/** Render board as a compact, unambiguous text diagram for the LLM */
function boardToTextGrid(board: Board): string {
  const lines: string[] = ['   1  2  3  4  5  6  7  8  9 (黑方列号，红方从右向左为一~九)'];
  for (let r = 0; r < ROWS; r++) {
    const cells: string[] = [];
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) {
        cells.push('· ');
      } else {
        const prefix = p.side === 'red' ? '红' : '黑';
        cells.push(`${prefix}${PIECE_LABELS[p.side][p.type]}`);
      }
    }
    lines.push(`${r}: ${cells.join(' ')}`);
    if (r === 4) lines.push('   --------- 楚河  汉界 ---------');
  }
  return lines.join('\n');
}

function formatRecentMoves(history: MoveRecord[], maxCount = 12): string {
  if (history.length === 0) return '（开局第一手，尚未落子）';
  const start = Math.max(0, history.length - maxCount);
  const parts: string[] = [];
  for (let i = start; i < history.length; i++) {
    const sideStr = i % 2 === 0 ? '红' : '黑';
    const round = Math.floor(i / 2) + 1;
    parts.push(`${round}${sideStr}:${history[i].notation}`);
  }
  return parts.join(' → ');
}

export interface DeepSeekCoachContext {
  board: Board;
  playerSide: Side;
  turn: Side;
  evalScore: number;
  history: MoveRecord[];
  recommendation: MoveExplanation | null;
  lastOpponentMove: MoveExplanation | null;
  /** Optional authoritative PV line & depth from Pikafish NNUE */
  enginePvLine?: { side: Side; notation: string }[];
  engineDepth?: number;
  engineName?: string;
  question?: string;
}

function buildMessages(ctx: DeepSeekCoachContext) {
  const evalText =
    Math.abs(ctx.evalScore) < 25
      ? '局势均衡 (0.0)'
      : ctx.evalScore > 0
        ? `红优 +${(ctx.evalScore / 100).toFixed(1)}`
        : `黑优 +${(Math.abs(ctx.evalScore) / 100).toFixed(1)}`;

  const systemPrompt = [
    '你是一位精通中国象棋、风趣耐心的象棋私教，正在“教学模式”中陪伴玩家对弈。',
    '重要原则：',
    '1. 严格以提供的棋盘状态、中文棋谱、象棋引擎推荐着法和战术事实为准，绝不编造不存在的棋子或违规走法。',
    '2. 回答简洁清晰、通俗易懂，直接讲人话，不用长篇大论或 Markdown 标题，控制在 2~4 句话（约 80~160 字）。',
    '3. 重点讲清楚“为什么要这么下”（战术目的、子力配合、防守隐患或对手意图），让新手也能立刻听懂。',
  ].join('\n');

  const contextLines = [
    `【玩家执子】${ctx.playerSide === 'red' ? '红方（先手）' : '黑方（后手）'}`,
    `【当前轮到】${ctx.turn === 'red' ? '红方' : '黑方'}走棋`,
    `【引擎估值】${evalText}（单位约 1.0 = 1个兵/卒）`,
    `【近期棋谱】${formatRecentMoves(ctx.history)}`,
    `【FEN】${boardToFen(ctx.board, ctx.turn)}`,
    `【当前棋盘】\n${boardToTextGrid(ctx.board)}`,
  ];

  if (ctx.lastOpponentMove) {
    contextLines.push(
      `【对手刚走】${ctx.lastOpponentMove.notation}（引擎分析：${ctx.lastOpponentMove.tags.join('、')} — ${ctx.lastOpponentMove.reasons.join(' ')}）`
    );
  }

  if (ctx.recommendation) {
    const srcLabel = ctx.engineName
      ? `${ctx.engineName}${ctx.engineDepth ? ` (深度 ${ctx.engineDepth} 层)` : ''}`
      : '引擎';
    contextLines.push(
      `【${srcLabel}推荐着法】${ctx.recommendation.notation}（战术特征：${ctx.recommendation.tags.join('、')} — ${ctx.recommendation.reasons.join(' ')}）`
    );
  }

  if (ctx.enginePvLine && ctx.enginePvLine.length > 1) {
    const pvStr = ctx.enginePvLine
      .map((f) => `${f.side === 'red' ? '红' : '黑'}${f.notation}`)
      .join(' → ');
    contextLines.push(`【权威后续主变推演】${pvStr}`);
  }

  const userTask = ctx.question
    ? `【玩家追问】${ctx.question}\n请结合上面盘面直接解答玩家的疑问。`
    : '请结合当前局面与引擎推荐着法，用通俗生动的语言讲解：为什么推荐走这一步？以及需要注意对手什么威胁？';

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${contextLines.join('\n')}\n\n${userTask}` },
  ];
}

export type ReviewAnalysisMode = 'full_game' | 'step_analysis' | 'future_variation' | 'custom';

export interface DeepSeekReviewContext {
  game: SavedGame;
  /** 0 = initial board, 1..N = after step k */
  currentStep: number;
  board: Board;
  stepInfo: ReconstructedStep | null;
  keyMoments: KeyMoment[];
  engineReview: ReviewLineResult | null;
  mode: ReviewAnalysisMode;
  question?: string;
}

function formatEvalText(score: number): string {
  if (Math.abs(score) < 25) return '均势 (0.0)';
  return score > 0
    ? `红优 +${(score / 100).toFixed(1)}`
    : `黑优 +${(Math.abs(score) / 100).toFixed(1)}`;
}

function buildReviewMessages(ctx: DeepSeekReviewContext) {
  const { game, currentStep, board, stepInfo, keyMoments, engineReview, mode, question } = ctx;

  const fullNotation = game.moves
    .map((m, i) => {
      const round = Math.floor(i / 2) + 1;
      return i % 2 === 0 ? `${round}.${m.notation}` : m.notation;
    })
    .join(' ');

  const keyMomentsText =
    keyMoments.length > 0
      ? keyMoments
          .map(
            (k) =>
              `第${k.step}步 ${k.notation}（${k.severity === 'blunder' ? '明显失误' : '略亏'}，估值下跌约 ${(k.loss / 100).toFixed(1)}）`
          )
          .join('；')
      : '本局玩家未出现明显大漏招，发挥较为稳健。';

  const systemPrompt = [
    '你是一位专业、表达清晰的中国象棋复盘大师，正在“复盘模式”中带玩家复盘已完成的对局。',
    '核心要求：',
    '1. 严格依据提供的完整棋谱、当前局面棋盘、估值变化、关键失误点和象棋引擎算出的更优解与后续变化，绝不编造不存在的棋子或违规走法。',
    '2. 重点围绕四个方面展开：当前局势优劣、哪一步走错了以及为什么错、引擎更优解好在哪里、以及“如果这么走，未来几步可能是……”。',
    '3. 语言自然精炼、分段清晰，不要使用复杂 Markdown 标题，控制在 140~260 字，让玩家一眼看懂复盘收获。',
  ].join('\n');

  const lines: string[] = [
    `【对局概况】玩家执${game.playerSide === 'red' ? '红方' : '黑方'}，结果：${game.resultText}，共 ${game.totalMoves} 步`,
    `【完整棋谱】${fullNotation || '（无着法）'}`,
    `【自动识别的玩家关键失误点】${keyMomentsText}`,
    `【当前复盘定位】${currentStep === 0 ? '开局初始局面' : `第 ${currentStep} 步（${stepInfo?.notation ?? ''}）`}`,
  ];

  if (stepInfo) {
    const moverStr = (currentStep - 1) % 2 === 0 ? '红方' : '黑方';
    lines.push(
      `【本步估值变化】${moverStr}走出「${stepInfo.notation}」前：${formatEvalText(stepInfo.evalBefore)} → 走出后：${formatEvalText(stepInfo.evalAfter)}`
    );
  }

  if (engineReview?.bestNotation) {
    const futureStr = engineReview.futureLine
      .map((f) => `${f.side === 'red' ? '红' : '黑'}${f.notation}`)
      .join(' → ');
    lines.push(
      `【引擎测算的更优解】当时若改走「${engineReview.bestNotation}」（走后估值：${formatEvalText(engineReview.evalAfterBest)}）`
    );
    if (futureStr) {
      lines.push(`【引擎推演的未来几步可能变化】${futureStr}`);
    }
  }

  lines.push(`【当前局面棋盘】\n${boardToTextGrid(board)}`);

  let userTask: string;
  if (mode === 'full_game') {
    userTask =
      '请对这整盘棋做一次复盘总结：1）整体局势转折在哪；2）玩家哪一步（或哪几步）最关键/走错了；3）给出1条最实用的改进建议。';
  } else if (mode === 'future_variation') {
    userTask =
      '请重点结合上面的引擎更优解与后续推演变化，用“如果当时走……，未来几步可能是……”的句式，生动讲清楚改走更优解后的局势发展，并与实战结果做对比。';
  } else if (mode === 'custom' && question) {
    userTask = `【玩家复盘追问】${question}\n请结合当前局面、整局棋谱与引擎推演直接解答，并在需要时推演“如果这么走，未来几步可能是……”。`;
  } else {
    userTask =
      '请重点复盘当前这一步：1）分析此刻局势；2）评价实战这一步下得好不好、有没有问题；3）对照引擎更优解，说明“如果当时这么走，未来几步可能是……”。';
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${lines.join('\n')}\n\n${userTask}` },
  ];
}

async function runDeepSeekStream(
  config: DeepSeekConfig,
  messages: { role: string; content: string }[],
  callbacks: {
    onChunk: (fullText: string) => void;
    onDone: (fullText: string) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal,
  flashMaxTokens = 800
): Promise<void> {
  // Strip accidental "Bearer " prefix, quotes, zero-width chars, and whitespace
  const apiKey = config.apiKey
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim();

  if (!apiKey) {
    callbacks.onError('请先填写 DeepSeek API Key');
    return;
  }

  if (!/^[\x21-\x7E]+$/.test(apiKey)) {
    callbacks.onError(
      'API Key 包含中文、空格或特殊符号（浏览器请求头不允许），请重新粘贴纯英文数字的 sk- 密钥。'
    );
    return;
  }

  const model = config.model.trim() || 'deepseek-flash';
  const endpoint = '/api/deepseek/chat/completions';

  try {
    const isFlashModel = model.includes('flash');
    const requestBody: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      temperature: 0.6,
      max_tokens: isFlashModel ? flashMaxTokens : 4096,
    };
    if (isFlashModel) {
      requestBody.thinking = { type: 'disabled' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!res.ok) {
      let errMsg = `请求失败 (${res.status})`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        if (errJson.error?.message) {
          errMsg = errJson.error.message;
        }
      } catch {
        // ignore JSON parse errors
      }
      if (res.status === 401) {
        errMsg = 'DeepSeek API Key 无效或已过期，请检查设置。';
      } else if (res.status === 402) {
        errMsg = 'DeepSeek 账户余额不足，请检查额度。';
      } else if (res.status === 429) {
        errMsg = '请求过于频繁，请稍后再试。';
      }
      callbacks.onError(errMsg);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      callbacks.onError('浏览器不支持流式读取响应');
      return;
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data) as {
            choices?: {
              delta?: { content?: string; reasoning_content?: string };
              message?: { content?: string };
            }[];
          };
          const choice = parsed.choices?.[0];
          const delta = choice?.delta?.content ?? choice?.message?.content;
          if (delta) {
            fullText += delta;
            callbacks.onChunk(fullText);
          }
        } catch {
          // ignore partial SSE json chunks
        }
      }
    }

    const finalOutput = fullText.trim();
    if (!finalOutput) {
      callbacks.onError('DeepSeek 本次未返回最终正文，请重试或切换为 V4.1 Flash。');
      return;
    }
    callbacks.onDone(finalOutput);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    const rawMsg = err instanceof Error ? err.message : String(err);
    if (rawMsg === 'Type error' || rawMsg === 'Load failed' || rawMsg === 'Failed to fetch') {
      callbacks.onError(
        `网络或请求头异常（${rawMsg}）：请检查 API Key 是否为纯英文 sk- 密钥，以及网络连接是否正常。`
      );
      return;
    }
    callbacks.onError(rawMsg || '网络请求异常，请稍后重试');
  }
}

export async function streamDeepSeekCoach(
  config: DeepSeekConfig,
  ctx: DeepSeekCoachContext,
  callbacks: {
    onChunk: (fullText: string) => void;
    onDone: (fullText: string) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  return runDeepSeekStream(config, buildMessages(ctx), callbacks, signal, 800);
}

export async function streamDeepSeekReview(
  config: DeepSeekConfig,
  ctx: DeepSeekReviewContext,
  callbacks: {
    onChunk: (fullText: string) => void;
    onDone: (fullText: string) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  return runDeepSeekStream(config, buildReviewMessages(ctx), callbacks, signal, 1000);
}

export interface DeepSeekSandboxContext {
  playerSide: Side;
  baseBoard: Board;
  sandboxBoard: Board;
  sandboxTurn: Side;
  baseEval: number;
  sandboxEval: number;
  triedMoves: { side: Side; notation: string }[];
  counterLine: { side: Side; notation: string }[];
  engineDepth?: number;
  pikafishActive?: boolean;
}

function buildSandboxMessages(ctx: DeepSeekSandboxContext) {
  const triedStr = ctx.triedMoves
    .map((m) => `${m.side === 'red' ? '红' : '黑'}${m.notation}`)
    .join(' → ');
  const counterStr = ctx.counterLine
    .map((m) => `${m.side === 'red' ? '红' : '黑'}${m.notation}`)
    .join(' → ');

  const sign = ctx.playerSide === 'red' ? 1 : -1;
  const deltaForPlayer = (ctx.sandboxEval - ctx.baseEval) * sign;
  const deltaText =
    Math.abs(deltaForPlayer) < 25
      ? '基本持平（无明显得失）'
      : deltaForPlayer > 0
        ? `对玩家更有利（+${(deltaForPlayer / 100).toFixed(1)}）`
        : `对玩家不利（亏了 ${(Math.abs(deltaForPlayer) / 100).toFixed(1)}）`;

  const engineLabel = ctx.pikafishActive
    ? `Pikafish NNUE${ctx.engineDepth ? ` (${ctx.engineDepth}层)` : ''}`
    : '本地象棋引擎';

  const systemPrompt = [
    '你是一位精通中国象棋的顶级私教，玩家刚刚在棋盘上使用「试走摆变化」功能，临时试走了一步/几步变招。',
    '核心要求：',
    '1. 严格以提供的棋盘、试走着法、引擎精确估值变化和引擎算出的对手最强反击序列为准，绝不编造不存在的棋子或违规走法。',
    '2. 先给出一句明确结论（如“这步试走完全可行！” / “略微吃亏” / “千万别这么走，会中计！”）。',
    '3. 再结合引擎算出的对手最强反击与后续变化，用通俗易懂的语言讲清楚“如果这么走，对手会怎么应对、未来几步会发生什么”。',
    '4. 控制在 2~4 句话（约 100~180 字），直击要害，不要用 Markdown 标题。',
  ].join('\n');

  const userContent = [
    `【玩家执子】${ctx.playerSide === 'red' ? '红方' : '黑方'}`,
    `【玩家试走的变招】${triedStr}`,
    `【${engineLabel} 估值变化】试走前：${formatEvalText(ctx.baseEval)} → 试走后：${formatEvalText(ctx.sandboxEval)}（${deltaText}）`,
    counterStr
      ? `【${engineLabel} 算出的最强应对及后续变化】${counterStr}`
      : '【后续变化】当前已无后续应手',
    `【试走后的当前棋盘】\n${boardToTextGrid(ctx.sandboxBoard)}`,
    '',
    '请点评玩家的这步试走：行不行？为什么？对手会怎么反击？',
  ].join('\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}

export async function streamDeepSeekSandbox(
  config: DeepSeekConfig,
  ctx: DeepSeekSandboxContext,
  callbacks: {
    onChunk: (fullText: string) => void;
    onDone: (fullText: string) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  return runDeepSeekStream(config, buildSandboxMessages(ctx), callbacks, signal, 900);
}
