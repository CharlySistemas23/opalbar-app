# OPALBAR — Plan Maestro para 100% Funcional

> Estado actual: **~55%** completado. Faltan pantallas, panel admin y varias funcionalidades del backend conectadas.

---

## 📊 Inventario Pencil (283 frames)

### Ya implementado ✅
| # | Pantalla | Estado |
|---|---|---|
| 01–05 | Home, Events, Offers, Community, Profile (tabs) | ✅ diseño nuevo |
| 06 | Login (email OTP) | ✅ |
| 07 | OTP Verification | ✅ |
| 08 | Onboarding intereses | ✅ |
| 09 | Detalle Evento | ✅ (con reservar/compartir) |
| 12 | Detalle Oferta | ✅ (con canjear) |
| 15 | Crear Post | ✅ |
| 21 | Mis Reservas | ✅ |
| 23 | Detalle Post + comentarios | ✅ |
| 26 | Editar Perfil | ✅ (foto URL, nombre, bio) |
| 27 | Wallet Puntos | ✅ |
| — | Support tickets + chat | ✅ |
| — | 10 - Reservar Mesa (nueva) | ✅ (recién corregida) |

### Faltan por implementar ❌
**Usuario — funcionalidad principal:**
- [ ] **11 — Confirmación de reserva** (pantalla post-booking con QR)
- [ ] **13 — Modal de canje** (con QR de la oferta)
- [ ] **14 — Notificaciones** (lista del usuario)
- [ ] **16 — Filtros de eventos** (hoja modal)
- [ ] **22 — Historial de Canjes** (pantalla dedicada)
- [ ] **24 — Configuración** (idioma, notifs, legal, logout)
- [ ] **25 — Privacidad y seguridad**
- [ ] **28 — Búsqueda global** (bares + personas)
- [ ] **29 — Perfil Usuario** (ver perfil de otro)

**Auth extras:**
- [ ] AUTH — Recuperar Contraseña (`7YMNW`)
- [ ] AUTH — Nueva Contraseña (`ATSbK`)
- [ ] AUTH — Correo Enviado (`qvkZK`)
- [ ] AUTH — Registro Completo (`SAOV5`)
- [ ] RG — Registro directo (`CKpBL`) — opcional si mantenemos OTP-only
- [ ] WL — Welcome (splash + onboarding marketing)

**Modales & Bottom sheets:**
- [ ] M — Cerrar Sesión (confirm)
- [ ] M — Cancelar Reserva
- [ ] M — Eliminar Cuenta
- [ ] M — Reporte de Contenido
- [ ] BS — Opciones Post
- [ ] BS — Opciones Usuario

**Social / Mensajería:**
- [ ] SC — Chat Mensajería (chat 1:1)
- [ ] SC — Lista Seguidores
- [ ] SC — Lista Siguiendo
- [ ] SC — Lista Asistentes a evento
- [ ] SC — Hilo de respuestas (comentarios de un comentario)
- [ ] SAVE — Posts/eventos guardados

**Venue:**
- [ ] VEN — Perfil del Bar
- [ ] VEN — Escribir Reseña
- [ ] QR — Viewer (para check-in)

**Compose helpers:**
- [ ] CP — Location Picker
- [ ] CP — Event Selector
- [ ] CP — Audience Selector

**Estados especiales:**
- [ ] EC — Oferta Expirada, Horarios Agotados
- [ ] EV — Evento Agotado
- [ ] RL — Catálogo de Recompensas
- [ ] RV — Modificar Reserva
- [ ] 17 — Empty / 18 — Error / 19 — Offline / 20 — Loading
- [ ] Splash screen con branding

**Panel Admin (0% — 39 pantallas ES + 39 EN):**
- [ ] A01 Dashboard (stats + widgets)
- [ ] B01–B04 Eventos (lista, crear, detalle, categorías)
- [ ] C01–C03 Ofertas
- [ ] D01–D03 Reservaciones
- [ ] E01–E06 Posts/Comentarios/Reseñas/Reportes (moderación)
- [ ] F01–F03 Monitor de contenido (flags + reglas)
- [ ] G01–G03 Soporte (tickets + chat admin + quick replies)
- [ ] H01–H06 Usuarios, GDPR, login attempts, alertas, staff
- [ ] I01–I02 Push notifications
- [ ] J01–J02 Analytics
- [ ] K01–K05 Config app, niveles, filtros, staff, permisos
- [ ] L01 QR Check-in (escanear reservas/ofertas)

