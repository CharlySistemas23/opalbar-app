# OPALBAR APP — Technical Documentation

> "Siempre hay algo pasando, y tú te enteras primero."

## Stack Overview

| Layer | Technology |
|---|---|
| Monorepo | Nx 22 |
| Backend API | NestJS 10 + TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Cache / Sessions | Redis 7 (ioredis) |
| Auth | JWT (access 15m + refresh 30d) + OTP email/SMS |
| Email | Nodemailer (SMTP) |
| SMS | Twilio |
| Mobile | React Native (Expo) |
| State Management | Zustand + AsyncStorage |
| CI/CD | GitHub Actions |
| Containerization | Docker + docker-compose |
| Rate Limiting | @nestjs/throttler (global + per-route) |
| Docs | Swagger / OpenAPI 3.0 |

---

## Project Structure

```
opalbar-app/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── app/            # AppModule (root)
│   │   │   ├── config/         # Configuration + Joi validation
│   │   │   ├── database/       # PrismaService + RedisService
│   │   │   ├── common/         # Filters, guards, interceptors, decorators
│   │   │   └── modules/
│   │   │       ├── auth/       # JWT auth, strategies, sessions
│   │   │       ├── otp/        # Email + SMS OTP
│   │   │       ├── users/      # Profile, interests, GDPR
│   │   │       ├── events/     # CRUD + attendance
│   │   │       ├── offers/     # CRUD + redemption
│   │   │       ├── community/  # Posts, comments, reactions, reports
│   │   │       ├── wallet/     # Points, loyalty levels, transactions
│   │   │       ├── notifications/ # In-app + push (FCM/APNs)
│   │   │       ├── admin/      # Moderation, roles, ban, stats
│   │   │       └── health/     # Health check endpoint
│   │   └── Dockerfile
│   ├── api-e2e/                # End-to-end tests
│   └── mobile/                 # React Native (Expo) app
│       └── src/
│           ├── api/            # Axios client + auto-refresh interceptor
│           ├── constants/      # Design tokens (colors, typography, spacing)
│           ├── stores/         # Zustand stores (auth, app)
│           ├── navigation/     # Routes constants
│           └── features/       # Feature folders (auth, home, events, etc.)
├── libs/
│   ├── shared-types/           # TypeScript types shared between api + mobile
│   └── shared-utils/           # Shared utility functions
├── prisma/
│   ├── schema.prisma           # Full database schema (25+ models, 15+ enums)
│   └── seed.ts                 # Database seeder
├── docker-compose.yml          # PostgreSQL + Redis + MailHog (dev)
├── .env.example                # Environment variables template
└── .github/workflows/ci.yml    # CI/CD pipeline
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop
- npm 10+

### 1. Clone and install

```bash
git clone <repo-url> opalbar-app
cd opalbar-app
npm install
```

### 2. Environment setup

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start services (PostgreSQL + Redis)

```bash
docker-compose up -d postgres redis
```

Optional — start MailHog for email testing:
```bash
docker-compose --profile dev up -d mailhog
# Access web UI at http://localhost:8025
```

### 4. Setup database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed with test data
npx prisma db seed
```

### 5. Start the API

```bash
npx nx serve api
# API running at http://localhost:3000/api/v1
# Swagger docs at http://localhost:3000/docs
```

---

## API Endpoints

