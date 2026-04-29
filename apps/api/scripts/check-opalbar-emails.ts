// One-shot diagnostic — list users whose email is on @opalbar.com
// (or any non-deliverable seed-style domain). Run once to confirm
// the bounce-generators were cleaned out.
//
// Usage:
//   DATABASE_URL=postgres://... npx ts-node apps/api/scripts/check-opalbar-emails.ts

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

(async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error('DATABASE_URL faltante'); process.exit(1); }
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const opalbarUsers = await prisma.user.findMany({
      where: { email: { contains: '@opalbar.com' } },
      select: { id: true, email: true, role: true, status: true, createdAt: true },
    });
    console.log(`@opalbar.com users encontrados: ${opalbarUsers.length}`);
    for (const u of opalbarUsers) {
      console.log(`  · ${u.email} | role=${u.role} | status=${u.status} | created=${u.createdAt.toISOString()}`);
    }

    const total = await prisma.user.count();
    const verified = await prisma.user.count({ where: { isVerified: true } });
    console.log(`\nTotal users: ${total}`);
    console.log(`Verified: ${verified}`);
  } finally {
    await prisma.$disconnect();
  }
})();
