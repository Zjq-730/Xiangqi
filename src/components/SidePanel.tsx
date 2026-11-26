import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  Flag,
  FlaskConical,
  Lightbulb,
  RotateCcw,
  Swords,
} from 'lucide-react';
import type { GameStatus, MoveRecord, Side } from '../engine/types';

interface SidePanelProps {
  playMode: 'ai' | 'pvp' | 'online';
  difficultyLabel: string;
  turn: Side;
  playerSide: Side;
  gameStatus: GameStatus;
  aiThinking: boolean;
  hintLoading: boolean;
  history: MoveRecord[];
  viewStep: number | null;
  canUndo: boolean;
  canHint: boolean;
  canResign: boolean;
  sandboxActive: boolean;
  onUndo: () => void;
  onToggleSandbox: () => void;
  onHint: () => void;
  onNewGame: () => void;
  onResign: () => void;
  onSelectStep: (step: number | null) => void;
  onCopyNotation: () => void;
  onDownloadNotation: () => void;
  onlineSlot?: React.ReactNode;
  coachSlot?: React.ReactNode;
  sandboxSlot?: React.ReactNode;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  playMode,
  difficultyLabel,
  turn,
  playerSide,
  gameStatus,
  aiThinking,
  hintLoading,
  history,
  viewStep,
  canUndo,
  canHint,
  canResign,
  sandboxActive,
  onUndo,
  onToggleSandbox,
  onHint,
  onNewGame,
  onResign,
  onSelectStep,
  onCopyNotation,
  onDownloadNotation,
  onlineSlot,
  coachSlot,
  sandboxSlot,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'coach' | 'history'>('coach');

  const activeStep = viewStep === null ? history.length : viewStep;

  // Automatically focus Coach tab when Teaching Mode turns on
  useEffect(() => {
    if (coachSlot) {
      setActiveTab('coach');
    }
  }, [Boolean(coachSlot)]);

