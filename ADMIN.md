# OPALBAR Admin Panel — Plan de implementación

Panel web separado en `apps/admin/` que consume el backend existente (rutas `/admin/*`, `/content-monitor/*`, etc., ya documentadas en el README).

---

## Arquitectura propuesta

```
apps/
├── api/            ← backend actual (NestJS) — ya tiene todos los endpoints admin
├── mobile/         ← app usuario final (Expo)
└── admin/          ← NUEVO: panel web React + Vite + Tailwind
```

### Stack

| Capa | Tecnología |
|---|---|
| Build | Vite 5 |
| UI | React 19 + Tailwind CSS |
| Routing | React Router 7 |
| State | Zustand (auth) + TanStack Query (data) |
| Forms | react-hook-form + zod |
| Tables | @tanstack/react-table |
| Charts | Recharts |
| Icons | Lucide React (consistente con mobile) |
| API client | Axios (compartido vía `libs/shared-types`) |

### Autenticación

Mismo `/auth/login` del backend. Solo usuarios con `role === 'ADMIN'` o `'SUPER_ADMIN'` pueden acceder. El frontend rechaza en la ruta guard.

### Despliegue

Vite build → archivos estáticos → servido desde un subdominio `admin.opalbar.com` o `/admin` path detrás de Nginx. Autenticación obligatoria + IP allowlist opcional.

---

## Pantallas requeridas (79 totales según Pencil: 39 ES + 40 EN)

### 🏠 Dashboard
- **A01 Dashboard** (`/admin`) — KPI cards + charts (signups 30d, redemptions por día, tickets abiertos, flags pendientes)

### 👥 Users
- **H01 Lista Usuarios** (`/admin/users`) — tabla con buscador, filtros por status/role/nivel, acciones inline
- **H02 Detalle Usuario** (`/admin/users/:id`) — Tabs: Perfil, Sesiones, Posts, Actividad, Reportes recibidos
- **H03 Solicitudes GDPR** (`/admin/gdpr`) — exports pendientes, deletion requests con countdown 30d
- **H04 Intentos de Login** (`/admin/security/login-attempts`) — últimos 1000, filtro por IP, success/fail
- **H05 Alertas Seguridad** (`/admin/security/alerts`) — anomalías detectadas
- **H06 Roles y Staff** (`/admin/config/staff`) — crear admin, asignar rol

### 🎉 Eventos
- **B01 Lista Eventos** (`/admin/events`)
- **B02 Crear Evento** (`/admin/events/new`) — form: título ES/EN, descripción, imagen, venue, categoría, fecha, capacidad, precio, tags, pointsReward
- **B03 Detalle Evento** (`/admin/events/:id`) — stats asistencia, lista attendees, check-in manual
- **B04 Categorías** (`/admin/events/categories`) — CRUD categorías (ES/EN + icono + color + orden)

### 🏷 Ofertas
- **C01 Lista Ofertas** (`/admin/offers`)
- **C02 Crear Oferta** (`/admin/offers/new`) — título ES/EN, imagen, precio (puntos o gratis), venue, validez, maxRedemptions, terms
- **C03 Detalle Oferta** (`/admin/offers/:id`) — stats canjes, lista de redenciones

### 📅 Reservaciones
- **D01 Lista Reservaciones** (`/admin/reservations`) — Kanban: Pending → Confirmed → Completed/Cancelled
- **D02 Detalle Reservación** (`/admin/reservations/:id`)
- **D03 Config Reservaciones** (`/admin/config/reservations`) — horarios disponibles, bloqueos

### 📝 Contenido comunidad
- **E01 Posts Pendientes** (`/admin/community/pending`) — cola moderación
- **E02 Todos los Posts** (`/admin/community/posts`)
- **E03 Detalle Post Moderación** (`/admin/community/posts/:id`) — approve/reject/ban user/borrar
- **E04 Cola Comentarios** (`/admin/community/comments`)
- **E05 Reseñas** (`/admin/community/reviews`) — cola de reviews a locales
- **E06 Detalle Reporte** (`/admin/community/reports/:id`)

### 🛡 Monitor Contenido
- **F01 Monitor** (`/admin/content-monitor`) — dashboard de flags
- **F02 Lista Flags** (`/admin/content-monitor/flags`)
- **F03 Detalle Flag** (`/admin/content-monitor/flags/:id`)

### 💬 Soporte
- **G01 Tickets** (`/admin/support`) — lista con filtros por status, priority, agent
- **G02 Chat Admin** (`/admin/support/:id`) — interfaz chat con usuario + plantillas
- **G03 Plantillas Respuesta** (`/admin/support/quick-replies`)

### 🔔 Push Notifications
- **I01 Lista Push** (`/admin/notifications`) — historial enviadas
- **I02 Nueva Push** (`/admin/notifications/new`) — título, body, audiencia (all/nivel/ciudad/evento), schedule

### 📊 Analytics
- **J01 Analytics** (`/admin/analytics`) — dashboards interactivos
- **J02 Reportes** (`/admin/analytics/reports`) — exports CSV

