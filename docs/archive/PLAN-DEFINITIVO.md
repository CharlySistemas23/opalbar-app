# OPALBAR — Plan Definitivo End-to-End para 10K usuarios

> **Este es el plan oficial. No se abren caminos nuevos fuera de aquí sin actualizar este doc.**
> Basado en auditoría real del código (no suposiciones) + los MDs existentes (README, PLAN, FLOW, ADMIN, OPALBAR APP, CONTEXTO-CHAT).
> Última revisión: 2026-04-20

---

## 0. Alcance y supuestos fijos

- **Usuarios objetivo**: 10,000+ activos.
- **Venues**: 1 bar inicial (OPALBAR). Multi-venue no entra en este plan.
- **Moderación**: manual por el owner en V1. Automatización con IA en V2, fuera de este plan.
- **Admin**: solo mobile (`/(admin)`). NO se construye web admin.
- **Idiomas**: ES + EN hardcoded. i18n con archivos locale fuera de este plan.
- **Search**: LIKE sobre Postgres aguanta 10K. Algolia/Meilisearch fuera de este plan.

---

## 1. Inventario real verificado en código

### Backend (18 módulos NestJS)
admin · auth · checkin · community · content-monitor · events · health · messages · notifications · offers · otp · push · reservations · reviews · support · users · venues · wallet

### Prisma (39 modelos, 105 índices)
Auth · Venue · Events · Offers · Community · Wallet · GDPR · Reservations · Support · Content Monitor · Reviews · Follow · MessageThread · Message · SavedItem · PushToken · FeatureFlag

### Mobile (87 pantallas `.tsx`)
- **Auth (14)**: welcome, login, register, register/step2-interests, otp-email, otp-phone, forgot-password, new-password, email-sent, biometric, session-expired, too-many-attempts, registration-complete, onboarding/permissions
- **Tabs (5)**: home, events, offers, community, profile
- **App stacks (35)**: events/[id]+filter, offers/[id], community/new-post+posts/[id], messages/index+[id], reservations/new+my+[id]+[id]/modify+[id]/qr, profile/{edit, wallet, notifications, notification-settings, preferences, privacy, gdpr, sessions, change-password, loyalty-levels, redemptions, saved, about}, users/[id]+[id]/followers+[id]/following, venue/[id]+[id]/review, search, staff/scan, support/index+new-ticket+chat/[id]
- **Admin (32)**: dashboard, activity, analytics, flags, gdpr, loyalty, notifications, reports/[id], settings, staff, users/[id], manage/{community, events, messages, offers, reservations, reviews, support}
- **Guest (1)**: home

### Lo que ya hicimos en sesiones previas
- ✅ Fix bug "posts no cargan post-login" (error states en 4 tabs)
- ✅ Auto-refresh axios solo hace logout en 401/403 del refresh endpoint (no en errores de red)
- ✅ Componentes universales: `EmptyState`, `ErrorState`, `OfflineBanner` + hook `useOffline`
- ✅ Socket.io real-time chat (gateway backend + hook mobile + integrado en `messages/[id]`)
- ✅ Haptics + sonidos (`useFeedback` hook con toggles en Ajustes)
- ✅ GDPR wiring completo con confirm doble (cumple requisito Apple/Google)
- ✅ Migración de 12 pantallas a EmptyState/ErrorState

---

## 2. Problemas críticos verificados para escala a 10K

Cada punto tiene evidencia del código, no supuestos.

| # | Problema | Evidencia | Impacto a 10K |
|---|---|---|---|
| P1 | **Sin cache Redis en lecturas públicas** | `events.service.ts`, `offers.service.ts`, `community.service.ts` no usan `RedisService` | 3,000 DAU abren home = 3,000 queries DB por los mismos datos |
| P2 | **Sin Redis lock en canje y reserva** | `offers.service.redeem()`, `reservations.service.create()` sin lock | Stock/cupos pueden quedar negativos en race condition |
| P3 | **Rate limits demasiado permisivos** | `app.module.ts`: default 10,000/min, auth 1,000/min, otp 100/5min | Brute-force posible; spam de SMS infla factura Twilio |
| P4 | **Rating promedio recalcula cada vez** | `reviews.service` hace AVG en cada request | A ~2K reviews va OK, a 20K+ se vuelve lento |
| P5 | **Sin mapa "cómo llegar al bar"** | `venue/[id].tsx`, `events/[id].tsx` no usan `lat/lng` del modelo Venue | UX rota — usuarios no saben dónde está el bar |
| P6 | **Admin sin inbox unificado** | 5 pantallas separadas: flags, reports, posts pending, reviews, tickets | Con moderación manual, saltar entre pantallas es ineficiente |
| P7 | **Admin sin badges de conteo** | `(admin)/_layout.tsx` no tiene contadores | No sabes si hay 5 o 500 pendientes sin entrar |
| P8 | **Admin sin push urgente** | Nuevo ticket/reporte severo/reserva del día no notifica | Respuesta lenta → peor experiencia de usuario |
| P9 | **Admin sin bulk actions** | `manage/community/index.tsx` solo individual | 50 posts/día a aprobar uno por uno se vuelve pesado |
| P10 | **Reserva con slots hardcoded** | `reservations/new.tsx` tiene `TIME_SLOTS` constante | Venue ya tiene `openTime/closeTime/slotMinutes` en DB, no se lee |
| P11 | **Imágenes base64 en DB** | `profile/edit.tsx`, `community/new-post.tsx`, `reviews/new.tsx` | A 10K con fotos infla DB en semanas |
| P12 | **Paquetes no instalados** | Socket.io, haptics, av, netinfo, local-auth | Código listo, features no se activan |
| P13 | **Paginación infinita no aplicada en UI** | Tabs cargan todo de una con `limit:50` fijo | Scroll se pone lento y se traen datos que no se ven |
| P14 | **Loyalty no actualiza nivel automáticamente** | `wallet.service` no recalcula nivel al crear transaction | Usuario gana puntos pero sigue en Bronce indefinido |

