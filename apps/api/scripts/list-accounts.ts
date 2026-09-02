// Listado read-only de cuentas (para confirmar antes de un wipe).
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!dbUrl) { console.error('sin DATABASE_URL'); process.exit(1); }
  const pool = new Pool({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const users = await prisma.user.findMany({
      select: { email: true, role: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`TOTAL usuarios: ${users.length}`);
    for (const u of users) console.log(`  ${u.role.padEnd(12)} ${u.status.padEnd(22)} ${u.email}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