---

## 🚀 Fases Propuestas

### **FASE A — Estabilización (app funciona 100% con lo actual)** — 🔥 AHORA
Objetivo: eliminar crashes, conectar endpoints faltantes, UI completa de lo existente.

1. ✅ OTP verify emite tokens + `completeOtpLogin` en store
2. ✅ Fix crop filtros Events
3. ✅ Fix shape data `.data.data` en tabs
4. ✅ Fix community render error (author.color)
5. ✅ Fix reservations payload (`timeSlot`/`partySize`)
6. ✅ Fix `walletApi.balance` → `walletApi.wallet`
7. [ ] Verificar post creation + reactions funcionan post-login
8. [ ] Verificar "posts no cargan" (confirmar con dispositivo)

### **FASE B — Pantallas de usuario faltantes** (prioridad alta)
Entrega en orden de impacto al usuario.

**B1. Funciones de engagement** (5 pantallas)
1. **14 — Notificaciones** — lista, marcar leídas, hacer click → destino
2. **28 — Búsqueda global** — tabs Bares/Personas/Eventos + sin resultados
3. **29 — Perfil Usuario (otro)** — bio, stats, posts, seguir/dejar de seguir
4. **SC — Lista Seguidores / Siguiendo** — 2 pantallas gemelas
5. **SC — Chat Mensajería** — listado + hilo 1:1

**B2. Reservas, ofertas y QR** (6 pantallas)
1. **11 — Confirmación Reserva** — con código QR grande
2. **13 — Modal Canje Oferta** — con QR
3. **22 — Historial de Canjes** — lista
4. **QR — Viewer** — fullscreen con brillo máx
5. **RV — Modificar Reserva** — edit form
6. **M — Cancelar Reserva** — modal confirm

**B3. Configuración & Cuenta** (6 pantallas)
1. **24 — Settings** — idioma, notifs, ayuda, logout
2. **CFG — Ajustes Notificaciones** — toggles por tipo
3. **CFG — Selector Idioma** — ES/EN
4. **CFG — Centro de Ayuda** — FAQ
5. **CFG — Términos/Privacidad**
6. **25 — Privacidad & Seguridad** — GDPR, sesiones, password

**B4. Social extras** (4 pantallas)
1. **SC — Lista Asistentes** a un evento
2. **SC — Hilo respuestas** a un comentario
3. **SAVE — Guardados**
4. **PRF — Tab Eventos Otro Usuario**

**B5. Venue & reviews** (2 pantallas)
1. **VEN — Perfil del Bar** — header, info, eventos, reviews
2. **VEN — Escribir Reseña** — rating + comentario

**B6. Filtros & helpers** (4 pantallas)
1. **16 — Filtros de Eventos** — modal con date, categoría, precio
2. **CP — Location Picker** (map + input)
3. **CP — Event Selector** (para "etiquetar evento" en post)
4. **CP — Audience Selector** (público/privado)

**B7. Modales y bottom sheets** (6)
1. M — Cerrar Sesión (ya existe en profile, hacer modal custom)
2. M — Eliminar Cuenta
3. M — Reporte de Contenido
4. BS — Opciones Post (editar/borrar/reportar)
5. BS — Opciones Usuario (bloquear/reportar)
6. RL — Catálogo Recompensas

**B8. Estados especiales** (4 pantallas)
1. **17 — Empty State** reutilizable
2. **18 — Error State** reutilizable
3. **19 — Offline** con retry
4. **20 — Loading** skeleton

**B9. Auth extras** (3 pantallas)
1. **Forgot Password** + Check Your Email
2. **New Password** (con token del email)
3. **Registration Complete** celebración
4. **Splash + Welcome Landing**

### **FASE C — Panel Admin Web** (app nueva)
El admin debería ser una app web separada (React Vite o Next.js). Construir en `apps/admin/` como app Nx.

