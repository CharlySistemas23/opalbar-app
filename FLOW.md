# OPALBAR — FLOW

> Contrato vivo. Cada pantalla es una fila; cada fila debe cumplir el **Definition of Done**. Lo que no esté aquí, no existe.

---

## 0. Cómo usar este documento

- **Columna por columna, pantalla por pantalla.** Si una celda está vacía, es un TODO.
- **No mover a "hecho" una feature** hasta que cumpla el checklist de §2.
- **Todo error** se muestra con `apiError(err)` — nunca strings hardcoded genéricos.
- **Toda string** tiene versión ES + EN.

---

## 1. Principios UX (no negociables)

1. Dark-first: fondo `#0D0D0F`, acento `#F4A340`.
2. Una acción primaria por pantalla (botón naranja dominante).
3. Feedback visual < 100 ms. Optimistic UI en like/follow/save.
4. Nunca bloquear: skeleton o retry inline, nunca pantalla en blanco.
5. Confirmación para lo irreversible (borrar, cancelar, eliminar cuenta).
6. Bilingüe ES/EN al 100%.
7. Haptic en toda acción destructiva o de éxito importante.

### Tokens visuales

| Token | Valor | Uso |
|---|---|---|
| bg-primary | `#0D0D0F` | Fondo pantallas |
| bg-card | `#17171B` | Cards, inputs |
| bg-elevated | `#1F1F25` | Icon boxes |
| border | `#2A2A32` | Bordes |
| accent-primary | `#F4A340` | Primario, highlights |
| accent-success | `#38C793` | OK, gratis |
| accent-danger | `#E45858` | Error, borrar |
| text-primary | `#F4F4F5` | Títulos |
| text-secondary | `#B4B4BB` | Subtítulos |
| text-muted | `#6B6B78` | Timestamps |
| radius-button | `14` | Botones, inputs |
| radius-card | `16` | Cards |

---

## 2. Definition of Done (por feature)

Una feature **no está lista** hasta que:

- [ ] **Golden path** funciona de punta a punta
- [ ] **Estado Loading** — skeleton o spinner, nunca pantalla blanca
- [ ] **Estado Empty** — ilustración/icono + mensaje + CTA claro
- [ ] **Estado Error** — muestra `apiError(err)` real + botón "Reintentar"
- [ ] **Estado Offline** — detecta sin red, muestra banner "Sin conexión"
- [ ] **Haptic** en acción destructiva, éxito, o confirmación
- [ ] **i18n** ES + EN completo (ningún string hardcoded en un solo idioma)
- [ ] **Deep link** `opalbar://…` funcional si la pantalla es navegable desde push
- [ ] **Guard de auth** correcto (redirige a login si aplica)
- [ ] **Pull-to-refresh** en toda lista principal
- [ ] **Animación de entrada** (fade-in 200ms mínimo)
- [ ] **Sonido** si la acción lo amerita (ver §3)

---

## 3. Sonidos & animaciones (expo-av + Reanimated)

| Evento | Sonido | Animación |
|---|---|---|
| Like (post/comment) | `pop.mp3` (60ms) | Scale 1 → 1.2 → 1 (200ms) |
| Comment enviado | `bubble.mp3` | Slide-in desde abajo |
| Reserva confirmada | `success.mp3` | Confetti 1s |
| Canje exitoso | `coin.mp3` | QR flip-in |
| Error | `error.mp3` | Shake horizontal (x3) |
| Logout | `chime.mp3` | Fade-out screen |
| Push recibida | `notification.mp3` | — |
| Navegación tab | — | Fade 150ms |
| Apertura modal | — | Slide-up 250ms ease-out |

**Toggle global:** `useAppStore.soundsEnabled` en Configuración.

---

## 4. Mapa de navegación

```
/(auth)
├── welcome            ← entry si !isAuthenticated
├── login
├── register
├── otp-email
├── forgot-password
└── new-password

/(tabs)                ← entry si isAuthenticated
├── explore            ← home: eventos + ofertas destacados
├── events             ← lista + filtros
├── community          ← feed + FAB new-post
├── offers             ← lista + filtros
└── profile            ← hero + menú

/(app)                 ← rutas stack sobre los tabs
├── events/[id]        → reservations/new
├── offers/[id]        → offers/[id]/redeem
├── venues/[id]        → reviews/new
├── community/new-post
├── community/posts/[id]
├── reservations/new
├── reservations/my
├── reservations/[id]
├── profile/edit
├── profile/wallet
├── profile/notifications
├── profile/privacy
├── users/[id]         → messages/[threadId]
├── messages/          (index: threads)
├── messages/[id]      (thread view)
├── search
└── support/
```

### Deep links canónicos

| URL | Destino |
|---|---|
| `opalbar://event/:id` | `events/[id]` |
| `opalbar://offer/:id` | `offers/[id]` |
| `opalbar://post/:id` | `community/posts/[id]` |
| `opalbar://user/:id` | `users/[id]` |
| `opalbar://thread/:id` | `messages/[id]` |
| `opalbar://reservation/:id` | `reservations/[id]` |

