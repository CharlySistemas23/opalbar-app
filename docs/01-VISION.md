# OPALBAR APP

Documento maestro ultra detallado para planificar, diseñar, construir, asegurar, lanzar y operar la app OPALBAR APP sin pérdida de información.

---

## 1. Propósito del Documento

Este archivo es la fuente única de verdad del proyecto. Todo cambio estratégico, técnico o funcional debe reflejarse aquí.

Objetivos de este documento:
- Evitar pérdida de contexto entre fases y entre miembros del equipo.
- Mantener trazabilidad completa de decisiones.
- Definir entregables y criterios de aceptación por fase.
- Asegurar integración entre diseño, backend, seguridad, QA y operación.

Estado actual del proyecto (al 2026-04-27):
- **Fase 1 COMPLETADA** — Diseño UX/UI completo con 220+ pantallas bilingües (ES + EN).
- **Fase 2 COMPLETADA** — Base técnica e infraestructura (NestJS + Postgres + Redis + EAS + Vercel + Railway + FCM).
- **Fase 3 COMPLETADA** — Reservaciones, soporte, content monitor, reviews, panel admin web, friendships, DMs IG/FB-style, stories con reactions, push end-to-end.
- **Fase 4 EN CURSO** — Hardening pre-store: APNs iOS, Sentry, audit logs admin, optimizaciones a 10K usuarios.
  - ✅ 2026-04-27 entregado: Sentry backend + admin web, audit log + decorator + endpoint lectura, health enriquecido (DB+Redis+FCM), rate-limit per-endpoint + ThrottlerGuard global en prod, 2FA email para SUPER_ADMIN, session-timeout idle 5 min en admin web, GDPR export real con email firmado, runbook on-call ([08-RUNBOOK.md](08-RUNBOOK.md)).
  - ⛔ Pendiente: APNs iOS, EAS production y Sentry mobile — bloqueados por verificación Apple Developer.

---

## 2. Identidad del Producto

Nombre del producto:
- OPALBAR APP

Propuesta de valor:
- Conectar a la comunidad del bar en torno a eventos, ofertas, descuentos y beneficios personalizados.

Promesa de marca:
- "Siempre hay algo pasando, y tú te enteras primero."

Pilares:
- Comunidad: interacción real entre clientes.
- Conversión: reservas y canjes de ofertas.
- Retención: programa de puntos y recompensas.
- Confianza: seguridad y privacidad desde el diseño.

---

## 3. Alcance Funcional Avanzado

### Alcance de la versión de lanzamiento (Fase 1 — DISEÑADO Y COMPLETADO)

- Registro e inicio de sesión con OTP (email y SMS).
- Inicio con eventos destacados y ofertas vigentes.
- Catálogo de eventos con filtros avanzados.
- Catálogo de ofertas y descuentos con reglas de vigencia.
- Comunidad: posts, comentarios, reacciones, reportes, moderación automática.
- Reservas de mesa con confirmación de asistencia previa.
- Perfil con recompensas, programa de niveles y configuración de privacidad.
- Notificaciones push segmentadas por intereses del usuario.
- Modo invitado con navegación limitada y CTA de registro.
- Gestión de sesiones activas y cierre global.
- Derechos de usuario GDPR: exportar, consultar y eliminar datos.
- Consentimiento explícito de marketing y comunicaciones.
- Biometría para reautenticación de acciones sensibles.
- Programa de fidelidad con niveles dinámicos (Bronce, Plata, Oro).
- Ranking de comunidad.
- Incentivo de bienvenida post-registro.
- Flujos de seguridad: sesión expirada, rate limit, cuenta bloqueada.
- Moderación: post en revisión, post rechazado con motivo.
- Edge cases de concurrencia: reserva ya tomada, canje agotado en tiempo real.
- Actualización forzada con comunicación in-app.

### Capacidades avanzadas en hoja de ruta prioritaria

- Pasarela de pago in-app con conciliación de transacciones.
- Streaming en vivo para eventos seleccionados.
- Marketplace de productos y experiencias del bar.
- Recomendación personalizada con motor de segmentación por comportamiento.
- Programa de fidelidad multicapa con reglas dinámicas y campañas automatizadas.

### Capacidades de expansión estratégica (siguientes releases)

- Pasarela de pago in-app avanzada.
- Streaming en vivo desde eventos.
- Marketplace de productos externos.

---

## 4. Roles de Usuario

### Roles internos

- **Admin**: control total de contenidos, ofertas, moderación y analítica. Panel web dedicado.
- **Staff**: gestión operativa de eventos, reservas y promociones. Panel web dedicado + acceso móvil de verificación QR.

### Roles externos

- **Usuario registrado**: consume contenido, participa y canjea ofertas.
- **Usuario invitado**: navegación limitada sin acciones sensibles (diseñado y completado).

### Matriz base de permisos

| Acción | Invitado | Registrado | Staff | Admin |
|---|---|---|---|---|
| Ver inicio parcial | ✅ | ✅ | ✅ | ✅ |
| Ver eventos públicos | ✅ | ✅ | ✅ | ✅ |
| Reservar mesa | ❌ | ✅ | ✅ | ✅ |
| Confirmar asistencia | ❌ | ✅ | ✅ | ✅ |
| Comentar y reaccionar | ❌ | ✅ | ✅ | ✅ |
| Canjear oferta | ❌ | ✅ | ✅ | ✅ |
| Recibir notificaciones | ❌ | ✅ | ✅ | ✅ |
| Crear y editar eventos | ❌ | ❌ | ✅ | ✅ |
| Gestionar reservas | ❌ | ❌ | ✅ | ✅ |
| Moderar contenido | ❌ | ❌ | ❌ | ✅ |
| Auditoría y analítica | ❌ | ❌ | ❌ | ✅ |

---

## 5. Arquitectura de Experiencia (UX)

### Navegación principal

- Inicio
- Eventos
- Ofertas
- Comunidad
- Perfil

### Elemento persistente

- Botón principal flotante: Reservar mesa (visible desde Home, Eventos y Detalle de Evento).

### Flujos críticos (todos diseñados y completados)

1. Registro → Personalización → Incentivo bienvenida → Inicio.
2. Descubrir evento → Confirmar asistencia → Reservar mesa → QR Ticket.
3. Ver oferta → Revisar condiciones → Canjear → Confirmación.
4. Crear post → Moderación automática → Publicación o rechazo con motivo.
5. Olvidé contraseña → Correo enviado → Nueva contraseña.
6. Invitado → CTA registro → Flujo de registro completo.

### Reglas UX

