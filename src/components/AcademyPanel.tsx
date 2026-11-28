import React from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  type AcademyProgress,
  INTERACTIVE_MANUALS,
  MICRO_LESSONS,
  TACTIC_PUZZLES,
} from '../data/academy';
import { type TeachingTab, TeachingSubNav } from './TeachingSubNav';

interface AcademyPanelProps {
  activeTab: Exclude<TeachingTab, 'coach'>;
  onSelectTab: (tab: TeachingTab) => void;
  progress: AcademyProgress;

  // Lessons
  lessonId: string;
  lessonStepIdx: number;
  lessonStepDone: boolean;
  lessonFeedback: { tone: 'success' | 'warn'; text: string } | null;
  onSelectLesson: (id: string) => void;
  onDemoLessonStep: () => void;
  onNextLessonStep: () => void;
  onResetLessonStep: () => void;

  // Puzzles
  puzzleId: string;
  puzzleStepIdx: number;
  puzzleSolved: boolean;
  puzzleShowHint: boolean;
  puzzleFeedback: { tone: 'success' | 'warn' | 'info'; text: string } | null;
  onSelectPuzzle: (id: string) => void;
  onTogglePuzzleHint: () => void;
  onResetPuzzle: () => void;
  onNextPuzzle: () => void;

  // Manuals
  manualId: string;
  manualStepIdx: number;
  manualQuizMode: boolean;
  manualNotations: string[];
  manualQuizFeedback: { tone: 'success' | 'warn'; text: string } | null;
  manualShowHint: boolean;
  onSelectManual: (id: string) => void;
  onManualStepChange: (idx: number) => void;
  onToggleManualQuizMode: (quiz: boolean) => void;
  onToggleManualHint: () => void;
  onResetManual: () => void;
}

