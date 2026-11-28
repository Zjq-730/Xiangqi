import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, BookMarked, SlidersHorizontal, X } from 'lucide-react';
import { AcademyPanel } from './components/AcademyPanel';
import { ChessBoard } from './components/Board';
import { CapturedStrip } from './components/CapturedTray';
import { CoachPanel } from './components/CoachPanel';
import { EvalBar } from './components/EvalBar';
import { GlossaryModal } from './components/GlossaryModal';
import { OnlineRoomCard } from './components/OnlineRoomCard';
import { ReviewPanel } from './components/ReviewPanel';
import { SandboxCard } from './components/SandboxCard';
import { SidePanel } from './components/SidePanel';
import { type TeachingTab, TeachingSubNav } from './components/TeachingSubNav';
import {
  type AcademyProgress,
  INTERACTIVE_MANUALS,
  MICRO_LESSONS,
  TACTIC_PUZZLES,
  createBoardFromPieces,
  getInitialLessonBoard,
  loadAcademyProgress,
  saveAcademyProgress,
} from './data/academy';
import { type ReviewLineResult, analyzePositionForReview, evaluateRedAdvantage } from './engine/ai';
import type { AIWorkerRequest, AIWorkerResponse } from './engine/aiWorker';
import {
  type MoveExplanation,
  type PlayerFeedback,
  evaluatePlayerMoveFeedback,
  explainMove,
} from './engine/coach';
import {
  type SavedGame,
  buildSavedGameFromHistory,
  deleteSavedGame,
  loadSavedGames,
  reconstructGameSteps,
  saveGameToArchive,
} from './engine/gameArchive';
import {
  type PikafishAnalysis,
  analyzeWithPikafish,
  checkPikafishStatus,
  difficultyToPikafishOpts,
  pikafishToReviewResult,
} from './engine/pikafishClient';
import {
  type OnlineRoomState,
  type OnlineSession,
  createOnlineRoom,
  joinOnlineRoom,
  sendOnlineMove,
  sendOnlineReset,
  sendOnlineUndo,
  subscribeOnlineRoom,
} from './engine/onlineClient';
import { exportGameNotation, moveToChineseNotation } from './engine/notation';
import { type SoundPack, loadSoundPack, soundEngine } from './engine/sound';
import {
  type Board,
  type Difficulty,
  type GameStatus,
  type Move,
  type MoveRecord,
  type Pos,
  type Side,
  oppositeSide,
} from './engine/types';
import {
  applyMove,
  boardToFen,
  createInitialBoard,
  evaluateGameStatus,
  findGeneral,
  getCapturedPieces,
  getLegalMovesForSquare,
  isInCheck,
} from './engine/xiangqi';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: '入门',
  intermediate: '棋友',
  master: '大师',
};