- Máximo 3 toques para completar una acción principal.
- Estado vacío siempre con CTA accionable.
- Indicadores claros de vigencia, cupos y horarios en toda tarjeta.
- Accesibilidad AA+: contraste validado, tipografía legible en todo el flujo, labels descriptivos para lectores de pantalla.
- Touch targets mínimos 44×44pt en todos los elementos interactivos.
- Feedback inmediato en todas las acciones: toast de éxito, error o info.
- Skeleton loaders en todas las listas antes de carga de datos.

### Inventario completo de pantallas (Fase 1 — COMPLETADO)

#### Auth / Onboarding
| ID | Pantalla | Descripción |
|---|---|---|
| SP | Splash Screen | Logo animado, arranque de app |
| WL | Welcome / Landing | Presentación de pilares, CTA registro/login |
| RG1 | Registro Paso 1 | Nombre, apellido, username |
| RG2 | Registro Paso 2 — Intereses | Chips de música, ambiente, zona |
| RG3 | Registro Paso 3 — Notificaciones | Permiso push |
| RC | Registro Completo | Celebración con stats iniciales |
| IB | Incentivo Bienvenida | Regalo: puntos + descuento primera reserva |
| LG | Login | Email + contraseña + OTP |
| OE | OTP Email | Verificación por email (6 dígitos) |
| OS | OTP SMS | Verificación por SMS (6 dígitos) |
| RP | Recuperar Contraseña | Formulario de email |
| CE | Correo Enviado | Confirmación + reenviar enlace |
| NP | Nueva Contraseña | Crear nueva contraseña con reglas |
| CM | Consentimiento Marketing | Toggles de email y SMS con opt-in legal |
| SE | Sesión Expirada | Redirect con feedback claro |
| RL | Rate Limit / Demasiados Intentos | Countdown de desbloqueo |

#### Main Tabs
| ID | Pantalla | Descripción |
|---|---|---|
| HM | Home / Inicio | Feed de eventos, ofertas destacadas, reserva rápida |
| EV | Eventos Tab | Catálogo de eventos con filtros |
| OF | Ofertas Tab | Catálogo de ofertas con reglas |
| CM | Comunidad Tab | Feed social de posts |
| PR | Perfil Tab | Perfil propio, puntos, configuración |

#### Flujo Eventos
| ID | Pantalla | Descripción |
|---|---|---|
| DE | Detalle Evento | Galería, info, asistentes, CTA reserva |
| CA | Confirmar Asistencia | RSVP sin reserva de mesa |
| RM | Reserva Mesa | Selección de fecha/hora/personas |
| CR | Confirmación Reserva | Resumen y estado confirmado |
| QR | QR Viewer | Ticket digital para acceso al bar |
| MR | Modificar Reserva | Cambiar fecha/hora/personas |
| MR | Mis Reservas | Lista completa de reservas |
| EA | Evento Agotado | Estado sin disponibilidad |
| HA | Horarios Agotados | Sin franjas disponibles |
| RF | Reserva Concurrente Fallida | Mesa tomada en tiempo real |

#### Flujo Ofertas
| ID | Pantalla | Descripción |
|---|---|---|
| DO | Detalle Oferta | Condiciones, vigencia, CTA canje |
| MC | Modal Canje | Confirmación antes de canjear |
| HC | Historial Canjes | Lista de canjes realizados |
| OE | Oferta Expirada | Estado sin vigencia |
| CA | Canje Agotado en Tiempo Real | Stock 0 al momento de canjear |

#### Comunidad / Social
| ID | Pantalla | Descripción |
|---|---|---|
| CP | Crear Post | Composer con texto, media, etiquetas |
| LP | Location Picker | Selector de ubicación en mapa |
| ES | Event Selector | Vincular post a un evento |
| SA | Selector Audiencia | Público del post (todos/seguidores) |
| DP | Detalle Post | Post completo con comentarios y reacciones |
| HR | Hilo Respuestas | Conversación anidada de comentarios |
| PR | Post en Revisión | Estado intermedio de moderación |
| PRC | Post Rechazado | Motivo + opciones de acción |
| CH | Chat Mensajería | Mensajes directos entre usuarios |
| LS | Lista Seguidores | Quién me sigue |
| LF | Lista Siguiendo | A quién sigo |
| LA | Lista Asistentes | Asistentes confirmados a un evento |
| RC | Ranking Comunidad | Podio + clasificación con mi posición |

#### Búsqueda
| ID | Pantalla | Descripción |
|---|---|---|
| SB | Búsqueda Tab Bares | Búsqueda de bares con filtros |
| SP | Búsqueda Tab Personas | Búsqueda de usuarios |
| SR | Búsqueda Sin Resultados | Estado vacío con sugerencias |

#### Venue / Bar
| ID | Pantalla | Descripción |
|---|---|---|
| PV | Perfil Bar/Venue | Info completa del bar, eventos, reseñas |
| ER | Escribir Reseña | Rating de estrellas, textarea, quick tags |

#### Perfil de Usuario
| ID | Pantalla | Descripción |
|---|---|---|
| MP | Mi Perfil | Perfil propio con tabs de posts/eventos/ofertas |
| EP | Editar Perfil | Avatar, bio, datos personales |
| PU | Perfil Otro Usuario | Perfil ajeno con follow/unfollow |
| TE | Tab Eventos Otro Usuario | Eventos a los que ha asistido |

#### Wallet / Fidelidad
| ID | Pantalla | Descripción |
|---|---|---|
| WP | Wallet Puntos | Saldo, historial, próximas recompensas |
| CR | Catálogo Recompensas | Recompensas canjeables |
| NL | Niveles de Fidelidad | Tier actual, progreso, beneficios |
| GU | Guardados | Eventos y ofertas guardadas |

#### Configuración
| ID | Pantalla | Descripción |
|---|---|---|
| CFG | Configuración | Hub principal de ajustes |
| AN | Ajustes Notificaciones | Toggles de tipos de notificación |
| SI | Selector Idioma | Cambio de idioma ES/EN |
| CH | Centro de Ayuda | FAQs y contacto de soporte |
| TP | Términos y Privacidad | Texto legal in-app |
| PV | Privacidad | Ajustes de visibilidad y datos |
| CC | Cambiar Contraseña | Contraseña actual + nueva + confirmar |
| SA | Sesiones Activas | Ver y cerrar sesiones en otros dispositivos |
| GD | Gestión de Datos GDPR | Exportar, consultar y eliminar datos |

#### Seguridad / Sistema
| ID | Pantalla | Descripción |
|---|---|---|
| BIO | Biometría / Reautenticación | Face ID / huella para acciones sensibles |
| CB | Cuenta Bloqueada | Suspensión temporal con motivo y duración |
| AU | Actualización Forzada | Versión obsoleta, CTA a tienda |
| HI | Home Invitado | Vista limitada con banner y CTA de registro |