export const AcademyPanel: React.FC<AcademyPanelProps> = ({
  activeTab,
  onSelectTab,
  progress,
  lessonId,
  lessonStepIdx,
  lessonStepDone,
  lessonFeedback,
  onSelectLesson,
  onDemoLessonStep,
  onNextLessonStep,
  onResetLessonStep,
  puzzleId,
  puzzleStepIdx,
  puzzleSolved,
  puzzleShowHint,
  puzzleFeedback,
  onSelectPuzzle,
  onTogglePuzzleHint,
  onResetPuzzle,
  onNextPuzzle,
  manualId,
  manualStepIdx,
  manualQuizMode,
  manualNotations,
  manualQuizFeedback,
  manualShowHint,
  onSelectManual,
  onManualStepChange,
  onToggleManualQuizMode,
  onToggleManualHint,
  onResetManual,
}) => {
  const lessonProgressText = `${progress.completedLessons.length}/${MICRO_LESSONS.length}`;
  const puzzleProgressText = `${progress.completedPuzzles.length}/${TACTIC_PUZZLES.length}`;
  const manualProgressText = `${progress.completedManuals.length}/${INTERACTIVE_MANUALS.length}`;

  const currentLesson = MICRO_LESSONS.find((l) => l.id === lessonId) ?? MICRO_LESSONS[0];
  const currentLessonIdx = MICRO_LESSONS.findIndex((l) => l.id === currentLesson.id);
  const currentStep = currentLesson.steps[lessonStepIdx] ?? currentLesson.steps[0];
  const isLastLessonStep = lessonStepIdx >= currentLesson.steps.length - 1;
  const hasNextLesson = currentLessonIdx < MICRO_LESSONS.length - 1;

  const currentPuzzle = TACTIC_PUZZLES.find((p) => p.id === puzzleId) ?? TACTIC_PUZZLES[0];
  const currentPuzzleIdx = TACTIC_PUZZLES.findIndex((p) => p.id === currentPuzzle.id);
  const currentPuzzleStep = currentPuzzle.steps[puzzleStepIdx] ?? currentPuzzle.steps[0];
  const hasNextPuzzle = currentPuzzleIdx < TACTIC_PUZZLES.length - 1;

  const currentManual = INTERACTIVE_MANUALS.find((m) => m.id === manualId) ?? INTERACTIVE_MANUALS[0];
  const totalManualMoves = currentManual.moves.length;
  const nextManualMove = currentManual.moves[manualStepIdx];
  const waitingForQuiz = Boolean(manualQuizMode && nextManualMove?.isQuiz && manualStepIdx < totalManualMoves);
  const activeManualComment =
    manualStepIdx === 0
      ? currentManual.summary
      : currentManual.moves[manualStepIdx - 1]?.comment ?? currentManual.summary;

  return (
    <aside className="side-panel academy-panel">
      <TeachingSubNav
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        lessonProgressText={lessonProgressText}
        puzzleProgressText={puzzleProgressText}
        manualProgressText={manualProgressText}
      />

      {/* ==================== 1. 基础微课 ==================== */}
      {activeTab === 'lessons' && (
        <>
          <div className="card academy-list-card">
            <div className="academy-section-head">
              <span className="academy-section-title">选择微课</span>
              <span className="academy-progress-pill">已掌握 {lessonProgressText}</span>
            </div>
            <div className="academy-chip-list">
              {MICRO_LESSONS.map((lesson, idx) => {
                const done = progress.completedLessons.includes(lesson.id);
                const active = lesson.id === currentLesson.id;
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    className={`academy-item-btn ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                    onClick={() => onSelectLesson(lesson.id)}
                  >
                    <span className="academy-item-idx">{idx + 1}</span>
                    <span className="academy-item-text">
                      <span className="academy-item-name">{lesson.title}</span>
                      <span className="academy-item-sub">
                        {lesson.category === 'notation' ? '记谱法' : '单子走法'} · {lesson.duration}
                      </span>
                    </span>
                    {done && <CheckCircle2 size={15} className="academy-done-icon" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card academy-work-card">
            <div className="academy-step-bar">
              <span className="academy-step-tag">
                第 {lessonStepIdx + 1} / {currentLesson.steps.length} 步
              </span>
              <div className="academy-step-dots">
                {currentLesson.steps.map((_, i) => (
                  <span
                    key={i}
                    className={`academy-dot ${
                      i < lessonStepIdx || (i === lessonStepIdx && lessonStepDone)
                        ? 'done'
                        : i === lessonStepIdx
                          ? 'current'
                          : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="academy-work-title">{currentStep.title}</div>
            <p className="academy-work-desc">{currentStep.explanation}</p>

            {currentStep.formula && (
              <div className="academy-formula-box">{currentStep.formula}</div>
            )}

            {lessonFeedback && (
              <div className={`academy-feedback ${lessonFeedback.tone}`}>
                {lessonFeedback.text}
              </div>
            )}

            <div className="academy-actions">
              {currentStep.kind === 'demo' && !lessonStepDone ? (
                <button
                  type="button"
                  className="wood-btn primary"
                  onClick={onDemoLessonStep}
                >
                  <Play size={14} />
                  演示这一步
                </button>
              ) : (
                <button
                  type="button"
                  className="wood-btn"
                  onClick={onResetLessonStep}
                >
                  <RotateCcw size={14} />
                  重试本步
                </button>
              )}

              {lessonStepDone && (
                <button
                  type="button"
                  className="wood-btn primary"
                  onClick={onNextLessonStep}
                >
                  {isLastLessonStep
                    ? hasNextLesson
                      ? '进入下一课'
                      : '去杀法闯关'
                    : '下一步'}
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== 2. 杀法闯关 ==================== */}
      {activeTab === 'puzzles' && (
        <>
          <div className="card academy-list-card">
            <div className="academy-section-head">
              <span className="academy-section-title">经典杀法闯关</span>
              <span className="academy-progress-pill">已通关 {puzzleProgressText}</span>
            </div>
            <div className="academy-puzzle-grid">
              {TACTIC_PUZZLES.map((pz, idx) => {
                const done = progress.completedPuzzles.includes(pz.id);
                const active = pz.id === currentPuzzle.id;
                return (
                  <button
                    key={pz.id}
                    type="button"
                    className={`academy-puzzle-chip ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                    onClick={() => onSelectPuzzle(pz.id)}
                  >
                    <span className="puzzle-chip-top">
                      <span>
                        {idx + 1}. {pz.name.replace(/（.*）/, '')}
                      </span>
                      {done && <CheckCircle2 size={13} className="academy-done-icon" />}
                    </span>
                    <span className="puzzle-chip-sub">
                      {pz.difficulty} · {pz.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card academy-work-card">
            <div className="academy-step-bar">
              <span className="academy-step-tag">{currentPuzzle.difficulty}</span>
              <span className="academy-progress-pill">红先绝杀</span>
            </div>

            <div className="academy-work-title">{currentPuzzle.name}</div>
            <p className="academy-work-desc">{currentPuzzle.description}</p>

            {puzzleShowHint && !puzzleSolved && (
              <div className="academy-hint-box">
                <Lightbulb size={14} />
                <span>{currentPuzzleStep.hintText}</span>
              </div>
            )}

            {puzzleFeedback && (
              <div className={`academy-feedback ${puzzleFeedback.tone}`}>
                {puzzleFeedback.text}
              </div>
            )}

            {puzzleSolved && (
              <div className="academy-takeaway-box">
                <Sparkles size={14} />
                <span>
                  <strong>杀法要诀：</strong>
                  {currentPuzzle.takeaway}
                </span>
              </div>
            )}

            <div className="academy-actions">
              {!puzzleSolved && (
                <button
                  type="button"
                  className={`wood-btn ${puzzleShowHint ? 'active' : ''}`}
                  onClick={onTogglePuzzleHint}
                >
                  <Lightbulb size={14} />
                  {puzzleShowHint ? '隐藏提示' : '看提示'}
                </button>
              )}
              <button type="button" className="wood-btn" onClick={onResetPuzzle}>
                <RotateCcw size={14} />
                重来
              </button>
              {puzzleSolved && (
                <button
                  type="button"
                  className="wood-btn primary"
                  onClick={onNextPuzzle}
                >
                  {hasNextPuzzle ? '下一关' : '去学互动棋谱'}
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== 3. 互动棋谱 ==================== */}
      {activeTab === 'manuals' && (
        <>
          <div className="card academy-list-card">
            <div className="academy-section-head">
              <span className="academy-section-title">经典棋谱精讲</span>
              <span className="academy-progress-pill">已学 {manualProgressText}</span>
            </div>
            <div className="academy-chip-list">
              {INTERACTIVE_MANUALS.map((man) => {
                const done = progress.completedManuals.includes(man.id);
                const active = man.id === currentManual.id;
                return (
                  <button
                    key={man.id}
                    type="button"
                    className={`academy-item-btn ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                    onClick={() => onSelectManual(man.id)}
                  >
                    <span className="academy-item-text">
                      <span className="academy-item-name">{man.title}</span>
                      <span className="academy-item-sub">
                        {man.difficulty} · {man.source}
                      </span>
                    </span>
                    {done && <CheckCircle2 size={15} className="academy-done-icon" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card academy-work-card">
            <div className="academy-manual-head">
              <div className="academy-work-title" style={{ marginBottom: 0 }}>
                {currentManual.title}
              </div>
              <div className="segmented compact">
                <button
                  type="button"
                  className={!manualQuizMode ? 'active' : ''}
                  onClick={() => onToggleManualQuizMode(false)}
                >
                  精读
                </button>
                <button
                  type="button"
                  className={manualQuizMode ? 'active' : ''}
                  onClick={() => onToggleManualQuizMode(true)}
                >
                  自测
                </button>
              </div>
            </div>

            {/* Interactive Move Chips */}
            <div className="manual-moves-strip">
              {manualNotations.map((note, idx) => {
                const stepNum = idx + 1;
                const isReached = stepNum <= manualStepIdx;
                const isCurrent = stepNum === manualStepIdx;
                const isRed = idx % 2 === 0;
                const hiddenInQuiz = manualQuizMode && stepNum > manualStepIdx;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={hiddenInQuiz}
                    className={`manual-move-chip ${isRed ? 'red' : 'black'} ${
                      isCurrent ? 'current' : isReached ? 'reached' : ''
                    }`}
                    onClick={() => onManualStepChange(stepNum)}
                  >
                    {isRed && <span className="manual-round">{Math.floor(idx / 2) + 1}.</span>}
                    {hiddenInQuiz ? '？' : note}
                  </button>
                );
              })}
            </div>

            <div className="academy-comment-box">
              <div className="academy-comment-meta">
                {manualStepIdx === 0
                  ? '布局总览'
                  : `第 ${manualStepIdx} / ${totalManualMoves} 步 · ${
                      (manualStepIdx - 1) % 2 === 0 ? '红方' : '黑方'
                    }`}
              </div>
              <p className="academy-work-desc" style={{ margin: 0 }}>
                {activeManualComment}
              </p>
            </div>

            {waitingForQuiz && (
              <div className="academy-quiz-prompt">
                <strong>轮到你走！</strong>请在左侧棋盘走出红方的关键着法。
                {manualShowHint && nextManualMove?.quizHint && (
                  <div className="academy-quiz-hint">提示：{nextManualMove.quizHint}</div>
                )}
              </div>
            )}

            {manualQuizFeedback && (
              <div className={`academy-feedback ${manualQuizFeedback.tone}`}>
                {manualQuizFeedback.text}
              </div>
            )}

            {manualStepIdx >= totalManualMoves && (
              <div className="academy-feedback success">
                本谱已学完！你可以切换到「自测」模式考考自己，或切到「实战陪练」亲自演练这一布局。
              </div>
            )}

            <div className="academy-actions">
              <button
                type="button"
                className="wood-btn"
                disabled={manualStepIdx <= 0}
                onClick={() => onManualStepChange(Math.max(0, manualStepIdx - 1))}
              >
                <ChevronLeft size={14} />
                上一步
              </button>

              {waitingForQuiz ? (
                <button
                  type="button"
                  className={`wood-btn ${manualShowHint ? 'active' : ''}`}
                  onClick={onToggleManualHint}
                >
                  <Lightbulb size={14} />
                  {manualShowHint ? '隐藏提示' : '提示'}
                </button>
              ) : (
                <button
                  type="button"
                  className="wood-btn primary"
                  disabled={manualStepIdx >= totalManualMoves}
                  onClick={() => onManualStepChange(Math.min(totalManualMoves, manualStepIdx + 1))}
                >
                  下一步
                  <ChevronRight size={14} />
                </button>
              )}

              <button type="button" className="wood-btn" onClick={onResetManual} title="回到开局">
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
};