**C1. Infraestructura** (1–2 días)
- [ ] Crear `apps/admin` (React + Vite + React Router + Zustand)
- [ ] Layout admin (sidebar + topbar + breadcrumbs)
- [ ] Auth flow (usa `/auth/login` con cuenta admin)
- [ ] API client con mismas interceptors

**C2. Dashboard & users** (4 pantallas)
- [ ] A01 Dashboard (KPIs: users, events, offers, tickets abiertos, flags)
- [ ] H01 Lista Usuarios + filtros + búsqueda
- [ ] H02 Detalle Usuario (tabs: perfil, sesiones, posts, actividad)
- [ ] H03 Solicitudes GDPR
- [ ] H04 Intentos de Login seguridad
- [ ] H05 Alertas seguridad
- [ ] H06 Roles y Staff

**C3. Contenido & moderación** (6 pantallas)
- [ ] B01–B04 Events (lista/crear/detalle/categorías)
- [ ] C01–C03 Offers
- [ ] E01–E06 Posts/Comentarios moderación
- [ ] F01–F03 Monitor contenido + flags + reglas

**C4. Operaciones** (4 pantallas)
- [ ] D01–D03 Reservaciones
- [ ] G01–G03 Soporte + chat admin + quick replies
- [ ] L01 QR Check-in

**C5. Crecimiento & config** (4 pantallas)
- [ ] I01–I02 Push notifications (compose + send)
- [ ] J01–J02 Analytics
- [ ] K01–K05 Config app, niveles, reglas, staff, permisos

### **FASE D — Integraciones & polish** (post-MVP)
- [ ] SMTP real (Nodemailer + SendGrid/Mailtrap) — emails reales
- [ ] Twilio SMS
- [ ] Push notifications (Expo notifications + FCM/APNs)
- [ ] Image upload (Cloudinary/S3) — reemplazar URL manual
- [ ] Mapas (Mapbox/Google Maps) para location pickers
- [ ] Biometric auth (Face ID/Touch ID)
- [ ] i18n completo (saca strings en archivos locale)
- [ ] Tests E2E (Maestro o Detox)

---

## 🔧 Bugs conocidos — corregir en próxima iteración

| Bug | Severidad | Fix |
|---|---|---|
| Posts no cargan post-login | 🔴 | Probable: adapter o shape. Revisar logs con device |
| Reservas descuadradas | 🟡 | Ya reescrita con nuevo diseño |
| Reservas no envían | 🔴 | Fix aplicado: campos `timeSlot`/`partySize` |
| Notas descuadradas | 🟡 | Fix incluido en nueva pantalla |
| Panel admin no existe | 🔴 | Fase C completa |
| Falta búsqueda | 🔴 | Fase B1 — pantalla 28 |
| Falta seguidores/siguiendo | 🔴 | Fase B1 — SC screens |
| Falta chat mensajería | 🔴 | Fase B1 |
| Posts no tienen opciones (editar/borrar) | 🟡 | Fase B7 — BS Opciones Post |

---

## 📝 Endpoints backend pendientes de crear

El Pencil/README menciona follow/mensajería pero NO están en el controlador actual:
- [ ] `POST /users/:id/follow` / `DELETE /users/:id/follow`
- [ ] `GET /users/:id/followers`
- [ ] `GET /users/:id/following`
- [ ] `GET /users/search`
- [ ] `GET /events/search`
- [ ] `GET /venues/search`
- [ ] `POST /messages` + `GET /messages/threads` + `GET /messages/:threadId` (chat 1:1)
- [ ] `GET /events/:id/attendees`
- [ ] `POST /community/posts/:id/save` + `GET /users/me/saved`

Tablas Prisma nuevas requeridas:
- `Follow` (followerId, followingId)
- `MessageThread` + `Message`
- `SavedItem` (userId, type, targetId)

---

## 🎯 Recomendación

**Empezar por la Fase B1 (engagement)** porque es lo que más sientes: notificaciones, búsqueda, perfiles de otros, seguidores y chat.

Después **B2+B3** (reservas/QR/settings).

Panel admin (Fase C) en paralelo una vez que el mobile user-flow esté al 100%.

---

*Fecha: 2026-04-19*
*Total de pantallas estimadas: ~45 faltantes para user + ~78 panel admin = ~123*
*Esfuerzo estimado: 3–5 días para B, 4–6 días para C*