#### Estados UI
| ID | Pantalla | Descripción |
|---|---|---|
| ES | Empty State | Vacío con ilustración y CTA |
| ER | Error State | Error técnico con reintentar |
| OF | Offline | Sin conexión con sincronización pendiente |
| LD | Loading | Carga en curso |
| SC | Success State | Acción completada con éxito |

#### Modales y Bottom Sheets
| ID | Pantalla | Descripción |
|---|---|---|
| M1 | Modal Cerrar Sesión | Confirmación de logout |
| M2 | Modal Cancelar Reserva | Confirmación de cancelación |
| M3 | Modal Eliminar Cuenta | Flujo de eliminación con aviso |
| M4 | Modal Reporte Contenido | Formulario de reporte |
| M5 | Bottom Sheet Opciones Post | Acciones sobre un post propio o ajeno |
| M6 | Bottom Sheet Opciones Usuario | Acciones sobre un perfil ajeno |
| F1 | Filtros Eventos | Bottom sheet con chips de fecha/tipo/zona |
| F2 | Filtros Ofertas | Bottom sheet con chips de categoría/vigencia |

**Total: 220+ nodos en canvas · 18 filas · Bilingüe 100% ES + EN**

---

## 6. Sistema de Diseño (UI)

### Dirección visual

- Nocturna elegante, enfoque premium y social.
- Contraste validado AA+ en todos los tokens.

### Tokens de diseño (Design Tokens v1.0)

#### Color
| Token | Valor | Uso |
|---|---|---|
| color.bg.primary | #0D0D0F | Fondo principal de pantallas |
| color.bg.card | #17171B | Tarjetas, inputs, nav bars, modales |
| color.bg.elevated | #2A2A30 | Divisores, separadores, elementos inactivos |
| color.text.primary | #F4F4F5 | Texto principal |
| color.text.secondary | #B4B4BB | Texto secundario, placeholders, labels |
| color.accent.primary | #F4A340 | CTA principal, amber, accents activos |
| color.accent.success | #38C793 | Confirmaciones, éxito, elementos activos |
| color.accent.danger | #E45858 | Errores, peligro, eliminaciones |
| color.accent.info | #60A5FA | Badges informativos, nuevo |
| color.overlay.amber | #F4A34015 | Fondos de secciones con tinte amber |
| color.overlay.success | #38C79315 | Fondos de secciones de éxito |
| color.overlay.danger | #E4585815 | Fondos de secciones de error |

#### Radio
| Token | Valor | Uso |
|---|---|---|
| radius.button | 27 | Botones primarios y secundarios |
| radius.card | 20 | Tarjetas principales |
| radius.input | 14 | Campos de texto |
| radius.chip | 18 | Chips de filtro y selección |
| radius.badge | 12 | Badges de estado |
| radius.modal | 24 | Modales y bottom sheets |
| radius.avatar.s | 16 | Avatar pequeño 32px |
| radius.avatar.m | 24 | Avatar mediano 48px |
| radius.avatar.l | 36 | Avatar grande 72px |
| radius.avatar.xl | 48 | Avatar extra grande 96px |

#### Tipografía
| Token | Familia | Tamaño | Peso | Uso |
|---|---|---|---|---|
| text.display | Inter | 30 | 800 | Pantallas de celebración |
| text.heading.xl | Inter | 26–28 | 800 | Títulos de pantalla hero |
| text.heading.l | Inter | 22–24 | 800 | Títulos principales |
| text.heading.m | Inter | 18 | 700 | Títulos de sección |
| text.heading.s | Inter | 17 | 700 | Nav bar titles |
| text.body.l | Inter | 15–16 | 400 | Cuerpo de texto principal |
| text.body.m | Inter | 14 | 400 | Cuerpo secundario |
| text.body.s | Inter | 13 | 400 | Texto auxiliar |
| text.label | Inter | 11 | 700 | Labels de sección, letterSpacing 1–2 |
| text.caption | Inter | 12 | 400 | Metadata, fechas, ubicaciones |
| text.cta | Inter | 16 | 700 | Texto de botones primarios |
| text.cta.s | Inter | 13–14 | 600–700 | Texto de botones secundarios |

#### Espaciado
| Token | Valor | Uso |
|---|---|---|
| spacing.base | 8 | Unidad base |
| spacing.xs | 4 | Gaps mínimos |
| spacing.s | 8 | Gaps pequeños |
| spacing.m | 12–16 | Gaps estándar |
| spacing.l | 20–24 | Padding de pantallas |
| spacing.xl | 32–40 | Secciones y grupos |
| spacing.screen.h | 48 | Padding horizontal estándar de pantalla |

### Componentes base (Component Library v1.0)

#### Buttons
| Componente | Estado | Descripción |
|---|---|---|
| BTN/Primary/Default | Normal | Amber sólido, texto oscuro |
| BTN/Primary/Disabled | Desactivado | Gris #2A2A30, texto muted |
| BTN/Secondary/Default | Normal | Borde amber, texto amber, fondo transparente |
| BTN/Tertiary/Default | Normal | Solo texto muted, sin fondo ni borde |
| BTN/Danger/Default | Normal | Borde rojo, texto rojo, fondo rojo 10% |
| BTN/Icon/Default | Normal | Círculo gris, icono blanco |
| BTN/Icon/Active | Activo | Círculo amber 20%, icono amber |

#### Inputs
| Componente | Estado | Visual |
|---|---|---|
| Input/Default | Reposo | Fondo #17171B, placeholder #B4B4BB |
| Input/Focus | Enfocado | + borde amber 1.5px, label amber |
| Input/Error | Error | + borde rojo 1.5px, label rojo, mensaje de error |
| Input/Success | Válido | + borde verde 1.5px, label verde, icono check |

#### Cards
| Componente | Variantes | Contenido |
|---|---|---|
| Card/Event | Default, Agotado, Destacado | Imagen, badge hora, título, metadata, CTA |
| Card/Offer | Default, Expirada, Limitada | Imagen, badge descuento %, título, vigencia, CTA |

#### Badges
| Componente | Color | Uso |
|---|---|---|
| Badge/Nuevo | Azul #60A5FA | Eventos o ofertas recién añadidas |
| Badge/Limitado | Amber #F4A340 | Stock o cupos limitados |
| Badge/ÚltimasPlazas | Rojo #E45858 | Muy pocos cupos disponibles |
| Badge/Activo | Verde #38C793 | Oferta o evento en curso |
| Badge/Expirado | Gris #B4B4BB | Sin vigencia |
| Badge/Puntos | Amber | Cantidad de puntos a ganar |
| Badge/Gratuito | Verde | Eventos o acciones sin coste |
| Badge/Notif | Rojo sólido | Contador de notificaciones no leídas |

