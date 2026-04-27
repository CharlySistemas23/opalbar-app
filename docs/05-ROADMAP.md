# OPALBAR — Roadmap

> Estado real al 2026-04-27. Consolida lo que estaba en `archive/PLAN.md`, `archive/PLAN-DEFINITIVO.md` y `archive/FLOW.md`.
> Los .md anteriores quedaron en `docs/archive/` por trazabilidad.

---

## Estado global

**~95% funcional.** Stores-ready en Android cuando:
- Se publique APK production por EAS (no preview).
- Se active APNs para iOS.
- Sentry en producción.

| Bloque | Estado |
|---|---|
| Diseño Pencil 220+ pantallas (ES + EN) | ✅ |
| Backend NestJS (18 módulos, 39 modelos, 105 índices) | ✅ |
| Mobile Expo (87 pantallas tsx) | ✅ |
| Admin web Vercel | ✅ |
| Auth email-OTP + JWT + sesiones | ✅ |
| Push FCM Android | ✅ |
| Push APNs iOS | ⛔ pendiente Apple Dev |
| Realtime `/rt` socket único | ✅ |
| DMs IG/FB-style + reactions + voice + media | ✅ |
| Stories + reactions + reply | ✅ |
| Friendships + DmPolicy | ✅ |
| Cloudinary uploads | ✅ |
| OTA EAS canal preview | ✅ |
| Postgres + Redis Railway | ✅ |
| Sentry / observabilidad | ⛔ |
| Audit log de acciones admin | 🟡 parcial |
| 2FA SUPER_ADMIN | ⛔ |

---

## Olas históricas (de PLAN-DEFINITIVO)

### Ola 1 · Fundación a 10K — ✅ COMPLETADA
- Cache Redis en lecturas públicas con invalidación
- Redis lock en `offers.redeem()` y `reservations.create()`
- Rate limits sanos (default 120/min, auth 20/min, otp 5/5min)
- Denormalizar `ratingAvg` + `ratingCount` en Venue
- Botón "Cómo llegar" en venue/event detail
- Slots de reservación derivados de `openTime/closeTime/slotMinutes`

### Ola 2 · Admin operable — ✅ COMPLETADA
- `/admin/inbox` agregado con urgencia 0-100 y deepLink
- Pantalla "Bandeja de hoy" en dashboard admin
- `useAdminCounts()` polling 30s + badges
- Push a admin/moderadores en eventos críticos
- Bulk actions en cola de posts pending

### Ola 3 · UX a volumen — ✅ COMPLETADA
- Paginación infinita en feeds (events, offers, community, messages, reservations/my)
- `select` estricto en listas públicas
- Auto-nivel loyalty + push LEVEL_UP
- Image upload a Cloudinary
- EmptyState/ErrorState en pantallas restantes

---

## Fase 4 — Hardening pre-store (en curso)

### P0 — Bloqueantes para iOS Store
1. **APNs** — registrar app en Apple Developer Program y configurar APNs key
2. **Mode production EAS** — `eas build --profile production` (canal `production`)
3. **Sentry** — instalar `@sentry/react-native` + `@sentry/node`, DSN por entorno
4. **Audit log completo** — toda acción admin (ban/delete/approve/reject) graba en `ModerationLog`

### P1 — Seguridad y compliance
- 2FA email obligatorio para SUPER_ADMIN
- Session timeout idle 5min en admin web
- IP allowlist Cloudflare para `admin.opalbar.com` (opcional)
- Rate-limit refinado por endpoint (no solo global)
- GDPR export real con email link (hoy queda en BD pero no notifica)

### P2 — Observabilidad
- Health check enriquecido (Postgres, Redis, FCM reachable)
- Métricas Prometheus o uptimerobot
- Log estructurado (Pino) con redacción de tokens

---

## Roadmap post-V1 (referencia, no se ejecuta ahora)

| V | Feature | Notas |
|---|---|---|
| V1.1 | Moderación AI (Perspective / OpenAI Moderation) | Cuando volumen lo justifique |
| V1.2 | Feed personalizado por scoring (intereses + cercanía + amigos) | Multi-venue requerido antes |
| V1.3 | Push segmentado avanzado (por nivel/intereses/última visita) | Necesita data acumulada |
| V1.4 | Mapa embebido con pin (react-native-maps) | Hoy se usa Linking a Apple/Google Maps |
| V1.5 | Analytics retention cohortes en admin | |
| V2.0 | Multi-venue | Requiere refactor de `Venue` y permisos |
| V2.1 | Streaming en vivo | |
| V2.2 | Marketplace de productos del bar | |
| V2.3 | Pasarela de pago in-app | |

---

## Cosas explícitamente fuera de alcance

- ❌ Algolia / Meilisearch — Postgres LIKE aguanta 10K
- ❌ i18n con archivos locale — ES+EN hardcoded suficiente para V1
- ❌ Mapa embebido en V1 — botón "Cómo llegar" basta
- ❌ A/B testing — V2

---

## Inventario verificado en código (al 2026-04-27)

### Backend (18 módulos NestJS)
admin · auth · checkin · community · content-monitor · events · friendships · health · messages · notifications · offers · otp · push · reservations · reviews · support · users · venues · wallet

### Prisma (39+ modelos, 105+ índices)
Auth · Venue · Events · Offers · Community · Wallet · GDPR · Reservations · Support · Content Monitor · Reviews · Follow · Friendship · MessageThread · Message · MessageReaction · SavedItem · PushToken · Story · StoryReaction · Mention · NotificationSettings · FeatureFlag

### Mobile (87+ pantallas tsx)
- **Auth (14)**: welcome, login, register/{step1,step2-interests}, otp-email, otp-phone, forgot/new-password, email-sent, biometric, session-expired, too-many-attempts, registration-complete, onboarding/permissions
- **Tabs (5)**: home, events, offers, community, profile
- **App stacks (35+)**: events, offers, community (post + new + story-viewer), messages (list + thread), reservations (new + my + detail + modify + qr), profile (edit + wallet + notifications + settings + privacy + gdpr + sessions + change-password + loyalty + redemptions + saved + about), users (profile + followers + following + friends), venue (detail + review), search, staff/scan, support (index + new-ticket + chat)
- **Admin mobile (32)**: dashboard, activity, analytics, flags, gdpr, loyalty, notifications, reports, settings, staff, users, manage/{community, events, messages, offers, reservations, reviews, support}
- **Guest (1)**: home

### Admin web (Vercel)
~39 pantallas: login, dashboard, users, events, offers, reservations, posts/comments/reviews moderation, content-monitor, support, push, analytics, config (app, levels, rules, staff, permissions), checkin.

---

## Referencias

- [01-VISION.md](01-VISION.md) — fuente única de verdad estratégica
- [02-STACK-Y-API.md](02-STACK-Y-API.md) — stack técnico + endpoints + DB
- [03-INFRAESTRUCTURA.md](03-INFRAESTRUCTURA.md) — servicios + costos + arquitectura
- [04-DESIGN-SYSTEM.md](04-DESIGN-SYSTEM.md) — tokens, primitivos, iconos
- [06-CHANGELOG.md](06-CHANGELOG.md) — log de releases por commit
- [07-ADMIN-PANEL.md](07-ADMIN-PANEL.md) — panel admin web
- [archive/](archive/) — docs históricos (PLAN, FLOW, contexto-chats)
