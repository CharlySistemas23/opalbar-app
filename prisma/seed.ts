// ─────────────────────────────────────────────
//  OPALBAR — Database Seed
//  Populates: loyalty levels, event categories,
//  venue, admin user, sample events & offers
// ─────────────────────────────────────────────
import { PrismaClient, UserRole, UserStatus, EventStatus, OfferType, OfferStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding OPALBAR database…');

  // ── Loyalty Levels ─────────────────────────

  console.log('  → Loyalty levels…');
  const levels = await Promise.all([
    prisma.loyaltyLevel.upsert({
      where: { slug: 'bronce' },
      update: {},
      create: {
        name: 'Bronce', nameEn: 'Bronze', slug: 'bronce',
        minPoints: 0, maxPoints: 499,
        color: '#CD7F32', icon: 'medal',
        benefits: ['5% de descuento en la barra', 'Acceso a eventos regulares'],
        sortOrder: 1,
      },
    }),
    prisma.loyaltyLevel.upsert({
      where: { slug: 'plata' },
      update: {},
      create: {
        name: 'Plata', nameEn: 'Silver', slug: 'plata',
        minPoints: 500, maxPoints: 1499,
        color: '#C0C0C0', icon: 'medal',
        benefits: ['10% de descuento en la barra', 'Invitaciones a pre-ventas', 'Mesa preferencial'],
        sortOrder: 2,
      },
    }),
    prisma.loyaltyLevel.upsert({
      where: { slug: 'oro' },
      update: {},
      create: {
        name: 'Oro', nameEn: 'Gold', slug: 'oro',
        minPoints: 1500, maxPoints: 4999,
        color: '#FFD700', icon: 'crown',
        benefits: ['15% de descuento en la barra', 'Acceso VIP a eventos', 'Bebida de bienvenida mensual', 'Mesa reservada'],
        sortOrder: 3,
      },
    }),
    prisma.loyaltyLevel.upsert({
      where: { slug: 'diamante' },
      update: {},
      create: {
        name: 'Diamante', nameEn: 'Diamond', slug: 'diamante',
        minPoints: 5000, maxPoints: null,
        color: '#B9F2FF', icon: 'gem',
        benefits: [
          '20% de descuento en la barra', 'Acceso VIP ilimitado',
          'Botella mensual incluida', 'Concierge personal',
          'Invitaciones exclusivas a eventos privados',
        ],
        sortOrder: 4,
      },
    }),
  ]);
  console.log(`    ✅ ${levels.length} loyalty levels created`);

  // ── Event Categories ───────────────────────

  console.log('  → Event categories…');
  const categories = await Promise.all([
    prisma.eventCategory.upsert({
      where: { slug: 'musica-en-vivo' },
      update: {},
      create: { name: 'Música en Vivo', nameEn: 'Live Music', slug: 'musica-en-vivo', icon: 'music', color: '#F4A340', sortOrder: 1 },
    }),
    prisma.eventCategory.upsert({
      where: { slug: 'dj-set' },
      update: {},
      create: { name: 'DJ Set', nameEn: 'DJ Set', slug: 'dj-set', icon: 'disc', color: '#60A5FA', sortOrder: 2 },
    }),
    prisma.eventCategory.upsert({
      where: { slug: 'karaoke' },
      update: {},
      create: { name: 'Karaoke', nameEn: 'Karaoke', slug: 'karaoke', icon: 'mic', color: '#38C793', sortOrder: 3 },
    }),
    prisma.eventCategory.upsert({
      where: { slug: 'cata-de-vinos' },
      update: {},
      create: { name: 'Cata de Vinos', nameEn: 'Wine Tasting', slug: 'cata-de-vinos', icon: 'wine', color: '#E45858', sortOrder: 4 },
    }),
    prisma.eventCategory.upsert({
      where: { slug: 'trivia' },
      update: {},
      create: { name: 'Trivia', nameEn: 'Trivia Night', slug: 'trivia', icon: 'help-circle', color: '#F4A340', sortOrder: 5 },
    }),
    prisma.eventCategory.upsert({
      where: { slug: 'especial' },
      update: {},
      create: { name: 'Especial', nameEn: 'Special', slug: 'especial', icon: 'star', color: '#FFD700', sortOrder: 6 },
    }),
  ]);
  console.log(`    ✅ ${categories.length} categories created`);

  // ── Venue ──────────────────────────────────

  console.log('  → Venue…');
  const venue = await prisma.venue.upsert({
    where: { slug: 'opalbar-cdmx' },
    update: {},
    create: {
      name: 'OPALBAR CDMX',
      slug: 'opalbar-cdmx',
      description: 'El bar de la comunidad. Donde siempre hay algo pasando.',
      address: 'Av. Álvaro Obregón 123',
      city: 'Ciudad de México',
      state: 'CDMX',
      country: 'MX',
      zipCode: '06700',
      lat: 19.4178,
      lng: -99.1535,
      phone: '+525512345678',
      email: 'hola@opalbar.com',
      website: 'https://opalbar.com',
      instagram: '@opalbar',
      isActive: true,
    },
  });
  console.log(`    ✅ Venue: ${venue.name}`);

  // ── Admin User ─────────────────────────────

  console.log('  → Admin user…');
  const adminEmail = process.env['ADMIN_EMAIL'] || 'admin@opalbar.com';
  const adminPassword = process.env['ADMIN_PASSWORD'] || 'Admin@123456';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      isVerified: true,
      points: 9999,
      profile: {
        create: {
          firstName: 'Admin',
          lastName: 'OPALBAR',
          language: 'es',
        },
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
  console.log(`    ✅ Admin: ${admin.email}`);

  // ── Sample Events ──────────────────────────

  console.log('  → Sample events…');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const events = await Promise.all([
    prisma.event.upsert({
      where: { id: 'seed-event-001' },
      update: {},
      create: {
        id: 'seed-event-001',
        title: 'Noche de Jazz en Vivo',
        titleEn: 'Live Jazz Night',
        description: 'Una noche mágica con los mejores músicos de jazz de la ciudad. Disfruta de cócteles artesanales mientras te sumerges en la mejor música.',
        descriptionEn: 'A magical night with the best jazz musicians in the city. Enjoy craft cocktails while immersing yourself in the finest music.',
        imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
        venueId: venue.id,
        categoryId: categories[0].id,
        startDate: tomorrow,
        endDate: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000),
        maxCapacity: 80,
        isFree: false,
        price: 200,
        tags: ['jazz', 'musica', 'cocteleria'],
        pointsReward: 100,
        isHighlighted: true,
        status: EventStatus.PUBLISHED,
        createdById: admin.id,
      },
    }),
    prisma.event.upsert({
      where: { id: 'seed-event-002' },
      update: {},
      create: {
        id: 'seed-event-002',
        title: 'DJ Set Electrónico: NEON',
        titleEn: 'Electronic DJ Set: NEON',
        description: 'El DJ NEON regresa con su set más explosivo del año. Luces, sonido inmersivo y la mejor música electrónica.',
        descriptionEn: 'DJ NEON returns with his most explosive set of the year. Lights, immersive sound, and the best electronic music.',
        imageUrl: 'https://images.unsplash.com/photo-1571266028243-e4e7b0ad6b1a?w=800',
        venueId: venue.id,
        categoryId: categories[1].id,
        startDate: nextWeek,
        endDate: new Date(nextWeek.getTime() + 6 * 60 * 60 * 1000),
        maxCapacity: 150,
        isFree: true,
        tags: ['electronica', 'dj', 'fiesta'],
        pointsReward: 75,
        isHighlighted: true,
        status: EventStatus.PUBLISHED,
        createdById: admin.id,
      },
    }),
    prisma.event.upsert({
      where: { id: 'seed-event-003' },
      update: {},
      create: {
        id: 'seed-event-003',
        title: 'Trivia Night: Cultura Pop',
        titleEn: 'Trivia Night: Pop Culture',
        description: 'Pon a prueba tus conocimientos de cultura pop en equipo. Premios para los tres primeros lugares y bebidas gratis para el campeón.',
        descriptionEn: 'Test your pop culture knowledge in teams. Prizes for the top three places and free drinks for the champion.',
        venueId: venue.id,
        categoryId: categories[4].id,
        startDate: new Date(tomorrow.getTime() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(tomorrow.getTime() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        isFree: true,
        tags: ['trivia', 'juegos', 'equipo'],
        pointsReward: 50,
        isHighlighted: false,
        status: EventStatus.PUBLISHED,
        createdById: admin.id,
      },
    }),
  ]);
  console.log(`    ✅ ${events.length} events created`);

  // ── Sample Offers ──────────────────────────

  console.log('  → Sample offers…');
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 3);

  const offers = await Promise.all([
    prisma.offer.upsert({
      where: { id: 'seed-offer-001' },
      update: {},
      create: {
        id: 'seed-offer-001',
        title: '2×1 en Cócteles los Lunes',
        titleEn: '2-for-1 Cocktails on Mondays',
        description: 'Todos los lunes disfruta de 2 cócteles artesanales al precio de 1. Válido de 18:00 a 21:00.',
        descriptionEn: 'Every Monday enjoy 2 craft cocktails for the price of 1. Valid from 6pm to 9pm.',
        venueId: venue.id,
        type: OfferType.BUY_ONE_GET_ONE,
        status: OfferStatus.ACTIVE,
        startDate,
        endDate,
        daysOfWeek: [1], // Monday
        startTime: '18:00',
        endTime: '21:00',
        maxPerUser: 4,
        isHighlighted: true,
        createdById: admin.id,
      },
    }),
    prisma.offer.upsert({
      where: { id: 'seed-offer-002' },
      update: {},
      create: {
        id: 'seed-offer-002',
        title: '15% de Descuento para Miembros',
        titleEn: '15% Member Discount',
        description: 'Presenta tu código de miembro y obtén 15% de descuento en tu consumo total. Válido todos los días.',
        descriptionEn: 'Show your member code and get 15% off your total bill. Valid every day.',
        venueId: venue.id,
        type: OfferType.PERCENTAGE,
        status: OfferStatus.ACTIVE,
        discountValue: 15,
        startDate,
        endDate,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        maxPerUser: 1,
        isHighlighted: false,
        pointsRequired: 500,
        createdById: admin.id,
      },
    }),
    prisma.offer.upsert({
      where: { id: 'seed-offer-003' },
      update: {},
      create: {
        id: 'seed-offer-003',
        title: 'Shot Gratis con tu Primer Pedido',
        titleEn: 'Free Shot with Your First Order',
        description: 'Bienvenido a OPALBAR. Tu primera visita incluye un shot de cortesía al realizar tu primer pedido.',
        descriptionEn: 'Welcome to OPALBAR. Your first visit includes a complimentary shot with your first order.',
        venueId: venue.id,
        type: OfferType.FREE_ITEM,
        status: OfferStatus.ACTIVE,
        startDate,
        endDate,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        maxRedemptions: 500,
        maxPerUser: 1,
        isHighlighted: true,
        createdById: admin.id,
      },
    }),
  ]);
  console.log(`    ✅ ${offers.length} offers created`);

  // ── App Config ────────────────────────────

  console.log('  → App config…');
  await Promise.all([
    prisma.appConfig.upsert({
      where: { key: 'app_version' },
      update: { value: '1.0.0' },
      create: { key: 'app_version', value: '1.0.0', isPublic: true },
    }),
    prisma.appConfig.upsert({
      where: { key: 'min_app_version' },
      update: { value: '1.0.0' },
      create: { key: 'min_app_version', value: '1.0.0', isPublic: true },
    }),
    prisma.appConfig.upsert({
      where: { key: 'maintenance_mode' },
      update: { value: 'false' },
      create: { key: 'maintenance_mode', value: 'false', isPublic: true },
    }),
    prisma.appConfig.upsert({
      where: { key: 'welcome_points' },
      update: { value: '100' },
      create: { key: 'welcome_points', value: '100', isPublic: false },
    }),
  ]);
  console.log('    ✅ App config ready');

  console.log('\n✅ Database seeded successfully!');
  console.log(`\n🔑 Admin credentials:\n   Email: ${adminEmail}\n   Password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