#### Chips
| Componente | Estado | Visual |
|---|---|---|
| Chip/Selected | Activo | Fondo amber 20%, borde amber, texto amber |
| Chip/Unselected | Inactivo | Fondo #17171B, texto #B4B4BB |

#### Navigation
| Componente | Descripción |
|---|---|
| Nav/TabBar | 5 tabs: Inicio, Eventos, Ofertas, Comunidad, Perfil. Tab activo en amber |
| Nav/Bar | Back + título centrado + acción opcional |
| Nav/BarClose | X close + título + acción (para modales) |

#### Avatars
| Componente | Tamaño | Radio |
|---|---|---|
| Avatar/S | 32×32 | 16 |
| Avatar/M | 48×48 | 24 |
| Avatar/L | 72×72 | 36 |
| Avatar/XL | 96×96 | 48 |

#### Toast / Notificaciones in-app
| Componente | Color | Icono | Uso |
|---|---|---|---|
| Toast/Success | Verde | circle-check | Acción completada |
| Toast/Error | Rojo | circle-alert | Acción fallida |
| Toast/Info | Amber | bell | Notificación informativa |

#### Skeleton Loaders
| Componente | Uso |
|---|---|
| Skeleton/Card | Tarjeta de evento u oferta en carga |
| Skeleton/ListItem | Fila de lista en carga |
| Skeleton/Text | Bloque de texto en carga |

#### Toggles
| Componente | Estado | Visual |
|---|---|---|
| Toggle/On | Activo | Fondo amber, knob blanco a la derecha |
| Toggle/Off | Inactivo | Fondo #2A2A30, knob gris a la izquierda |

### Estados UI obligatorios

Todos implementados como pantallas genéricas reutilizables y como estados en contexto:
- loading (con skeleton loaders por tipo de contenido)
- empty (con ilustración y CTA siempre presente)
- success
- error
- offline (con aviso de sincronización offline-first)

### Iconografía

- Familia: **Lucide** (lucide icon set)
- Iconos principales usados: arrow-left, house, calendar, tag, users, user, star, heart, bookmark, bell, lock, mail, message-square, smartphone, laptop, download, eye, eye-off, trash-2, shield-check, shield-off, gift, award, scan, timer, circle-check, circle-alert, circle-arrow-up, map-pin, share-2, plus, x, search, settings, fingerprint (scan), key-round, user-x

---

## 7. Arquitectura Técnica

### Frontend móvil

- React Native + Expo EAS para distribución continua en iOS y Android.
- Capa de diseño basada en Design Tokens compartidos con soporte de temas y variantes.
- Componentes nombrados en código con correspondencia 1:1 con la Component Library de diseño.
- Manejo de estado con arquitectura modular por dominios: auth, eventos, ofertas, comunidad, reservas, perfil, wallet, configuración.
- Sincronización offline-first para acciones críticas con cola de reintento automático.
- Deep links con Universal Links (iOS) y App Links (Android) para eventos, ofertas y reservas.
- Biometría con Expo LocalAuthentication (Face ID / Touch ID / huella dactilar).
- Secure Storage con Expo SecureStore para tokens y datos sensibles.

### Backend

- Node.js + NestJS.
- API REST versionada (v1, v2) + canal de eventos WebSocket para notificaciones en tiempo real.
- Contratos tipados y validados por esquema (Zod / class-validator) para compatibilidad de versiones.
- Rate limiting por IP, usuario y endpoint con respuesta 429 y Retry-After header.
- Moderación automática de contenido con filtro de spam y lenguaje ofensivo en pipeline de publicación.

### Datos e infraestructura

- PostgreSQL (dato transaccional principal).
- Redis (caché de sesiones, rate limiting, cola de eventos, locks de concurrencia para reservas).
- Object Storage (imágenes de comunidad, avatares, imágenes de eventos).
- FCM (Firebase Cloud Messaging) para push en Android.
- APNs para push en iOS.
- CDN para activos estáticos, imágenes optimizadas y latencia global.
- Orquestación con ambientes aislados: dev, qa, staging, prod.
- Feature flags remotos para rollout controlado de nuevas funcionalidades.

### Observabilidad

- Logging estructurado (JSON) con nivel de severidad y trazabilidad por request-id.
- Métricas de API y negocio (latencia p95/p99, tasa de error, reservas por minuto).
- Alertas operativas con umbrales definidos por métrica.
- Crash analytics móvil con trazabilidad por versión, dispositivo y usuario.
- Dashboard operativo activo desde día 1 en producción.

---

## 8. Modelo de Datos Inicial

### Entidades núcleo

| Entidad | Descripción |
|---|---|
| users | Datos de perfil, rol, estado de cuenta |
| roles | Definición de permisos por rol |
| user_sessions | Sesiones activas por dispositivo, token, IP |
| user_interests | Preferencias de música, ambiente, zona |
| user_consent | Registro de consentimiento marketing y push con fecha y versión |
| events | Eventos del bar con cupos, horarios y estado |
| event_attendees | Confirmaciones de asistencia (RSVP) |
| offers | Ofertas con reglas de vigencia y stock |
| offer_redemptions | Canjes realizados con estado y timestamp |
| reservations | Reservas de mesa con horario, personas, QR token |
| posts | Contenido de comunidad con estado de moderación |
| comments | Comentarios anidados en posts |
| reactions | Reacciones por tipo en posts y comentarios |
| reports | Reportes de contenido o usuario con estado |
| moderation_log | Historial de decisiones de moderación |
| loyalty_wallet | Saldo de puntos por usuario |
| loyalty_transactions | Movimientos de puntos (entrada/salida/caducidad) |
| loyalty_levels | Definición de niveles (Bronce, Plata, Oro) con umbrales y beneficios |
| notifications | Notificaciones push con estado de entrega y lectura |
| audit_logs | Log de acciones sensibles por usuario y administrador |
| data_deletion_requests | Solicitudes GDPR de eliminación de datos |
| data_export_requests | Solicitudes GDPR de exportación de datos |

### Relaciones clave

- users 1:N reservations
- users 1:N posts
- users 1:N user_sessions
- events 1:N reservations
- events 1:N event_attendees
- offers 1:N offer_redemptions
- users 1:1 loyalty_wallet
- loyalty_wallet 1:N loyalty_transactions
- posts 1:N comments
- posts 1:N reactions
- users 1:1 user_consent

---

## 9. Seguridad Integral (Security by Design)

### Principios

- Privilegio estricto por rol y contexto.
- Defensa en profundidad.
- Cero confianza implícita.
- Trazabilidad completa de acciones sensibles.

### Autenticación

