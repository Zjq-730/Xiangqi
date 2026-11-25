import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FlaskConical,
  GitBranch,
  History,
  Pause,
  Play,
  Send,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { ReviewLineResult } from '../engine/ai';
import {
  type DeepSeekConfig,
  type DeepSeekModel,
  type ReviewAnalysisMode,
  loadDeepSeekConfig,
  saveDeepSeekConfig,
  streamDeepSeekReview,
} from '../engine/deepseekCoach';
import {
  type ReconstructedStep,
  type SavedGame,
  detectKeyMoments,
} from '../engine/gameArchive';
import type { Board } from '../engine/types';

interface ReviewPanelProps {
  games: SavedGame[];
  selectedGameId: string | null;
  activeGame: SavedGame | null;
  steps: ReconstructedStep[];
  currentStep: number;
  displayedBoard: Board;
  isPlaying: boolean;
  engineReview: ReviewLineResult | null;
  engineReviewLoading: boolean;
  sandboxActive?: boolean;
  onToggleSandbox?: () => void;
  sandboxSlot?: React.ReactNode;
  onSelectGame: (id: string) => void;
  onDeleteGame: (id: string) => void;
  onStepChange: (step: number) => void;
  onTogglePlay: () => void;
  onExitReview: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({
  games,
  selectedGameId,
  activeGame,
  steps,
  currentStep,
  displayedBoard,
  isPlaying,
  engineReview,
  engineReviewLoading,
  sandboxActive = false,
  onToggleSandbox,
  sandboxSlot,
  onSelectGame,
  onDeleteGame,
  onStepChange,
  onTogglePlay,
  onExitReview,
}) => {
  const [config, setConfig] = useState<DeepSeekConfig>(() => loadDeepSeekConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [draftKey, setDraftKey] = useState(config.apiKey);
  const [draftModel, setDraftModel] = useState<DeepSeekModel>(config.model);

  const [aiText, setAiText] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activePromptTitle, setActivePromptTitle] = useState<string | null>(null);
  const [questionInput, setQuestionInput] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const hasApiKey = config.apiKey.trim().length > 0;

  const keyMoments = useMemo(
    () => (activeGame ? detectKeyMoments(activeGame) : []),
    [activeGame]
  );

  const currentStepInfo = currentStep > 0 ? steps[currentStep - 1] ?? null : null;

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

  // Clear review AI output when switching saved game
  useEffect(() => {
    cancelStream();
    setAiText('');
    setAiError(null);
    setActivePromptTitle(null);
  }, [selectedGameId]);

  useEffect(() => {
    return () => cancelStream();
  }, []);

  const triggerReviewAI = (mode: ReviewAnalysisMode, title: string, question?: string) => {
    if (!activeGame) return;
    if (!config.apiKey.trim()) {
      setShowSettings(true);
      return;
    }

    cancelStream();
    const controller = new AbortController();
    abortRef.current = controller;
    setAiText('');
    setAiError(null);
    setActivePromptTitle(title);
    setAiStreaming(true);

    streamDeepSeekReview(
      config,
      {
        game: activeGame,
        currentStep,
        board: displayedBoard,
        stepInfo: currentStepInfo,
        keyMoments,
        engineReview,
        mode,
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

  const handleSaveSettings = () => {
    const next: DeepSeekConfig = {
      ...config,
      apiKey: draftKey.trim(),
      model: draftModel.trim() || 'deepseek-flash',
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
    triggerReviewAI('custom', `追问：${q}`, q);
  };

  // Build SVG sparkline path for evaluation trajectory
  const sparkline = useMemo(() => {
    if (!activeGame || activeGame.moves.length === 0) return null;
    const width = 260;
    const height = 46;
    const midY = height / 2;
    const scores = [0, ...activeGame.moves.map((m) => m.evalAfter)];
    const total = scores.length - 1;

    const points = scores.map((s, idx) => {
      const x = total === 0 ? 0 : (idx / total) * width;
      const norm = Math.tanh(s / 650); // -1..1
      const y = midY - norm * (midY - 5);
      return { x, y, step: idx };
    });

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const curPoint = points[Math.min(currentStep, points.length - 1)];
    const blunderSet = new Set(keyMoments.map((k) => k.step));

    return { width, height, midY, points, pathD, curPoint, blunderSet };
  }, [activeGame, currentStep, keyMoments]);

  const totalSteps = steps.length;

  return (
    <aside className="side-panel review-side-panel">
      {/* Saved Games Archive & Playback Card */}
      <div className="card review-archive-card">
        <div className="card-header">
          <div className="review-title">
            <History size={16} />
            <span>复盘室</span>
          </div>
          <button type="button" className="mini-btn" onClick={onExitReview}>
            返回对弈
          </button>
        </div>

        {games.length === 0 ? (
          <div className="review-empty">
            <p>暂无已保存的对局记录。</p>
            <span>完成任意一场对局后，棋局会自动留存到这里，随时逐步复盘与 AI 深度剖析。</span>
          </div>
        ) : (
          <>
            {/* Game Selector Row */}
            <div className="review-select-row">
              <select
                className="review-select"
                value={selectedGameId ?? ''}
                onChange={(e) => onSelectGame(e.target.value)}
                aria-label="选择已保存对局"
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id === '__live__'
                      ? `当前进行中 · ${g.totalMoves}步`
                      : `${formatTime(g.finishedAt)} · ${g.resultText} · ${g.totalMoves}步${g.wasTeachingMode ? ' [教学]' : ''}`}
                  </option>
                ))}
              </select>
              {selectedGameId && selectedGameId !== '__live__' && (
                <button
                  type="button"
                  className="mini-btn"
                  title="删除此条对局记录"
                  onClick={() => onDeleteGame(selectedGameId)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Playback Controls */}
            <div className="review-playback">
              <button
                type="button"
                title="回到开局"
                disabled={currentStep === 0}
                onClick={() => onStepChange(0)}
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                type="button"
                title="上一步 (←)"
                disabled={currentStep <= 0}
                onClick={() => onStepChange(Math.max(0, currentStep - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className={`play-btn ${isPlaying ? 'playing' : ''}`}
                title={isPlaying ? '暂停播放' : '自动逐步播放'}
                disabled={totalSteps === 0}
                onClick={onTogglePlay}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                <span>{isPlaying ? '暂停' : '播放'}</span>
              </button>
              <button
                type="button"
                title="下一步 (→)"
                disabled={currentStep >= totalSteps}
                onClick={() => onStepChange(Math.min(totalSteps, currentStep + 1))}
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                title="跳至终局"
                disabled={currentStep >= totalSteps}
                onClick={() => onStepChange(totalSteps)}
              >
                <ChevronsRight size={16} />
              </button>
            </div>

            <div className="review-step-meta">
              <span>
                {currentStep === 0
                  ? '开局初始局面'
                  : `第 ${currentStep} / ${totalSteps} 步 · ${currentStepInfo?.notation ?? ''}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {onToggleSandbox && (
                  <button
                    type="button"
                    className={`sandbox-enter-btn ${sandboxActive ? 'active' : ''}`}
                    onClick={onToggleSandbox}
                    title="从当前复盘局面自由试走变化，让引擎实时验算"
                  >
                    <FlaskConical size={11} />
                    {sandboxActive ? '退出试走' : '试走变招'}
                  </button>
                )}
                {activeGame && (
                  <span className="review-result-pill">{activeGame.resultText}</span>
                )}
              </div>
            </div>

            {/* Interactive SVG Evaluation Sparkline */}
            {sparkline && (
              <div className="sparkline-box" title="点击走势图任意点即可跳转到对应步数">
                <svg
                  viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                  className="sparkline-svg"
                >
                  <line
                    x1="0"
                    y1={sparkline.midY}
                    x2={sparkline.width}
                    y2={sparkline.midY}
                    stroke="rgba(216, 169, 98, 0.25)"
                    strokeDasharray="3 3"
                  />
                  <path
                    d={sparkline.pathD}
                    fill="none"
                    stroke="#e5b86e"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  {sparkline.points.map((p) => {
                    const isBlunder = sparkline.blunderSet.has(p.step);
                    return (
                      <circle
                        key={p.step}
                        cx={p.x}
                        cy={p.y}
                        r={isBlunder ? 3.4 : 2.2}
                        fill={isBlunder ? '#ef4444' : 'transparent'}
                        className="sparkline-hit"
                        onClick={() => onStepChange(p.step)}
                      />
                    );
                  })}
                  {sparkline.curPoint && (
                    <circle
                      cx={sparkline.curPoint.x}
                      cy={sparkline.curPoint.y}
                      r="4.2"
                      fill="#86efac"
                      stroke="#14261c"
                      strokeWidth="1.5"
                    />
                  )}
                </svg>
              </div>
            )}

            {/* Key Mistakes Quick-Jump Chips */}
            {keyMoments.length > 0 && (
              <div className="key-moments">
                <div className="key-moments-label">
                  <AlertTriangle size={12} />
                  <span>关键失误点（点击跳转）</span>
                </div>
                <div className="key-moments-chips">
                  {keyMoments.map((k) => (
                    <button
                      key={k.step}
                      type="button"
                      className={`moment-chip ${k.severity} ${currentStep === k.step ? 'active' : ''}`}
                      onClick={() => onStepChange(k.step)}
                    >
                      第{k.step}步 {k.notation} (-{(k.loss / 100).toFixed(1)})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Engine Better Move + Future Line & DeepSeek Review Master Card */}
      {activeGame && (
        <div className="card review-ai-card">
          <div className="coach-header">
            <div className="coach-title" style={{ color: '#f2cb85' }}>
              <GitBranch size={15} />
              <span>DeepSeek 复盘大师</span>
            </div>
            <button
              type="button"
              className={`coach-settings-btn ${hasApiKey ? 'connected' : ''}`}
              onClick={() => {
                setDraftKey(config.apiKey);
                setDraftModel(config.model);
                setShowSettings((s) => !s);
              }}
              title="配置 DeepSeek API"
            >
              <span className={`ds-dot ${hasApiKey ? 'on' : ''}`} />
              <span>DeepSeek</span>
              {showSettings ? <X size={12} /> : <Settings size={12} />}
            </button>
          </div>

          {sandboxActive && sandboxSlot}

          {/* Inline DeepSeek Settings */}
          {showSettings && (
            <div className="ds-config-box">
              <div className="ds-field">
                <label htmlFor="rev-ds-key">DeepSeek API Key（与教学模式共用）</label>
                <input
                  id="rev-ds-key"
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
                  >
                    V4.1 Flash
                  </button>
                  <button
                    type="button"
                    className={draftModel === 'deepseek-v4-pro' ? 'active' : ''}
                    onClick={() => setDraftModel('deepseek-v4-pro')}
                  >
                    V4 Pro
                  </button>
                </div>
                <div className="ds-actions">
                  <button type="button" className="mini-btn" onClick={() => setShowSettings(false)}>
                    取消
                  </button>
                  <button type="button" className="coach-apply-btn" onClick={handleSaveSettings}>
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Engine Better Move & Predicted Future Line */}
          {!sandboxActive && currentStep > 0 && (
            <div className="review-engine-box">
              {engineReviewLoading ? (
                <div className="coach-loading" style={{ color: '#f2cb85' }}>
                  <Sparkles size={13} />
                  <span>正在推演更优解与后续变化…</span>
                </div>
              ) : engineReview?.bestNotation ? (
                <>
                  <div className="review-compare">
                    <span>
                      实战：<strong>{currentStepInfo?.notation}</strong>
                    </span>
                    <span className="review-best-tag">
                      更优解：<strong>{engineReview.bestNotation}</strong>
                    </span>
                  </div>
                  {engineReview.futureLine.length > 0 && (
                    <div className="review-pv">
                      <span className="review-pv-label">如果走更优解，未来可能：</span>
                      <span className="review-pv-line">
                        {engineReview.futureLine.map((f) => f.notation).join(' → ')}
                      </span>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* DeepSeek Review Actions */}
          {!sandboxActive && (!hasApiKey ? (
            <button
              type="button"
              className="ds-cta-btn"
              onClick={() => setShowSettings(true)}
            >
              <Sparkles size={13} />
              配置 DeepSeek，解锁复盘局势剖析与变招推演
            </button>
          ) : (
            <>
              <div className="review-ai-actions">
                <button
                  type="button"
                  disabled={aiStreaming}
                  onClick={() => triggerReviewAI('full_game', '整局复盘总结')}
                >
                  整局总结
                </button>
                <button
                  type="button"
                  disabled={aiStreaming || currentStep === 0}
                  onClick={() =>
                    triggerReviewAI('step_analysis', `剖析第 ${currentStep} 步`)
                  }
                >
                  分析这一步
                </button>
                <button
                  type="button"
                  disabled={aiStreaming || currentStep === 0}
                  onClick={() =>
                    triggerReviewAI('future_variation', '推演更优解后续')
                  }
                >
                  若走更优解…
                </button>
              </div>

              {activePromptTitle && (
                <div className="ds-head-title" style={{ color: '#f2cb85' }}>
                  <Sparkles size={12} />
                  <span>{activePromptTitle}</span>
                </div>
              )}

              {aiError && <p className="ds-error">{aiError}</p>}

              {(aiText || aiStreaming) && (
                <div className="ds-output review-ds-output" ref={outputRef}>
                  {aiText || '复盘大师正在推演局面与后续变化…'}
                  {aiStreaming && <span className="ds-cursor" />}
                </div>
              )}

              <form className="ds-ask-form" onSubmit={handleAskSubmit}>
                <input
                  type="text"
                  placeholder="追问复盘（如：如果这里改走车一平二会怎样？）"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  disabled={aiStreaming}
                />
                <button
                  type="submit"
                  disabled={aiStreaming || !questionInput.trim()}
                  title="发送复盘追问"
                >
                  <Send size={13} />
                </button>
              </form>
            </>
          ))}
        </div>
      )}
    </aside>
  );
};