export function App() {
  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [turn, setTurn] = useState<Side>('red');
  const [playMode, setPlayMode] = useState<'ai' | 'pvp' | 'online'>('ai');
  const [playerSide, setPlayerSide] = useState<Side>('red');

  // Online two-device room state
  const [onlineSession, setOnlineSession] = useState<OnlineSession | null>(null);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const onlineAppliedVersionRef = useRef<number>(0);
  const onlineMoveLenRef = useRef<number>(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [teachingMode, setTeachingMode] = useState(false);
  const [teachingTab, setTeachingTab] = useState<TeachingTab>('lessons');
  const [reviewMode, setReviewMode] = useState(false);

  // Academy (基础微课 / 杀法闯关 / 互动棋谱) state
  const [academyProgress, setAcademyProgress] = useState<AcademyProgress>(() => loadAcademyProgress());
  const [lessonId, setLessonId] = useState<string>(MICRO_LESSONS[0].id);
  const [lessonStepIdx, setLessonStepIdx] = useState(0);
  const [lessonBoard, setLessonBoard] = useState<Board>(() =>
    getInitialLessonBoard(MICRO_LESSONS[0].steps[0])
  );
  const [lessonLastMove, setLessonLastMove] = useState<Move | null>(null);
  const [lessonStepDone, setLessonStepDone] = useState(false);
  const [lessonFeedback, setLessonFeedback] = useState<{ tone: 'success' | 'warn'; text: string } | null>(null);

  const [puzzleId, setPuzzleId] = useState<string>(TACTIC_PUZZLES[0].id);
  const [puzzleStepIdx, setPuzzleStepIdx] = useState(0);
  const [puzzleBoard, setPuzzleBoard] = useState<Board>(() =>
    createBoardFromPieces(TACTIC_PUZZLES[0].pieces)
  );
  const [puzzleLastMove, setPuzzleLastMove] = useState<Move | null>(null);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [puzzleShowHint, setPuzzleShowHint] = useState(false);
  const [puzzleBusy, setPuzzleBusy] = useState(false);
  const [puzzleFeedback, setPuzzleFeedback] = useState<{
    tone: 'success' | 'warn' | 'info';
    text: string;
  } | null>(null);

  const [manualId, setManualId] = useState<string>(INTERACTIVE_MANUALS[0].id);
  const [manualStepIdx, setManualStepIdx] = useState(0);
  const [manualQuizMode, setManualQuizMode] = useState(false);
  const [manualQuizFeedback, setManualQuizFeedback] = useState<{
    tone: 'success' | 'warn';
    text: string;
  } | null>(null);
  const [manualShowHint, setManualShowHint] = useState(false);
  const academyTimerRef = useRef<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [soundPack, setSoundPack] = useState<SoundPack>(() => loadSoundPack());

  const [savedGames, setSavedGames] = useState<SavedGame[]>(() => loadSavedGames());
  const [selectedReviewGameId, setSelectedReviewGameId] = useState<string | null>(null);
  const [reviewStep, setReviewStep] = useState(0);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [engineReview, setEngineReview] = useState<ReviewLineResult | null>(null);
  const [engineReviewLoading, setEngineReviewLoading] = useState(false);

  const [history, setHistory] = useState<MoveRecord[]>([]);
  const [viewStep, setViewStep] = useState<number | null>(null);
  const [selectedPos, setSelectedPos] = useState<Pos | null>(null);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [hintPvLine, setHintPvLine] = useState<{ side: Side; notation: string }[]>([]);
  const [hintDepth, setHintDepth] = useState<number>(0);
  const [hintLoading, setHintLoading] = useState(false);
  const [pikafishReady, setPikafishReady] = useState(false);
  const [nnueEval, setNnueEval] = useState<number | null>(null);

  // Sandbox ("试走摆变化") state — works in both Teaching Mode & Review Mode
  const [sandboxActive, setSandboxActive] = useState(false);
  const [sandboxBaseBoard, setSandboxBaseBoard] = useState<Board>(() => createInitialBoard());
  const [sandboxBaseTurn, setSandboxBaseTurn] = useState<Side>('red');
  const [sandboxBaseEval, setSandboxBaseEval] = useState(0);
  const [sandboxMoves, setSandboxMoves] = useState<MoveRecord[]>([]);
  const [sandboxAnalysis, setSandboxAnalysis] = useState<PikafishAnalysis | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [lastOpponentMove, setLastOpponentMove] = useState<MoveExplanation | null>(null);
  const [playerFeedback, setPlayerFeedback] = useState<PlayerFeedback | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [showCheckToast, setShowCheckToast] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [evalBarMode, setEvalBarMode] = useState<'auto' | 'always' | 'hidden'>('auto');
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [pendingSide, setPendingSide] = useState<Side>('red');
  const [dismissedGameOver, setDismissedGameOver] = useState(false);
  const [resignedSide, setResignedSide] = useState<Side | null>(null);
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const activeAiReqRef = useRef<number | null>(null);
  const activeHintReqRef = useRef<number | null>(null);
  const activeReviewReqRef = useRef<number | null>(null);
  const activeSandboxReqRef = useRef<number | null>(null);
  const checkToastTimerRef = useRef<number | null>(null);
  const currentGameIdRef = useRef<string>(`game_${Date.now()}`);
  const savedGameIdsRef = useRef<Set<string>>(new Set());

  const halfMovesSinceCapture = useMemo(() => {
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].move.captured) break;
      count++;
    }
    return count;
  }, [history]);

  const gameStatus: GameStatus = useMemo(() => {
    if (resignedSide !== null) {
      return {
        state: 'resigned',
        winner: oppositeSide(resignedSide),
        resignedSide,
      };
    }
    return evaluateGameStatus(board, turn, halfMovesSinceCapture);
  }, [resignedSide, board, turn, halfMovesSinceCapture]);

  // Sync sound pack & preload real wooden WAV samples
  useEffect(() => {
    soundEngine.setPack(soundPack);
    if (soundPack !== 'off') {
      soundEngine.preload();
    }
  }, [soundPack]);

  // Detect native Pikafish NNUE engine availability on startup
  useEffect(() => {
    let mounted = true;
    checkPikafishStatus().then((ok) => {
      if (mounted) setPikafishReady(ok);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-save completed game to local archive (works for both Normal & Teaching modes)
  useEffect(() => {
    if (gameStatus.state === 'playing' || history.length === 0) return;
    const gid = currentGameIdRef.current;
    if (savedGameIdsRef.current.has(gid)) return;
    savedGameIdsRef.current.add(gid);

    const result: 'win' | 'loss' | 'draw' =
      gameStatus.state === 'draw'
        ? 'draw'
        : gameStatus.winner === playerSide
          ? 'win'
          : 'loss';

    const modeTag = playMode === 'pvp' ? '·双人' : playMode === 'online' ? '·联机' : '';
    const resultText =
      gameStatus.state === 'draw'
        ? `和棋${modeTag}`
        : gameStatus.state === 'resigned'
          ? `${gameStatus.winner === 'red' ? '红方胜' : '黑方胜'}（${gameStatus.resignedSide === 'red' ? '红认输' : '黑认输'}${modeTag}）`
          : `${gameStatus.winner === 'red' ? '红方胜' : '黑方胜'}${modeTag ? `（${modeTag.slice(1)}）` : ''}`;

    const saved = buildSavedGameFromHistory({
      id: gid,
      history,
      playerSide,
      difficulty,
      wasTeachingMode: teachingMode,
      result,
      resultText,
    });
    const updated = saveGameToArchive(saved);
    setSavedGames(updated);
  }, [gameStatus, history, playMode, playerSide, difficulty, teachingMode]);

  const triggerCheckToast = useCallback(() => {
    if (checkToastTimerRef.current) {
      window.clearTimeout(checkToastTimerRef.current);
    }
    setShowCheckToast(false);
    requestAnimationFrame(() => {
      setShowCheckToast(true);
      checkToastTimerRef.current = window.setTimeout(() => {
        setShowCheckToast(false);
      }, 1450);
    });
  }, []);

  const commitMove = useCallback(
    (move: Move, currentBoard: Board, currentTurn: Side, currentHistory: MoveRecord[]) => {
      const notation = moveToChineseNotation(currentBoard, move);
      const nextBoard = applyMove(currentBoard, move);
      const nextTurn = oppositeSide(currentTurn);
      const nextInCheck = isInCheck(nextBoard, nextTurn);
      const fenAfter = boardToFen(nextBoard, nextTurn, 0, Math.floor((currentHistory.length + 1) / 2) + 1);

      const record: MoveRecord = {
        move,
        notation,
        boardAfter: nextBoard,
        inCheck: nextInCheck,
        fenAfter,
      };

      const nextHistory = [...currentHistory, record];

      // Compute next status for sound effects
      let sinceCapture = 0;
      for (let i = nextHistory.length - 1; i >= 0; i--) {
        if (nextHistory[i].move.captured) break;
        sinceCapture++;
      }
      const nextStatus = evaluateGameStatus(nextBoard, nextTurn, sinceCapture);

      if (nextStatus.state === 'checkmate') {
        soundEngine.playCapture();
        soundEngine.playGameOver(nextStatus.winner === playerSide);
      } else if (nextInCheck) {
        if (move.captured) soundEngine.playCapture();
        else soundEngine.playMove();
        soundEngine.playCheck();
        triggerCheckToast();
      } else if (move.captured) {
        soundEngine.playCapture();
      } else {
        soundEngine.playMove();
      }

      setBoard(nextBoard);
      setTurn(nextTurn);
      setHistory(nextHistory);
      setSelectedPos(null);
      setHintMove(null);
      setHintPvLine([]);
      setHintDepth(0);
      setNnueEval(null);
      setViewStep(null);
    },
    [playerSide, triggerCheckToast]
  );

  // Keep latest commitMove & state accessible for worker callback
  const stateRef = useRef({ board, turn, history, commitMove });
  stateRef.current = { board, turn, history, commitMove };

  // Initialize Web Worker
  useEffect(() => {
    const worker = new Worker(new URL('./engine/aiWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<AIWorkerResponse>) => {
      const { id, kind, move, review } = e.data;
      if (kind === 'move') {
        if (id !== activeAiReqRef.current) return;
        activeAiReqRef.current = null;
        setAiThinking(false);
        if (move) {
          const { board: b, turn: t, history: h, commitMove: commit } = stateRef.current;
          setLastOpponentMove(explainMove(b, move, h.length));
          commit(move, b, t, h);
        }
      } else if (kind === 'hint') {
        if (id !== activeHintReqRef.current) return;
        activeHintReqRef.current = null;
        setHintLoading(false);
        setHintMove(move);
      } else if (kind === 'review') {
        if (id !== activeReviewReqRef.current) return;
        activeReviewReqRef.current = null;
        setEngineReviewLoading(false);
        setEngineReview(review ?? null);
      }
    };
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const academyActive = teachingMode && !reviewMode && teachingTab !== 'coach';

  const currentLesson = useMemo(
    () => MICRO_LESSONS.find((l) => l.id === lessonId) ?? MICRO_LESSONS[0],
    [lessonId]
  );
  const currentLessonStep = currentLesson.steps[lessonStepIdx] ?? currentLesson.steps[0];

  const currentPuzzle = useMemo(
    () => TACTIC_PUZZLES.find((p) => p.id === puzzleId) ?? TACTIC_PUZZLES[0],
    [puzzleId]
  );
  const currentPuzzleStep = currentPuzzle.steps[puzzleStepIdx] ?? currentPuzzle.steps[0];

  const currentManual = useMemo(
    () => INTERACTIVE_MANUALS.find((m) => m.id === manualId) ?? INTERACTIVE_MANUALS[0],
    [manualId]
  );

  const manualTimeline = useMemo(() => {
    const boards: Board[] = [createInitialBoard()];
    const moves: Move[] = [];
    const notations: string[] = [];
    let b = boards[0];
    for (const mm of currentManual.moves) {
      const piece = b[mm.from.r]?.[mm.from.c];
      if (!piece) break;
      const move: Move = {
        from: mm.from,
        to: mm.to,
        piece,
        captured: b[mm.to.r]?.[mm.to.c] ?? null,
      };
      notations.push(moveToChineseNotation(b, move));
      moves.push(move);
      b = applyMove(b, move);
      boards.push(b);
    }
    return { boards, moves, notations };
  }, [currentManual]);

  const markAcademyComplete = useCallback(
    (kind: 'lesson' | 'puzzle' | 'manual', id: string) => {
      setAcademyProgress((prev) => {
        const next: AcademyProgress = {
          completedLessons:
            kind === 'lesson' && !prev.completedLessons.includes(id)
              ? [...prev.completedLessons, id]
              : prev.completedLessons,
          completedPuzzles:
            kind === 'puzzle' && !prev.completedPuzzles.includes(id)
              ? [...prev.completedPuzzles, id]
              : prev.completedPuzzles,
          completedManuals:
            kind === 'manual' && !prev.completedManuals.includes(id)
              ? [...prev.completedManuals, id]
              : prev.completedManuals,
        };
        saveAcademyProgress(next);
        return next;
      });
    },
    []
  );

  const clearAcademyTimer = useCallback(() => {
    if (academyTimerRef.current) {
      window.clearTimeout(academyTimerRef.current);
      academyTimerRef.current = null;
    }
  }, []);

  const loadLessonStep = useCallback(
    (targetLessonId: string, stepIndex: number) => {
      clearAcademyTimer();
      const lesson = MICRO_LESSONS.find((l) => l.id === targetLessonId) ?? MICRO_LESSONS[0];
      const step = lesson.steps[stepIndex] ?? lesson.steps[0];
      setLessonId(lesson.id);
      setLessonStepIdx(stepIndex);
      setLessonBoard(getInitialLessonBoard(step));
      setLessonLastMove(null);
      setLessonStepDone(false);
      setLessonFeedback(null);
      setSelectedPos(null);
    },
    [clearAcademyTimer]
  );

  const handleDemoLessonStep = useCallback(() => {
    const em = currentLessonStep.expectedMoves[0];
    if (!em) return;
    const piece = lessonBoard[em.from.r]?.[em.from.c];
    if (!piece) return;
    const move: Move = {
      from: em.from,
      to: em.to,
      piece,
      captured: lessonBoard[em.to.r]?.[em.to.c] ?? null,
    };
    const nextB = applyMove(lessonBoard, move);
    if (move.captured) soundEngine.playCapture();
    else soundEngine.playMove();
    setLessonBoard(nextB);
    setLessonLastMove(move);
    setLessonStepDone(true);
    setLessonFeedback({ tone: 'success', text: currentLessonStep.successTip });
    if (lessonStepIdx >= currentLesson.steps.length - 1) {
      markAcademyComplete('lesson', currentLesson.id);
    }
  }, [currentLessonStep, lessonBoard, lessonStepIdx, currentLesson, markAcademyComplete]);

  const handleNextLessonStep = useCallback(() => {
    if (lessonStepIdx < currentLesson.steps.length - 1) {
      loadLessonStep(currentLesson.id, lessonStepIdx + 1);
      return;
    }
    const idx = MICRO_LESSONS.findIndex((l) => l.id === currentLesson.id);
    if (idx < MICRO_LESSONS.length - 1) {
      loadLessonStep(MICRO_LESSONS[idx + 1].id, 0);
    } else {
      setTeachingTab('puzzles');
      setSelectedPos(null);
    }
  }, [lessonStepIdx, currentLesson, loadLessonStep]);

  const loadPuzzle = useCallback(
    (targetPuzzleId: string) => {
      clearAcademyTimer();
      const pz = TACTIC_PUZZLES.find((p) => p.id === targetPuzzleId) ?? TACTIC_PUZZLES[0];
      setPuzzleId(pz.id);
      setPuzzleStepIdx(0);
      setPuzzleBoard(createBoardFromPieces(pz.pieces));
      setPuzzleLastMove(null);
      setPuzzleSolved(false);
      setPuzzleShowHint(false);
      setPuzzleBusy(false);
      setPuzzleFeedback(null);
      setSelectedPos(null);
    },
    [clearAcademyTimer]
  );

  const handleNextPuzzle = useCallback(() => {
    const idx = TACTIC_PUZZLES.findIndex((p) => p.id === currentPuzzle.id);
    if (idx < TACTIC_PUZZLES.length - 1) {
      loadPuzzle(TACTIC_PUZZLES[idx + 1].id);
    } else {
      setTeachingTab('manuals');
      setSelectedPos(null);
    }
  }, [currentPuzzle.id, loadPuzzle]);

  const handleSelectManual = useCallback(
    (targetManualId: string) => {
      clearAcademyTimer();
      setManualId(targetManualId);
      setManualStepIdx(0);
      setManualQuizFeedback(null);
      setManualShowHint(false);
      setSelectedPos(null);
    },
    [clearAcademyTimer]
  );

  const handleManualStepChange = useCallback(
    (nextStep: number) => {
      clearAcademyTimer();
      const clamped = Math.max(0, Math.min(manualTimeline.moves.length, nextStep));
      if (clamped > manualStepIdx && manualTimeline.moves[clamped - 1]) {
        const mv = manualTimeline.moves[clamped - 1];
        if (mv.captured) soundEngine.playCapture();
        else soundEngine.playMove();
      }
      setManualStepIdx(clamped);
      setManualQuizFeedback(null);
      setManualShowHint(false);
      setSelectedPos(null);
      if (clamped >= manualTimeline.moves.length) {
        markAcademyComplete('manual', currentManual.id);
      }
    },
    [clearAcademyTimer, manualTimeline.moves, manualStepIdx, markAcademyComplete, currentManual.id]
  );

  // Trigger AI move when it's AI's turn and we're in live AI playing state
  useEffect(() => {
    const aiSide = oppositeSide(playerSide);
    if (playMode !== 'ai' || reviewMode || academyActive || gameStatus.state !== 'playing') {
      setAiThinking(false);
      return;
    }
    if (turn !== aiSide) return;
    if (viewStep !== null) return;

    setAiThinking(true);
    const id = ++reqIdRef.current;
    activeAiReqRef.current = id;
    const controller = new AbortController();

    // Tiny natural delay so player's move registers visually first
    const timer = window.setTimeout(async () => {
      if (activeAiReqRef.current !== id) return;

      if (pikafishReady) {
        const res = await analyzeWithPikafish(
          board,
          aiSide,
          difficultyToPikafishOpts(difficulty),
          controller.signal
        );
        if (activeAiReqRef.current !== id) return;
        if (res?.bestMove) {
          activeAiReqRef.current = null;
          setAiThinking(false);
          const { board: b, turn: t, history: h, commitMove: commit } = stateRef.current;
          setLastOpponentMove(explainMove(b, res.bestMove, h.length));
          commit(res.bestMove, b, t, h);
          setNnueEval(res.scoreCp);
          return;
        }
      }

      const worker = workerRef.current;
      if (!worker || activeAiReqRef.current !== id) return;
      const req: AIWorkerRequest = {
        id,
        kind: 'move',
        board,
        side: aiSide,
        difficulty,
        moveCount: history.length,
      };
      worker.postMessage(req);
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [playMode, reviewMode, academyActive, pikafishReady, board, turn, playerSide, difficulty, gameStatus.state, history.length, viewStep]);

  // Teaching Mode: automatically compute and show hint on the board whenever it's a human's turn
  const activeHumanSide: Side | null =
    gameStatus.state !== 'playing'
      ? null
      : playMode === 'pvp'
        ? turn
        : playMode === 'online'
          ? onlineSession && onlineSession.side !== 'spectator' && turn === onlineSession.side
            ? onlineSession.side
            : null
          : turn === playerSide
            ? playerSide
            : null;

  useEffect(() => {
    if (!teachingMode || reviewMode || academyActive) {
      return;
    }
    if (!activeHumanSide || viewStep !== null) {
      return;
    }

    setHintLoading(true);
    setHintMove(null);
    setHintPvLine([]);
    setHintDepth(0);
    const id = ++reqIdRef.current;
    activeHintReqRef.current = id;
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      if (activeHintReqRef.current !== id) return;

      if (pikafishReady) {
        const res = await analyzeWithPikafish(
          board,
          activeHumanSide,
          { skillLevel: 20, movetime: 550, maxPvPlies: 6 },
          controller.signal
        );
        if (activeHintReqRef.current !== id) return;
        if (res?.bestMove) {
          activeHintReqRef.current = null;
          setHintLoading(false);
          setHintMove(res.bestMove);
          setHintPvLine(res.futureLine);
          setHintDepth(res.depth);
          setNnueEval(res.scoreCp);
          return;
        }
      }

      const worker = workerRef.current;
      if (!worker || activeHintReqRef.current !== id) return;
      const req: AIWorkerRequest = {
        id,
        kind: 'hint',
        board,
        side: activeHumanSide,
        difficulty: 'master',
        moveCount: history.length,
      };
      worker.postMessage(req);
    }, 100);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [teachingMode, reviewMode, academyActive, pikafishReady, board, activeHumanSide, history.length, viewStep]);

  // Review Mode: build list of reviewable games (saved completed games + optional current in-progress game)
  const reviewGamesList = useMemo(() => {
    const list = [...savedGames];
    if (history.length > 0 && gameStatus.state === 'playing') {
      const liveSnapshot = buildSavedGameFromHistory({
        id: '__live__',
        history,
        playerSide,
        difficulty,
        wasTeachingMode: teachingMode,
        result: 'draw',
        resultText: '进行中',
      });
      list.unshift(liveSnapshot);
    }
    return list;
  }, [savedGames, history, gameStatus.state, playerSide, difficulty, teachingMode]);

  const activeReviewGame = useMemo(() => {
    if (!reviewMode || reviewGamesList.length === 0) return null;
    return (
      reviewGamesList.find((g) => g.id === selectedReviewGameId) ?? reviewGamesList[0]
    );
  }, [reviewMode, reviewGamesList, selectedReviewGameId]);

  const reviewSteps = useMemo(
    () => (activeReviewGame ? reconstructGameSteps(activeReviewGame) : []),
    [activeReviewGame]
  );

  // Auto-playback timer in Review Mode
  useEffect(() => {
    if (!reviewMode || !reviewPlaying) return;
    if (reviewStep >= reviewSteps.length) {
      setReviewPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setReviewStep((s) => {
        const next = Math.min(reviewSteps.length, s + 1);
        const stepObj = reviewSteps[next - 1];
        if (stepObj) {
          if (stepObj.inCheck) soundEngine.playCheck();
          else if (stepObj.move.captured) soundEngine.playCapture();
          else soundEngine.playMove();
        }
        return next;
      });
    }, 1150);
    return () => window.clearTimeout(timer);
  }, [reviewMode, reviewPlaying, reviewStep, reviewSteps]);

  // Compute engine better move + future variation when inspecting a step in Review Mode
  useEffect(() => {
    if (!reviewMode || reviewPlaying || reviewStep <= 0 || !reviewSteps[reviewStep - 1]) {
      activeReviewReqRef.current = null;
      setEngineReviewLoading(false);
      setEngineReview(null);
      return;
    }

    const stepInfo = reviewSteps[reviewStep - 1];
    const moverSide: Side = (reviewStep - 1) % 2 === 0 ? 'red' : 'black';
    setEngineReviewLoading(true);
    setEngineReview(null);
    const id = ++reqIdRef.current;
    activeReviewReqRef.current = id;
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      if (activeReviewReqRef.current !== id) return;

      if (pikafishReady) {
        const res = await analyzeWithPikafish(
          stepInfo.boardBefore,
          moverSide,
          { skillLevel: 20, movetime: 650, maxPvPlies: 6 },
          controller.signal
        );
        if (activeReviewReqRef.current !== id) return;
        if (res?.bestMove) {
          activeReviewReqRef.current = null;
          setEngineReviewLoading(false);
          setEngineReview(pikafishToReviewResult(res));
          return;
        }
      }

      const worker = workerRef.current;
      if (!worker || activeReviewReqRef.current !== id) return;
      const req: AIWorkerRequest = {
        id,
        kind: 'review',
        board: stepInfo.boardBefore,
        side: moverSide,
        difficulty: 'intermediate',
        moveCount: reviewStep - 1,
      };
      worker.postMessage(req);
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [reviewMode, reviewPlaying, reviewStep, reviewSteps, pikafishReady]);

  const coachRecommendation = useMemo(() => {
    if (!teachingMode || !hintMove || !activeHumanSide || viewStep !== null) {
      return null;
    }
    return explainMove(board, hintMove, history.length);
  }, [teachingMode, hintMove, activeHumanSide, viewStep, board, history.length]);

  // Displayed board & metadata (supports sandbox variation branching, live play, quick replay preview, and dedicated Review Mode)
  const isReplaying = !reviewMode && !sandboxActive && viewStep !== null;

  const sandboxBoard = useMemo(() => {
    if (!sandboxActive) return sandboxBaseBoard;
    return sandboxMoves.length > 0
      ? sandboxMoves[sandboxMoves.length - 1].boardAfter
      : sandboxBaseBoard;
  }, [sandboxActive, sandboxMoves, sandboxBaseBoard]);

  const sandboxTurn: Side = useMemo(() => {
    return sandboxMoves.length % 2 === 0 ? sandboxBaseTurn : oppositeSide(sandboxBaseTurn);
  }, [sandboxMoves.length, sandboxBaseTurn]);

  // Keep sandbox pure by default: clear stale engine verification whenever sandbox moves change
  useEffect(() => {
    activeSandboxReqRef.current = null;
    setSandboxLoading(false);
    setSandboxAnalysis(null);
  }, [sandboxActive, sandboxMoves.length]);

  // On-demand engine verification (only available in Teaching Mode or Review Mode)
  const handleVerifySandbox = useCallback(async () => {
    if (!sandboxActive || sandboxMoves.length === 0 || (!teachingMode && !reviewMode)) {
      return;
    }
    setSandboxLoading(true);
    setSandboxAnalysis(null);
    const id = ++reqIdRef.current;
    activeSandboxReqRef.current = id;

    if (pikafishReady) {
      const res = await analyzeWithPikafish(sandboxBoard, sandboxTurn, {
        skillLevel: 20,
        movetime: 550,
        maxPvPlies: 6,
      });
      if (activeSandboxReqRef.current !== id) return;
      if (res) {
        activeSandboxReqRef.current = null;
        setSandboxLoading(false);
        setSandboxAnalysis(res);
        return;
      }
    }

    const localRes = analyzePositionForReview(sandboxBoard, sandboxTurn, sandboxMoves.length);
    if (activeSandboxReqRef.current !== id) return;
    activeSandboxReqRef.current = null;
    setSandboxLoading(false);
    setSandboxAnalysis({
      bestMove: localRes.bestMove,
      bestNotation: localRes.bestNotation,
      futureLine: localRes.futureLine,
      scoreCp: localRes.evalAfterBest,
      mate: null,
      depth: 4,
      engine: 'pikafish',
    });
  }, [sandboxActive, sandboxMoves.length, teachingMode, reviewMode, pikafishReady, sandboxBoard, sandboxTurn]);

  const academyInteractiveSide: Side | null = useMemo(() => {
    if (!academyActive) return null;
    if (teachingTab === 'lessons') {
      return currentLessonStep.kind === 'practice' && !lessonStepDone ? 'red' : null;
    }
    if (teachingTab === 'puzzles') {
      return !puzzleSolved && !puzzleBusy ? 'red' : null;
    }
    if (teachingTab === 'manuals') {
      const nextMm = currentManual.moves[manualStepIdx];
      return manualQuizMode && nextMm?.isQuiz ? 'red' : null;
    }
    return null;
  }, [
    academyActive,
    teachingTab,
    currentLessonStep.kind,
    lessonStepDone,
    puzzleSolved,
    puzzleBusy,
    currentManual.moves,
    manualStepIdx,
    manualQuizMode,
  ]);

  const displayedBoard = useMemo(() => {
    if (academyActive) {
      if (teachingTab === 'lessons') return lessonBoard;
      if (teachingTab === 'puzzles') return puzzleBoard;
      return manualTimeline.boards[manualStepIdx] ?? createInitialBoard();
    }
    if (sandboxActive) return sandboxBoard;
    if (reviewMode) {
      if (reviewStep === 0) return createInitialBoard();
      return reviewSteps[reviewStep - 1]?.boardAfter ?? createInitialBoard();
    }
    if (viewStep === null) return board;
    if (viewStep === 0) return createInitialBoard();
    return history[viewStep - 1]?.boardAfter ?? board;
  }, [
    academyActive,
    teachingTab,
    lessonBoard,
    puzzleBoard,
    manualTimeline.boards,
    manualStepIdx,
    sandboxActive,
    sandboxBoard,
    reviewMode,
    reviewStep,
    reviewSteps,
    viewStep,
    board,
    history,
  ]);

  const staticEvalScore = useMemo(() => evaluateRedAdvantage(displayedBoard), [displayedBoard]);
  const evalScore = sandboxActive
    ? sandboxAnalysis
      ? sandboxAnalysis.scoreCp
      : sandboxBaseEval
    : !reviewMode && !isReplaying && nnueEval !== null
      ? nnueEval
      : staticEvalScore;
  const captured = useMemo(() => getCapturedPieces(displayedBoard), [displayedBoard]);

  const displayedLastMove = useMemo(() => {
    if (academyActive) {
      if (teachingTab === 'lessons') return lessonLastMove;
      if (teachingTab === 'puzzles') return puzzleLastMove;
      return manualStepIdx > 0 ? manualTimeline.moves[manualStepIdx - 1] ?? null : null;
    }
    if (sandboxActive) {
      return sandboxMoves.length > 0 ? sandboxMoves[sandboxMoves.length - 1].move : null;
    }
    if (reviewMode) {
      if (reviewStep === 0) return null;
      return reviewSteps[reviewStep - 1]?.move ?? null;
    }
    if (viewStep === null) {
      return history.length > 0 ? history[history.length - 1].move : null;
    }
    if (viewStep === 0) return null;
    return history[viewStep - 1]?.move ?? null;
  }, [
    academyActive,
    teachingTab,
    lessonLastMove,
    puzzleLastMove,
    manualStepIdx,
    manualTimeline.moves,
    sandboxActive,
    sandboxMoves,
    reviewMode,
    reviewStep,
    reviewSteps,
    viewStep,
    history,
  ]);

  // In Sandbox Mode: show engine's strongest counter-move arrow.
  // In Review Mode: show green arrow for engine's better move when it differs from played move.
  const displayedHintMove = useMemo(() => {
    if (academyActive) {
      if (teachingTab === 'puzzles' && puzzleShowHint && !puzzleSolved) {
        const em = currentPuzzleStep.playerMoves[0];
        const p = em ? puzzleBoard[em.from.r]?.[em.from.c] : null;
        if (em && p) {
          return { from: em.from, to: em.to, piece: p, captured: puzzleBoard[em.to.r]?.[em.to.c] ?? null };
        }
      }
      if (teachingTab === 'manuals' && manualQuizMode && manualShowHint) {
        return manualTimeline.moves[manualStepIdx] ?? null;
      }
      return null;
    }
    if (sandboxActive) {
      return sandboxAnalysis?.bestMove ?? null;
    }
    if (reviewMode) {
      if (!engineReview?.bestMove || reviewStep <= 0) return null;
      const played = reviewSteps[reviewStep - 1]?.move;
      const best = engineReview.bestMove;
      if (
        played &&
        played.from.r === best.from.r &&
        played.from.c === best.from.c &&
        played.to.r === best.to.r &&
        played.to.c === best.to.c
      ) {
        return null;
      }
      return best;
    }
    return isReplaying ? null : hintMove;
  }, [
    academyActive,
    teachingTab,
    puzzleShowHint,
    puzzleSolved,
    currentPuzzleStep,
    puzzleBoard,
    manualQuizMode,
    manualShowHint,
    manualTimeline.moves,
    manualStepIdx,
    sandboxActive,
    sandboxAnalysis,
    reviewMode,
    engineReview,
    reviewStep,
    reviewSteps,
    isReplaying,
    hintMove,
  ]);

  const legalTargets = useMemo(() => {
    if (academyActive) {
      if (!selectedPos || !academyInteractiveSide) return [];
      return getLegalMovesForSquare(displayedBoard, selectedPos.r, selectedPos.c);
    }
    if (sandboxActive) {
      if (!selectedPos) return [];
      return getLegalMovesForSquare(sandboxBoard, selectedPos.r, selectedPos.c);
    }
    if (reviewMode || isReplaying || !selectedPos || !activeHumanSide) {
      return [];
    }
    return getLegalMovesForSquare(board, selectedPos.r, selectedPos.c);
  }, [
    academyActive,
    academyInteractiveSide,
    displayedBoard,
    sandboxActive,
    sandboxBoard,
    reviewMode,
    board,
    selectedPos,
    isReplaying,
    activeHumanSide,
  ]);

  const checkedKingPos = useMemo(() => {
    if (academyActive) {
      if (teachingTab === 'puzzles' && isInCheck(puzzleBoard, 'black')) {
        return findGeneral(puzzleBoard, 'black');
      }
      return null;
    }
    if (sandboxActive) {
      if (isInCheck(sandboxBoard, sandboxTurn)) {
        return findGeneral(sandboxBoard, sandboxTurn);
      }
      return null;
    }
    if (reviewMode) {
      if (reviewStep > 0 && reviewSteps[reviewStep - 1]?.inCheck) {
        const checkedSide = oppositeSide(reviewSteps[reviewStep - 1].move.piece.side);
        return findGeneral(displayedBoard, checkedSide);
      }
      return null;
    }
    if (isReplaying) {
      if (viewStep && viewStep > 0 && history[viewStep - 1]?.inCheck) {
        const checkedSide = oppositeSide(history[viewStep - 1].move.piece.side);
        return findGeneral(displayedBoard, checkedSide);
      }
      return null;
    }
    if (gameStatus.state === 'playing' && gameStatus.inCheck) {
      return findGeneral(board, turn);
    }
    if (gameStatus.state === 'checkmate') {
      return findGeneral(board, oppositeSide(gameStatus.winner));
    }
    return null;
  }, [
    academyActive,
    teachingTab,
    puzzleBoard,
    sandboxActive,
    sandboxBoard,
    sandboxTurn,
    reviewMode,
    reviewStep,
    reviewSteps,
    isReplaying,
    viewStep,
    history,
    displayedBoard,
    gameStatus,
    board,
    turn,
  ]);

  const enterSandbox = useCallback(() => {
    setSelectedPos(null);
    setReviewPlaying(false);
    const baseB = reviewMode
      ? reviewStep === 0
        ? createInitialBoard()
        : reviewSteps[reviewStep - 1]?.boardAfter ?? createInitialBoard()
      : viewStep === null
        ? board
        : viewStep === 0
          ? createInitialBoard()
          : history[viewStep - 1]?.boardAfter ?? board;
    const baseT: Side = reviewMode
      ? reviewStep % 2 === 0
        ? 'red'
        : 'black'
      : viewStep === null
        ? turn
        : viewStep % 2 === 0
          ? 'red'
          : 'black';
    setSandboxBaseBoard(baseB);
    setSandboxBaseTurn(baseT);
    setSandboxBaseEval(evalScore);
    setSandboxMoves([]);
    setSandboxAnalysis(null);
    setSandboxActive(true);
  }, [reviewMode, reviewStep, reviewSteps, viewStep, board, history, turn, evalScore]);

  const exitSandbox = useCallback(() => {
    activeSandboxReqRef.current = null;
    setSandboxActive(false);
    setSandboxMoves([]);
    setSandboxAnalysis(null);
    setSandboxLoading(false);
    setSelectedPos(null);
  }, []);

  const handleToggleSandbox = useCallback(() => {
    if (sandboxActive) exitSandbox();
    else enterSandbox();
  }, [sandboxActive, exitSandbox, enterSandbox]);

  const handleUndoSandboxMove = useCallback(() => {
    setSelectedPos(null);
    setSandboxMoves((prev) => prev.slice(0, -1));
  }, []);

  // Apply authoritative room state pushed via SSE from server/roomBridge.ts
  const syncBoardFromOnlineState = useCallback(
    (roomState: OnlineRoomState, mySide: Side | 'spectator') => {
      setOnlineSession((prev) => (prev ? { ...prev, state: roomState } : prev));
      if (roomState.version === onlineAppliedVersionRef.current) {
        return;
      }
      onlineAppliedVersionRef.current = roomState.version;

      let b = createInitialBoard();
      const recs: MoveRecord[] = [];
      let curTurn: Side = 'red';

      for (const sm of roomState.moves) {
        const piece = b[sm.from.r]?.[sm.from.c];
        if (!piece) break;
        const move: Move = {
          from: sm.from,
          to: sm.to,
          piece,
          captured: b[sm.to.r]?.[sm.to.c] ?? null,
        };
        const notation = moveToChineseNotation(b, move);
        const nextB = applyMove(b, move);
        const nextT = oppositeSide(curTurn);
        const inChk = isInCheck(nextB, nextT);
        recs.push({
          move,
          notation,
          boardAfter: nextB,
          inCheck: inChk,
          fenAfter: boardToFen(nextB, nextT, 0, Math.floor((recs.length + 1) / 2) + 1),
        });
        b = nextB;
        curTurn = nextT;
      }

      const prevLen = onlineMoveLenRef.current;
      onlineMoveLenRef.current = recs.length;

      // Play sound when a new move arrives
      if (recs.length > prevLen && recs.length > 0) {
        const lastRec = recs[recs.length - 1];
        const nextStatus = evaluateGameStatus(b, curTurn, 0);
        if (nextStatus.state === 'checkmate') {
          soundEngine.playCapture();
          soundEngine.playGameOver(mySide !== 'spectator' && nextStatus.winner === mySide);
        } else if (lastRec.inCheck) {
          if (lastRec.move.captured) soundEngine.playCapture();
          else soundEngine.playMove();
          soundEngine.playCheck();
          triggerCheckToast();
        } else if (lastRec.move.captured) {
          soundEngine.playCapture();
        } else {
          soundEngine.playMove();
        }
      }

      if (recs.length === 0) {
        currentGameIdRef.current = `game_${Date.now()}`;
        setDismissedGameOver(false);
        setResignedSide(null);
        setShowResignConfirm(false);
      }

      setBoard(b);
      setTurn(curTurn);
      setHistory(recs);
      setSelectedPos(null);
      setHintMove(null);
      setViewStep(null);
    },
    [triggerCheckToast]
  );

  // Subscribe to SSE stream while inside an online room
  useEffect(() => {
    if (playMode !== 'online' || !onlineSession) return;
    const unsubscribe = subscribeOnlineRoom(
      onlineSession.code,
      onlineSession.token,
      (nextState) => syncBoardFromOnlineState(nextState, onlineSession.side)
    );
    return unsubscribe;
  }, [playMode, onlineSession?.code, onlineSession?.token, onlineSession?.side, syncBoardFromOnlineState]);

  const handleCreateOnlineRoom = useCallback(async () => {
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const session = await createOnlineRoom('red');
      try {
        sessionStorage.setItem(`xiangqi_room_token_${session.code}`, session.token);
      } catch {
        // ignore storage errors
      }
      onlineAppliedVersionRef.current = 0;
      onlineMoveLenRef.current = 0;
      setOnlineSession(session);
      setPlayerSide('red');
      setFlipped(false);
      syncBoardFromOnlineState(session.state, session.side);
      window.history.replaceState({}, '', `/?room=${session.code}`);
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : '创建房间失败');
    } finally {
      setOnlineBusy(false);
    }
  }, [syncBoardFromOnlineState]);

  const handleJoinOnlineRoom = useCallback(
    async (code: string) => {
      const cleaned = code.trim();
      if (!cleaned) return;
      setOnlineBusy(true);
      setOnlineError(null);
      try {
        let savedToken: string | undefined;
        try {
          savedToken = sessionStorage.getItem(`xiangqi_room_token_${cleaned}`) ?? undefined;
        } catch {
          // ignore
        }
        const session = await joinOnlineRoom(cleaned, savedToken);
        try {
          sessionStorage.setItem(`xiangqi_room_token_${session.code}`, session.token);
        } catch {
          // ignore
        }
        onlineAppliedVersionRef.current = 0;
        onlineMoveLenRef.current = session.state.moves.length;
        setPlayMode('online');
        setOnlineSession(session);
        if (session.side === 'black') {
          setPlayerSide('black');
          setFlipped(true);
        } else if (session.side === 'red') {
          setPlayerSide('red');
          setFlipped(false);
        }
        syncBoardFromOnlineState(session.state, session.side);
        window.history.replaceState({}, '', `/?room=${session.code}`);
      } catch (err) {
        setOnlineError(err instanceof Error ? err.message : '加入房间失败');
      } finally {
        setOnlineBusy(false);
      }
    },
    [syncBoardFromOnlineState]
  );

  const handleLeaveOnlineRoom = useCallback(() => {
    setOnlineSession(null);
    setOnlineError(null);
    onlineAppliedVersionRef.current = 0;
    onlineMoveLenRef.current = 0;
    window.history.replaceState({}, '', '/');
  }, []);

  // Auto-join if URL contains ?room=XXXX
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoinedRef.current) return;
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (roomParam) {
      autoJoinedRef.current = true;
      handleJoinOnlineRoom(roomParam);
    }
  }, [handleJoinOnlineRoom]);

  const playPlayerMove = useCallback(
    (targetMove: Move) => {
      if (playMode === 'online' && onlineSession) {
        sendOnlineMove(onlineSession.code, onlineSession.token, {
          from: targetMove.from,
          to: targetMove.to,
        }).catch((err) => {
          setOnlineError(err instanceof Error ? err.message : '落子同步失败');
        });
        return;
      }
      if (teachingMode) {
        const sign = playerSide === 'red' ? 1 : -1;
        const evalBefore = evaluateRedAdvantage(board) * sign;
        const evalAfter = evaluateRedAdvantage(applyMove(board, targetMove)) * sign;
        const evalRec = hintMove ? evaluateRedAdvantage(applyMove(board, hintMove)) * sign : null;
        const recNotation = coachRecommendation?.notation ?? null;
        setPlayerFeedback(
          evaluatePlayerMoveFeedback(
            targetMove,
            hintMove,
            evalBefore,
            evalAfter,
            evalRec,
            recNotation
          )
        );
      }
      commitMove(targetMove, board, turn, history);
    },
    [playMode, onlineSession, teachingMode, playerSide, board, hintMove, coachRecommendation, commitMove, turn, history]
  );

  const handleCommitSandboxMove = useCallback(() => {
    if (
      reviewMode ||
      !sandboxActive ||
      sandboxMoves.length === 0 ||
      !activeHumanSide ||
      sandboxBaseTurn !== activeHumanSide
    ) {
      return;
    }
    const firstMove = sandboxMoves[0].move;
    exitSandbox();
    playPlayerMove(firstMove);
  }, [reviewMode, sandboxActive, sandboxMoves, activeHumanSide, sandboxBaseTurn, exitSandbox, playPlayerMove]);

  const handleSquareClick = (r: number, c: number) => {
    // Academy (基础微课 / 杀法闯关 / 互动棋谱自测) interaction
    if (academyActive) {
      if (!academyInteractiveSide) return;
      const clickedPiece = displayedBoard[r][c];
      if (selectedPos) {
        const targetMove = legalTargets.find((m) => m.to.r === r && m.to.c === c);
        if (targetMove) {
          // 1. Micro-Lesson practice
          if (teachingTab === 'lessons') {
            const matched = currentLessonStep.expectedMoves.some(
              (em) =>
                em.from.r === targetMove.from.r &&
                em.from.c === targetMove.from.c &&
                em.to.r === targetMove.to.r &&
                em.to.c === targetMove.to.c
            );
            if (matched) {
              const nextB = applyMove(lessonBoard, targetMove);
              if (targetMove.captured) soundEngine.playCapture();
              else soundEngine.playMove();
              setLessonBoard(nextB);
              setLessonLastMove(targetMove);
              setLessonStepDone(true);
              setLessonFeedback({ tone: 'success', text: currentLessonStep.successTip });
              if (lessonStepIdx >= currentLesson.steps.length - 1) {
                markAcademyComplete('lesson', currentLesson.id);
              }
            } else {
              soundEngine.playSelect();
              setLessonFeedback({ tone: 'warn', text: currentLessonStep.wrongHint });
            }
            setSelectedPos(null);
            return;
          }

          // 2. Tactic Puzzle
          if (teachingTab === 'puzzles') {
            const nextB = applyMove(puzzleBoard, targetMove);
            const statusAfter = evaluateGameStatus(nextB, 'black', 0);
            const matchedStep = currentPuzzleStep.playerMoves.some(
              (pm) =>
                pm.from.r === targetMove.from.r &&
                pm.from.c === targetMove.from.c &&
                pm.to.r === targetMove.to.r &&
                pm.to.c === targetMove.to.c
            );
            const isDirectMate = statusAfter.state === 'checkmate' && statusAfter.winner === 'red';

            if (matchedStep || isDirectMate) {
              if (targetMove.captured) soundEngine.playCapture();
              else soundEngine.playMove();
              setPuzzleBoard(nextB);
              setPuzzleLastMove(targetMove);
              setSelectedPos(null);

              const isFinal = isDirectMate || puzzleStepIdx >= currentPuzzle.steps.length - 1;
              if (isFinal) {
                soundEngine.playGameOver(true);
                setPuzzleSolved(true);
                setPuzzleShowHint(false);
                setPuzzleFeedback({ tone: 'success', text: '绝杀通关！漂亮！' });
                markAcademyComplete('puzzle', currentPuzzle.id);
              } else if (currentPuzzleStep.opponentReply) {
                soundEngine.playCheck();
                setPuzzleBusy(true);
                setPuzzleShowHint(false);
                setPuzzleFeedback({ tone: 'info', text: '好棋将军！看黑方被迫应招…' });
                const reply = currentPuzzleStep.opponentReply;
                clearAcademyTimer();
                academyTimerRef.current = window.setTimeout(() => {
                  const repPiece = nextB[reply.from.r]?.[reply.from.c];
                  if (repPiece) {
                    const repMove: Move = {
                      from: reply.from,
                      to: reply.to,
                      piece: repPiece,
                      captured: nextB[reply.to.r]?.[reply.to.c] ?? null,
                    };
                    const afterReply = applyMove(nextB, repMove);
                    if (repMove.captured) soundEngine.playCapture();
                    else soundEngine.playMove();
                    setPuzzleBoard(afterReply);
                    setPuzzleLastMove(repMove);
                  }
                  setPuzzleStepIdx((idx) => idx + 1);
                  setPuzzleBusy(false);
                  setPuzzleFeedback({ tone: 'info', text: '黑方应招完毕，请走下一步绝杀！' });
                }, 480);
              }
            } else {
              soundEngine.playSelect();
              setPuzzleFeedback({
                tone: 'warn',
                text: '这步还杀不死黑将，换个思路再试试！（可点下方「看提示」）',
              });
              setSelectedPos(null);
            }
            return;
          }

          // 3. Interactive Manual Quiz
          if (teachingTab === 'manuals') {
            const expected = currentManual.moves[manualStepIdx];
            if (
              expected &&
              expected.from.r === targetMove.from.r &&
              expected.from.c === targetMove.from.c &&
              expected.to.r === targetMove.to.r &&
              expected.to.c === targetMove.to.c
            ) {
              if (targetMove.captured) soundEngine.playCapture();
              else soundEngine.playMove();
              const nextIdx = manualStepIdx + 1;
              setManualStepIdx(nextIdx);
              setManualShowHint(false);
              setManualQuizFeedback({
                tone: 'success',
                text: `走对了！正是「${manualTimeline.notations[manualStepIdx] ?? ''}」`,
              });
              setSelectedPos(null);

              if (nextIdx >= currentManual.moves.length) {
                markAcademyComplete('manual', currentManual.id);
              } else if (!currentManual.moves[nextIdx].isQuiz) {
                clearAcademyTimer();
                academyTimerRef.current = window.setTimeout(() => {
                  const autoMv = manualTimeline.moves[nextIdx];
                  if (autoMv) {
                    if (autoMv.captured) soundEngine.playCapture();
                    else soundEngine.playMove();
                  }
                  const afterAuto = nextIdx + 1;
                  setManualStepIdx(afterAuto);
                  setManualQuizFeedback(null);
                  if (afterAuto >= currentManual.moves.length) {
                    markAcademyComplete('manual', currentManual.id);
                  }
                }, 600);
              }
            } else {
              soundEngine.playSelect();
              setManualQuizFeedback({
                tone: 'warn',
                text: '这步不是本谱正招，再试试看（或点下方「提示」）',
              });
              setSelectedPos(null);
            }
            return;
          }
        }
        if (selectedPos.r === r && selectedPos.c === c) {
          setSelectedPos(null);
          return;
        }
      }
      if (clickedPiece && clickedPiece.side === academyInteractiveSide) {
        soundEngine.playSelect();
        setSelectedPos({ r, c });
      } else {
        setSelectedPos(null);
      }
      return;
    }

    // Sandbox ("试走摆变化") interaction: freely play legal moves for either side without affecting the real game
    if (sandboxActive) {
      const clickedPiece = sandboxBoard[r][c];
      if (selectedPos) {
        const targetMove = legalTargets.find((m) => m.to.r === r && m.to.c === c);
        if (targetMove) {
          const notation = moveToChineseNotation(sandboxBoard, targetMove);
          const nextBoard = applyMove(sandboxBoard, targetMove);
          const nextTurn = oppositeSide(sandboxTurn);
          const nextInCheck = isInCheck(nextBoard, nextTurn);
          if (nextInCheck) {
            if (targetMove.captured) soundEngine.playCapture();
            else soundEngine.playMove();
            soundEngine.playCheck();
          } else if (targetMove.captured) {
            soundEngine.playCapture();
          } else {
            soundEngine.playMove();
          }
          const rec: MoveRecord = {
            move: targetMove,
            notation,
            boardAfter: nextBoard,
            inCheck: nextInCheck,
            fenAfter: boardToFen(nextBoard, nextTurn),
          };
          setSandboxMoves((prev) => [...prev, rec]);
          setSelectedPos(null);
          return;
        }
        if (selectedPos.r === r && selectedPos.c === c) {
          setSelectedPos(null);
          return;
        }
      }
      if (clickedPiece && clickedPiece.side === sandboxTurn) {
        soundEngine.playSelect();
        setSelectedPos({ r, c });
      } else {
        setSelectedPos(null);
      }
      return;
    }

    if (reviewMode || isReplaying || aiThinking || !activeHumanSide) {
      return;
    }

    const clickedPiece = board[r][c];

    // If a piece is already selected, check if clicked square is a legal destination
    if (selectedPos) {
      const targetMove = legalTargets.find((m) => m.to.r === r && m.to.c === c);
      if (targetMove) {
        playPlayerMove(targetMove);
        return;
      }
      // Deselect if clicking the same piece
      if (selectedPos.r === r && selectedPos.c === c) {
        setSelectedPos(null);
        return;
      }
    }

    // Select active human player's piece
    if (clickedPiece && clickedPiece.side === activeHumanSide) {
      soundEngine.playSelect();
      setSelectedPos({ r, c });
    } else {
      setSelectedPos(null);
    }
  };

  // Undo: in Online syncs undo to room; in PvP pops 1 move; in AI mode undoes back to player's turn
  const canUndo =
    !sandboxActive &&
    !isReplaying &&
    history.length > 0 &&
    (playMode === 'pvp' ||
      (playMode === 'online' && onlineSession !== null && onlineSession.side !== 'spectator') ||
      (playMode === 'ai' && !(playerSide === 'black' && history.length === 1 && turn === 'black')));

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    if (playMode === 'online' && onlineSession) {
      sendOnlineUndo(onlineSession.code, onlineSession.token).catch(() => {});
      return;
    }
    // Cancel any in-flight AI request
    activeAiReqRef.current = null;
    activeHintReqRef.current = null;
    setAiThinking(false);
    setHintLoading(false);
    setHintMove(null);
    setSelectedPos(null);
    setDismissedGameOver(false);
    setResignedSide(null);
    setShowResignConfirm(false);

    // Determine how many plies to pop
    let targetLen = history.length - 1;
    if (playMode === 'ai' && turn === playerSide && history.length >= 2) {
      targetLen = history.length - 2;
    }

    const newHistory = history.slice(0, targetLen);
    const newBoard = targetLen === 0 ? createInitialBoard() : newHistory[targetLen - 1].boardAfter;
    const newTurn: Side = targetLen % 2 === 0 ? 'red' : 'black';

    setHistory(newHistory);
    setBoard(newBoard);
    setTurn(newTurn);
    setViewStep(null);
    setPlayerFeedback(null);
    setLastOpponentMove(null);
  }, [canUndo, playMode, onlineSession, history, turn, playerSide]);

  const canHint = !sandboxActive && !isReplaying && !aiThinking && activeHumanSide !== null;

  const canResign =
    gameStatus.state === 'playing' &&
    !reviewMode &&
    !sandboxActive &&
    !isReplaying &&
    history.length > 0 &&
    (playMode !== 'online' || (onlineSession !== null && onlineSession.side !== 'spectator'));

  const resigningSide: Side =
    playMode === 'pvp'
      ? turn
      : playMode === 'online' && onlineSession && onlineSession.side !== 'spectator'
        ? onlineSession.side
        : playerSide;

  const handleConfirmResign = useCallback(() => {
    if (!canResign) {
      setShowResignConfirm(false);
      return;
    }
    activeAiReqRef.current = null;
    activeHintReqRef.current = null;
    setAiThinking(false);
    setHintLoading(false);
    setSelectedPos(null);
    setHintMove(null);
    setShowResignConfirm(false);
    setDismissedGameOver(false);
    soundEngine.playGameOver(false);
    setResignedSide(resigningSide);
  }, [canResign, resigningSide]);

  const handleHint = async () => {
    if (!canHint || !activeHumanSide) return;
    setHintLoading(true);
    setHintMove(null);
    setHintPvLine([]);
    setHintDepth(0);
    const id = ++reqIdRef.current;
    activeHintReqRef.current = id;

    if (pikafishReady) {
      const res = await analyzeWithPikafish(board, activeHumanSide, {
        skillLevel: 20,
        movetime: 600,
        maxPvPlies: 6,
      });
      if (activeHintReqRef.current !== id) return;
      if (res?.bestMove) {
        activeHintReqRef.current = null;
        setHintLoading(false);
        setHintMove(res.bestMove);
        setHintPvLine(res.futureLine);
        setHintDepth(res.depth);
        setNnueEval(res.scoreCp);
        return;
      }
    }

    if (!workerRef.current || activeHintReqRef.current !== id) return;
    const req: AIWorkerRequest = {
      id,
      kind: 'hint',
      board,
      side: activeHumanSide,
      difficulty: 'master',
      moveCount: history.length,
    };
    workerRef.current.postMessage(req);
  };

  const startNewGame = (side: Side) => {
    exitSandbox();
    activeAiReqRef.current = null;
    activeHintReqRef.current = null;
    activeReviewReqRef.current = null;
    currentGameIdRef.current = `game_${Date.now()}`;
    setReviewMode(false);
    setReviewPlaying(false);
    setAiThinking(false);
    setHintLoading(false);
    setBoard(createInitialBoard());
    setTurn('red');
    setPlayerSide(side);
    setFlipped(side === 'black');
    setHistory([]);
    setViewStep(null);
    setSelectedPos(null);
    setHintMove(null);
    setPlayerFeedback(null);
    setLastOpponentMove(null);
    setDismissedGameOver(false);
    setResignedSide(null);
    setShowResignConfirm(false);
    setShowNewGameModal(false);
  };

  const handleResumeFromReplay = () => {
    if (viewStep === null) return;
    activeAiReqRef.current = null;
    activeHintReqRef.current = null;
    setAiThinking(false);
    setHintLoading(false);

    const newHistory = history.slice(0, viewStep);
    const newBoard = viewStep === 0 ? createInitialBoard() : newHistory[viewStep - 1].boardAfter;
    const newTurn: Side = viewStep % 2 === 0 ? 'red' : 'black';

    setHistory(newHistory);
    setBoard(newBoard);
    setTurn(newTurn);
    setViewStep(null);
    setSelectedPos(null);
    setHintMove(null);
    setPlayerFeedback(null);
    setLastOpponentMove(null);
    setDismissedGameOver(false);
    setResignedSide(null);
    setShowResignConfirm(false);
  };

  const enterReviewMode = (targetGameId?: string) => {
    exitSandbox();
    activeAiReqRef.current = null;
    setAiThinking(false);
    setSelectedPos(null);
    setReviewPlaying(false);
    setDismissedGameOver(true);

    const target =
      (targetGameId && reviewGamesList.find((g) => g.id === targetGameId)) ||
      reviewGamesList[0] ||
      null;
    setSelectedReviewGameId(target?.id ?? null);
    setReviewStep(target ? target.moves.length : 0);
    setReviewMode(true);
  };

  const exitReviewMode = () => {
    exitSandbox();
    setReviewPlaying(false);
    setReviewMode(false);
  };

  const handleSelectReviewGame = (id: string) => {
    exitSandbox();
    setReviewPlaying(false);
    setSelectedReviewGameId(id);
    const g = reviewGamesList.find((item) => item.id === id);
    setReviewStep(g ? g.moves.length : 0);
  };

  const handleDeleteReviewGame = (id: string) => {
    setReviewPlaying(false);
    const updated = deleteSavedGame(id);
    setSavedGames(updated);
    if (selectedReviewGameId === id) {
      const next = updated[0] ?? null;
      setSelectedReviewGameId(next?.id ?? null);
      setReviewStep(next ? next.moves.length : 0);
    }
  };

  const handleToggleReviewPlay = () => {
    if (reviewSteps.length === 0) return;
    if (reviewPlaying) {
      setReviewPlaying(false);
      return;
    }
    if (reviewStep >= reviewSteps.length) {
      setReviewStep(0);
    }
    setReviewPlaying(true);
  };

  const selectTopMode = (mode: 'play' | 'teach' | 'review') => {
    if (mode === 'review') {
      if (!reviewMode) enterReviewMode();
      return;
    }
    if (reviewMode) {
      exitReviewMode();
    }
    if (mode === 'teach') {
      if (!teachingMode) {
        exitSandbox();
        setTeachingMode(true);
      }
    } else {
      if (teachingMode) {
        exitSandbox();
        activeHintReqRef.current = null;
        setHintLoading(false);
        setHintMove(null);
        setPlayerFeedback(null);
        setLastOpponentMove(null);
        setTeachingMode(false);
      }
    }
  };

  const currentTopMode: 'play' | 'teach' | 'review' = reviewMode
    ? 'review'
    : teachingMode
      ? 'teach'
      : 'play';

  const showEvalBar =
    !academyActive &&
    (evalBarMode === 'always' || (evalBarMode === 'auto' && (teachingMode || reviewMode)));

  const topLostSide: Side = flipped ? 'red' : 'black';
  const bottomLostSide: Side = flipped ? 'black' : 'red';
  const topLostPieces = topLostSide === 'red' ? captured.redLost : captured.blackLost;
  const bottomLostPieces = bottomLostSide === 'red' ? captured.redLost : captured.blackLost;

  const buildNotationText = () => {
    const resultText =
      gameStatus.state === 'checkmate'
        ? gameStatus.winner === 'red'
          ? '红胜'
          : '黑胜'
        : gameStatus.state === 'resigned'
          ? gameStatus.winner === 'red'
            ? '红胜（黑方认输）'
            : '黑胜（红方认输）'
          : gameStatus.state === 'draw'
            ? gameStatus.reason
            : '对局进行中';
    return exportGameNotation(history, {
      playerSide,
      difficulty: DIFFICULTY_LABELS[difficulty],
      resultText,
      currentFen: boardToFen(board, turn, halfMovesSinceCapture, Math.floor(history.length / 2) + 1),
    });
  };

  const handleCopyNotation = () => {
    const text = buildNotationText();
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const handleDownloadNotation = () => {
    const text = buildNotationText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `雅弈棋谱_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcuts: Left/Right for replay or review mode, Ctrl/Cmd+Z for undo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (reviewMode) {
        if (e.key === 'ArrowLeft' && reviewStep > 0) {
          e.preventDefault();
          setReviewPlaying(false);
          setReviewStep((s) => Math.max(0, s - 1));
        } else if (e.key === 'ArrowRight' && reviewStep < reviewSteps.length) {
          e.preventDefault();
          setReviewPlaying(false);
          setReviewStep((s) => Math.min(reviewSteps.length, s + 1));
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (history.length === 0) return;
      const cur = viewStep === null ? history.length : viewStep;
      if (e.key === 'ArrowLeft' && cur > 0) {
        e.preventDefault();
        setViewStep(cur - 1);
      } else if (e.key === 'ArrowRight' && cur < history.length) {
        e.preventDefault();
        const next = cur + 1;
        setViewStep(next >= history.length ? null : next);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reviewMode, reviewStep, reviewSteps.length, handleUndo, history.length, viewStep]);

  const showGameOverModal =
    !academyActive &&
    !reviewMode &&
    !sandboxActive &&
    gameStatus.state !== 'playing' &&
    !dismissedGameOver &&
    !isReplaying;

  const academyHighlightCoords =
    academyActive &&
    ((teachingTab === 'lessons' && Boolean(currentLessonStep.highlightCoords)) ||
      teachingTab === 'manuals');

  const academyTargetSquares =
    academyActive && teachingTab === 'lessons' && !lessonStepDone
      ? currentLessonStep.targetSquares ?? []
      : [];

  const handleSelectTeachingTab = (tab: TeachingTab) => {
    clearAcademyTimer();
    exitSandbox();
    setSelectedPos(null);
    setTeachingTab(tab);
  };

  const sandboxCardElement = sandboxActive ? (
    <SandboxCard
      playerSide={
        reviewMode && activeReviewGame
          ? activeReviewGame.playerSide
          : playMode === 'pvp'
            ? sandboxBaseTurn
            : playerSide
      }
      baseBoard={sandboxBaseBoard}
      sandboxBoard={sandboxBoard}
      sandboxTurn={sandboxTurn}
      baseEval={sandboxBaseEval}
      sandboxMoves={sandboxMoves}
      analysis={sandboxAnalysis}
      loading={sandboxLoading}
      pikafishActive={pikafishReady}
      allowVerify={teachingMode || reviewMode}
      canCommitMove={
        !reviewMode &&
        viewStep === null &&
        sandboxMoves.length > 0 &&
        activeHumanSide !== null &&
        sandboxBaseTurn === activeHumanSide
      }
      onVerifySandbox={handleVerifySandbox}
      onUndoSandboxMove={handleUndoSandboxMove}
      onCommitSandboxMove={handleCommitSandboxMove}
      onExitSandbox={exitSandbox}
    />
  ) : undefined;

  return (
    <div className="app-shell">
      {/* Minimal 3-Anchor Header */}
      <header className="top-bar">
        <div className="brand">
          <div className="brand-seal">弈</div>
          <div className="brand-title">雅弈</div>
        </div>

        <nav className="mode-pill-group" aria-label="模式切换">
          <button
            type="button"
            className={currentTopMode === 'play' ? 'active' : ''}
            onClick={() => selectTopMode('play')}
          >
            对弈
          </button>
          <button
            type="button"
            className={currentTopMode === 'teach' ? 'active teach' : ''}
            onClick={() => selectTopMode('teach')}
          >
            教学
          </button>
          <button
            type="button"
            className={currentTopMode === 'review' ? 'active review' : ''}
            onClick={() => selectTopMode('review')}
          >
            复盘
            {savedGames.length > 0 && <span className="nav-count">{savedGames.length}</span>}
          </button>
        </nav>

        <div className="top-controls">
          <button
            type="button"
            className={`icon-btn ${showGlossary ? 'active' : ''}`}
            onClick={() => setShowGlossary(true)}
            title="象棋词典"
          >
            <BookMarked size={15} />
            <span className="btn-label">词典</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setFlipped((f) => !f)}
            title="翻转棋盘视角"
          >
            <ArrowUpDown size={15} />
            <span className="btn-label">翻转</span>
          </button>

          <button
            type="button"
            className={`icon-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(true)}
            title="对弈设置（人机/双人、难度、音效、估值条）"
          >
            <SlidersHorizontal size={15} />
            <span className="btn-label">设置</span>
          </button>
        </div>
      </header>

      {/* Main Serene Two-Column Layout */}
      <main className="main-layout">
        <div className="board-with-tray">
          {showEvalBar && (
            <EvalBar
              evalScore={evalScore}
              gameStatus={reviewMode ? { state: 'playing', inCheck: false } : gameStatus}
              isReplaying={reviewMode || isReplaying}
              flipped={flipped}
            />
          )}

          <div className="board-column">
            {!academyActive && <CapturedStrip side={topLostSide} pieces={topLostPieces} />}

            <ChessBoard
              board={displayedBoard}
              flipped={academyActive ? false : flipped}
              selectedPos={
                academyActive
                  ? selectedPos
                  : sandboxActive
                    ? selectedPos
                    : reviewMode || isReplaying
                      ? null
                      : selectedPos
              }
              legalTargets={legalTargets}
              lastMove={displayedLastMove}
              hintMove={displayedHintMove}
              checkedKingPos={checkedKingPos}
              interactiveSide={
                academyActive
                  ? academyInteractiveSide
                  : sandboxActive
                    ? sandboxTurn
                    : !reviewMode && !isReplaying && !aiThinking
                      ? activeHumanSide
                      : null
              }
              showCheckToast={!academyActive && !reviewMode && !sandboxActive && showCheckToast}
              isReplaying={!academyActive && isReplaying}
              replayStepLabel={viewStep === 0 ? '开局局面' : `第 ${viewStep} 步`}
              isSandbox={!academyActive && sandboxActive}
              sandboxMoveCount={sandboxMoves.length}
              highlightCoords={academyHighlightCoords}
              targetSquares={academyTargetSquares}
              onSquareClick={handleSquareClick}
              onReturnToLive={() => setViewStep(null)}
              onResumeFromReplay={handleResumeFromReplay}
              onExitSandbox={exitSandbox}
            />

            {!academyActive && <CapturedStrip side={bottomLostSide} pieces={bottomLostPieces} />}
          </div>
        </div>

        {reviewMode ? (
          <ReviewPanel
            games={reviewGamesList}
            selectedGameId={activeReviewGame?.id ?? null}
            activeGame={activeReviewGame}
            steps={reviewSteps}
            currentStep={reviewStep}
            displayedBoard={displayedBoard}
            isPlaying={reviewPlaying}
            engineReview={engineReview}
            engineReviewLoading={engineReviewLoading}
            sandboxActive={sandboxActive}
            onToggleSandbox={handleToggleSandbox}
            sandboxSlot={sandboxCardElement}
            onSelectGame={handleSelectReviewGame}
            onDeleteGame={handleDeleteReviewGame}
            onStepChange={(step) => {
              exitSandbox();
              setReviewPlaying(false);
              setReviewStep(step);
            }}
            onTogglePlay={() => {
              exitSandbox();
              handleToggleReviewPlay();
            }}
            onExitReview={exitReviewMode}
          />
        ) : academyActive ? (
          <AcademyPanel
            activeTab={teachingTab as Exclude<TeachingTab, 'coach'>}
            onSelectTab={handleSelectTeachingTab}
            progress={academyProgress}
            lessonId={lessonId}
            lessonStepIdx={lessonStepIdx}
            lessonStepDone={lessonStepDone}
            lessonFeedback={lessonFeedback}
            onSelectLesson={(id) => loadLessonStep(id, 0)}
            onDemoLessonStep={handleDemoLessonStep}
            onNextLessonStep={handleNextLessonStep}
            onResetLessonStep={() => loadLessonStep(lessonId, lessonStepIdx)}
            puzzleId={puzzleId}
            puzzleStepIdx={puzzleStepIdx}
            puzzleSolved={puzzleSolved}
            puzzleShowHint={puzzleShowHint}
            puzzleFeedback={puzzleFeedback}
            onSelectPuzzle={loadPuzzle}
            onTogglePuzzleHint={() => setPuzzleShowHint((v) => !v)}
            onResetPuzzle={() => loadPuzzle(puzzleId)}
            onNextPuzzle={handleNextPuzzle}
            manualId={manualId}
            manualStepIdx={manualStepIdx}
            manualQuizMode={manualQuizMode}
            manualNotations={manualTimeline.notations}
            manualQuizFeedback={manualQuizFeedback}
            manualShowHint={manualShowHint}
            onSelectManual={handleSelectManual}
            onManualStepChange={handleManualStepChange}
            onToggleManualQuizMode={(quiz) => {
              clearAcademyTimer();
              setManualQuizMode(quiz);
              setManualStepIdx(0);
              setManualQuizFeedback(null);
              setManualShowHint(false);
              setSelectedPos(null);
            }}
            onToggleManualHint={() => setManualShowHint((v) => !v)}
            onResetManual={() => handleSelectManual(manualId)}
          />
        ) : (
          <SidePanel
            topSlot={
              teachingMode ? (
                <TeachingSubNav
                  activeTab={teachingTab}
                  onSelectTab={handleSelectTeachingTab}
                  lessonProgressText={`${academyProgress.completedLessons.length}/${MICRO_LESSONS.length}`}
                  puzzleProgressText={`${academyProgress.completedPuzzles.length}/${TACTIC_PUZZLES.length}`}
                  manualProgressText={`${academyProgress.completedManuals.length}/${INTERACTIVE_MANUALS.length}`}
                />
              ) : undefined
            }
            playMode={playMode}
            difficultyLabel={DIFFICULTY_LABELS[difficulty]}
            turn={turn}
            playerSide={playerSide}
            gameStatus={gameStatus}
            aiThinking={aiThinking}
            hintLoading={hintLoading}
            history={history}
            viewStep={viewStep}
            canUndo={canUndo}
            canHint={canHint}
            canResign={canResign}
            sandboxActive={sandboxActive}
            onUndo={handleUndo}
            onToggleSandbox={handleToggleSandbox}
            onHint={handleHint}
            onResign={() => setShowResignConfirm(true)}
            onNewGame={() => {
              if (playMode === 'online' && onlineSession) {
                sendOnlineReset(onlineSession.code, onlineSession.token).catch(() => {});
                return;
              }
              if (playMode === 'pvp') {
                startNewGame('red');
                return;
              }
              setPendingSide(playerSide);
              setShowNewGameModal(true);
            }}
            onSelectStep={(step) => {
              setSelectedPos(null);
              setViewStep(step);
            }}
            onCopyNotation={handleCopyNotation}
            onDownloadNotation={handleDownloadNotation}
            onlineSlot={
              playMode === 'online' ? (
                <OnlineRoomCard
                  session={onlineSession}
                  busy={onlineBusy}
                  error={onlineError}
                  onCreateRoom={handleCreateOnlineRoom}
                  onJoinRoom={handleJoinOnlineRoom}
                  onLeaveRoom={handleLeaveOnlineRoom}
                />
              ) : undefined
            }
            sandboxSlot={!teachingMode && sandboxActive ? sandboxCardElement : undefined}
            coachSlot={
              teachingMode ? (
                <CoachPanel
                  board={displayedBoard}
                  playerSide={playMode === 'pvp' ? turn : playerSide}
                  turn={turn}
                  evalScore={evalScore}
                  history={history}
                  loading={hintLoading}
                  isPlayerTurn={activeHumanSide !== null && !aiThinking}
                  isReplaying={isReplaying}
                  gameOver={gameStatus.state !== 'playing'}
                  recommendation={coachRecommendation}
                  lastOpponentMove={lastOpponentMove}
                  playerFeedback={playerFeedback}
                  enginePvLine={hintPvLine}
                  engineDepth={hintDepth}
                  pikafishActive={pikafishReady}
                  sandboxActive={sandboxActive}
                  onToggleSandbox={handleToggleSandbox}
                  sandboxSlot={sandboxCardElement}
                  onApplyRecommendation={() => {
                    if (hintMove && !isReplaying && !aiThinking && activeHumanSide !== null) {
                      playPlayerMove(hintMove);
                    }
                  }}
                />
              ) : undefined
            }
          />
        )}
      </main>

      {/* Clean Settings Modal */}
      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal-card settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <span className="settings-title">对弈设置</span>
              <button
                type="button"
                className="glossary-close"
                onClick={() => setShowSettings(false)}
                title="关闭设置"
              >
                <X size={16} />
              </button>
            </div>

            <div className="settings-list">
              <div className="settings-row">
                <span className="settings-label">对弈模式</span>
                <div className="segmented">
                  <button
                    type="button"
                    className={playMode === 'ai' ? 'active' : ''}
                    onClick={() => {
                      handleLeaveOnlineRoom();
                      setPlayMode('ai');
                      setSelectedPos(null);
                    }}
                  >
                    人机
                  </button>
                  <button
                    type="button"
                    className={playMode === 'pvp' ? 'active' : ''}
                    onClick={() => {
                      handleLeaveOnlineRoom();
                      activeAiReqRef.current = null;
                      setAiThinking(false);
                      setPlayMode('pvp');
                      setSelectedPos(null);
                    }}
                  >
                    同屏
                  </button>
                  <button
                    type="button"
                    className={playMode === 'online' ? 'active' : ''}
                    onClick={() => {
                      activeAiReqRef.current = null;
                      setAiThinking(false);
                      setPlayMode('online');
                      setSelectedPos(null);
                      setShowSettings(false);
                    }}
                  >
                    双设备联机
                  </button>
                </div>
              </div>

              {playMode === 'ai' && (
                <div className="settings-row">
                  <span className="settings-label">AI 难度</span>
                  <div className="segmented">
                    {(['beginner', 'intermediate', 'master'] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={difficulty === d ? 'active' : ''}
                        onClick={() => setDifficulty(d)}
                      >
                        {DIFFICULTY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="settings-row">
                <span className="settings-label">竖状估值条</span>
                <div className="segmented">
                  <button
                    type="button"
                    className={evalBarMode === 'auto' ? 'active' : ''}
                    onClick={() => setEvalBarMode('auto')}
                  >
                    自动
                  </button>
                  <button
                    type="button"
                    className={evalBarMode === 'always' ? 'active' : ''}
                    onClick={() => setEvalBarMode('always')}
                  >
                    常显
                  </button>
                  <button
                    type="button"
                    className={evalBarMode === 'hidden' ? 'active' : ''}
                    onClick={() => setEvalBarMode('hidden')}
                  >
                    隐藏
                  </button>
                </div>
              </div>

              <div className="settings-row">
                <span className="settings-label">落子音效</span>
                <div className="segmented">
                  {(
                    [
                      { key: 'crisp', label: '棋摊脆拍' },
                      { key: 'classic', label: '经典怀旧' },
                      { key: 'off', label: '静音' },
                    ] as { key: SoundPack; label: string }[]
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={soundPack === item.key ? 'active' : ''}
                      onClick={() => {
                        setSoundPack(item.key);
                        soundEngine.setPack(item.key);
                        if (item.key !== 'off') {
                          soundEngine.preload().then(() => soundEngine.playMove());
                        }
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-engine-info">
                <span className={`ds-dot ${pikafishReady ? 'on' : ''}`} />
                <span>
                  {pikafishReady
                    ? '引擎：Pikafish NNUE（原生满血已连接）'
                    : '引擎：内置轻量象棋引擎'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Glossary / Encyclopedia Modal */}
      {showGlossary && <GlossaryModal onClose={() => setShowGlossary(false)} />}

      {/* New Game Side Selector Modal */}
      {showNewGameModal && (
        <div className="modal-backdrop" onClick={() => setShowNewGameModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">开启新局</div>
            <div className="modal-desc">选择你本局执子方，红先黑后。</div>
            <div className="side-choice">
              <button
                type="button"
                className={`side-option ${pendingSide === 'red' ? 'selected' : ''}`}
                onClick={() => setPendingSide('red')}
              >
                <span className="side-option-char red">帥</span>
                <span className="side-option-label">执红先手</span>
              </button>
              <button
                type="button"
                className={`side-option ${pendingSide === 'black' ? 'selected' : ''}`}
                onClick={() => setPendingSide('black')}
              >
                <span className="side-option-char black">將</span>
                <span className="side-option-label">执黑后手</span>
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" className="wood-btn" onClick={() => setShowNewGameModal(false)}>
                取消
              </button>
              <button
                type="button"
                className="wood-btn primary"
                onClick={() => startNewGame(pendingSide)}
              >
                开始对弈
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resign Confirmation Modal */}
      {showResignConfirm && (
        <div className="modal-backdrop" onClick={() => setShowResignConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">确认认输？</div>
            <div className="modal-desc">
              {`${resigningSide === 'red' ? '红方' : '黑方'}中盘认负后，将直接判定${resigningSide === 'red' ? '黑方' : '红方'}获胜，同时本局会自动保存到复盘模式。`}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="wood-btn"
                onClick={() => setShowResignConfirm(false)}
              >
                继续对弈
              </button>
              <button
                type="button"
                className="wood-btn danger"
                onClick={handleConfirmResign}
              >
                确认认输
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {showGameOverModal && (
        <div className="modal-backdrop" onClick={() => setDismissedGameOver(true)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              {gameStatus.state === 'resigned'
                ? `${gameStatus.resignedSide === 'red' ? '红方' : '黑方'}认输`
                : gameStatus.state === 'checkmate'
                  ? playMode === 'pvp' || playMode === 'online'
                    ? gameStatus.winner === 'red'
                      ? '红方获胜'
                      : '黑方获胜'
                    : gameStatus.winner === playerSide
                      ? '棋高一着'
                      : '惜败一局'
                  : '握手言和'}
            </div>
            <div className="modal-desc">
              {gameStatus.state === 'resigned'
                ? `${gameStatus.resignedSide === 'red' ? '红方' : '黑方'}中盘认输，判定${gameStatus.winner === 'red' ? '红方' : '黑方'}获胜，共弈 ${history.length} 步。本局已自动保存，可随时进入复盘模式分析。`
                : gameStatus.state === 'checkmate'
                  ? `${gameStatus.winner === 'red' ? '红方' : '黑方'}绝杀获胜，共弈 ${history.length} 步。你可以复盘推演或导出棋谱。`
                  : `${gameStatus.reason}，共弈 ${history.length} 步。`}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="wood-btn"
                onClick={() => enterReviewMode(currentGameIdRef.current)}
              >
                进入复盘模式
              </button>
              <button
                type="button"
                className="wood-btn primary"
                onClick={() => {
                  if (playMode === 'online' && onlineSession) {
                    sendOnlineReset(onlineSession.code, onlineSession.token).catch(() => {});
                    setDismissedGameOver(true);
                  } else {
                    startNewGame(playerSide);
                  }
                }}
              >
                再来一局
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
