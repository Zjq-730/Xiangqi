import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, FlaskConical, Play, Send, Settings, Sparkles, X } from 'lucide-react';
import type { MoveExplanation, PlayerFeedback } from '../engine/coach';
import {
  type DeepSeekConfig,
  type DeepSeekModel,
  loadDeepSeekConfig,
  saveDeepSeekConfig,
  streamDeepSeekCoach,
} from '../engine/deepseekCoach';
import type { Board, MoveRecord, Side } from '../engine/types';

interface CoachPanelProps {
  board: Board;
  playerSide: Side;
  turn: Side;
  evalScore: number;
  history: MoveRecord[];
  loading: boolean;
  isPlayerTurn: boolean;
  isReplaying: boolean;
  gameOver: boolean;
  recommendation: MoveExplanation | null;
  lastOpponentMove: MoveExplanation | null;
  playerFeedback: PlayerFeedback | null;
  enginePvLine?: { side: Side; notation: string }[];
  engineDepth?: number;
  pikafishActive?: boolean;
  sandboxActive?: boolean;
  onToggleSandbox?: () => void;
  sandboxSlot?: React.ReactNode;
  onApplyRecommendation: () => void;
}

const QUICK_QUESTIONS = [
  '对手这步是什么意图',
  '对手下一步想干嘛？',
  '为什么推荐走这步？',
  '接下来怎么进攻？',
];