---

## 5. Pantallas — tabla actionable

Leyenda: ✅ hecho · 🟡 parcial · ⛔ falta · — no aplica

### 5.1 Auth

| Pantalla | Evento | Endpoint | Loading | Empty | Error | Haptic | Sonido | Anim |
|---|---|---|---|---|---|---|---|---|
| welcome | tap "Iniciar sesión" | — | — | — | — | ⛔ | ⛔ | ✅ |
| welcome | tap "Continuar invitado" | — | — | — | — | ⛔ | — | ✅ |
| login | submit | `POST /auth/login` | ✅ | — | ✅ | ⛔ | ⛔ | ✅ |
| login | tap "Olvidé contraseña" | — | — | — | — | ⛔ | — | ✅ |
| register | submit | `POST /auth/register` → OTP | ✅ | — | ✅ | ⛔ | ⛔ | ✅ |
| otp-email | verify 6 dígitos | `POST /otp/verify` | ✅ | — | ✅ | ⛔ | ⛔ | 🟡 |
| otp-email | resend | `POST /otp/send` | 🟡 | — | ✅ | ⛔ | — | — |
| forgot-password | submit | `POST /otp/send` | ✅ | — | ✅ | ⛔ | — | ✅ |
| new-password | submit | `PATCH /auth/password` | ✅ | — | ✅ | ⛔ | ⛔ | ✅ |

### 5.2 Tabs

| Pantalla | Evento | Endpoint | Loading | Empty | Error | PTR | Anim |
|---|---|---|---|---|---|---|---|
| explore | mount | `GET /events`, `GET /offers`, `GET /venues` | ✅ | ⛔ | ⛔ | 🟡 | ✅ |
| events | mount | `GET /events` | ✅ | ⛔ | ⛔ | ✅ | ✅ |
| events | filtros | query params | — | — | — | — | ⛔ |
| community | mount | `GET /community/posts` | ✅ | ✅ | 🟡 | ✅ | ✅ |
| community | tap FAB | `push /community/new-post` | — | — | — | — | ✅ |
| offers | mount | `GET /offers` | ✅ | ⛔ | ⛔ | ✅ | ✅ |
| profile | mount | `GET /users/me` (persistido) | — | — | — | — | ✅ |

### 5.3 Eventos

| Pantalla | Evento | Endpoint | Loading | Error | Haptic | Sonido |
|---|---|---|---|---|---|---|
| events/[id] | mount | `GET /events/:id` | ✅ | 🟡 | — | — |
| events/[id] | tap "Reservar" | `push reservations/new?eventId` | — | — | ⛔ | — |
| events/[id] | tap "Asistiré" | `POST /events/:id/attend` | ✅ | ✅ | ⛔ | ⛔ |
| events/[id] | tap "Guardar" | `POST /users/me/saved` | — | — | ⛔ | — |

### 5.4 Ofertas

| Pantalla | Evento | Endpoint | Loading | Error | Sonido |
|---|---|---|---|---|---|
| offers/[id] | mount | `GET /offers/:id` | ✅ | 🟡 | — |
| offers/[id] | tap "Canjear" | `POST /offers/:id/redeem` | ✅ | ✅ | ⛔ coin.mp3 |
| offers/[id] | ver QR | (sheet QR) | — | — | — |

### 5.5 Reservaciones

| Pantalla | Evento | Endpoint | Estado |
|---|---|---|---|
| reservations/new | submit | `POST /reservations` | ✅ |
| reservations/my | mount | `GET /reservations/my` | ✅ |
| reservations/[id] | mount | `GET /reservations/:id` | ⛔ |
| reservations/[id] | cancel | `DELETE /reservations/:id` | ⛔ |
| reservations/[id] | QR | (modal QR de confirmación) | ⛔ |

### 5.6 Comunidad

| Pantalla | Evento | Endpoint | Estado |
|---|---|---|---|
| community (feed) | pull-refresh | `GET /community/posts` | ✅ |
| community | like | `POST /community/posts/:id/react` | ✅ |
| community | opciones post | delete/report | ✅ |
| community/new-post | submit | `POST /community/posts` | ✅ |
| community/new-post | adjuntar foto | expo-image-picker → base64 | ✅ |
| posts/[id] | mount | `GET /community/posts/:id` + comments | ✅ |
| posts/[id] | comentar | `POST /.../comments` | ✅ |
| posts/[id] | responder | `POST /.../comments` con `parentId` | ✅ |
| posts/[id] | like comentario | `POST /community/comments/:id/like` | ✅ |
| posts/[id] | borrar/reportar comentario | `DELETE`/`POST …/report` | ✅ |

### 5.7 Mensajes

| Pantalla | Evento | Endpoint | Estado |
|---|---|---|---|
| messages (lista) | mount | `GET /messages/threads` | ✅ |
| messages/[id] | mount | `GET /messages/threads/:id/messages` | ✅ |
| messages/[id] | enviar | `POST /messages/threads/:id/messages` | ✅ |
| messages/[id] | tiempo real | **WebSocket** `message:new` | ⛔ |
| messages/[id] | "escribiendo…" | **WebSocket** `typing:start/stop` | ⛔ |
| messages/[id] | presencia online | **WebSocket** `presence:online` | ⛔ |
| messages/[id] | leído | **WebSocket** `message:read` | ⛔ |

