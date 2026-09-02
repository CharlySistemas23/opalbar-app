// ─────────────────────────────────────────────
//  wipe-keep-apple.ts — Deja el sistema limpio conservando SOLO:
//    - carlosalonsog966@gmail.com (admin)
//    - apple.review@opalbar.com.mx (revisor Apple)
//  Borra las demas cuentas + todo el contenido de usuario. Conserva datos
//  del bar (Venue/Event/Offer/etc). Basado en wipe-data.ts.
//
//  Uso: railway run --service Postgres -- npx ts-node apps/api/scripts/wipe-keep-apple.ts --confirm=YES_BORRAR
// ─────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const KEEP_EMAILS = ['carlosalonsog966@gmail.com', 'apple.review@opalbar.com.mx'];

function getArg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : process.env[name.toUpperCase()];
}

async function main() {
  if (getArg('confirm') !== 'YES_BORRAR') { console.error('Falta --confirm=YES_BORRAR'); process.exit(1); }
  const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!dbUrl) { console.error('sin DATABASE_URL'); process.exit(1); }
  const pool = new Pool({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const keep = await prisma.user.findMany({ where: { email: { in: KEEP_EMAILS } }, select: { id: true, email: true } });
    const keepEmails = keep.map((k) => k.email);
    if (!keepEmails.includes('apple.review@opalbar.com.mx') || !keep.some((k) => k.email === 'carlosalonsog966@gmail.com')) {
      console.error('ABORTO: no encontre admin o apple entre las cuentas. Encontradas: ' + keepEmails.join(', '));
      process.exit(1);
    }
    const keepIds = keep.map((k) => k.id);
    console.log('Conservando: ' + keepEmails.join(', '));

    const steps: Array<[string, () => Promise<{ count: number }>]> = [
      ['AuditLog', () => prisma.auditLog.deleteMany({})],
      ['AdminActionLog', () => prisma.adminActionLog.deleteMany({})],
      ['ModerationLog', () => prisma.moderationLog.deleteMany({})],
      ['ContentFlag', () => prisma.contentFlag.deleteMany({})],
      ['Report', () => prisma.report.deleteMany({})],
      ['Mention', () => prisma.mention.deleteMany({})],
      ['SavedItem', () => prisma.savedItem.deleteMany({})],
      ['EmailCampaignRecipient', () => prisma.emailCampaignRecipient.deleteMany({})],
      ['PushBroadcast', () => prisma.pushBroadcast.deleteMany({})],
      ['MessageReaction', () => prisma.messageReaction.deleteMany({})],
      ['Message', () => prisma.message.deleteMany({})],
      ['MessageThread', () => prisma.messageThread.deleteMany({})],
      ['Friendship', () => prisma.friendship.deleteMany({})],
      ['Follow', () => prisma.follow.deleteMany({})],
      ['Review', () => prisma.review.deleteMany({})],
      ['CommentReaction', () => prisma.commentReaction.deleteMany({})],
      ['CommentLike', () => prisma.commentLike.deleteMany({})],
      ['Comment', () => prisma.comment.deleteMany({})],
      ['PostEmojiReaction', () => prisma.postEmojiReaction.deleteMany({})],
      ['Reaction', () => prisma.reaction.deleteMany({})],
      ['StoryView', () => prisma.storyView.deleteMany({})],
      ['StoryReaction', () => prisma.storyReaction.deleteMany({})],
      ['Story', () => prisma.story.deleteMany({})],
      ['Post', () => prisma.post.deleteMany({})],
      ['Notification', () => prisma.notification.deleteMany({})],
      ['NotificationSettings', () => prisma.notificationSettings.deleteMany({})],
      ['PushToken', () => prisma.pushToken.deleteMany({})],
      ['WalletTransaction', () => prisma.walletTransaction.deleteMany({})],
      ['SupportMessage', () => prisma.supportMessage.deleteMany({})],
      ['SupportTicket', () => prisma.supportTicket.deleteMany({})],
      ['Reservation', () => prisma.reservation.deleteMany({})],
      ['EventAttendee', () => prisma.eventAttendee.deleteMany({})],
      ['OfferRedemption', () => prisma.offerRedemption.deleteMany({})],
      ['DataDeletionRequest', () => prisma.dataDeletionRequest.deleteMany({})],
      ['DataExportRequest', () => prisma.dataExportRequest.deleteMany({})],
      ['LoginAttempt', () => prisma.loginAttempt.deleteMany({})],
      ['Otp', () => prisma.otp.deleteMany({})],
      ['Session', () => prisma.session.deleteMany({})],
      ['UserInterest (otros)', () => prisma.userInterest.deleteMany({ where: { userId: { notIn: keepIds } } })],
      ['UserConsent (otros)', () => prisma.userConsent.deleteMany({ where: { userId: { notIn: keepIds } } })],
      ['UserProfile (otros)', () => prisma.userProfile.deleteMany({ where: { userId: { notIn: keepIds } } })],
      ['User (otros)', () => prisma.user.deleteMany({ where: { id: { notIn: keepIds } } })],
    ];

    let total = 0;
    for (const [name, fn] of steps) {
      const res = await fn();
      if (res.count > 0) console.log(`  - ${name}: ${res.count}`);
      total += res.count;
    }
    const restantes = await prisma.user.findMany({ select: { email: true, role: true } });
    console.log(`\nWipe completo. Filas borradas: ${total}`);
    console.log('Cuentas restantes: ' + restantes.map((r) => `${r.email}(${r.role})`).join(', '));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
