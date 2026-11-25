import React, { useState } from 'react';
import { Check, Link2, LogOut, Plus, Users } from 'lucide-react';
import type { OnlineSession } from '../engine/onlineClient';

interface OnlineRoomCardProps {
  session: OnlineSession | null;
  busy: boolean;
  error: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
}

export const OnlineRoomCard: React.FC<OnlineRoomCardProps> = ({
  session,
  busy,
  error,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = () => {
    if (!session) return;
    const url = `${window.location.origin}/?room=${session.code}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSubmitJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = codeInput.trim();
    if (!cleaned || busy) return;
    onJoinRoom(cleaned);
  };

  if (!session) {
    return (
      <div className="card online-card">
        <div className="online-head">
          <span className="online-title">
            <Users size={15} />
            双设备联机
          </span>
          <span className="online-sub">同 Wi-Fi / 公网同步落子</span>
        </div>

        <button
          type="button"
          className="wood-btn primary online-create-btn"
          disabled={busy}
          onClick={onCreateRoom}
        >
          <Plus size={15} />
          {busy ? '正在建房…' : '创建房间（执红先手）'}
        </button>

        <form className="online-join-row" onSubmit={handleSubmitJoin}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="输入 4 位房号加入"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="wood-btn" disabled={busy || !codeInput.trim()}>
            加入
          </button>
        </form>

        {error && <p className="ds-error">{error}</p>}
      </div>
    );
  }

  const opponentConnected =
    session.side === 'red'
      ? session.state.blackConnected
      : session.side === 'black'
        ? session.state.redConnected
        : session.state.redConnected && session.state.blackConnected;

  const roleText =
    session.side === 'red' ? '你执红' : session.side === 'black' ? '你执黑' : '观战中';

  return (
    <div className="card online-card active">
      <div className="online-room-top">
        <div className="online-code-wrap">
          <span className="online-code-label">房号</span>
          <strong className="online-code">{session.code}</strong>
          <span className={`online-role ${session.side}`}>{roleText}</span>
        </div>
        <span className={`online-presence ${opponentConnected ? 'on' : ''}`}>
          <span className={`ds-dot ${opponentConnected ? 'on' : ''}`} />
          {opponentConnected ? '对手在线' : '等对手加入'}
        </span>
      </div>

      <div className="online-room-actions">
        <button type="button" className="mini-btn" onClick={handleCopyInvite}>
          {copied ? <Check size={13} /> : <Link2 size={13} />}
          {copied ? '已复制邀请链接' : '复制邀请链接'}
        </button>
        <button type="button" className="mini-btn" onClick={onLeaveRoom}>
          <LogOut size={13} />
          退出房间
        </button>
      </div>
    </div>
  );
};