### 5.8 Perfil

| Pantalla | Evento | Endpoint | Estado |
|---|---|---|---|
| profile | tap menú | navegación | ✅ |
| profile | logout | `POST /auth/logout` + clear | ✅ |
| profile/edit | guardar | `PATCH /users/me/profile` | ✅ |
| profile/edit | cambiar avatar | image-picker + base64 | ✅ |
| profile/wallet | mount | `GET /wallet` + `/wallet/transactions` | ✅ |
| profile/notifications | toggle | `PATCH /users/me/notifications` | ✅ |
| profile/privacy | consent | `PATCH /users/me/consent` | ✅ |
| profile/privacy | export datos | `POST /users/me/export` | ⛔ |
| profile/privacy | eliminar cuenta | `DELETE /users/me` | ⛔ |

### 5.9 Usuarios & búsqueda

| Pantalla | Evento | Endpoint | Estado |
|---|---|---|---|
| users/[id] | mount | `GET /users/:id` | ✅ |
| users/[id] | follow/unfollow | `POST/DELETE /users/:id/follow` | ✅ |
| users/[id] | tap "Mensaje" | `POST /messages/threads` → push | ✅ |
| users/[id] | ver followers/following | `GET /users/:id/followers` | ⛔ |
| search | buscar personas | `GET /users/search` | ✅ |
| search | buscar bares | `GET /venues?search=` | 🟡 |
| search | buscar eventos | `GET /events?search=` | 🟡 |

### 5.10 Reseñas & venues

| Pantalla | Evento | Endpoint | Estado |
|---|---|---|---|
| venues/[id] | mount | `GET /venues/:id` | ⛔ |
| venues/[id] | ver reseñas | `GET /reviews/venue/:id` | ⛔ |
| reviews/new | submit | `POST /reviews` | ⛔ |

### 5.11 Soporte

| Pantalla | Evento | Endpoint | Estado |
|---|---|---|---|
| support (index) | listar mis tickets | `GET /support/tickets/my` | ✅ |
| support/new | crear ticket | `POST /support/tickets` | ✅ |
| support/[id] | chat | `GET/POST /support/tickets/:id/messages` | ✅ |

---

## 6. Matriz de estados (lista/detalle)

| Estado | Diseño |
|---|---|
| Loading | Skeleton si lista, spinner centrado si detalle. Nunca blank. |
| Empty | Icono 64px + título + mensaje + CTA primario |
| Error | Icono danger + `apiError(err)` + botón "Reintentar" |
| Offline | Banner superior amarillo "Sin conexión" + cache si hay |
| Success | Toast 2s o navegación directa, sin Alert() para lo simple |

---

## 7. Backlog priorizado (sale de la tabla)

### 🔥 P1 — Tiempo real en mensajes
- Gateway Socket.io con auth JWT
- Eventos: `message:new`, `typing`, `presence`, `message:read`
- Hook `useThreadSocket(threadId)` en `messages/[id].tsx`
- Indicador online (puntito verde) en header del chat
- "Escribiendo…" en footer

### 🟠 P2 — Estados vacíos/error universales
- Componentes `<EmptyState icon msg cta>`, `<ErrorState onRetry>`, `<OfflineBanner>`
- Aplicar en: explore, events, offers, messages, search, wallet

### 🟠 P3 — Sonidos & haptics
- Instalar `expo-av` + `expo-haptics`
- Hook `useSound('pop')` con toggle global
- Aplicar en like, comentario, canje, error

### 🟡 P4 — Reservaciones completas
- Pantalla detalle con QR
- Cancel + modificar
- Historial unificado con canjes

### 🟡 P5 — Venues & reseñas
- `venues/[id]` con galería, horarios, mapa (expo-maps)
- `reviews/new` con estrellas 1–5 + foto opcional

### 🟢 P6 — Privacidad
- Export de datos (POST + email link)
- Eliminar cuenta con confirm doble + razón

### 🟢 P7 — Push notifications
- Expo push token al login
- Backend envía a topic por tipo

---

## 8. Flujo administrador

Detallado en `ADMIN.md`. Resumen de impacto sobre la app móvil:

- Post en `PENDING_REVIEW` → no aparece en feed del autor tampoco hasta aprobar
- User `banned` → logout forzado en siguiente request (401)
- Reserva cambiada por admin → push "Tu reserva fue confirmada/cancelada"
- Oferta eliminada → push a quien la guardó

---

## 9. Cambios que invalidan este doc

Cuando cambies:
- Un endpoint → actualizar la celda correspondiente
- Una navegación → actualizar §4
- Tokens visuales → actualizar §1
- Sonidos → actualizar §3

*Doc versionado con el código. Si esto y el código no concuerdan, el código está mal.*
