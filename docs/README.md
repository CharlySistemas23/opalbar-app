# OPALBAR — Documentación

> Una sola fuente de verdad. Todo lo que era un .md suelto en root ahora vive aquí, ordenado.

---

## Índice

| # | Archivo | De qué trata |
|---|---|---|
| 01 | [01-VISION.md](01-VISION.md) | **Maestro estratégico**: identidad, alcance, roles, fases, design tokens, modelo de datos, seguridad, KPIs, plan 7 fases, **bitácora oficial** |
| 02 | [02-STACK-Y-API.md](02-STACK-Y-API.md) | Stack técnico, estructura del monorepo, getting started, lista completa de endpoints, scripts, env vars, pipeline CI |
| 03 | [03-INFRAESTRUCTURA.md](03-INFRAESTRUCTURA.md) | Servicios contratados, costos mensuales, mapa de arquitectura, calendario de pagos, vars de entorno reales |
| 04 | [04-DESIGN-SYSTEM.md](04-DESIGN-SYSTEM.md) | Tokens, primitivos UI (Display/Heading/Body/Caption/Label, Card, Pressy, Hairline, Skeleton), iconos Feather |
| 05 | [05-ROADMAP.md](05-ROADMAP.md) | Estado real al 2026-04-27, olas históricas (1, 2, 3), Fase 4 hardening, post-V1, fuera de alcance |
| 06 | [06-CHANGELOG.md](06-CHANGELOG.md) | Releases por commit desde el inicio del repo (2026-04-18 →) |
| 07 | [07-ADMIN-PANEL.md](07-ADMIN-PANEL.md) | Panel admin web (Vercel + Vite + React 19): pantallas, deploy, seguridad, endpoints |

### Archive (histórico, no editar)

| Archivo | Por qué se archivó |
|---|---|
| [archive/PLAN.md](archive/PLAN.md) | Plan inicial por Fases A/B/C/D — sustituido por `05-ROADMAP.md` |
| [archive/PLAN-DEFINITIVO.md](archive/PLAN-DEFINITIVO.md) | Plan a 10K usuarios (Olas 1-3) — consolidado en `05-ROADMAP.md` |
| [archive/FLOW.md](archive/FLOW.md) | Tabla DoD por pantalla — superada por código actual; tokens migrados a `04-DESIGN-SYSTEM.md` |
| [archive/CONTEXTO-CHAT.md](archive/CONTEXTO-CHAT.md) | Bitácora histórica de sesiones Claude |
| [archive/CONTEXTO-CLAUDE-EXPO.md](archive/CONTEXTO-CLAUDE-EXPO.md) | Handoff de troubleshooting Expo Go (ya resuelto) |

---

## Reglas

1. **Si lo decides hoy, va aquí hoy** — bitácora en `01-VISION.md` §15.
2. **Cambios de stack** → `02-STACK-Y-API.md`.
3. **Cambios de servicios externos / costos** → `03-INFRAESTRUCTURA.md`.
4. **Cambios visuales / nuevos primitivos** → `04-DESIGN-SYSTEM.md`.
5. **Nueva ola / feature roadmap** → `05-ROADMAP.md`.
6. **Releases** → regenerar `06-CHANGELOG.md` con `git log`.
7. **Cambios al admin panel** → `07-ADMIN-PANEL.md`.

Si una decisión vive en dos sitios, alguien va a quedar mal sincronizado. Una sola fuente por concepto.

---

## Convenciones

- Fechas en formato **YYYY-MM-DD**.
- Estado de bloques: ✅ hecho · 🟡 parcial · ⛔ pendiente.
- Si una sección está marcada como "histórico" o "ya ejecutado", **no se edita** salvo para corregir hechos.
- `AGENTS.md` y `CLAUDE.md` en root NO se mueven — son auto-generados por Nx.

---

## Cómo regenerar el changelog

```bash
git log --since="2026-04-18" --pretty="%h|%ad|%s" --date=short --reverse
```

Pega el resultado en `06-CHANGELOG.md` agrupado por fecha y tema.
