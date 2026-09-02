// ─────────────────────────────────────────────
//  Messages — presentational sub-components barrel
//
//  Use these inside `app/(app)/messages/` screens. Logic (sockets,
//  mutations, optimistic updates) lives in the screen file; UI lives here.
// ─────────────────────────────────────────────
export { MessageBubble } from './MessageBubble';
export type { MessageBubbleProps, ReactionAggregate } from './MessageBubble';
export { DateDivider, dateLabel } from './DateDivider';
export { TypingBubble } from './TypingBubble';
export { VoiceBubble } from './VoiceBubble';
export { ChatInputBar } from './ChatInputBar';
export { StickerPicker } from './StickerPicker';
export { MessageReactionRow } from './MessageReactionRow';
export { messagePreview, threadPreview, relTime } from './preview';
export type { PreviewableMessage } from './preview';