| Module | Method | Endpoint | Auth |
|---|---|---|---|
| **Health** | GET | `/health` | Public |
| **Auth** | POST | `/auth/register` | Public |
| **Auth** | POST | `/auth/login` | Public |
| **Auth** | POST | `/auth/refresh` | Public |
| **Auth** | POST | `/auth/logout` | JWT |
| **Auth** | POST | `/auth/logout-all` | JWT |
| **Auth** | GET | `/auth/me` | JWT |
| **Auth** | POST | `/auth/change-password` | JWT |
| **Auth** | POST | `/auth/reset-password` | Public |
| **Auth** | GET | `/auth/sessions` | JWT |
| **Auth** | DELETE | `/auth/sessions/:id` | JWT |
| **OTP** | POST | `/otp/send` | Public |
| **OTP** | POST | `/otp/verify` | Public |
| **Users** | GET | `/users/me` | JWT |
| **Users** | PATCH | `/users/me/profile` | JWT |
| **Users** | PATCH | `/users/me/interests` | JWT |
| **Users** | PATCH | `/users/me/notifications` | JWT |
| **Users** | PATCH | `/users/me/consent` | JWT |
| **Users** | POST | `/users/me/export` | JWT |
| **Users** | DELETE | `/users/me` | JWT |
| **Events** | GET | `/events` | Public |
| **Events** | GET | `/events/categories` | Public |
| **Events** | GET | `/events/my` | JWT |
| **Events** | GET | `/events/:id` | Public |
| **Events** | POST | `/events` | Admin |
| **Events** | PATCH | `/events/:id` | Admin |
| **Events** | DELETE | `/events/:id` | Admin |
| **Events** | POST | `/events/:id/attend` | JWT |
| **Events** | DELETE | `/events/:id/attend` | JWT |
| **Offers** | GET | `/offers` | Public |
| **Offers** | GET | `/offers/my` | JWT |
| **Offers** | GET | `/offers/:id` | Public |
| **Offers** | POST | `/offers` | Admin |
| **Offers** | POST | `/offers/:id/redeem` | JWT |
| **Community** | GET | `/community/posts` | Public |
| **Community** | GET | `/community/posts/:id` | Public |
| **Community** | POST | `/community/posts` | JWT |
| **Community** | PATCH | `/community/posts/:id` | JWT |
| **Community** | DELETE | `/community/posts/:id` | JWT |
| **Community** | GET | `/community/posts/:id/comments` | Public |
| **Community** | POST | `/community/posts/:id/comments` | JWT |
| **Community** | DELETE | `/community/comments/:id` | JWT |
| **Community** | POST | `/community/posts/:id/react` | JWT |
| **Community** | POST | `/community/posts/:id/report` | JWT |
| **Community** | GET | `/community/ranking` | Public |
| **Wallet** | GET | `/wallet` | JWT |
| **Wallet** | GET | `/wallet/transactions` | JWT |
| **Wallet** | GET | `/wallet/levels` | Public |
| **Notifications** | GET | `/notifications` | JWT |
| **Notifications** | PATCH | `/notifications/:id/read` | JWT |
| **Notifications** | PATCH | `/notifications/read-all` | JWT |
| **Notifications** | DELETE | `/notifications/:id` | JWT |
| **Admin** | GET | `/admin/stats` | Admin |
| **Admin** | GET | `/admin/users` | Admin |
| **Admin** | PATCH | `/admin/users/:id/ban` | Admin |
| **Admin** | PATCH | `/admin/users/:id/unban` | Admin |
| **Admin** | PATCH | `/admin/users/:id/role` | SuperAdmin |
| **Admin** | GET | `/admin/posts/pending` | Admin |
| **Admin** | PATCH | `/admin/posts/:id/approve` | Admin |
| **Admin** | PATCH | `/admin/posts/:id/reject` | Admin |
| **Admin** | GET | `/admin/reports` | Admin |
| **Admin** | PATCH | `/admin/reports/:id/resolve` | Admin |

---

## Database Schema

25+ models across 6 domains:

| Domain | Models |
|---|---|
| Auth | User, UserProfile, UserInterest, UserConsent, Session, Otp, LoginAttempt |
| Venue | Venue |
| Events | EventCategory, Event, EventMedia, EventAttendee |
| Offers | Offer, OfferRedemption |
| Community | Post, Comment, Reaction, Report, ModerationLog |
| Wallet | LoyaltyLevel, WalletTransaction, NotificationSettings, Notification |
| GDPR | DataDeletionRequest, DataExportRequest |
| Config | AppConfig |

---

## Auth Flow

