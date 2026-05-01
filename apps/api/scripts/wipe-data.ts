// ─────────────────────────────────────────────
//  wipe-data.ts — Reset productivo de datos de usuario.
//
//  CONSERVA: Venue, Event*, Offer, LoyaltyLevel, AppConfig, FeatureFlag,
//            SupportQuickReply, FilterRule, MarketingAsset, EmailCampaign
//            (templates), y la(s) cuenta(s) SUPER_ADMIN para no perder acceso.
//
//  BORRA: usuarios no-admin, sesiones (inclusive del admin para forzar relogin),
//         posts/stories/comments/reactions, mensajes, follows/friendships,
//         reservas, redenciones, notificaciones, push tokens, audit logs, etc.
//
//  Uso:
//    railway run npx ts-node apps/api/scripts/wipe-data.ts --confirm=YES_BORRAR
//  o seteando DATABASE_URL manualmente:
//    DATABASE_URL=postgres://... npx ts-node apps/api/scripts/wipe-data.ts --confirm=YES_BORRAR
// ─────────────────────────────────────────────

import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function getArg(name: string): string | undefined {
  const flag = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(flag));
  if (a) return a.slice(flag.length);
  return process.env[name.toUpperCase()];
}

async function main() {
  const confirm = getArg('confirm');
  if (confirm !== 'YES_BORRAR') {
    console.error('FALTA confirmacion. Pasa --confirm=YES_BORRAR para ejecutar.');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL no esta seteada en el entorno.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Buscando cuentas SUPER_ADMIN para preservarlas...');
    const admins = await prisma.user.findMany({
      where: { role: UserRole.SUPER_ADMIN },
      select: { id: true, email: true },
    });
    if (admins.length === 0) {
      console.error('No hay ningun SUPER_ADMIN. Aborto para no quedarte sin acceso.');
      process.exit(1);
    }
    const adminIds = admins.map((a) => a.id);
    console.log(`Conservare ${admins.length} SUPER_ADMIN: ${admins.map((a) => a.email).join(', ')}`);

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
      ['UserInterest (no-admin)', () => prisma.userInterest.deleteMany({ where: { userId: { notIn: adminIds } } })],
      ['UserConsent (no-admin)', () => prisma.userConsent.deleteMany({ where: { userId: { notIn: adminIds } } })],
      ['UserProfile (no-admin)', () => prisma.userProfile.deleteMany({ where: { userId: { notIn: adminIds } } })],
      ['User (no-admin)', () => prisma.user.deleteMany({ where: { id: { notIn: adminIds } } })],
    ];

    let total = 0;
    for (const [name, fn] of steps) {
      try {
        const res = await fn();
        if (res.count > 0) console.log(`  - ${name}: borrados ${res.count}`);
        total += res.count;
      } catch (e: any) {
        console.error(`  ! ${name}: ERROR ${e.message ?? e}`);
        throw e;
      }
    }

    console.log('');
    console.log(`Wipe completo. Total filas borradas: ${total}`);
    console.log('SUPER_ADMIN(s) preservados pueden iniciar sesion con sus credenciales actuales.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