- OTP por email o SMS para verificación inicial (pantallas diseñadas para ambos canales).
- Access token de vida corta (15 min).
- Refresh token rotativo con revocación y persistencia en secure storage.
- Cierre de sesión global desde pantalla de Sesiones Activas (todos los dispositivos).
- Biometría para reautenticación de acciones de alto riesgo (eliminar cuenta, cambiar contraseña, canjes de alto valor).
- Device binding para sesiones de alto riesgo.
- Detección de sesión expirada con feedback claro y redirect a login sin pérdida de contexto.

### Rate limiting y bloqueos

- Rate limit por IP, usuario y endpoint con respuesta 429 y cuenta regresiva visible en app.
- Bloqueo temporal por OTP fallido (N intentos → lock con countdown).
- Bloqueo temporal de cuenta por moderación (con pantalla dedicada, motivo y duración).
- Sanciones progresivas: advertencia → suspensión temporal → suspensión permanente.

### Autorización

- RBAC por roles (invitado, registrado, staff, admin).
- Validación de permisos en backend por endpoint.
- Protección de rutas sensibles en cliente y servidor.

### Protección de API

- Rate limit por IP, usuario y endpoint.
- Validación de payload con esquemas estrictos (Zod).
- Sanitización contra XSS en todos los inputs de texto libre.
- Consultas parametrizadas contra SQL injection.
- Protección CSRF para web admin.
- Protección anti-replay para operaciones críticas (canje, reserva).
- Firma de requests en endpoints de alta sensibilidad.

### Protección de datos

- TLS 1.3 en tránsito.
- Cifrado en reposo para base de datos y backups.
- Contraseñas con Argon2id costo alto.
- Seudonimización en analítica donde sea posible.
- Reducción de superficie de datos sensibles y retención por ciclo de vida.
- GDPR: pantalla de gestión de derechos diseñada (exportar, ver, eliminar).
- Registro de consentimiento explícito de marketing con fecha y versión de política.

### Seguridad móvil

- Secure storage para tokens (Expo SecureStore / Keychain iOS / Keystore Android).
- Certificate pinning para llamadas API.
- Detección de root/jailbreak para acciones críticas.
- Build release con ofuscación.
- Device binding para sesiones de alto riesgo.
- Rotación de claves y secretos por entorno con vault centralizado.
- Actualización forzada in-app cuando la versión es obsoleta (pantalla diseñada).

### Moderación y abuso

- Pipeline de moderación automática en publicación de posts.
- Filtro de spam y lenguaje ofensivo en servidor.
- Pantallas diseñadas para feedback al usuario: post en revisión, post rechazado con motivo.
- Reportes por usuario y contenido (modal dedicado).
- Revisión manual de moderación para incidentes severos (equipo admin).
- Umbrales de bloqueo temporal por reincidencia (pantalla de cuenta bloqueada diseñada).
- Apelación o contacto a soporte desde pantalla de cuenta bloqueada.

### Gestión de incidentes

- Runbook de respuesta P1/P2/P3.
- Rotación inmediata de secretos y claves comprometidas.
- Comunicación interna y externa ante incidente.
- Playbook de soporte documentado para Fase 6.

### Cumplimiento

- Política de privacidad in-app (pantalla diseñada).
- Consentimiento para marketing y push con registro explícito (pantalla diseñada).
- Gestión de derechos de usuario: acceso, exportación y eliminación (pantalla GDPR diseñada).
- Comunicación in-app ante actualización de política de privacidad.

---

## 10. QA y Estrategia de Pruebas

### Tipos de prueba

- Unitarias (lógica de negocio, validaciones, reglas de puntos).
- Integración (API + DB + cache + moderación).
- E2E (flujos críticos de usuario en dispositivos reales).
- Seguridad (OWASP ASVS nivel avanzado + pruebas de abuso de rate limit y moderación).
- Performance (picos en eventos especiales, reservas concurrentes).
- Compatibilidad por matriz real de dispositivos iOS y Android.
- Pruebas de resiliencia de red (3G/4G/5G/wifi inestable/offline).

### Casos críticos (alineados con pantallas diseñadas)

| Caso | Pantalla de feedback diseñada |
|---|---|
| Registro/login/refresh token | SE - Sesión Expirada |
| OTP fallido N veces | RL - Rate Limit / Demasiados Intentos |
| Reserva concurrente de últimas mesas | RF - Reserva Concurrente Fallida |
| Canje de oferta con stock límite al momento | CA - Canje Agotado en Tiempo Real |
| Post con contenido ofensivo | PR/PRC - Post en Revisión / Post Rechazado |
| Cuenta bloqueada por reincidencia | CB - Cuenta Bloqueada |
| Versión obsoleta de la app | AU - Actualización Forzada |
| Sin conexión en acción crítica | OF - Offline con cola de reintento |
| Recuperación ante fallo de servicios | ER - Error State con reintentar |

### Criterios de calidad de lanzamiento

- Sin vulnerabilidades críticas abiertas.
- Crash rate por debajo del 0.1% por versión.
- Tiempo de respuesta API p95 < 200ms en operaciones principales.
- Éxito de reservas y canjes en dispositivos iOS y Android > 99.5%.
- Todos los estados de UI (loading, empty, error, success, offline) cubiertos en cada flujo.

---

## 11. Analítica y KPIs

### KPIs de producto

- DAU, WAU y MAU.
- Retención D1, D7 y D30.
- Usuarios que completan el onboarding completo (3 pasos).
- Usuarios que activan el incentivo de bienvenida.
- Usuarios que reservan al menos una vez.
- Tasa de asistencia a evento desde app (RSVP → presencia real).
- Tasa de canje de ofertas sobre visualizaciones.
- Conversión de invitado a registrado.

### KPIs de comunidad

- Posts por usuario activo por semana.
- Comentarios y reacciones por post.
- Tasa de moderación automática (aprobados / rechazados / revisión).
- Reportes de abuso por 1.000 usuarios activos.
- Ranking de comunidad: usuarios con ≥ 500 puntos.

### KPIs del programa de fidelidad

- Distribución de usuarios por nivel (Bronce / Plata / Oro).
- Puntos emitidos vs canjeados por semana.
- Tasa de acceso a pantalla de Niveles de Fidelidad.
- Retención incremental de usuarios con nivel Plata u Oro vs Bronce.

### KPIs operativos

- Disponibilidad del backend (SLA objetivo: 99.9%).
- Latencia p95/p99 por endpoint crítico.
- Errores 4xx/5xx por endpoint.
- Tasa de moderación automática correcta vs falsos positivos.
- Tiempo medio de resolución de moderación manual.

---

## 12. Plan Por Fases (Integración End-to-End)

### Fase 0: Descubrimiento y definición ✅ COMPLETADA

Entregables completados:
- Brief de producto.
- Mapa de funcionalidades priorizadas.
- Riesgos y supuestos.
- Definición de KPIs objetivo.
- Documento maestro OPALBAR APP creado.

