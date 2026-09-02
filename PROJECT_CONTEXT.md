# OPAL BAR — Contexto del Proyecto

> Snapshot completo del estado del proyecto. Carga este archivo al inicio de una nueva sesión para que el asistente entienda dónde estamos.
>
> **Última actualización:** 2026-05-01

---

## 1. ¿Qué es OPAL BAR?

App nativa para **OPAL BAR**, un venue de nightlife premium en **Puerto Vallarta, Jalisco, México** (target: 18+).

**Casos de uso principales:**
- Reservas de mesas/botellas con disponibilidad en tiempo real
- Cartelera de eventos y noches temáticas (DJs, fiestas)
- Comunidad social tipo IG/FB: posts, stories, mensajes directos, friendships
- Ofertas y programa de lealtad por puntos
- Notificaciones push de eventos, mensajes, reservas
- Check-in de reservas vía QR (panel staff)

**Owner:** Carlos Alonso (`carlosalonsog966@gmail.com`)
**Repo:** https://github.com/CharlySistemas23/opalbar-app

---

## 2. Stack técnico

### Mobile (apps/mobile)
- **React Native + Expo SDK 54** (54.0.34)
- **expo-router** v5 (file-system routing)
- **Zustand** (state management — no React Query)
- **socket.io-client** (realtime via /rt namespace)
- **Reanimated 4** (animations)
- **libphonenumber-js** (selector internacional de teléfono)

### Admin Web (apps/admin)
- **React 19 + Vite 6 + TypeScript**
- **Tailwind CSS**
- **Zustand**
- Hosted on **Vercel**

### Backend (apps/api)
- **NestJS** (modular monolith)
- **Prisma 7.7** (ORM con `@prisma/adapter-pg`)
- **PostgreSQL** (Railway)
- **Redis** (cache + rate limit)
- **Resend** (transactional email — fallback Gmail SMTP)
- **Twilio Verify** (SMS OTP)
- **Cloudinary** (image storage — uploads van directo desde mobile, no pasan por API)
- **Socket.io** (realtime gateway en `/rt`)
- **Nest Throttler** (rate limiting)
- **JWT** (auth con refresh tokens)
- **bcrypt** (password hashing)
- Hosted on **Railway**

### Monorepo
- **Nx workspace**
- **npm** (NO pnpm/yarn)
- Build via Webpack (NestJS) + Metro (RN)

---

## 3. Arquitectura

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Mobile App      │     │  Admin Web       │     │  Public legals   │
│  (Android/iOS)   │     │  (React+Vite)    │     │  (HTML pages)    │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │  HTTPS + WSS          │  HTTPS + WSS          │  HTTPS
         └────────────┬───────────┴────────────┬───────────┘
                      │                        │
                ┌─────▼────────────────────────▼─────┐
                │  NestJS API (Railway)              │
                │  https://opalbar-app-production    │
                │  .up.railway.app/api/v1            │
                └───┬────────────┬───────────┬───────┘
                    │            │           │
              ┌─────▼─┐    ┌─────▼─┐   ┌─────▼─────┐
              │Postgres│    │ Redis │   │ Resend    │
              │Railway │    │Railway│   │ Twilio    │
              └────────┘    └───────┘   │ Cloudinary│
                                        │ FCM       │
                                        └───────────┘