### ⚙ Config App
- **K01 Config App** (`/admin/config/app`) — feature flags, strings globales
- **K02 Niveles Fidelidad** (`/admin/config/levels`) — Ámbar, Platino, Diamante…
- **K03 Reglas de Filtro** (`/admin/config/rules`) — patrones prohibidos
- **K04 Gestión Staff** — ya en H06
- **K05 Permisos Roles** (`/admin/config/permissions`)

### 📱 Check-in
- **L01 QR Check-in** (`/admin/checkin`) — escáner para staff (usa cámara en tablet/web)

---

## Orden de implementación recomendado

### Fase C1 — Infraestructura (1 día)
- [ ] `npx nx g @nx/react:app admin --bundler=vite --routing=true`
- [ ] Instalar Tailwind, TanStack Query, Zustand, react-router-dom, recharts, react-hook-form, zod, lucide-react
- [ ] Copy `apps/mobile/src/api/client.ts` → `apps/admin/src/api/client.ts` (adaptar para localStorage)
- [ ] Layout: sidebar + topbar + content + auth guard
- [ ] Login page (`/admin/login`)

### Fase C2 — Core (2 días)
- [ ] A01 Dashboard (stats cards + charts básicos)
- [ ] H01–H02 Users (list + detail)
- [ ] B01–B03 Events (list + crear + detalle)
- [ ] C01–C03 Offers
- [ ] E01–E03 Community moderación

### Fase C3 — Ops (1.5 días)
- [ ] D01–D02 Reservations Kanban
- [ ] G01–G02 Support chat
- [ ] L01 QR Check-in con `react-qr-reader`

### Fase C4 — Growth (1 día)
- [ ] I01–I02 Push notifications
- [ ] J01 Analytics básico
- [ ] H03 GDPR

### Fase C5 — Config (0.5 días)
- [ ] K01–K05 Config app, levels, rules, staff, permisos
- [ ] B04 Categorías eventos

### Fase C6 — Resto (1 día)
- [ ] H04–H06 Security + staff management
- [ ] E04–E06 Cola comentarios/reseñas/reportes
- [ ] F01–F03 Content monitor detalle
- [ ] G03 Quick replies

**Total estimado: ~6-7 días de trabajo**

---

## Endpoints existentes que consumirá

Todos ya implementados en `apps/api/src/modules/admin/` y módulos relacionados. Ver README.md líneas 183-224.

### Resumen por módulo

| Módulo | Endpoints clave |
|---|---|
| Admin Stats | `GET /admin/stats` |
| Admin Users | `GET/PATCH /admin/users`, `PATCH /admin/users/:id/ban`, `PATCH /admin/users/:id/role` |
| Admin Posts | `GET /admin/posts/pending`, `PATCH /admin/posts/:id/approve\|reject` |
| Admin Reports | `GET /admin/reports`, `PATCH /admin/reports/:id/resolve` |
| Admin Reservations | `GET /admin/reservations`, `PATCH /admin/reservations/:id/status` |
| Admin Support | `GET /admin/support/tickets`, `PATCH /admin/support/tickets/:id`, `GET/POST/PATCH/DELETE /admin/support/quick-replies` |
| Admin Reviews | `GET /admin/reviews`, `PATCH /admin/reviews/:id/moderate` |
| Admin Loyalty | `POST /admin/loyalty-levels` |
| Content Monitor | `GET /content-monitor/flags`, `GET /content-monitor/flags/stats`, `PATCH /content-monitor/flags/:id/review`, `GET/POST/PATCH/DELETE /content-monitor/rules` |
| Events CRUD | `POST/PATCH/DELETE /events/:id` |
| Offers CRUD | `POST/PATCH /offers/:id` |

### Endpoints a crear (pocos)

- `POST /admin/notifications` — enviar push a audiencia
- `GET /admin/analytics/signups?period=30d`
- `GET /admin/analytics/redemptions`
- `GET /admin/analytics/retention`
- `GET /admin/config/app` + `PATCH /admin/config/app` — feature flags
- `POST /admin/checkin/reservation/:id` — mark attended via QR
- `POST /admin/checkin/redemption/:id` — mark redeemed via QR

---

## Seguridad

- ✅ JWT guard con role check (`@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)`) en backend
- ⚠️ Agregar audit log: cada acción admin graba en `ModerationLog` con userId + action + targetType + targetId
- ⚠️ 2FA obligatorio para SUPER_ADMIN (OTP email en cada login)
- ⚠️ Session timeout agresivo (5 min idle → auto logout)
- ⚠️ IP allowlist a nivel Nginx/CloudFlare (opcional)
- ⚠️ Todas las actions destructivas (ban, delete) piden confirmación con motivo

---

## Principios UX Admin

1. **Tablas primero**: toda lista principal es una tabla con columnas configurables.
2. **Acciones inline rápidas**: no navegar para actions simples (ban, approve, reject).
3. **Bulk actions**: checkbox en filas + bar de acciones al seleccionar varias.
4. **Filtros persistentes en URL**: `?status=PENDING&role=USER` → shareable.
5. **Keyboard shortcuts**: `/` para buscar, `n` para nuevo, `Esc` cerrar modal.
6. **Auditoría visible**: toda página de detalle muestra "Última edición por X, hace N horas".
7. **Dark-mode**: mismo dark theme del mobile para consistencia.

---

*Última actualización: auto-generada*
