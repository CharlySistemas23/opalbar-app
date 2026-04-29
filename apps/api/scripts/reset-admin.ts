// ─────────────────────────────────────────────
//  reset-admin.ts — one-shot script to set/replace the SUPER_ADMIN account
//
//  Reads ADMIN_EMAIL and ADMIN_PASSWORD from env (or args). If a user with
//  that email exists, promotes them to SUPER_ADMIN and resets the password.
//  Otherwise, looks up any existing SUPER_ADMIN and renames its email +
//  resets its password (so legacy admin@opalbar.com seed account becomes
//  the real admin in one step).
//
//  Usage on Railway:
//    railway run npx ts-node apps/api/scripts/reset-admin.ts \
//      --email=carlosalonsog966@gmail.com \
//      --password=YourNewPassword123!
//
//  Or via env:
//    railway run \
//      ADMIN_EMAIL=carlosalonsog966@gmail.com \
//      ADMIN_PASSWORD=YourNewPassword123! \
//      npx ts-node apps/api/scripts/reset-admin.ts
// ─────────────────────────────────────────────

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
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
    console.error(
      'Falta --email o --password (o las env vars ADMIN_EMAIL / ADMIN_PASSWORD).',
    );
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`Email invalido: ${email}`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password tiene que ser de al menos 8 caracteres.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);

    // 1) Si ya existe un user con ese email, promover y resetear password
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          isVerified: true,
          passwordHash,
        },
      });
      console.log(
        `[OK] Usuario ${email} ya existia. Promovido a SUPER_ADMIN y password reseteado.`,
      );
      return;
    }

    // 2) Si no existe, buscar cualquier SUPER_ADMIN previo (admin@opalbar.com
    //    del seed por ejemplo) y mutar su email + password.
    const legacy = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
      orderBy: { createdAt: 'asc' },
    });
    if (legacy) {
      await prisma.user.update({
        where: { id: legacy.id },
        data: {
          email,
          passwordHash,
          status: UserStatus.ACTIVE,
          isVerified: true,
        },
      });
      console.log(
        `[OK] SUPER_ADMIN existente (era ${legacy.email}) renombrado a ${email}, password reseteado.`,
      );
      return;
    }

    // 3) No habia ninguno: crear uno limpio
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        isVerified: true,
        profile: {
          create: { firstName: 'Admin', lastName: 'OPALBAR', language: 'es' },
        },
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
    console.log(`[OK] SUPER_ADMIN creado desde cero (id=${created.id}, email=${email}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