```

**Flujos clave:**
- Mobile/Admin → API (REST) + WSS `/rt` (realtime)
- Push notifications: API → Expo Push Service → FCM → device
- Image upload: Mobile → Cloudinary directo (URL signed con preset `opalbar_unsigned`)
- Email: API → Resend (con fallback SMTP Gmail si Resend falla)
- SMS OTP: API → Twilio Verify

---

## 4. Estado actual (qué está deployado)

### Mobile
- **versionCode 3** (versionName 1.0.0) — AAB en Play Console **Closed Alpha** esperando review de Google
- **Channel OTA:** `production` (los testers reciben fixes JS automáticos cuando Expo OTA esté operativo)
- Última actualización OTA exitosa: PhonePicker (commit `5d08bf8`)
- ⚠️ EAS Updates ha estado rechazando publicaciones con error `sdkVersion 54.0.0 is not supported` desde varios commits — issue del lado de Expo

### Backend
- API live en https://opalbar-app-production.up.railway.app
- Cada `git push origin main` redeploya automáticamente
- Health check: `GET /api/v1/health` → 200 ok

### Play Store
- Cuenta de desarrollador: `pandacharlypc@gmail.com` ($25 USD pagado)
- Token ADI (verificación developer): `CQX2TOA4LLWEEAAAAAAAAAAAAA` (registrado, app verificada)
- Closed Alpha track: ✅ enviado a revisión Google (1-3 días)
- **Requisito producción:** 12 testers × 14 días en Closed Testing antes de poder solicitar acceso a Producción

### Resend (email transaccional)
- Dominio `opalbar.com.mx` ✅ **verified**
- Sender: `OPAL BAR <noreply@opalbar.com.mx>`
- Reply-to: `carlosalonsog966@gmail.com`
- API key sending-only activa en Railway (env var `RESEND_API_KEY`)
- Fallback: Gmail SMTP (configurado pero secundario)

### Dominio
- `opalbar.com.mx` registrado en HostGator (1 año, $210 MXN)
- DNS records de Resend: DKIM + SPF MX + SPF TXT — todos `verified`

---

## 5. Cuentas / credenciales activas

| Servicio | Cuenta | Notas |
|---|---|---|
| Gmail principal | `carlosalonsog966@gmail.com` | Owner, reply-to de emails, admin |
| Google Play Console | `pandacharlypc@gmail.com` | App verificada, Closed Alpha activo |
| Firebase FCM | `pandacharlypc@gmail.com` | Proyecto `opalbar-a0a5e` |
| Expo / EAS | `carlosg2026` (cuenta) | Project `opalbar-app` |
| GitHub | `CharlySistemas23` | Repo `opalbar-app` |
| Railway | (token de proyecto activo) | Project `opalbar-app`, env `production` |
| Resend | (linked al Gmail) | Dominio verified |
| HostGator | — | Dominio MX |
| Cloudinary | cloud `dl9o0umy3` | preset `opalbar_unsigned` |
| Twilio | — | Verify service para OTP SMS |

---

## 6. Esquema de base de datos (alto nivel)

**Modelos principales** (`prisma/schema.prisma`):

| Modelo | Propósito |
|---|---|
| User, UserProfile, UserConsent, UserInterest | Usuarios + perfil + consentimientos |
| Session, Otp, LoginAttempt, PushToken | Auth state + push tokens |
| Venue, EventCategory, Event, EventAttendee, EventMedia | Datos del bar + cartelera |
| Offer, OfferRedemption | Promociones + canjes |
| Reservation, ReservationBlock | Reservas + bloqueos de slots |
| Post, Story, Comment, Reaction, PostEmojiReaction, CommentReaction, CommentLike, StoryReaction, StoryView | Comunidad social |
| MessageThread, Message, MessageReaction | DMs |
| Friendship, Follow | Relaciones sociales |
| Notification, NotificationSettings | Notificaciones in-app + ajustes |
| WalletTransaction, LoyaltyLevel | Puntos + niveles |
| Review | Reviews del venue |
| Report, ContentFlag, ModerationLog, FilterRule | Moderación |
| SupportTicket, SupportMessage, SupportQuickReply | Soporte |
| EmailCampaign, EmailCampaignRecipient, MarketingAsset | Marketing emails |
| PushBroadcast | Historial de broadcasts |
| AuditLog, AdminActionLog | Auditoría admin |
| DataDeletionRequest, DataExportRequest | GDPR |
| Mention, SavedItem | Menciones + saves |
| AppConfig, FeatureFlag | Config global |

**Defaults de privacidad (post-auditoría 2026-05-01):**
- `User.dmPolicy` = `FRIENDS_ONLY` (antes EVERYONE)
- `User.mentionPolicy` = `FRIENDS_ONLY`
- `User.friendPolicy` = `EVERYONE`
- `User.isPrivate` = `false`

---

## 7. Endpoints públicos importantes

```
GET  /api/v1/health                      → status check
GET  /api/v1/legal/privacy               → política privacidad (HTML)
GET  /api/v1/legal/terms                 → términos servicio (HTML)
GET  /api/v1/legal/account-deletion      → instrucciones eliminación cuenta (HTML)
GET  /api/v1/legal/child-safety          → estándares CSAE (HTML)
GET  /api/docs                           → Swagger UI
POST /api/v1/auth/register
POST /api/v1/auth/login                  → respuesta puede incluir requiresEmailVerification|requires2FA
POST /api/v1/auth/login/2fa              → completa 2FA SUPER_ADMIN
POST /api/v1/otp/send                    → envío OTP email/SMS
POST /api/v1/otp/verify                  → verifica OTP
GET  /api/v1/users/search?q=...          → search (no devuelve email)
GET  /api/v1/users/:id                   → public profile (oculta campos si isPrivate)
GET  /api/v1/users/:id/followers         → requiere login + privacy gating
GET  /api/v1/users/:id/following         → requiere login + privacy gating
```

---

## 8. Configuración importante

### Variables de entorno Railway (servicio `opalbar-app`)

```
NODE_ENV=production
DATABASE_URL=postgresql://postgres:***@postgres.railway.internal:5432/railway
REDIS_URL=redis://...
JWT_SECRET=***
JWT_REFRESH_SECRET=***

