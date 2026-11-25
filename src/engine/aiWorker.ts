import { type ReviewLineResult, analyzePositionForReview, findBestMove } from './ai';
import type { Board, Difficulty, Move, Side } from './types';

export interface AIWorkerRequest {
  id: number;
  kind: 'move' | 'hint' | 'review';
  board: Board;
  side: Side;
  difficulty: Difficulty;
  moveCount: number;
}

export interface AIWorkerResponse {
  id: number;
  kind: 'move' | 'hint' | 'review';
  move: Move | null;
  review?: ReviewLineResult;
}

self.onmessage = (e: MessageEvent<AIWorkerRequest>) => {
  const { id, kind, board, side, difficulty, moveCount } = e.data;
  if (kind === 'review') {
    const review = analyzePositionForReview(board, side, moveCount);
    const res: AIWorkerResponse = { id, kind, move: review.bestMove, review };
    self.postMessage(res);
    return;
  }
  const move = findBestMove(board, side, difficulty, moveCount);
  const res: AIWorkerResponse = { id, kind, move };
  self.postMessage(res);
};