### Fase 1: Diseño UX/UI y sistema de diseño ✅ COMPLETADA

Objetivo: Diseñar experiencia completa y coherente para lanzamiento en iOS y Android.

Entregables completados:
- 220+ pantallas diseñadas en alta fidelidad, bilingüe ES + EN.
- Flujos usuario end-to-end completos (auth, eventos, ofertas, comunidad, perfil, wallet, configuración, seguridad, GDPR, moderación, edge cases).
- Biblioteca de componentes v1.0 con tokens, botones, inputs, cards, badges, chips, navegación, avatares, toasts y skeleton loaders.
- Estados UI obligatorios cubiertos: loading, empty, success, error, offline.
- Roles diseñados: registrado, invitado, implícito staff/admin vía modales y moderación.
- Accesibilidad AA+ aplicada en contraste, tipografía y touch targets.

Criterio de salida alcanzado:
- Todos los flujos críticos del documento completamente diseñados y verificados.
- Componentes nombrados para mapeo 1:1 en código.
- Bilingüe completo sin gaps.

### Fase 2: Base técnica e infraestructura 🔄 EN CURSO

Objetivo: Dejar lista la base robusta para desarrollo rápido y seguro.

Entregables:
- Repositorio, CI/CD, ambientes dev/staging/prod.
- Backend inicial con autenticación OTP (email + SMS) y health checks.
- Base de datos con migraciones versionadas.
- Configuración centralizada de secretos.
- Logging y monitoreo activos desde el día 1.

Criterio de salida:
- Pipeline funcionando con despliegue automático a staging.
- Auth completo (registro, login, OTP, refresh token, biometría) operativo en staging.

### Fase 3: Desarrollo funcional de lanzamiento

Objetivo: Implementar módulos de negocio y experiencia principal.

Entregables:
- Módulo de usuarios y sesiones (con gestión de sesiones activas y cierre global).
- Módulo de eventos (catálogo, filtros, asistencia, reservas concurrentes).
- Módulo de ofertas/canje (con lock Redis para stock en tiempo real).
- Módulo de comunidad (posts, moderación automática, comentarios, reacciones, reportes).
- Módulo de reservas (con QR, modificación, cancelación).
- Módulo de perfil y recompensas (wallet, niveles, ranking).
- Módulo de notificaciones push (FCM + APNs, segmentado por intereses).
- Módulo GDPR (exportación, consulta y eliminación de datos).

Integración obligatoria:
- Contratos API versionados.
- Validaciones cruzadas entre frontend y backend.
- Trazabilidad de evento de analítica en cada acción clave.
- Rate limiting activo en todos los endpoints críticos.

Criterio de salida:
- Flujos críticos completos operando en staging.

### Fase 4: Hardening de seguridad y rendimiento

Objetivo: Reducir riesgos antes de salida a beta.

Entregables:
- Auditoría de endpoints y permisos RBAC.
- Rate limiting y reglas anti-abuso ajustadas.
- Pruebas de carga (reservas concurrentes, picos de eventos).
- Tuning de consultas DB críticas.
- Revisión de secretos y políticas de acceso.
- Pruebas de moderación automática con dataset de casos reales.
- Revisión de certificate pinning y detección de root/jailbreak.

Criterio de salida:
- Cero hallazgos críticos abiertos.
- Latencia p95 < 200ms en operaciones principales.

### Fase 5: Beta cerrada

Objetivo: Validar experiencia real con usuarios controlados.

Entregables:
- Grupo de prueba (clientes habituales del bar) y guion de feedback estructurado.
- Dashboard de métricas de adopción activo.
- Medición de KPIs: retención D7, tasa de reservas, conversión incentivo bienvenida.
- Priorización de mejoras basada en datos reales.

Integración obligatoria:
- Ciclo semanal: feedback → ajuste → medición.
- Moderación manual activa durante toda la beta.

Criterio de salida:
- Retención D7 ≥ objetivo definido.
- Crash rate < 0.1%.
- Estabilidad de reservas y canjes > 99.5%.

### Fase 6: Lanzamiento público

Objetivo: Publicar versión estable y segura en App Store y Google Play.

Entregables:
- Plan de comunicación de lanzamiento (RRSS, notificación in-venue, email).
- Playbooks de soporte y operación documentados.
- Monitoreo 24/7 en ventana de lanzamiento.
- Feature flags listos para rollout controlado.
- Estrategia de rollback por versión activa.

Integración obligatoria:
- Equipo de guardia técnica en primer fin de semana.
- Dashboard operativo con alertas activas.

Criterio de salida:
- Plataforma estable y KPIs iniciales dentro de rango objetivo.

### Fase 7: Escalamiento y optimización continua

Objetivo: Mejorar conversión, retención y eficiencia operativa.

Entregables:
- Roadmap trimestral de nuevas funciones (streaming, marketplace, pago in-app).
- Experimentos A/B en home y ofertas.
- Mejoras del sistema de recompensas (más niveles, campañas automatizadas).
- Motor de recomendaciones personalizadas.

Integración obligatoria:
- Todo experimento con hipótesis, métrica objetivo y decisión final documentada.

Criterio de salida:
- Incremento sostenido de uso y reservas mes a mes.

---

## 13. Backlog Priorizado

### Prioridad alta (en diseño / en desarrollo)

- Login seguro con refresh rotativo. ✅ Diseñado
- Eventos con filtros y detalle. ✅ Diseñado
- Ofertas con reglas y canje. ✅ Diseñado
- Reserva de mesa confirmada con QR. ✅ Diseñado
- Feed de comunidad con moderación y reporte. ✅ Diseñado
- OTP por email y SMS. ✅ Diseñado
- Gestión GDPR (exportar, ver, eliminar). ✅ Diseñado
- Consentimiento de marketing explícito. ✅ Diseñado
- Sesiones activas y cierre global. ✅ Diseñado
- Biometría para acciones sensibles. ✅ Diseñado
- Rate limit con feedback en app. ✅ Diseñado
- Moderación automática + feedback al autor. ✅ Diseñado
- Incentivo de bienvenida post-registro. ✅ Diseñado
- Actualización forzada in-app. ✅ Diseñado

### Prioridad media

- Programa de niveles de fidelidad (Bronce/Plata/Oro). ✅ Diseñado
- Ranking de comunidad con podio. ✅ Diseñado
- Recomendaciones personalizadas por intereses y comportamiento. Pendiente de implementación.

### Prioridad baja (roadmap)

- Streaming en vivo desde eventos.
- Marketplace de productos del bar.
- Pasarela de pago in-app.
- Gamificación extendida (badges, retos).

---

## 14. Riesgos y Mitigaciones

