import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native';
import { usersApi, type MentionInput } from '@/api/client';

// ─────────────────────────────────────────────
//  useMentionAutocomplete
//  · Detects an active "@token" before the caret and queries the users API.
//  · Tracks which @username tokens correspond to which userId, so the parent
//    can submit a real mentions[] array even after edits.
//  · On unmount-safe: each query overrides the previous one.
// ─────────────────────────────────────────────

export type MentionSuggestion = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
};

// Backend's /users/search returns rows with the profile fields nested.
function normalizeUser(raw: any): MentionSuggestion {
  return {
    id: raw.id,
    firstName: raw.firstName ?? raw.profile?.firstName ?? null,
    lastName: raw.lastName ?? raw.profile?.lastName ?? null,
    username: raw.username ?? raw.profile?.username ?? null,
    avatarUrl: raw.avatarUrl ?? raw.profile?.avatarUrl ?? null,
  };
}

const MIN_QUERY = 1;
const DEBOUNCE_MS = 180;

function buildHandle(u: MentionSuggestion): string {
  // Prefer `username` if backend provides one; otherwise build a stable fallback
  // from first/last name so the @token is still meaningful.
  if (u.username && u.username.trim()) return u.username.replace(/\s+/g, '').toLowerCase();
  const fn = (u.firstName ?? '').trim();
  const ln = (u.lastName ?? '').trim();
  const compact = `${fn}${ln}`.replace(/\s+/g, '').toLowerCase();
  return compact || u.id.slice(0, 8);
}

export function useMentionAutocomplete() {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  // userId per handle that the user actively picked. Used to derive mentions[]
  // from the final text. We also store the original suggestion so we can
  // attach a coord later if the parent supports photo tagging.
  const pickedRef = useRef<Map<string, MentionSuggestion>>(new Map());

  const reqIdRef = useRef(0);

  // Detect active @token immediately before the caret. Returns the query
  // (without the @) or null if there is none.
  const detectActiveToken = (s: string, caret: number): string | null => {
    const upto = s.slice(0, caret);
    const match = /(^|\s)@([\w.]{0,30})$/.exec(upto);
    return match ? match[2] : null;
  };

  // Fire search when activeQuery changes.
  useEffect(() => {
    if (activeQuery === null || activeQuery.length < MIN_QUERY) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const id = ++reqIdRef.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await usersApi.search(activeQuery, 8);
        if (reqIdRef.current !== id) return;
        const raw: any[] = res.data?.data ?? res.data ?? [];
        setSuggestions(Array.isArray(raw) ? raw.map(normalizeUser) : []);
      } catch {
        if (reqIdRef.current === id) setSuggestions([]);
      } finally {
        if (reqIdRef.current === id) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [activeQuery]);

  const onChangeText = useCallback(
    (next: string) => {
      setText(next);
      // Caret may be stale here; recompute against new text using current selection
      // (RN fires onChangeText before onSelectionChange in most setups).
      const caret = Math.min(selection.end, next.length);
      setActiveQuery(detectActiveToken(next, caret));
    },
    [selection.end],
  );

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const sel = e.nativeEvent.selection;
      setSelection(sel);
      setActiveQuery(detectActiveToken(text, sel.end));
    },
    [text],
  );

  const pickSuggestion = useCallback(
    (s: MentionSuggestion) => {
      const handle = buildHandle(s);
      const caret = selection.end;
      const upto = text.slice(0, caret);
      const after = text.slice(caret);
      const match = /(^|\s)@([\w.]{0,30})$/.exec(upto);
      if (!match) return;
      const replaceFrom = match.index + match[1].length; // start of '@'
      const next = upto.slice(0, replaceFrom) + `@${handle} ` + after;
      pickedRef.current.set(handle, s);
      setText(next);
      setActiveQuery(null);
      setSuggestions([]);
      const newCaret = replaceFrom + handle.length + 2; // '@handle '
      setSelection({ start: newCaret, end: newCaret });
    },
    [selection.end, text],
  );

  // Derive the mention input array from current text + the picked map.
  // Caller passes optional coords keyed by userId (for photo tagging).
  const buildMentions = useCallback(
    (coordsByUserId?: Map<string, { x: number; y: number }>): MentionInput[] => {
      const handles = new Set<string>();
      const re = /@([\w.]{1,30})/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) handles.add(m[1].toLowerCase());
      const out: MentionInput[] = [];
      const seen = new Set<string>();
      for (const h of handles) {
        const s = pickedRef.current.get(h);
        if (!s || seen.has(s.id)) continue;
        seen.add(s.id);
        const coord = coordsByUserId?.get(s.id);
        out.push({
          userId: s.id,
          ...(coord ? { x: coord.x, y: coord.y } : {}),
        });
      }
      return out;
    },
    [text],
  );

  const reset = useCallback(() => {
    setText('');
    setSelection({ start: 0, end: 0 });
    setActiveQuery(null);
    setSuggestions([]);
    pickedRef.current.clear();
  }, []);

  // Expose the picked map's lookup for renderers that want to highlight
  // resolved mentions with a different style.
  const getPickedByHandle = useCallback((handle: string) => {
    return pickedRef.current.get(handle.toLowerCase()) ?? null;
  }, []);

  return {
    text,
    setText,
    selection,
    onChangeText,
    onSelectionChange,
    activeQuery,
    suggestions,
    loading,
    pickSuggestion,
    buildMentions,
    reset,
    getPickedByHandle,
    pickedUsers: () => Array.from(pickedRef.current.values()),
  };
}
