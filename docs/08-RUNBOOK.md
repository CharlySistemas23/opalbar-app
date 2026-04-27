# OPALBAR — Operations Runbook

> **Audiencia:** ingeniería de guardia (on-call) y soporte L2.
> **Actualizado:** 2026-04-27.

Esta guía es el playbook para diagnosticar y mitigar incidentes en producción.
Asume que ya tienes acceso a Railway, Sentry, el panel admin (`admin.opalbar.com`)
y al repositorio.

---

## 1. Topología y servicios

| Componente             | Dónde corre                   | Cómo se monitorea                            |
|------------------------|-------------------------------|----------------------------------------------|
| API NestJS             | Railway (servicio `api`)      | `GET /api/v1/health/ready`, Sentry, logs    |
| Postgres               | Railway (servicio `postgres`) | `health/ready` reporta latencia DB           |
| Redis                  | Railway addon                 | `health/ready` reporta latencia Redis        |
| Admin web              | Vercel/Netlify                | Sentry browser project                       |
| Mobile (Expo / EAS)    | EAS Updates `preview` channel | EAS dashboard; Sentry mobile aún diferido    |
| FCM (push)             | Google `opalbar-a0a5e`        | `health/ready` ping a `fcm.googleapis.com`   |
| SMTP                   | proveedor del usuario         | OTP logs; `[Mail]`/`[OTP]` en Logger          |

**URLs clave:**
- API: `https://opalbar-app-production.up.railway.app/api/v1`
- Health (liveness): `GET /health` — fast, ~350ms p50
- Health (readiness): `GET /health/ready` — DB + Redis + FCM, ~900ms p50
- Audit log: `GET /api/v1/admin/audit?limit=100` (SUPER_ADMIN)
- UptimeRobot dashboard: <https://uptimerobot.com/dashboard> (cuenta: `carlosalonsog966@gmail.com`)

---

## 2. Severidades

| Sev | Definición                                                                 | Respuesta esperada     |
|-----|----------------------------------------------------------------------------|------------------------|
| P0  | API caída, login/registro roto, pérdida de datos, brecha de seguridad.    | < 15 min, despertar.   |
| P1  | Subsistema clave degradado (push, mensajería, OTP), > 5% de errores.       | < 1 h en horario hábil.|
| P2  | Bug visible que no bloquea flujo principal, latencia alta sostenida.       | < 1 día hábil.          |
| P3  | Cosmético, sugerencias de usuario, deuda técnica.                          | Siguiente sprint.      |

---

## 3. Diagnóstico inicial (cualquier severidad)

```bash
# 1. ¿La API responde?
curl -fsS https://opalbar-app-production.up.railway.app/api/v1/health | jq

# 2. ¿Y la readiness (DB + Redis + FCM)?
curl -fsS https://opalbar-app-production.up.railway.app/api/v1/health/ready | jq

# 3. Logs en vivo
railway logs --service api --tail

# 4. Errores recientes en Sentry — usa el filtro environment=production
```

Lectura del `health/ready`:
- `status: "ok"` — todos los checks ok.
- `status: "degraded"` — al menos un subsistema reporta `degraded` (típico: FCM no
  alcanzable). API sigue sirviendo el resto.
- `status: "error"` — al menos un check `error` (DB o Redis); responde **503**.

---

## 4. Playbooks por escenario

### 4.1 — API no responde / 502 / 503

1. Verifica `GET /health` desde curl.
2. `railway logs --service api --tail` — busca crash loops, OOM, migrations
   bloqueadas.
3. Revisa el último deploy: si fue reciente, `railway rollback` al deploy
   anterior.
4. Si la causa es Postgres: ver §4.2.
5. Si la causa es Redis: ver §4.3.

### 4.2 — Postgres caído o lento

1. `health/ready` → `database.status` muestra `error` o latencia > 1 s.
2. Revisar Railway → servicio `postgres` → métricas (CPU, conexiones).
3. Si las conexiones están saturadas, reiniciar el API libera el pool. Como
   último recurso, reiniciar Postgres.
4. Si el servicio Postgres no arranca por mal `start command`, recordar que
   Railway ignora `railway.json` en este servicio (override por GraphQL); ver
   memoria `project_railway_postgres_start_override.md`.

### 4.3 — Redis caído

1. `health/ready` → `redis.status === 'error'`.
2. Sin Redis: el blocklist de sesiones JWT no funciona, throttler degrada y los
   OTP de SMS pierden idempotencia. Login de usuarios sigue funcionando.