---

## 3. Plan definitivo en 3 olas

### 🌊 OLA 1 · Fundación (no se rompe a 10K) — 2 días **✅ COMPLETADA**

| # | Tarea | Archivos | Resultado | Estado |
|---|---|---|---|---|
| O1.1 | **Cache Redis** en `events.list/get`, `offers.list/get`, `community.posts/post`, `venues.list/get` con TTL 30-120s e invalidación en mutaciones | `redis.service.ts` (+helpers `cacheKey/cacheWrap/cacheDelPattern`) · events/offers/community/venues services | Lecturas públicas ~1ms, DB descongestionada | ✅ |
| O1.2 | **Redis lock** con `withLock()` SETNX+EX+NX en `offers.redeem()` y `reservations.create()` por 5s | `redis.service.ts` (+`LockBusyError`) · offers + reservations services | Stock/cupos consistentes bajo concurrencia, 409 Conflict si busy | ✅ |
| O1.3 | **Rate limits sanos**: default 120/min, auth 20/min, otp 5/5min | `app.module.ts` | Anti brute-force + control spend Twilio | ✅ |
| O1.4 | **Denormalizar** `ratingAvg` + `ratingCount` en `Venue`, `syncVenueRating()` en create/update/moderate/delete review | prisma schema + `reviews.service` | Detalle venue sin AVG cada vez | ✅ (falta correr migration) |
| O1.5 | **Mapa del bar**: botón "Cómo llegar" (Linking Apple/Google Maps) en `venue/[id]` + fila meta clickeable en `events/[id]` + "Llamar" + "Sitio" | `venue/[id].tsx` · `events/[id].tsx` | Usuarios abren navegación nativa al bar | ✅ |
| O1.6 | **Reservation usa config del venue**: `buildSlotsFromVenue()` genera slots desde `openTime/closeTime/slotMinutes`, maneja cierre post-medianoche | `reservations/new.tsx` | Slots correctos por venue | ✅ |

**Instalaciones requeridas para activar**:
```powershell
cd C:\Users\Panda\Documents\opalbar-app
npx prisma migrate dev --name add_venue_rating_denorm
# (nada más — Redis y axios ya estaban instalados)
```

### 🌊 OLA 2 · Admin operable para moderar manual — 3 días **✅ COMPLETADA**

| # | Tarea | Archivos | Resultado | Estado |
|---|---|---|---|---|
| O2.1 | **Endpoint `/admin/inbox`** que agrega flags + posts pending + reviews pending + reports + tickets + reservaciones (hoy–7d), con `urgency` 0-100 por severidad/prioridad/antigüedad + deepLink por item. Secundario `/admin/inbox/counts` para badges | `admin.service.ts` (+types `InboxItem`/`InboxCounts`) · `admin.controller.ts` | Una sola cola priorizada por urgencia | ✅ |
| O2.2 | **Pantalla "Bandeja de hoy"** en dashboard admin muestra top 6 items del inbox con icono por tipo + dot de urgencia + tap abre deepLink | `(admin)/dashboard.tsx` | Admin abre y sabe qué hacer | ✅ |
| O2.3 | **Hook `useAdminCounts()`** polling 30s + badges rojos en tab layout admin (Inicio=total, Gestión=posts+reviews+tickets+reservaciones, Reportes=reports+flags) | `hooks/useAdminCounts.ts` + `(admin)/_layout.tsx` | Badges visibles sin entrar a cada tab | ✅ |
| O2.4 | **Push al admin/moderadores** vía `PushService.sendToRoles()` cuando: nuevo ticket, flag HIGH/CRITICAL, reserva del día | `push.service.ts` (+`sendToRoles`) · `support.service.ts` · `content-monitor.service.ts` · `reservations.service.ts` | Respuesta ágil sin revisar manual | ✅ |
| O2.5 | **Bulk actions** cola posts pending: long-press → multi-select → bulk approve/reject con Alert de motivo, endpoints `POST /admin/posts/bulk/{approve,reject}` max 100 | `admin.controller.ts` · `admin.service.ts` (+`bulkModeratePosts`) · `manage/community/index.tsx` | 50 posts en 30s en vez de 5min | ✅ |

### 🌊 OLA 3 · Polish para UX a volumen — 3 días