```
Register → POST /auth/register (creates user, sends OTP)
Verify   → POST /otp/verify (activates account)
Login    → POST /auth/login (returns access + refresh tokens)
Refresh  → POST /auth/refresh (rotates both tokens)
Logout   → POST /auth/logout (blocklists access token in Redis)
```

### JWT Strategy

- **Access token**: 15 minutes, validated on every request
- **Refresh token**: 30 days, stored in DB session, rotated on use
- **Blocklist**: revoked access tokens stored in Redis with TTL

---

## Security Features

| Feature | Implementation |
|---|---|
| Password hashing | bcryptjs (12 rounds) |
| JWT access token | 15m expiry + jti blocklist in Redis |
| JWT refresh token | 30d expiry + DB session + rotation |
| Rate limiting | ThrottlerModule (default: 100/min, auth: 10/min, OTP: 3/5min) |
| Input validation | class-validator + ValidationPipe (whitelist + transform) |
| CORS | Strict origin in production |
| Helmet | HTTP security headers |
| Soft deletes | deletedAt on User, Post, Comment |
| GDPR | Data export + deletion requests with 30-day delay |

---

## Available Scripts

```bash
# Development
npx nx serve api              # Start API dev server
npx nx build api              # Build API for production

# Database
npx prisma migrate dev        # Create and apply migration
npx prisma db push            # Push schema without migration
npx prisma db seed            # Seed database
npx prisma studio             # Open Prisma Studio GUI

# Testing
npx nx test api               # Run unit tests
npx nx e2e api-e2e            # Run E2E tests
npx nx test api --coverage    # Tests with coverage report

# Code quality
npx nx lint api               # Lint
npx prettier --write .        # Format all files

# Docker
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f api    # Stream API logs
```

---

## Environment Variables

See `.env.example` for the complete list with descriptions.

Required for minimum dev setup:
```env
DATABASE_URL=postgresql://opalbar:opalbar_secret@localhost:5432/opalbar_db
JWT_ACCESS_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<min 32 chars>
SMTP_HOST=localhost
SMTP_USER=dev@opalbar.com
SMTP_PASS=dev
EMAIL_FROM=OPALBAR Dev <dev@opalbar.com>
ADMIN_EMAIL=admin@opalbar.com
ADMIN_PASSWORD=Admin@123456
```

---

## CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`):

```
Push / PR
    └── Lint & Format check
           └── Unit tests (with coverage)
                  └── Build
                         └── E2E tests (main/develop only)
                                └── Docker build & push (main only)
```

---

## Fase 2 Status: ✅ COMPLETADA

| Bloque | Estado |
|---|---|
| Monorepo (Nx) + apps + libs | ✅ |
| Prisma schema (25+ modelos) | ✅ |
| Redis service | ✅ |
| Variables de entorno + validación Joi | ✅ |
| AuthModule (JWT + refresh + sessions) | ✅ |
| OTPModule (email + SMS + Redis cache) | ✅ |
| Rate Limiting (ThrottlerModule) | ✅ |
| UsersModule (perfil, intereses, GDPR) | ✅ |
| EventsModule (CRUD + asistencia) | ✅ |
| OffersModule (CRUD + canje + validación) | ✅ |
| CommunityModule (posts + comentarios + reacciones + reportes) | ✅ |
| WalletModule (puntos + niveles + historial) | ✅ |
| NotificationsModule (in-app + push) | ✅ |
| AdminModule (moderación + roles + ban) | ✅ |
| HealthModule (/health endpoint) | ✅ |
| Swagger / OpenAPI completo | ✅ |
| Common: filtros, guards, interceptors, decorators | ✅ |
| Database seed (loyalty levels, categorías, venue, admin) | ✅ |
| Dockerfile + docker-compose | ✅ |
| GitHub Actions CI/CD | ✅ |
| Unit tests (AuthService, WalletService) | ✅ |
| Mobile design tokens | ✅ |
| Mobile API client (axios + auto-refresh) | ✅ |
| Mobile Zustand stores (auth, app) | ✅ |
| Mobile navigation routes | ✅ |
| README técnico completo | ✅ |
