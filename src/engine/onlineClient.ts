import type { Pos, Side } from './types';

export interface OnlineMovePayload {
  from: Pos;
  to: Pos;
}

export interface OnlineRoomState {
  code: string;
  version: number;
  redConnected: boolean;
  blackConnected: boolean;
  moves: OnlineMovePayload[];
}

export interface OnlineSession {
  code: string;
  side: Side | 'spectator';
  token: string;
  state: OnlineRoomState;
}

export async function createOnlineRoom(preferredSide: Side = 'red'): Promise<OnlineSession> {
  const res = await fetch('/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferredSide }),
  });
  const data = (await res.json()) as OnlineSession & { error?: string };
  if (!res.ok) throw new Error(data.error || '创建房间失败');
  return data;
}

export async function joinOnlineRoom(code: string, token?: string): Promise<OnlineSession> {
  const res = await fetch('/api/rooms/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim(), token }),
  });
  const data = (await res.json()) as OnlineSession & { error?: string };
  if (!res.ok) throw new Error(data.error || '加入房间失败');
  return data;
}

export async function sendOnlineMove(
  code: string,
  token: string,
  move: OnlineMovePayload
): Promise<void> {
  const res = await fetch('/api/rooms/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, token, move }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || '落子同步失败');
  }
}

export async function sendOnlineUndo(code: string, token: string): Promise<void> {
  await fetch('/api/rooms/undo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, token }),
  });
}

export async function sendOnlineReset(code: string, token: string): Promise<void> {
  await fetch('/api/rooms/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, token }),
  });
}

export function subscribeOnlineRoom(
  code: string,
  token: string,
  onState: (state: OnlineRoomState) => void,
  onError?: () => void
): () => void {
  const url = `/api/rooms/stream?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  es.addEventListener('state', (evt) => {
    try {
      const parsed = JSON.parse((evt as MessageEvent).data) as OnlineRoomState;
      onState(parsed);
    } catch {
      // ignore malformed payloads
    }
  });

  es.onerror = () => {
    onError?.();
  };

  return () => {
    es.close();
  };
}