# Email (Resend activo, SMTP fallback)
EMAIL_TRANSPORT=resend
EMAIL_FROM=OPAL BAR <noreply@opalbar.com.mx>
EMAIL_REPLY_TO=carlosalonsog966@gmail.com
RESEND_API_KEY=re_*** (sending-only)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=carlosalonsog966@gmail.com
SMTP_PASS=*** (Gmail App Password)

# SMS
TWILIO_ACCOUNT_SID=***
TWILIO_AUTH_TOKEN=***
TWILIO_VERIFY_SERVICE_SID=***

# Storage (cliente uploads directo)
STORAGE_PROVIDER=cloudinary

# Marketing pixel HMAC (auditoría 2026-05-01)
MARKETING_PIXEL_SECRET=*** (cae a JWT_SECRET si no se setea)
```

### app.json (mobile)
- `runtimeVersion`: `1.0.0` (android), `policy: appVersion` (iOS)
- `versionCode`: 3 (auto-incrementado por EAS)
- `version`: `1.0.0`
- `package`: `com.opalbar.app`

### eas.json (mobile)
- Profile `production`: AAB build, channel `production`, `autoIncrement: true`
- Profile `preview`: APK build interno, channel `preview`
- Submit configurado a Google Play track `internal` con `releaseStatus: draft`

---

## 9. Bugs corregidos en sesión 2026-05-01

### Backend (live en producción)

**Privacy enforcement (cuentas privadas eran decorativas):**
1. `users.search` ya no devuelve `email`, filtra `BANNED`/`DELETED` (deja `PENDING_VERIFICATION` searchable)
2. `getPublicProfile` oculta bio/ciudad/edad/género/etc si target es privado y viewer no es follower/amigo/dueño
3. `/users/:id/followers` y `/following` requieren login + chequean visibilidad
4. Feed comunidad filtra posts de cuentas privadas a no-followers
5. `getPost` devuelve 404 si autor privado y viewer no follower (anti-enumeración)
6. `getUserStories` oculta stories de cuentas privadas
7. `presence:online` ya no broadcast a TODOS — solo staff + followers + amigos del user

**Auth & messaging:**
8. Login bypass por teléfono cerrado (antes solo bloqueaba si user tenía email)
9. Bloqueo de usuario respetado en threads NUEVOS (antes podías reabrir un thread fresco con un user que te bloqueó)
10. `requiresEmailVerification` flag: si registras y no verificas, login redirige al OTP screen automáticamente

**Realtime:**
11. Admin web `/rt` socket sincroniza al rotar token (mismo bug que mobile, replicado en admin)
12. Mobile auth.store sincroniza socket `/rt` en login/refresh/logout (banner notificaciones funciona en background)

**Reservas:**
13. Check-in QR setea `SEATED` (antes `CONFIRMED` → no aparecía en dashboard staff)
14. `updateStatus` de reserva manda push al cliente cuando staff confirma/cancela manual

**Notificaciones:**
15. Aggregator push consistente con soft-throttle Redis (1/min) — sin huecos en counts (#3 y #4 ya no se pierden)
16. `broadcastToAllActiveUsers` respeta `pushEnabled` + flags granulares por NotificationType (eventReminders, newEvents, etc)

**Hardening:**
17. Marketing pixel firmado con HMAC (`MARKETING_PIXEL_SECRET`) — anti-inflado de open-rates

### Mobile (en bundle del AAB v3)

**UX:**
- Selector internacional de teléfono con bandera + búsqueda + auto-formato (libphonenumber-js)
- Timestamps "ahora" en vez de "-3594s" (clamp `Math.max(0, ...)` en 15+ archivos)
- Mensaje de error "No refresh token available" no se filtra al UI (ahora cae silencioso a guest mode)
- Login auto-rutea a OTP screen si email no está verificado

### Schema migrations
- `User.dmPolicy` default cambió de `EVERYONE` → `FRIENDS_ONLY` + migración aplicada a USERs existentes

### Email infraestructura
- Migración SMTP Gmail → Resend con dominio propio (`noreply@opalbar.com.mx`)
- Fallback SMTP Gmail mantenido si Resend falla
- Cuentas: 3 USER en `PENDING_VERIFICATION`, 2 USER `ACTIVE`, 2 SUPER_ADMIN (1 ACTIVE, 1 DELETED)

### Limpieza
- Wipe de DB ejecutado: 446 filas borradas (users de prueba + sesiones + posts + notifs + tokens push), conservando cuentas SUPER_ADMIN + datos del bar (Venue/Event/Offer/etc)

---

## 10. Pendientes / TODOs

### 🔴 Alta prioridad
- **Reclutar 12 testers** para Closed Alpha — el contador de 14 días empieza cuando aceptan
- **Esperar revisión Google** del AAB v3 (1-3 días)
- Implementar **follow-request flow** para cuentas privadas (auto-aprueba hoy si es privada)

### 🟡 Media
- Implementar Sentry (ya integrado en código, solo falta `SENTRY_DSN`)
- Implementar UptimeRobot (gratis) para alertas de caída API
- Configurar Cloudflare Email Routing para `info@opalbar.com.mx`
- Investigar por qué EAS Updates rechaza publicaciones con `sdkVersion 54.0.0 is not supported`

### 🟢 Baja
- Apple Developer Program ($99/año) si se quiere iOS
- Verificar dominio adicional si se compra (`opalbar.club` u otro alterno)
- Plantillas de email marketing más elaboradas
- Mover `resend` y `libphonenumber-js` de root deps a `apps/api` y `apps/mobile` respectivamente

---

## 11. Comandos útiles

```bash
# Build API
npx nx build api

