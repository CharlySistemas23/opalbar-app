import { useEffect, useRef } from 'react';
import { getCommunitySocket } from '../api/community-socket';

interface CommunityChangedPayload {
  type: string;
  postId?: string;
  commentId?: string;
  at?: string;
}

export function useCommunityRealtime(
  onChanged: (payload: CommunityChangedPayload) => void,
  opts?: { postId?: string },
) {
  const onChangedRef = useRef(onChanged);
  useEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);

  useEffect(() => {
    const socket = getCommunitySocket();

    const handler = (payload: CommunityChangedPayload) => {
      if (opts?.postId && payload.postId && payload.postId !== opts.postId) return;
      onChangedRef.current(payload);
    };

    socket.on('community:changed', handler);
    return () => {
      socket.off('community:changed', handler);
    };
  }, [opts?.postId]);
}
