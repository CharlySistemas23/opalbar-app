// ─────────────────────────────────────────────
//  useThreadSocket — real-time chat hook
//  Usage:
//    const { connected, typingUserIds, otherOnline, emitTyping, markRead } =
//      useThreadSocket(threadId, (msg) => setMessages((m) => [...m, msg]));
// ─────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../api/socket';

export interface ThreadSocketHandle {
  connected: boolean;
  otherOnline: boolean;
  typingUserIds: Set<string>;
  emitTyping: (isTyping: boolean) => void;
  markRead: () => void;
}

export function useThreadSocket(
  threadId: string | undefined,
  onNewMessage: (message: any) => void,
  opts?: { otherUserId?: string },
): ThreadSocketHandle {
  const [connected, setConnected] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingStateRef = useRef<boolean>(false);

  // Keep a ref to the latest onNewMessage so we don't reattach listeners
  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);

  useEffect(() => {
    if (!threadId) return;
    const socket = getSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      socket.emit('thread:join', { threadId }, (ack: any) => {
        if (ack?.ok && typeof ack.otherOnline === 'boolean') {
          setOtherOnline(ack.otherOnline);
        }
      });
    };
    const handleDisconnect = () => setConnected(false);
    const handleNewMessage = (payload: { threadId: string; message: any }) => {
      if (payload.threadId !== threadId) return;
      onNewMessageRef.current(payload.message);
    };
    const handleTypingStart = (payload: { threadId: string; userId: string }) => {
      if (payload.threadId !== threadId) return;
      setTypingUserIds((prev) => {
        if (prev.has(payload.userId)) return prev;
        const next = new Set(prev);
        next.add(payload.userId);
        return next;
      });
    };
    const handleTypingStop = (payload: { threadId: string; userId: string }) => {
      if (payload.threadId !== threadId) return;
      setTypingUserIds((prev) => {
        if (!prev.has(payload.userId)) return prev;
        const next = new Set(prev);
        next.delete(payload.userId);
        return next;
      });
    };
    const handlePresenceOnline = (payload: { userId: string }) => {
      if (opts?.otherUserId && payload.userId === opts.otherUserId) setOtherOnline(true);
    };
    const handlePresenceOffline = (payload: { userId: string }) => {
      if (opts?.otherUserId && payload.userId === opts.otherUserId) setOtherOnline(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('message:new', handleNewMessage);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('presence:online', handlePresenceOnline);
    socket.on('presence:offline', handlePresenceOffline);

    // If already connected when the hook mounts, join immediately
    if (socket.connected) handleConnect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message:new', handleNewMessage);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('presence:online', handlePresenceOnline);
      socket.off('presence:offline', handlePresenceOffline);
      if (socket.connected) socket.emit('thread:leave', { threadId });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [threadId, opts?.otherUserId]);

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const socket = socketRef.current;
      if (!socket || !threadId) return;

      if (isTyping) {
        if (!lastTypingStateRef.current) {
          socket.emit('typing:start', { threadId });
          lastTypingStateRef.current = true;
        }
        // Auto-stop after 3s of no further typing signals
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          socket.emit('typing:stop', { threadId });
          lastTypingStateRef.current = false;
        }, 3000);
      } else {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        if (lastTypingStateRef.current) {
          socket.emit('typing:stop', { threadId });
          lastTypingStateRef.current = false;
        }
      }
    },
    [threadId],
  );

  const markRead = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !threadId) return;
    socket.emit('message:read', { threadId });
  }, [threadId]);

  return { connected, otherOnline, typingUserIds, emitTyping, markRead };
}