| # | Tarea | Archivos | Resultado |
|---|---|---|---|
| O3.1 | **Paginación infinita** en tabs events, offers, community, messages, reservations/my con `onEndReached` | 5 pantallas mobile | Scroll fluido sin traer 500 registros de una |
| O3.2 | **`select` estricto** en listas públicas (events/offers) — solo campos que la card muestra | services backend | Respuestas más chicas y rápidas |
| O3.3 | **Auto-nivel loyalty**: hook post-creación de `WalletTransaction` recalcula nivel; si cambia, emite notificación "LEVEL_UP" + push | `wallet.service` | Usuario ve progreso real, retención |
| O3.4 | **Índice compuesto** `Message(threadId, createdAt)` | prisma schema + migration | Paginación de chat rápida a gran volumen |
| O3.5 | **Image upload a Cloudinary** (free tier 25GB) en `profile/edit`, `community/new-post`, `reviews/new` — reemplazar base64 | Mobile 3 pantallas + backend config | Fotos en CDN, DB no se infla |
| O3.6 | **Migrar las 6 listas pendientes** a `<EmptyState>` + `<ErrorState>`: home (catch silencioso), search, support/chat, community/posts/[id], venue/[id], admin screens clave | 6 archivos mobile | UX consistente en toda la app |

---

## 4. Lo que NO se hace en este plan (explícito)

Para que no se vuelvan a abrir estos caminos:

- ❌ **Admin web** — descartado por owner
- ❌ **Moderación AI (Perspective/OpenAI)** — V2, owner modera manual
- ❌ **Feed personalizado por scoring** — con 1 venue no aporta
- ❌ **Push segmentado avanzado** — V2 cuando haya data suficiente
- ❌ **Algolia / Meilisearch** — Postgres LIKE aguanta 10K
- ❌ **i18n con archivos locale** — ES+EN hardcoded suficiente
- ❌ **Mapa embebido (react-native-maps)** — Nivel A basta: botón "Cómo llegar" a maps nativo
- ❌ **Streaming / marketplace / pasarela de pago** — post-V1 roadmap
- ❌ **2FA para super_admin** — V2
- ❌ **A/B testing** — V2

---

## 5. Checklist de instalación (obligatorio antes de probar)

Estas son las instalaciones que deben ocurrir cuando el owner llegue a casa:

```powershell
# Backend — una vez
cd C:\Users\Panda\Documents\opalbar-app
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# Mobile — una vez
cd apps\mobile
npm install socket.io-client expo-haptics expo-av @react-native-community/netinfo expo-local-authentication

# Cuando arranquemos O3.5 (Cloudinary):
npm install cloudinary-react-native
# + crear cuenta Cloudinary free tier + copiar cloud name al .env
```

---

## 6. Orden de ejecución y criterio de "hecho"

Se hace **en orden**. Nada de saltar.

| Ola | Tarea | Criterio de hecho |
|---|---|---|
| O1.1 | Cache Redis | `GET /events` bajo carga responde < 50ms p95 con `X-Cache: HIT` |
| O1.2 | Redis lock | Test de 100 canjes concurrentes no produce stock negativo |
| O1.3 | Rate limits | `app.module.ts` usa valores del `configuration.ts` |
| O1.4 | Denormalizar rating | Migration aplicada, script de backfill corrido |
| O1.5 | Mapa | Botón "Cómo llegar" abre Apple/Google Maps con coord del venue |
| O1.6 | Reserva config venue | `TIME_SLOTS` deriva de `openTime/closeTime/slotMinutes` |
| O2.1-5 | Admin afilado | Pantalla "Hoy" con inbox + badges en vivo + push + bulk |
| O3.1-6 | UX polish | Listas con pagination infinita; loyalty sube solo; fotos en CDN |

Cada ola cierra con una **verificación manual del owner** antes de pasar a la siguiente.

---

## 7. Roadmap post-V1 (solo referencia, no se ejecuta ahora)

Cuando los 10K usuarios estén activos y estables:

- V1.1 Moderación AI (Perspective / OpenAI Moderation)
- V1.2 Feed personalizado simple (scoring por intereses + cercanía + amigos)
- V1.3 Push segmentado avanzado (por nivel, intereses, última visita)
- V1.4 Mapa embebido con pin
- V1.5 Analytics retention cohortes en admin
- V2.0 Multi-venue si se expande
- V2.1 Streaming / marketplace / pago in-app

---

## 8. Referencias rápidas

- [CONTEXTO-CHAT.md](CONTEXTO-CHAT.md) — bitácora técnica de sesiones
- [FLOW.md](FLOW.md) — contrato UX + DoD + tokens
- [README.md](README.md) — stack, endpoints, DB
- [ADMIN.md](ADMIN.md) — solo contiene plan de admin web **que está descartado**
- [PLAN.md](PLAN.md) — inventario histórico (desactualizado, usar este doc en su lugar)
- [OPALBAR APP.md](../../OneDrive/Im%C3%A1genes/DESING/OPALBAR%20APP.md) — visión estratégica original

---

**Este doc manda.** Si algo no está aquí, no se hace hasta que se agregue aquí primero.
