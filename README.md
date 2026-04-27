# OPALBAR APP

> "Siempre hay algo pasando, y tú te enteras primero."

App móvil + admin web + API NestJS para la comunidad de OPAL BAR (eventos, ofertas, comunidad, reservas, wallet de puntos, mensajes, stories).

---

## Documentación

Toda la doc está en **[`docs/`](docs/)**. Ver [docs/README.md](docs/README.md) para el índice.

| Quiero | Voy a |
|---|---|
| Entender qué es OPALBAR a nivel producto | [docs/01-VISION.md](docs/01-VISION.md) |
| Levantar el proyecto local / ver endpoints | [docs/02-STACK-Y-API.md](docs/02-STACK-Y-API.md) |
| Saber qué servicios usa y cuánto cuestan | [docs/03-INFRAESTRUCTURA.md](docs/03-INFRAESTRUCTURA.md) |
| Tocar UI sin romper el design system | [docs/04-DESIGN-SYSTEM.md](docs/04-DESIGN-SYSTEM.md) |
| Saber qué falta o qué viene | [docs/05-ROADMAP.md](docs/05-ROADMAP.md) |
| Ver historial de releases | [docs/06-CHANGELOG.md](docs/06-CHANGELOG.md) |
| Trabajar en el panel admin | [docs/07-ADMIN-PANEL.md](docs/07-ADMIN-PANEL.md) |

---

## Quick start

```bash
# Backend
docker-compose up -d postgres redis
npx prisma migrate deploy
npx prisma db seed
npx nx serve api          # http://localhost:3000/api/v1 · Swagger en /docs

# Mobile
cd apps/mobile && npx expo start --clear

# Admin web
npx nx serve admin        # http://localhost:5173
```

Detalle completo (env vars, scripts, troubleshooting) en [docs/02-STACK-Y-API.md](docs/02-STACK-Y-API.md).

---

## Estado al 2026-04-27

- Diseño Pencil (220+ pantallas ES+EN) — ✅
- Backend NestJS (18 módulos, 39 modelos) — ✅
- Mobile Expo + OTA EAS — ✅ (canal preview)
- Admin web Vercel — ✅
- Push FCM Android — ✅
- Push APNs iOS — ⛔ pendiente Apple Dev Program
- Sentry / observabilidad — ⛔ Fase 4

Detalle: [docs/05-ROADMAP.md](docs/05-ROADMAP.md).