| Riesgo | Mitigación | Estado |
|---|---|---|
| Baja adopción inicial | Incentivo de bienvenida (50 pts + 20% dto.) + campaña en local + notificaciones segmentadas por intereses | ✅ Diseñado |
| Abuso en comunidad | Moderación automática + pipeline de revisión + pantallas de feedback + sanciones progresivas | ✅ Diseñado |
| Saturación en eventos grandes | Redis lock para reservas concurrentes + pantalla de feedback en tiempo real + autoscaling | ✅ Diseñado |
| Problemas de privacidad | Consentimiento explícito + pantalla GDPR completa + minimización de datos + auditoría legal | ✅ Diseñado |
| Abuso de rate limit / bots | Rate limiting por IP y usuario + bloqueo temporal + detección de patrones anómalos | ✅ Diseñado |
| Versión obsoleta en producción | Política de deprecación + pantalla de actualización forzada in-app + feature flags | ✅ Diseñado |
| Sesiones comprometidas | Device binding + cierre global de sesiones + rotación de refresh token | ✅ Diseñado |

---

## 15. Gobierno de Cambios

### Regla de actualización

Cualquier decisión que impacte producto, seguridad o arquitectura debe registrarse en este archivo el mismo día.

### Formato de bitácora

- Fecha | Decisión | Motivo | Impacto | Responsable

### Bitácora

| Fecha | Decisión | Motivo | Impacto | Responsable |
|---|---|---|---|---|
| 2026-04-18 | Creación del documento maestro OPALBAR APP | Necesidad de centralizar visión y ejecución | Base de trabajo oficial | Equipo fundador |
| 2026-04-18 | Inicio de Fase 1: diseño UX/UI completo en Pencil | Requerimiento de prototipo de alta fidelidad | Base visual para desarrollo | Diseño |
| 2026-04-18 | Definición de Design Tokens v1.0 | Alinear diseño y código desde el inicio | Tokens implementados en Component Library y en todas las pantallas | Diseño |
| 2026-04-18 | Incorporación de pantallas de seguridad avanzada (biometría, rate limit, sesiones activas, GDPR, cuenta bloqueada) | Requerimiento explícito §9 del documento | Cobertura completa de flujos de seguridad en diseño | Diseño |
| 2026-04-18 | Incorporación de OTP SMS como segundo canal de verificación | §9: OTP por email o teléfono | Dos canales de verificación diseñados y listos para implementar | Diseño |
| 2026-04-18 | Diseño de moderación con estados de revisión y rechazo con motivo | §5 flujo crítico: Crear post → Moderación automática → Publicación | Flujo de moderación completo incluyendo feedback al autor | Diseño |
| 2026-04-18 | Pantalla de Confirmar Asistencia separada de Reservar Mesa | §5: "Confirmar asistencia → Reservar mesa" son pasos distintos | Flujo de eventos más granular y correcto | Diseño |
| 2026-04-18 | Incorporación de Incentivo de Bienvenida como pantalla post-registro | §14: mitigación de riesgo de baja adopción | Activación de nuevos usuarios con 50 pts + 20% dto. | Producto |
| 2026-04-18 | Incorporación de Ranking de Comunidad y Niveles de Fidelidad | §13 backlog prioridad media | Gamificación y retención diseñadas | Diseño |
| 2026-04-18 | Component Library v1.0 completada con 12 categorías de componentes | §6 y §16 checklist: componentes nombrados 1:1 con código | Listos para implementación directa en React Native | Diseño |
| 2026-04-18 | Fase 1 declarada COMPLETADA | Todos los flujos, estados y componentes del documento cubiertos | Paso a Fase 2: Base técnica e infraestructura | Equipo |
| 2026-04-18 | Fase 2 entregada (base técnica) | Inicialización del monorepo Nx con 18 módulos NestJS, Prisma con 39 modelos, Redis, OTP email/SMS, JWT con refresh y sesiones, Swagger, CI GitHub Actions | Backend listo para conectar mobile | Backend |
| 2026-04-22 | Despliegue inicial Railway | Postgres + Redis + API NestJS arrancan en Railway Pro tras varios fixes de Nixpacks/Node 22 | API pública en `https://opalbar-app-api.up.railway.app/api/v1` | DevOps |
| 2026-04-23 | EAS y OTA configurados | Vincula proyecto EAS, canal `preview`, OTA via expo-updates con overlay de progreso y auto-restart | Releases sin nuevo APK para cambios JS | Mobile |
| 2026-04-23 | Auth migrada a email-only OTP + Twilio Verify | Simplifica funnel y delega entrega de códigos a Twilio (SMS) y Gmail SMTP (email) | Onboarding más limpio | Auth |
| 2026-04-23 | Panel Admin Web (Vercel + Vite + React 19 + TanStack Query) | 39+ pantallas, login, gestión usuarios/ofertas/reservas/reportes/soporte/push/analytics/venues/config | El owner modera desde web sin usar mobile | Admin |
| 2026-04-23 | Cloudinary unsigned upload reemplaza base64 | Cuenta `dl9o0umy3` + preset `opalbar_unsigned` | DB no se infla con avatares/fotos | Mobile |
| 2026-04-24 | Gateway socket unificado `/rt` | Cierra `/community` aislado: posts, stories y mensajes viajan por un solo namespace | Realtime simplificado para todos los clientes | Backend |
| 2026-04-24 | Moderación de DMs en admin | Admin puede leer/intervenir mensajes privados desde el panel | Cumple con compromiso de seguridad y reportes | Admin |
| 2026-04-25 | Notificaciones push end-to-end | FCM activado en proyecto Firebase `opalbar-a0a5e`, registro de PushToken en mobile, fan-out por tipo (follow/like/comment/event/story/level-up/DM) | Engagement en tiempo real fuera de app | Notif |
| 2026-04-25 | Friendships + DmPolicy (FRIENDS_OF_FRIENDS / FRIENDS_ONLY) | FB/IG hybrid: sigues + amigos, DM cerrado por default a no-amigos | Privacidad por capas | Social |
| 2026-04-25 | DMs estilo IG/FB con message requests | Usuarios fuera del policy entran a "solicitudes" hasta aceptación | Anti-spam y UX clara | Messages |
| 2026-04-25 | Chat overhaul: replies, reactions, voice notes, GIFs, image+sticker | Optimistic send, read receipts, last-seen, typing indicator, suppress notif si dentro del thread | Chat al nivel de WhatsApp/IG | Messages |
| 2026-04-25 | Mentions polimórficos (@-tag + photo tag) | Posts y stories pueden mencionar usuarios; deep link a perfil; preview en push | Engagement social pleno | Social |
| 2026-04-25 | Notificaciones overhaul UX/UI | Banner in-app rich, secciones por fecha (Hoy/Ayer/Esta semana/Anteriores), agregación estilo IG, paginación infinita, settings configurables por tipo | Inbox premium | Notif |
| 2026-04-25 | Ola 3 (UX a volumen) cerrada | Pagination infinita en feeds, select estricto en listas públicas, auto-nivel loyalty con LEVEL_UP push, EmptyState/ErrorState en search/post-detail/venue/support | Performance y UX consistentes a 10K | UX |
| 2026-04-26 | Stories: ring de progreso, reacciones rápidas, reply por DM, comments con threads | Reddit-style threads en comentarios + edit + reaction notifications + deep-link highlight | Comunidad madura | Community |
| 2026-04-27 | Consolidación de docs en `/docs` | Maestro + stack + infra + design system + roadmap + changelog + admin; legacy en `archive/` | Una sola fuente ordenada | Docs |
| 2026-04-27 | Fase 2 y Fase 3 declaradas COMPLETADAS | Todo lo listado para fase 2/3 está en producción y verificado en commits | Paso a Fase 4: hardening pre-store + APNs + Sentry + audit logs admin | Equipo |
| 2026-04-27 | Fase 4 hardening (todo lo no-Apple) entregado | Sentry backend + admin web con redact PII; AuditLog + @Audit decorator + interceptor + endpoint lectura SUPER_ADMIN; health enriquecido (DB+Redis+FCM); rate-limit per-endpoint + ThrottlerGuard global solo en prod; 2FA email para SUPER_ADMIN; session-timeout idle 5 min en admin web; GDPR export real (bundle JSON inline + URL firmada HMAC + email); runbook on-call en `docs/08-RUNBOOK.md` | App segura y observable; queda solo Apple (APNs/iOS/Sentry mobile) | Seguridad |

