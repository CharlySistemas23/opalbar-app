// One-shot cleanup — usuarios @opalbar.com que NO se pudieron borrar
// (tienen logs/refs históricas) se renombran a carlosalonsog966+seed-XXX@gmail.com
// para que no generen bounces cuando reciban campañas.
//
// Gmail interpreta `usuario+algo@gmail.com` como el mismo buzón, así que
// cualquier email a esa dirección llega a tu inbox normal.
//
// Usage:
//   DATABASE_URL=postgres://... npx ts-node apps/api/scripts/rename-opalbar-emails.ts

import { PrismaClient, UserStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

(async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error('DATABASE_URL faltante'); process.exit(1); }
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const targets = await prisma.user.findMany({
      where: { email: { contains: '@opalbar.com' } },
      select: { id: true, email: true, role: true },
    });
    console.log(`A renombrar (${targets.length}):`);

    for (const t of targets) {
      if (!t.email) continue;
      // Use the local-part as the +tag. e.g. admin@opalbar.com → carlosalonsog966+admin@gmail.com
      const tag = t.email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 30);
      const newEmail = `carlosalonsog966+seed-${tag}@gmail.com`;
      await prisma.user.update({
        where: { id: t.id },
        data: {
          email: newEmail,
          // keep them as DELETED so don't show on lists / audiences
          status: UserStatus.DELETED,
        },
      });
      console.log(`  ✓ ${t.email} → ${newEmail} (status: DELETED)`);
    }

    const left = await prisma.user.count({ where: { email: { contains: '@opalbar.com' } } });
    console.log(`\nQuedan @opalbar.com: ${left}`);
  } finally {
    await prisma.$disconnect();
  }
})();
