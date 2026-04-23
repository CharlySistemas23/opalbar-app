// ─────────────────────────────────────────────
//  One-shot cleanup: null out all `data:image/...` base64 values across the DB.
//
//  Migration from base64-in-Postgres → Cloudinary CDN URLs. Any remaining
//  base64 rows are either seed/test data or pre-migration posts that will
//  simply show with no image (the UI already handles missing imageUrl).
//
//  Usage (against Railway):
//    DATABASE_URL="postgresql://...railway..." npx tsx scripts/cleanup-base64-images.ts
//
//  Pass --dry to only count rows without mutating anything:
//    DATABASE_URL="..." npx tsx scripts/cleanup-base64-images.ts --dry
// ─────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const DRY_RUN = process.argv.includes('--dry');
const LIKE = 'data:image%';

async function count(table: string, column: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*)::bigint AS n FROM "${table}" WHERE "${column}" LIKE $1`,
    LIKE,
  );
  return Number(rows[0]?.n ?? 0n);
}

async function nullify(table: string, column: string): Promise<number> {
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET "${column}" = NULL WHERE "${column}" LIKE $1`,
    LIKE,
  );
  return Number(result);
}

async function countStoryBase64(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*)::bigint AS n FROM "Story" WHERE "mediaUrl" LIKE $1`,
    LIKE,
  );
  return Number(rows[0]?.n ?? 0n);
}

async function deleteStoryBase64(): Promise<number> {
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM "Story" WHERE "mediaUrl" LIKE $1`,
    LIKE,
  );
  return Number(result);
}

// Post.mediaUrls is a TEXT[] — need array-aware filtering.
async function countPostMediaUrlsBase64(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*)::bigint AS n FROM "Post"
     WHERE EXISTS (
       SELECT 1 FROM unnest("mediaUrls") u WHERE u LIKE $1
     )`,
    LIKE,
  );
  return Number(rows[0]?.n ?? 0n);
}

async function cleanPostMediaUrlsArray(): Promise<number> {
  // Strip only base64 entries from each array, keep http(s) ones.
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "Post"
     SET "mediaUrls" = COALESCE(
       (SELECT array_agg(u) FROM unnest("mediaUrls") u WHERE u NOT LIKE $1),
       ARRAY[]::text[]
     )
     WHERE EXISTS (
       SELECT 1 FROM unnest("mediaUrls") u WHERE u LIKE $1
     )`,
    LIKE,
  );
  return Number(result);
}

// Target tables/columns. Story is handled separately (mediaUrl is NOT NULL →
// we DELETE those rows since stories are ephemeral anyway).
const TARGETS: Array<{ table: string; column: string }> = [
  { table: 'UserProfile', column: 'avatarUrl' },
  { table: 'UserProfile', column: 'coverUrl' },
  { table: 'Venue', column: 'imageUrl' },
  { table: 'Venue', column: 'coverUrl' },
  { table: 'Event', column: 'imageUrl' },
  { table: 'Event', column: 'coverUrl' },
  { table: 'Offer', column: 'imageUrl' },
  { table: 'Post', column: 'imageUrl' },
  { table: 'Notification', column: 'imageUrl' },
];

async function main() {
  console.log(`\n🧹 Cleanup base64 images — ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE RUN (will mutate DB)'}\n`);

  let grandTotal = 0;

  // Nullable columns
  for (const { table, column } of TARGETS) {
    const n = await count(table, column);
    grandTotal += n;
    if (n === 0) {
      console.log(`  ✓ ${table}.${column}: clean`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  • ${table}.${column}: ${n} rows would be nulled`);
    } else {
      const updated = await nullify(table, column);
      console.log(`  ✔ ${table}.${column}: ${updated} rows nulled`);
    }
  }

  // Post.mediaUrls (array)
  const nArr = await countPostMediaUrlsBase64();
  grandTotal += nArr;
  if (nArr === 0) {
    console.log(`  ✓ Post.mediaUrls: clean`);
  } else if (DRY_RUN) {
    console.log(`  • Post.mediaUrls: ${nArr} posts have base64 entries (would strip)`);
  } else {
    const cleaned = await cleanPostMediaUrlsArray();
    console.log(`  ✔ Post.mediaUrls: ${cleaned} posts cleaned`);
  }

  // Story.mediaUrl is required → delete rows instead of nulling.
  const nStory = await countStoryBase64();
  grandTotal += nStory;
  if (nStory === 0) {
    console.log(`  ✓ Story.mediaUrl: clean`);
  } else if (DRY_RUN) {
    console.log(`  • Story.mediaUrl: ${nStory} rows would be DELETED (column is NOT NULL)`);
  } else {
    const deleted = await deleteStoryBase64();
    console.log(`  ✔ Story.mediaUrl: ${deleted} rows deleted`);
  }

  console.log(`\n${DRY_RUN ? '→ Would affect' : '→ Affected'} ${grandTotal} rows total.\n`);
}

main()
  .catch((err) => {
    console.error('✖ Cleanup failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