---

## 16. Checklist de Preparación para Implementación

### Producto y diseño

- ✅ Flujos aprobados (220+ pantallas en 18 flujos end-to-end).
- ✅ UI final en alta fidelidad aprobada.
- ✅ Estados y microcopy listos en todas las pantallas.
- ✅ Versión bilingüe ES + EN completa.
- ✅ Component Library v1.0 documentada con nomenclatura lista para código.
- ✅ Design Tokens v1.0 definidos y documentados.
- ✅ Todos los estados UI cubiertos: loading, empty, success, error, offline.
- ✅ Flujos de seguridad diseñados: biometría, rate limit, sesiones, GDPR, moderación.
- ✅ Edge cases diseñados: concurrencia, stock, moderación, bloqueo.

### Técnico

- ⬜ Repositorio y CI/CD listos.
- ⬜ Migraciones iniciales aprobadas.
- ⬜ Contratos API v1 definidos.
- ⬜ Ambientes dev/staging/prod configurados.
- ⬜ Logging y monitoreo activos.

### Seguridad

- ✅ Modelo de amenazas inicial documentado (§9).
- ✅ Estrategia de autenticación aprobada (OTP email + SMS, biometría, refresh rotativo).
- ⬜ Políticas de logs y secretos activas en infraestructura.
- ⬜ Rate limiting configurado en API gateway.
- ⬜ Certificate pinning implementado.

### Operación

- ⬜ Dashboard operativo completo activo.
- ⬜ Alertas principales configuradas.
- ⬜ Plan de incidentes documentado (runbook P1/P2/P3).

---

## 17. Siguiente Acción Recomendada

### Acción inmediata (Fase 2)

Arrancar base técnica e infraestructura con estos entregables en orden:

1. Repositorio monorepo configurado (mobile app + backend + shared).
2. CI/CD con GitHub Actions o similar para build automático en staging.
3. Ambientes dev/staging/prod con variables de entorno separadas.
4. Backend NestJS con módulo de auth completo: registro, OTP email + SMS, login, refresh token, cierre de sesión global.
5. Base de datos PostgreSQL con migraciones versionadas (Prisma o TypeORM).
6. Redis configurado para sesiones y rate limiting.
7. Logging estructurado activo desde el primer endpoint.
8. Health checks y monitoreo básico operativos.

### Resultado esperado de esta acción

Auth completo y estable en staging. Base lista para que el equipo de frontend conecte las primeras pantallas diseñadas (Splash, Login, OTP, Registro) con datos reales.

---

## 18. Compatibilidad Avanzada iOS y Android

### Objetivo de plataforma

Paridad funcional completa entre iOS y Android desde la primera versión pública.

### Versionado y soporte

- iOS: soporte activo para las dos versiones principales vigentes del sistema (iOS 16+).
- Android: soporte activo para API level 26+ (Android 8.0+).
- Política de deprecación por versión con comunicación in-app (pantalla de actualización forzada diseñada).

### Integraciones nativas críticas (todas con diseño de UI listo)

| Integración | iOS | Android | Estado diseño |
|---|---|---|---|
| Push notifications | APNs | FCM | ✅ Pantallas de permiso y configuración diseñadas |
| Deep links | Universal Links | App Links | ✅ Flujos de destino diseñados (evento, oferta, reserva) |
| Almacenamiento seguro | Keychain | Keystore | ✅ Flujos de sesión y biometría diseñados |
| Biometría | Face ID / Touch ID | Fingerprint / Face | ✅ Pantalla de reautenticación diseñada |
| Actualización forzada | App Store | Google Play | ✅ Pantalla de force update diseñada |

### Pipeline de build y release

- Build automatizado firmado por entorno (QA, Staging, Production) con Expo EAS.
- Distribución interna con canales beta por plataforma (TestFlight / Firebase App Distribution).
- Validación de políticas de App Store y Google Play antes de cada release.
- Estrategia de rollback por versión con feature flags remotos activos.
- Versionado semántico (MAJOR.MINOR.PATCH) con changelog por versión.

### Matriz de validación de dispositivos

- Gama alta: iPhone 15 Pro / Samsung Galaxy S24.
- Gama media: iPhone 13 / Pixel 7a.
- Gama entrada: iPhone SE / Moto G Power.
- Resoluciones: compacta (375pt), estándar (390pt), grande (430pt), tablet (768pt+).
- Pruebas en condiciones: baja batería, baja memoria, red degradada, offline total.

### Estándar de calidad por plataforma

- Misma cobertura funcional y de seguridad en iOS y Android.
- Cero bloqueos críticos en flujos de login, reservas y canjes.
- Telemetría activa por versión para detectar regresiones en menos de 15 minutos.
- Ningún release aprobado si existe divergencia funcional crítica entre iOS y Android.

### Gobernanza de cambios cross-platform

- Toda decisión que afecte UX o funcionalidad debe validar impacto en ambas plataformas.
- Ningún release se aprueba si existe divergencia funcional crítica entre iOS y Android.
- Pruebas de regresión automatizadas en ambas plataformas antes de cada release.
