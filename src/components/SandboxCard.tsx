import React, { useEffect, useRef, useState } from 'react';
import { Check, FlaskConical, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  loadDeepSeekConfig,
  streamDeepSeekSandbox,
} from '../engine/deepseekCoach';
import type { PikafishAnalysis } from '../engine/pikafishClient';
import type { Board, MoveRecord, Side } from '../engine/types';

interface SandboxCardProps {
  playerSide: Side;
  baseBoard: Board;
  sandboxBoard: Board;
  sandboxTurn: Side;
  baseEval: number;
  sandboxMoves: MoveRecord[];
  analysis: PikafishAnalysis | null;
  loading: boolean;
  pikafishActive: boolean;
  allowVerify: boolean;
  canCommitMove: boolean;
  onVerifySandbox?: () => void;
  onUndoSandboxMove: () => void;
  onCommitSandboxMove?: () => void;
  onExitSandbox: () => void;
}

function formatEvalShort(score: number): string {
  if (Math.abs(score) < 25) return '均势 0.0';
  return score > 0
    ? `红优 +${(score / 100).toFixed(1)}`
    : `黑优 +${(Math.abs(score) / 100).toFixed(1)}`;
}

export const SandboxCard: React.FC<SandboxCardProps> = ({
  playerSide,
  baseBoard,
  sandboxBoard,
  sandboxTurn,
  baseEval,
  sandboxMoves,
  analysis,
  loading,
  pikafishActive,
  allowVerify,
  canCommitMove,
  onVerifySandbox,
  onUndoSandboxMove,
  onCommitSandboxMove,
  onExitSandbox,
}) => {
  const [aiText, setAiText] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  const cancelStream = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setAiStreaming(false);
  };

  // Clear AI commentary whenever the sandbox move list changes
  useEffect(() => {
    cancelStream();
    setAiText('');
    setAiError(null);
  }, [sandboxMoves.length]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [aiText, aiStreaming]);

  useEffect(() => () => cancelStream(), []);

  const currentEval = analysis ? analysis.scoreCp : baseEval;
  const sign = playerSide === 'red' ? 1 : -1;
  const deltaForPlayer = (currentEval - baseEval) * sign;

  const verdict = (() => {
    if (sandboxMoves.length === 0 || loading || !analysis) return null;
    if (deltaForPlayer >= 60) return { cls: 'great', text: `更优 +${(deltaForPlayer / 100).toFixed(1)}` };
    if (deltaForPlayer >= -45) return { cls: 'good', text: '可行 · 持平' };
    if (deltaForPlayer >= -150) return { cls: 'warn', text: `略亏 -${(Math.abs(deltaForPlayer) / 100).toFixed(1)}` };
    return { cls: 'bad', text: `中计大亏 -${(Math.abs(deltaForPlayer) / 100).toFixed(1)}` };
  })();

  const handleAskDeepSeek = () => {
    const config = loadDeepSeekConfig();
    if (!config.apiKey.trim()) {
      setAiError('请先在上方 DeepSeek 设置中填入 API Key。');
      return;
    }
    if (sandboxMoves.length === 0 || !analysis) return;

    cancelStream();
    const controller = new AbortController();
    abortRef.current = controller;
    setAiText('');
    setAiError(null);
    setAiStreaming(true);

    streamDeepSeekSandbox(
      config,
      {
        playerSide,
        baseBoard,
        sandboxBoard,
        sandboxTurn,
        baseEval,
        sandboxEval: analysis.scoreCp,
        triedMoves: sandboxMoves.map((m) => ({
          side: m.move.piece.side,
          notation: m.notation,
        })),
        counterLine: analysis.futureLine,
        engineDepth: analysis.depth,
        pikafishActive,
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

  return (
    <div className="sandbox-box">
      <div className="sandbox-head">
        <div className="sandbox-title">
          <FlaskConical size={14} />
          <span>试走摆变化</span>
        </div>
        <button type="button" className="mini-btn" onClick={onExitSandbox} title="退出试走，恢复原局面">
          <X size={12} />
          退出试走
        </button>
      </div>

      {sandboxMoves.length === 0 ? (
        <p className="sandbox-hint">
          草稿棋盘：直接在棋盘上替红黑双方自由摆变化，不会影响原对局，也不会自动剧透答案。
        </p>
      ) : (
        <>
          <div className="sandbox-line">
            <span className="sandbox-label">已摆变化：</span>
            <span className="sandbox-moves-text">
              {sandboxMoves.map((m) => m.notation).join(' → ')}
            </span>
          </div>

          {allowVerify && loading && (
            <div className="coach-loading" style={{ color: '#d8b4fe' }}>
              <Sparkles size={13} />
              <span>{pikafishActive ? 'Pikafish 正在深度验算…' : '引擎正在验算…'}</span>
            </div>
          )}

          {allowVerify && !loading && analysis && (
            <div className="sandbox-result">
              <div className="sandbox-eval-row">
                <span className="sandbox-eval-change">
                  {formatEvalShort(baseEval)} → <strong>{formatEvalShort(analysis.scoreCp)}</strong>
                </span>
                {verdict && <span className={`sandbox-verdict ${verdict.cls}`}>{verdict.text}</span>}
              </div>

              {analysis.futureLine.length > 0 && (
                <div className="sandbox-counter">
                  <span className="sandbox-label">
                    {sandboxTurn === playerSide ? '后续最强续招' : '对手最狠反击'}
                    {pikafishActive && analysis.depth > 0 ? ` (${analysis.depth}层)` : ''}：
                  </span>
                  <span className="sandbox-counter-line">
                    {analysis.futureLine.slice(0, 5).map((f) => f.notation).join(' → ')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="sandbox-actions">
            <button
              type="button"
              className="mini-btn"
              onClick={onUndoSandboxMove}
              title="撤回最后一步试走"
            >
              <RotateCcw size={12} />
              退一步
            </button>

            {canCommitMove && onCommitSandboxMove && (
              <button
                type="button"
                className="coach-apply-btn"
                onClick={onCommitSandboxMove}
                title="把第一步试走作为实战正式落子"
              >
                <Check size={12} />
                就走这步
              </button>
            )}

            {allowVerify && !analysis && onVerifySandbox && (
              <button
                type="button"
                className="sandbox-ai-btn"
                disabled={loading}
                onClick={onVerifySandbox}
                title="摆完变化后，按需让引擎验算这手变化是否成立"
              >
                <Sparkles size={12} />
                {loading ? '验算中…' : '引擎验算'}
              </button>
            )}

            {allowVerify && analysis && (
              <button
                type="button"
                className="sandbox-ai-btn"
                disabled={loading || aiStreaming}
                onClick={handleAskDeepSeek}
              >
                <Sparkles size={12} />
                {aiStreaming ? '点评中…' : 'DeepSeek 点评'}
              </button>
            )}
          </div>

          {allowVerify && aiError && <p className="ds-error">{aiError}</p>}

          {allowVerify && (aiText || aiStreaming) && (
            <div className="ds-output sandbox-ds-output" ref={outputRef}>
              {aiText || 'DeepSeek 正在结合引擎反击线路点评…'}
              {aiStreaming && <span className="ds-cursor" />}
            </div>
          )}
        </>
      )}
    </div>
  );
};