3. Reinicia el addon de Redis en Railway. Si persiste, contactar soporte
   Railway. Mientras tanto, mantener `THROTTLER_DISABLE=true` solo si causa
   503s.

### 4.4 — Login admin no entra (2FA bloqueando)

1. Para roles `SUPER_ADMIN`, el login dispara un OTP por email a la cuenta del
   usuario antes de emitir tokens.
2. Si el correo no llega: revisa logs `[Mail] Sent to ...` o `[Mail] Failed`.
3. Comprobar credenciales SMTP en Railway env: `EMAIL_HOST`, `EMAIL_USER`,
   `EMAIL_PASS`.
4. Mitigación temporal: bajar el rol del usuario a `ADMIN` desde la base de
   datos para saltar 2FA — **registrar la decisión en el audit log manualmente
   con un comentario** y restaurar luego.

### 4.5 — Push notifications no llegan

1. `health/ready` → `fcm.status` debe ser `ok`. `degraded` significa que el
   ping a `fcm.googleapis.com` falló (no implica que el envío real falle).
2. Revisar `apps/api` logs por `[Push]` warnings: tokens inválidos se desactivan
   solos.
3. Si TODOS los usuarios fallan: revisar que `GOOGLE_APPLICATION_CREDENTIALS`
   apunte al service account correcto del proyecto `opalbar-a0a5e` y que el
   archivo exista.
4. Para el cliente Android, ver memoria `feedback_eas_prebuilt_android_fcm.md`
   (el directorio `android/` prebuilt ignora `app.json`).

### 4.6 — Rate-limit golpeando usuarios reales

Configurado por endpoint, sólo activo en `NODE_ENV=production`:

| Decorador        | Límite prod         | Aplica a                                |
|------------------|---------------------|------------------------------------------|
| `@ThrottleAuth`  | 10 req / min        | login, register, refresh, 2FA            |
| `@ThrottleOtp`   | 5 req / 5 min       | reenvío OTP                              |
| `@ThrottleWrite` | 30 req / min        | crear post/comment/story, mensajes, reportes |
| `@ThrottlePush`  | 10 req / min        | registro de token push                   |

Si una IP legítima se ve bloqueada por NAT compartido, opciones:
- Subir el límite del decorador correspondiente (requiere deploy).
- Excluir temporalmente con `@SkipThrottle()` en el endpoint específico.
- En producción se puede setear `NODE_ENV=development` como bypass de
  emergencia (no dejar así > 1 h; el throttler global se desactiva).

### 4.7 — Alguien reporta una acción admin sospechosa

1. `GET /api/v1/admin/audit?actorId=<userId>&limit=200` (SUPER_ADMIN).
2. También filtrable por `action` o `targetId`.
3. Cada entrada incluye actor, IP, user-agent (truncado a 300 chars) y
   metadata redactada (passwords/tokens/OTPs sustituidos por `[REDACTED]`).

### 4.8 — Solicitud GDPR (export o deletion)

1. Listar pendientes: panel admin → Configuración → GDPR (o
   `GET /api/v1/admin/gdpr/requests`).
2. **Export (APPROVE):** el sistema construye un bundle JSON con perfil, posts,
   comentarios, reservaciones, reviews, follows, sesiones, puntos y
   notificaciones. El payload se guarda inline en `DataExportRequest.payloadJson`,
   se firma un token HMAC con `JWT_ACCESS_SECRET` y se envía email al usuario
   con un link `https://api.opalbar.com/api/v1/users/me/export/download/:id?token=...`
   válido 7 días.
3. **Deletion (APPROVE):** soft-delete del usuario (limpia PII, libera email/
   phone, revoca sesiones, borra interests). El contenido permanece como
   "Usuario eliminado" para mantener integridad histórica.
4. Si falla el envío de email (`[GDPR] Failed to email export link`), pasar el
   link manualmente al usuario desde el panel admin (campo `downloadUrl` del
   request).

### 4.9 — Errores 5xx en Sentry

1. Cada excepción no manejada se envía a Sentry con tags `method`, `path`,
   `status` y extra `requestId`.
2. Headers `authorization`, `cookie`, `x-refresh-token` y campos sensibles del
   body (`password`, `token`, `otp`, `code`, etc.) se redactan en el
   `beforeSend`.
