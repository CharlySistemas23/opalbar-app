# 🗺️ Infraestructura OPALBAR — servicios, costos y arquitectura

> Última actualización: 2026-04-25

---

## 1. Servicios contratados (pagados)

| Servicio | Plan | Para qué se usa | Costo USD/mes | Frecuencia |
|---|---|---|---|---|
| **Anthropic Claude** | Max (5×) | Asistente de desarrollo (Claude Code) | $100 | Mensual |
| **Expo / EAS** | Production | Build APK + EAS Updates ilimitados, MAUs sin tope chico | $99 | Mensual |
| **Railway** | Pro (con uso variable) | Backend NestJS + PostgreSQL + Redis | $20 base + uso (~$5–30) | Mensual |
| **GitHub** | Pro / Team | Repo `CharlySistemas23/opalbar-app` | $4 (Pro) | Mensual |
| **Firebase** | Blaze (pay-as-you-go) | FCM push + lo que actives después | $0 base (paga por uso) | Mensual |
| **Apple Developer Program** | Individual | Publicar en App Store | $99/año (~$8.25/mes) | Anual |
| **Google Play Developer** | — | Publicar en Play Store | $25 una sola vez | Único |

### Servicios gratis que también están en uso

| Servicio | Plan | Uso |
|---|---|---|
| **Vercel** | Hobby | Hosting de admin web (`apps/admin`) con rewrites a Railway |
| **Cloudinary** | Free (25 GB) | Imágenes/avatars/posts (cloud `dl9o0umy3`, preset `opalbar_unsigned`) |
| **Gmail SMTP** | Free (500/día) | OTP + email transaccional desde `carlosalonsog966@gmail.com` |

---

## 2. Total mensual estimado

| Concepto | Mínimo | Máximo |
|---|---|---|
| Claude Max (5×) | $100 | $100 |
| Expo Production | $99 | $99 |
| Railway Pro | $25 | $50 |
| GitHub Pro | $4 | $4 |
| Firebase Blaze | $0 | $5 |
| Apple Dev (amortizado) | $8 | $8 |
| **Total mensual** | **~$236 USD** | **~$266 USD** |

A tipo de cambio aprox MXN 17 = **$4,000 – $4,500 MXN/mes**

---

## 3. Calendario de pagos

| Día/mes | Concepto | Monto |
|---|---|---|
| Mensual fijo | Claude, Expo, Railway, GitHub, Firebase | ~$236–266 |
| 1 vez al año | Apple Developer Program | $99 |
| 1 vez total (ya pagado) | Google Play Developer | $25 |
| Variable | Cloudinary y Twilio (si activas) — solo si excedes free | $0–20 |

**Recomendación:** apunta todas las suscripciones mensuales a la misma tarjeta y revisa el dashboard de Railway 2 veces al mes — el cobro varía con uso (RAM, egress de red, tamaño de Postgres).

---

## 4. Servicios configurables pero NO activos todavía

(El código tiene los hooks listos pero el `.env` solo tiene placeholders)

| Servicio | Para qué sería | Cuándo activar | Costo |
|---|---|---|---|
| **Twilio** | OTP por SMS | Si quieres SMS además de email | $0.0079/SMS |
| **S3 / Cloudflare R2** | Storage no-imagen | Probablemente nunca — Cloudinary cubre | R2: ~$0.015/GB |
| **FCM** | Push Android | Próximamente (#6 del plan) | $0 — Firebase ya pagado |
| **APNS** | Push iOS | Al publicar en App Store | Incluido en Apple Dev |
| **Sentry** | Error tracking | Al tener usuarios reales | Free tier o $26/mes |

---

## 5. Mapa de arquitectura

```
                       ┌─────────────────────────────┐
                       │         USUARIO FINAL       │
                       │  (APK preview en Android)   │
                       └──────────────┬──────────────┘
                                      │ HTTPS + WSS
                                      ▼
                       ┌─────────────────────────────┐
                       │   EAS UPDATES (canal preview)│
                       │   bundle JS sin nuevo APK   │
                       └─────────────────────────────┘
                                      │
                                      ▼
   ┌─────────┐    HTTPS REST   ┌──────────────────────┐    HTTPS upload    ┌────────────┐
   │  ADMIN  │ ──────────────▶ │       RAILWAY        │ ◀──────────────── │ CLOUDINARY │
   │ (Vercel)│                 │  ┌────────────────┐  │                    │ (imágenes) │
   └─────────┘                 │  │  NestJS API    │  │                    └────────────┘
                               │  │  /api/v1       │  │
   ┌─────────┐                 │  │  /rt (sockets) │  │      SMTP         ┌────────────┐
   │ MOBILE  │ ──── WSS ─────▶ │  │  /community    │  │ ────────────────▶ │   GMAIL    │
   │ (Expo)  │                 │  └────────┬───────┘  │   (OTP/email)     │   SMTP     │
   └─────────┘                 │           │          │                    └────────────┘
                               │  ┌────────▼───────┐  │
                               │  │   POSTGRES     │  │   (próximo: FCM via Firebase Admin)
                               │  │   (Prisma)     │  │
                               │  └────────────────┘  │
                               │  ┌────────────────┐  │
                               │  │     REDIS      │  │
                               │  │ (cache+pubsub) │  │
                               │  └────────────────┘  │
                               └──────────────────────┘
                                      ▲
                                      │ git push
                                      │ (auto-deploy)
                               ┌──────────────┐
                               │    GITHUB    │
                               └──────────────┘
```

### Flujo de deploy
- **Backend:** `git push origin main` → Railway redespliega automáticamente
- **Admin web:** Vercel redespliega desde `main` automáticamente
- **Mobile (sin código nativo):** `eas update --branch preview` — bundle JS llega al APK existente
- **Mobile (con código nativo nuevo):** `eas build --profile preview` — APK nuevo

---

## 6. Receta reutilizable para tu próxima app

Stack base mínimo para una app similar:

1. **GitHub** — repo (free para empezar)
2. **Railway** — un proyecto con backend + Postgres + Redis (Hobby $5/mes alcanza)
3. **Vercel** — frontend admin/web (free)
4. **Expo Free** — móvil con EAS Updates (gratis hasta 1k MAUs)
5. **Cloudinary** — imágenes (free 25 GB)
6. **Gmail App Password** o **Resend** — emails (free 500/día o 100/día)

**Costo de arranque sin Claude/Expo Pro: ~$5/mes.**
Cuando crezca, escalas planes según necesidad. La arquitectura no cambia — solo los planes de cada servicio.

---

## 7. Variables de entorno relevantes

Ver [`.env`](.env) para template completo. Los servicios activos usan:

- `DATABASE_URL` — Postgres en Railway
- `REDIS_HOST/PORT/PASSWORD` — Redis en Railway
- `SMTP_USER/PASS` — Gmail con app password
- `JWT_ACCESS_SECRET / JWT_REFRESH_SECRET` — secretos JWT
- `EXPO_PUBLIC_API_URL` (en `apps/mobile/.env` y `eas.json`) — URL del backend
- `EXPO_PUBLIC_CLOUDINARY_CLOUD / PRESET` — credenciales Cloudinary

Servicios con placeholders (no activos):
- `TWILIO_*`, `FCM_SERVER_KEY`, `APNS_*`, `SENTRY_DSN`, `S3_*`