# Build mobile (AAB producción)
cd apps/mobile && npx eas-cli build --profile production --platform android

# OTA push (si EAS Updates funciona)
cd apps/mobile && npx eas-cli update --branch production --message "..."

# Reset SUPER_ADMIN password (Railway)
RAILWAY_TOKEN=*** railway run --service opalbar-app -- npx ts-node apps/api/scripts/reset-admin.ts --email=carlosalonsog966@gmail.com --password=...

# Wipe DB (deja SUPER_ADMIN + datos del bar)
DATABASE_URL=postgresql://... npx ts-node apps/api/scripts/wipe-data.ts --confirm=YES_BORRAR

# Logs Railway
RAILWAY_TOKEN=*** railway logs --service opalbar-app

# Prisma migrate (db push para cambios no breaking)
DATABASE_URL=postgresql://... npx prisma db push
```

---

## 12. Convenciones del proyecto (de CLAUDE.md y feedback acumulado)

### Workflow
- **Siempre commit + push + EAS update** al terminar (sin preguntar)
- **EAS Update channel `production`** (no preview, ese era el patrón viejo)
- **Backend changes** se aplican vía `git push` (Railway redeploya solo)
- **No mockear DB** en tests
- Commits sin Claude attribution (no Co-Authored-By)

### Código
- No agregar `try/catch` decorativos
- No comentarios obvios
- Comentarios solo para WHY no obvio (incidentes pasados, restricciones ocultas)
- Preferir editar archivos existentes sobre crear nuevos
- TodoWrite cuando aplique para tracking
- Defaults de privacy estrictos (FRIENDS_ONLY > EVERYONE)

### EAS Build & Updates
- `runtimeVersion: "1.0.0"` Android, `policy: "appVersion"` iOS
- Cuando EAS prebuilt genera `android/`, app.json `googleServicesFile` se ignora — hay que cablear FCM en gradle a mano
- `google-services.json` NO en `.gitignore` (necesario para que EAS lo encuentre en el monorepo)

### Realtime sockets
- Existen 2 sockets en mobile: legacy `/api/socket` y unificado `/rt`
- Auth store debe sincronizar token en AMBOS (lección de bug de hoy)
- Pattern: token rotation → `updateSocketToken(t)` + `updateRtToken(t)`

---

## 13. Documentos relacionados

- [`opalbar-services.html`](./opalbar-services.html) — Dashboard visual con links a todos los servicios
- [`apps/mobile/play-store-builds/opalbar-v1.0.0-vc3.aab`](./apps/mobile/play-store-builds/) — AAB actual subido a Play
- [`apps/api/scripts/`](./apps/api/scripts/) — Scripts one-shot (reset-admin, wipe-data, etc.)
- [`prisma/schema.prisma`](./prisma/schema.prisma) — Esquema de DB
- [`apps/api/src/modules/legal/legal.html.ts`](./apps/api/src/modules/legal/legal.html.ts) — HTML de las políticas

---

## 14. Si te pasan este archivo en una sesión nueva

1. **Lee este documento completo primero**
2. Revisa `git log --oneline -20` para los últimos commits
3. Revisa `git status` para cambios pendientes
4. Verifica que API esté viva: `curl https://opalbar-app-production.up.railway.app/api/v1/health`
5. Pregunta al usuario por contexto reciente que no esté aquí
6. Si vas a hacer cambios destructivos (wipe DB, force push, etc.), **confirma antes**
