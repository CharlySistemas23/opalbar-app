// ─────────────────────────────────────────────
//  create-demo-user.ts — one-shot: crea/actualiza una cuenta USER de prueba
//  (para el revisor de Apple). ACTIVE + verificada, con profile + consent.
//
//  Usage:
//    railway run npx ts-node apps/api/scripts/create-demo-user.ts \
//      --email=apple.review@opalbar.com.mx --password=OpalReview2026!
//  o con DATABASE_URL público directo en el entorno.
// ─────────────────────────────────────────────

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

function getArg(name: string): string | undefined {
  const flag = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(flag));
  if (a) return a.slice(flag.length);
  return process.env[name.toUpperCase()];
}

async function main() {
  const email = getArg('email');
  const password = getArg('password');
  if (!email || !password) {
    console.error('Falta --email o --password (o EMAIL / PASSWORD).');
    process.exit(1);
  }

  // Prefer the public proxy URL so this can run from a laptop (the internal
  // postgres.railway.internal host is only reachable inside Railway's network).
  const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL / DATABASE_PUBLIC_URL no está seteada.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: UserRole.USER, status: UserStatus.ACTIVE, isVerified: true, passwordHash },
      });
      console.log(`[OK] ${email} ya existía. Reseteado a USER ACTIVE verificado.`);
      return;
    }
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        isVerified: true,
        profile: { create: { firstName: 'Apple', lastName: 'Reviewer', language: 'es' } },
        consent: {
          create: {
            termsAccepted: true,
            privacyAccepted: true,
            termsVersion: '1.0',
            privacyVersion: '1.0',
          },
        },
      },
    });
    console.log(`[OK] Cuenta demo creada (id=${created.id}, email=${email}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
