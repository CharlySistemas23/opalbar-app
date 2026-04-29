// One-shot cleanup — borra usuarios cuyo email esté en @opalbar.com
// (cuentas de seed/test que no tienen buzón real y generan bounces
// cada vez que les llega una campaña).
//
// Usage:
//   DATABASE_URL=postgres://... npx ts-node apps/api/scripts/delete-opalbar-emails.ts

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
    const targets = await prisma.user.findMany({
      where: { email: { contains: '@opalbar.com' } },
      select: { id: true, email: true, role: true },
    });
    console.log(`A borrar (${targets.length}):`);
    for (const t of targets) console.log(`  · ${t.email} (${t.role})`);

    if (targets.length === 0) { console.log('Nada que borrar.'); return; }

    for (const t of targets) {
      await prisma.user.delete({ where: { id: t.id } }).catch((e) => {
        console.error(`  ✗ No pude borrar ${t.email}: ${e.message}`);
      });
      console.log(`  ✓ Borrado ${t.email}`);
    }

    const left = await prisma.user.count({ where: { email: { contains: '@opalbar.com' } } });
    console.log(`\nQuedan @opalbar.com: ${left}`);
  } finally {
    await prisma.$disconnect();
  }
})();
