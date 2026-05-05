-- Performance indexes from audit 2026-05-05.
-- Uses IF NOT EXISTS so re-running on a partially-applied DB is safe.
-- All composite indexes; existing single-column indexes kept for back-compat.

-- Notification: bell badge polls /notifications constantly, sorted by createdAt desc per user.
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification" ("userId", "createdAt" DESC);

-- Reservation: admin filters by venue+date+status; user feed by userId+status.
CREATE INDEX IF NOT EXISTS "Reservation_userId_status_idx"
  ON "Reservation" ("userId", "status");
CREATE INDEX IF NOT EXISTS "Reservation_venueId_date_status_idx"
  ON "Reservation" ("venueId", "date", "status");

-- Post: feed filters PUBLISHED ordered by createdAt desc; profile feed adds userId.
CREATE INDEX IF NOT EXISTS "Post_status_createdAt_idx"
  ON "Post" ("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Post_userId_status_createdAt_idx"
  ON "Post" ("userId", "status", "createdAt" DESC);

-- MessageThread: inbox sorts ACCEPTED threads by lastMessageAt desc.
CREATE INDEX IF NOT EXISTS "MessageThread_status_lastMessageAt_idx"
  ON "MessageThread" ("status", "lastMessageAt" DESC);

-- Message: unreadCount-per-thread groupBy filters by (threadId, isRead, senderId).
CREATE INDEX IF NOT EXISTS "Message_threadId_isRead_idx"
  ON "Message" ("threadId", "isRead");