  useEffect(() => {
    if (viewStep === null && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [history.length, viewStep, activeTab]);

  const handleCopy = () => {
    onCopyNotation();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const rounds: {
    round: number;
    red?: { rec: MoveRecord; step: number };
    black?: { rec: MoveRecord; step: number };
  }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rounds.push({
      round: Math.floor(i / 2) + 1,
      red: { rec: history[i], step: i + 1 },
      black: history[i + 1] ? { rec: history[i + 1], step: i + 2 } : undefined,
    });
  }

  const statusText = (() => {
    if (gameStatus.state === 'checkmate') {
      return gameStatus.winner === 'red' ? '红方胜' : '黑方胜';
    }
    if (gameStatus.state === 'resigned') {
      return gameStatus.winner === 'red' ? '红方胜（认输）' : '黑方胜（认输）';
    }
    if (gameStatus.state === 'draw') {
      return '和棋';
    }
    return turn === 'red' ? '红方走棋' : '黑方走棋';
  })();

  const showCoach = Boolean(coachSlot) && activeTab === 'coach';

  return (
    <aside className="side-panel">
      {/* Optional Online Room Bar (when in Two-Device Online Mode) */}
      {onlineSlot}

      {/* Compact Status & 4-Action Card */}
      <div className="card">
        <div className="status-row">
          <div className="turn-badge">
            <span
              className={`turn-dot ${
                gameStatus.state === 'checkmate' || gameStatus.state === 'resigned'
                  ? gameStatus.winner
                  : turn
              }`}
            />
            <span>{statusText}</span>
          </div>

          <div className="status-row-right">
            {aiThinking && (
              <span className="ai-pill">
                <span className="thinking-dots" />
                思考中
              </span>
            )}
            {!aiThinking && gameStatus.state === 'playing' && gameStatus.inCheck && (
              <span
                className="ai-pill"
                style={{ color: '#ffb5a8', borderColor: 'rgba(220,70,70,0.5)' }}
              >
                将军！
              </span>
            )}
            {canResign && !aiThinking && (
              <button
                type="button"
                className="resign-mini-btn"
                onClick={onResign}
                title="中盘认输（判对手获胜并自动保存到复盘模式）"
              >
                <Flag size={12} />
                认输
              </button>
            )}
          </div>
        </div>

        <div className="status-sub">
          <span>
            {playMode === 'pvp'
              ? '双人同屏'
              : playMode === 'online'
                ? '双设备联机'
                : `执${playerSide === 'red' ? '红' : '黑'} · AI ${difficultyLabel}`}
          </span>
          <span>第 {Math.floor(history.length / 2) + 1} 回合</span>
        </div>

        <div className="action-grid four-cols">
          <button
            type="button"
            className="wood-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="悔棋 (Ctrl/⌘ + Z)"
          >
            <RotateCcw size={14} />
            悔棋
          </button>

          <button
            type="button"
            className={`wood-btn ${sandboxActive ? 'sandbox-active-btn' : ''}`}
            onClick={onToggleSandbox}
            disabled={aiThinking}
            title="开启/退出草稿棋盘试走变化"
          >
            <FlaskConical size={14} />
            试走
          </button>

          <button
            type="button"
            className="wood-btn"
            onClick={onHint}
            disabled={!canHint || hintLoading}
            title="引擎推荐着法"
          >
            <Lightbulb size={14} />
            {hintLoading ? '推演' : '提示'}
          </button>

          <button type="button" className="wood-btn primary" onClick={onNewGame}>
            <Swords size={14} />
            新局
          </button>
        </div>
      </div>

      {/* Standalone Sandbox Card in Normal Mode (replaces history while drafting to avoid stacking) */}
      {sandboxSlot ? (
        <div className="card sandbox-standalone-card">{sandboxSlot}</div>
      ) : (
        /* Tabbed Lower Workspace: Coach vs Move History (never stacked!) */
        <div className="side-lower-wrap">
          {coachSlot && (
            <div className="panel-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'coach'}
                className={activeTab === 'coach' ? 'active' : ''}
                onClick={() => setActiveTab('coach')}
              >
                私教讲解
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'history'}
                className={activeTab === 'history' ? 'active' : ''}
                onClick={() => setActiveTab('history')}
              >
                棋谱{history.length > 0 ? ` (${history.length})` : ''}
              </button>
            </div>
          )}

          {showCoach ? (
            coachSlot
          ) : (
            <div className="card history-card">
              <div className="card-header">
                <span className="card-title">棋谱复盘</span>
                <div className="export-actions">
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={handleCopy}
                    disabled={history.length === 0}
                    title="复制中文棋谱与 FEN"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? '已复制' : '复制'}
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={onDownloadNotation}
                    disabled={history.length === 0}
                    title="导出棋谱为文本文件"
                  >
                    <Download size={13} />
                    导出
                  </button>
                </div>
              </div>

              <div className="moves-list" ref={listRef}>
                {rounds.length === 0 ? (
                  <div className="moves-empty">
                    <span>暂未落子</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>点击棋子即可开局</span>
                  </div>
                ) : (
                  rounds.map((row) => (
                    <div className="move-row" key={row.round}>
                      <span className="move-round">{row.round}.</span>
                      {row.red && (
                        <button
                          type="button"
                          className={`move-chip red-move ${activeStep === row.red.step ? 'active' : ''}`}
                          onClick={() =>
                            onSelectStep(row.red!.step === history.length ? null : row.red!.step)
                          }
                        >
                          {row.red.rec.notation}
                        </button>
                      )}
                      {row.black ? (
                        <button
                          type="button"
                          className={`move-chip black-move ${activeStep === row.black.step ? 'active' : ''}`}
                          onClick={() =>
                            onSelectStep(row.black!.step === history.length ? null : row.black!.step)
                          }
                        >
                          {row.black.rec.notation}
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="replay-controls">
                <button
                  type="button"
                  title="回到开局"
                  disabled={history.length === 0 || activeStep === 0}
                  onClick={() => onSelectStep(0)}
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  type="button"
                  title="上一步 (←)"
                  disabled={history.length === 0 || activeStep <= 0}
                  onClick={() => onSelectStep(Math.max(0, activeStep - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  title="下一步 (→)"
                  disabled={history.length === 0 || activeStep >= history.length}
                  onClick={() => {
                    const next = activeStep + 1;
                    onSelectStep(next >= history.length ? null : next);
                  }}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  title="回到最新"
                  disabled={history.length === 0 || viewStep === null}
                  onClick={() => onSelectStep(null)}
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