export const CoachPanel: React.FC<CoachPanelProps> = ({
  board,
  playerSide,
  turn,
  evalScore,
  history,
  loading,
  isPlayerTurn,
  isReplaying,
  gameOver,
  recommendation,
  lastOpponentMove,
  playerFeedback,
  enginePvLine,
  engineDepth,
  pikafishActive,
  sandboxActive = false,
  onToggleSandbox,
  sandboxSlot,
  onApplyRecommendation,
}) => {
  const [config, setConfig] = useState<DeepSeekConfig>(() => loadDeepSeekConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [draftKey, setDraftKey] = useState(config.apiKey);
  const [draftModel, setDraftModel] = useState<DeepSeekModel>(config.model);
  const [draftAuto, setDraftAuto] = useState(config.autoExplain);

  const [aiText, setAiText] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [questionInput, setQuestionInput] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const userAskedMoveRef = useRef<number | null>(null);
  const hasApiKey = config.apiKey.trim().length > 0;

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [aiText, aiStreaming]);

  const cancelStream = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setAiStreaming(false);
  };

  const requestDeepSeek = (question?: string) => {
    if (!config.apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    cancelStream();

    if (question) {
      userAskedMoveRef.current = history.length;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setAiText('');
    setAiError(null);
    setActiveQuestion(question ?? null);
    setAiStreaming(true);

    streamDeepSeekCoach(
      config,
      {
        board,
        playerSide,
        turn,
        evalScore,
        history,
        recommendation,
        lastOpponentMove,
        enginePvLine,
        engineDepth,
        engineName: pikafishActive ? 'Pikafish NNUE' : undefined,
        question,
      },
      {
        onChunk: (full) => setAiText(full),
        onDone: (full) => {
          setAiText(full);
          setAiStreaming(false);
        },
        onError: (msg) => {
          setAiError(msg);
          setAiStreaming(false);
        },
      },
      controller.signal
    );
  };

  // Clear previous DeepSeek reply only when a new board move happens or side switches
  useEffect(() => {
    cancelStream();
    userAskedMoveRef.current = null;
    setAiText('');
    setAiError(null);
    setActiveQuestion(null);
  }, [history.length, playerSide]);

  // Auto-explain when a new recommendation arrives for the player's turn
  const recKey = recommendation
    ? `${history.length}-${recommendation.notation}-${playerSide}`
    : '';

  useEffect(() => {
    if (
      !hasApiKey ||
      !config.autoExplain ||
      !recommendation ||
      !isPlayerTurn ||
      isReplaying ||
      gameOver
    ) {
      return;
    }

    // Never interrupt or overwrite a follow-up question the user manually asked on this move
    if (userAskedMoveRef.current === history.length) {
      return;
    }

    requestDeepSeek();

    return () => {
      if (userAskedMoveRef.current !== history.length) {
        cancelStream();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recKey, hasApiKey, config.autoExplain, config.model, isReplaying, gameOver]);

  const handleSaveSettings = () => {
    const next: DeepSeekConfig = {
      apiKey: draftKey.trim(),
      model: draftModel.trim() || 'deepseek-flash',
      autoExplain: draftAuto,
    };
    saveDeepSeekConfig(next);
    setConfig(next);
    setShowSettings(false);
  };

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = questionInput.trim();
    if (!q || aiStreaming) return;
    setQuestionInput('');
    requestDeepSeek(q);
  };

  return (
    <div className="card coach-card">
      <div className="coach-header">
        <div className="coach-title">
          <BookOpen size={15} />
          <span>私教讲解</span>
        </div>
        <div className="coach-header-right">
          <button
            type="button"
            className={`coach-settings-btn ${hasApiKey ? 'connected' : ''}`}
            onClick={() => {
              setDraftKey(config.apiKey);
              setDraftModel(config.model);
              setDraftAuto(config.autoExplain);
              setShowSettings((s) => !s);
            }}
            title="配置 DeepSeek AI 私教"
          >
            <span className={`ds-dot ${hasApiKey ? 'on' : ''}`} />
            <span>DeepSeek</span>
            {showSettings ? <X size={12} /> : <Settings size={12} />}
          </button>
        </div>
      </div>

      {/* Inline DeepSeek Settings Drawer (Teaching Mode Only) */}
      {showSettings && (
        <div className="ds-config-box">
          <div className="ds-field">
            <label htmlFor="ds-key">DeepSeek API Key（仅存本机浏览器）</label>
            <input
              id="ds-key"
              type="password"
              placeholder="sk-..."
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
            />
          </div>
          <div className="ds-row">
            <div className="ds-model-group">
              <button
                type="button"
                className={draftModel === 'deepseek-flash' ? 'active' : ''}
                onClick={() => setDraftModel('deepseek-flash')}
                title="DeepSeek-V4.1-Flash（官方默认，低延迟实时讲解）"
              >
                V4.1 Flash
              </button>
              <button
                type="button"
                className={draftModel === 'deepseek-v4-pro' ? 'active' : ''}
                onClick={() => setDraftModel('deepseek-v4-pro')}
                title="DeepSeek-V4-Pro（深度逻辑推演）"
              >
                V4 Pro
              </button>
            </div>
            <label className="ds-check">
              <input
                type="checkbox"
                checked={draftAuto}
                onChange={(e) => setDraftAuto(e.target.checked)}
              />
              自动精讲
            </label>
          </div>
          <div className="ds-field">
            <label htmlFor="ds-model">模型 ID（支持自定义）</label>
            <input
              id="ds-model"
              type="text"
              placeholder="deepseek-flash"
              value={draftModel}
              onChange={(e) => setDraftModel(e.target.value)}
            />
          </div>
          <div className="ds-actions">
            <button type="button" className="mini-btn" onClick={() => setShowSettings(false)}>
              取消
            </button>
            <button type="button" className="coach-apply-btn" onClick={handleSaveSettings}>
              保存配置
            </button>
          </div>
        </div>
      )}

      {/* Sandbox Variation Branching Slot */}
      {sandboxActive && sandboxSlot}

      {/* Player's last move feedback */}
      {!sandboxActive && playerFeedback && !isReplaying && (
        <div className={`coach-feedback ${playerFeedback.verdict}`}>
          <span className="coach-feedback-tag">{playerFeedback.label}</span>
          <span>{playerFeedback.text}</span>
        </div>
      )}

      {/* Opponent's last move intent */}
      {!sandboxActive && lastOpponentMove && !isReplaying && (
        <div className="coach-block opponent">
          <div className="coach-block-label">
            对手刚走 <strong>{lastOpponentMove.notation}</strong>
            {lastOpponentMove.tags[0] && (
              <span className="coach-tag muted">{lastOpponentMove.tags[0]}</span>
            )}
          </div>
          <p className="coach-text">{lastOpponentMove.reasons[0]}</p>
        </div>
      )}

      {/* Current Recommended Move & Explanation */}
      {!sandboxActive && (
        <div className="coach-block recommend">
        {isReplaying ? (
          <p className="coach-text muted">正在复盘预览，点击「回到最新」继续实时教学讲解。</p>
        ) : gameOver ? (
          <p className="coach-text muted">本局已结束，你可以点击下方棋谱逐步复盘，或开启新局继续练习。</p>
        ) : !isPlayerTurn ? (
          <p className="coach-text muted">对手正在思考应手，稍后为你解读对手意图并给出下一步推荐…</p>
        ) : loading ? (
          <div className="coach-loading">
            <Sparkles size={14} />
            <span>私教正在推演最佳着法…</span>
          </div>
        ) : recommendation ? (
          <>
            <div className="coach-rec-head">
              <div className="coach-rec-move">
                <span className="coach-rec-prefix">推荐</span>
                <strong>{recommendation.notation}</strong>
              </div>
              <div className="coach-rec-btns">
                {onToggleSandbox && (
                  <button
                    type="button"
                    className="sandbox-enter-btn"
                    onClick={onToggleSandbox}
                    title="在棋盘上临时试走别的招法，让 Pikafish 验算对手反击"
                  >
                    <FlaskConical size={11} />
                    试走变招
                  </button>
                )}
                <button
                  type="button"
                  className="coach-apply-btn"
                  onClick={onApplyRecommendation}
                  title="直接按私教推荐走这一步"
                >
                  <Play size={11} />
                  跟走
                </button>
              </div>
            </div>
            {recommendation.tags.length > 0 && (
              <div className="coach-tags">
                {recommendation.tags.map((t) => (
                  <span key={t} className="coach-tag">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="coach-reasons">
              {recommendation.reasons.map((r, i) => (
                <p key={i} className="coach-text">
                  {r}
                </p>
              ))}
            </div>
            {enginePvLine && enginePvLine.length > 1 && (
              <div className="coach-pv-line">
                <span className="coach-pv-badge">
                  {pikafishActive ? `Pikafish ${engineDepth ?? ''}层主变` : '后续推演'}
                </span>
                <span>{enginePvLine.slice(0, 5).map((f) => f.notation).join(' → ')}</span>
              </div>
            )}
          </>
        ) : (
          <p className="coach-text muted">等待局面分析…</p>
        )}
        </div>
      )}

      {/* DeepSeek AI Commentary & Interactive Q&A (Teaching Mode Only) */}
      {!sandboxActive && !isReplaying && !gameOver && (
        <div className="ds-section">
          {!hasApiKey ? (
            <button
              type="button"
              className="ds-cta-btn"
              onClick={() => setShowSettings(true)}
            >
              <Sparkles size={13} />
              接入 DeepSeek，解锁 AI 精讲与自由追问
            </button>
          ) : (
            <>
              <div className="ds-head">
                <span className="ds-head-title">
                  <Sparkles size={12} />
                  {activeQuestion ? `追问：${activeQuestion}` : 'DeepSeek 精讲'}
                </span>
                {!aiStreaming && recommendation && isPlayerTurn && (
                  <button
                    type="button"
                    className="ds-trigger-btn"
                    onClick={() => requestDeepSeek()}
                  >
                    {aiText ? '重新讲解' : '深度解析'}
                  </button>
                )}
              </div>

              {aiError && <p className="ds-error">{aiError}</p>}

              {(aiText || aiStreaming) && (
                <div className="ds-output" ref={outputRef}>
                  {aiText || 'DeepSeek 正在看盘思考…'}
                  {aiStreaming && <span className="ds-cursor" />}
                </div>
              )}

              {/* Quick Question Chips */}
              <div className="ds-chips">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={aiStreaming}
                    onClick={() => requestDeepSeek(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Custom Question Input */}
              <form className="ds-ask-form" onSubmit={handleAskSubmit}>
                <input
                  type="text"
                  placeholder="问问 DeepSeek（如：为什么不吃卒？）"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  disabled={aiStreaming}
                />
                <button
                  type="submit"
                  disabled={aiStreaming || !questionInput.trim()}
                  title="发送追问"
                >
                  <Send size={13} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};