3. Si Sentry está caído: el SDK falla silenciosamente, los errores siguen en
   los logs estructurados con `requestId`.

---

## 5. Operaciones de seguridad

- **Rotar `JWT_ACCESS_SECRET`** invalida todos los tokens activos (forza
  re-login). Requiere coordinación; comunicar antes.
- **Forzar logout global de un usuario:** `DELETE /api/v1/auth/sessions/:id` o
  `POST /api/v1/auth/logout-all` desde el panel del usuario.
- **Banear usuario:** `PATCH /api/v1/admin/users/:id/ban` — registra audit log
  y notificación al usuario.
- **Bloquear IP a nivel infra:** Cloudflare/Railway WAF (no integrado al
  throttler de NestJS).

---

## 6. Variables de entorno críticas (producción)

```
NODE_ENV=production
DATABASE_URL=...
REDIS_URL=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
EMAIL_HOST=...
EMAIL_USER=...
EMAIL_PASS=...
EMAIL_FROM=...
TWILIO_ACCOUNT_SID=...   # opcional, para OTP por SMS
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=...
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase.json   # FCM
SENTRY_DSN=...                                              # backend
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
API_PUBLIC_URL=https://api.opalbar.com                       # para links GDPR
```

Admin web (build-time):
```
VITE_API_URL=https://api.opalbar.com/api/v1
VITE_SENTRY_DSN=...
```

---

## 7. Despliegue

```bash
# Deploy backend (Railway lo dispara con git push a main)
git push origin main

# Publicar OTA en mobile (canal usado por el APK actual)
eas update --branch preview --message "fix: ..."

# NO publicar a production salvo que se diga lo contrario; ver memoria
# project_eas_channel.md.
```

Rollback:
```bash
railway rollback --service api      # revertir al deploy anterior
git revert <sha> && git push        # revertir el commit en main
```

---

## 8. Monitoring externo (UptimeRobot)

UptimeRobot pingea los endpoints de health desde fuera de Railway, de modo que
si Railway entero cae (no sólo nuestro servicio), igual nos enteramos. Plan
gratuito: 50 monitores, 5 min interval, alertas por email.

**Monitores configurados:**

| Nombre                 | URL                                                                            | Tipo | Intervalo |
|------------------------|--------------------------------------------------------------------------------|------|-----------|
| OpalBar API liveness   | `https://opalbar-app-production.up.railway.app/api/v1/health`                  | HTTPS| 5 min     |
| OpalBar API readiness  | `https://opalbar-app-production.up.railway.app/api/v1/health/ready`            | HTTPS| 5 min     |

**Configuración de alertas:**
- Canal: email a `carlosalonsog966@gmail.com`
- Trigger: 2 fallos consecutivos (evita falsos positivos por blip de red)
- Recovery: 1 OK consecutivo

**Setup desde cero (si hay que recrear):**

1. Crear cuenta gratuita en <https://uptimerobot.com>.
2. Add New Monitor → Monitor Type: `HTTP(s)`.
3. Friendly Name: `OpalBar API liveness`.
4. URL: `https://opalbar-app-production.up.railway.app/api/v1/health`.
5. Monitoring Interval: `5 minutes`.
6. Alert Contacts To Notify: marcar el correo del owner.
7. Repetir para `/api/v1/health/ready`.
8. (Opcional) crear status page público para que el equipo pueda chequear sin login.

**Qué hacer si llega alerta de UptimeRobot:**

```bash
# 1. Confirmar manual
curl -fsS https://opalbar-app-production.up.railway.app/api/v1/health
curl -fsS https://opalbar-app-production.up.railway.app/api/v1/health/ready

# 2. Si liveness falla → API caída. Saltar a §3 Diagnóstico inicial + Sentry.
# 3. Si solo readiness falla → leer "services" del JSON; un subsistema degraded.
#    - database error  → Railway Postgres caído (ver §3 y memoria
#      project_railway_postgres_start_override.md)
#    - redis degraded  → no es P0, push y pubsub funcionan vía polling fallback
#    - fcm degraded    → push iOS/Android puede tardar; no afecta REST API
```

---

## 9. Contactos

- Owner técnico: carlosalonsog966@gmail.com
- Firebase / FCM: pandacharlypc@gmail.com (proyecto `opalbar-a0a5e`)
- Apple Developer: pendiente verificación (mobile Sentry y push iOS bloqueados
  hasta que cierre)
