# OPALBAR — Changelog

> Cronología de releases por commit desde el inicio del repo.
> Generado con `git log --since="2026-04-18" --pretty="%h|%ad|%s" --date=short`.

---

## 2026-04-26 — Comunidad madura

| Commit | Cambio |
|---|---|
| `3a63778` | feat(stories): quick reactions + reply by DM |
| `b85323c` | feat(posts): emoji reactions on posts |
| `644d689` | feat(comments): edit, reaction notifications, deep-link highlight |
| `6000db6` | feat(comments): emoji reactions + reddit-style threads with reply context |
| `44e3931` | feat(comments): render @menciones azules con tap a perfil + preview en push |

---

## 2026-04-25 — Push, social, chat, notif overhaul

### Push end-to-end (FCM)
| Commit | Cambio |
|---|---|
| `7c9c757` | feat(mobile): wire up FCM for Android push notifications |
| `f040378` | feat(notif): in-app banner + diagnose silent push registration failure |
| `3e3864a` | feat(notifications): re-wire push for follows, posts, events, stories |
| `724800b` | fix(db): restore notification-types migration as idempotent no-op |
| `48b6751` | revert: feat(notifications) push wiring (rollback temporal) |
| `3721b02` | feat(notifications): push para follows, post moderation, events, venue stories |
| `227158e` | feat(admin): persist broadcasts so users see them in their notif feed |

### Notificaciones UI overhaul
| Commit | Cambio |
|---|---|
| `08bbac7` | feat(notif): premium banner + notif screen redesign + IG-style aggregation |
| `ecd3f38` | fix(notif): banner shows real title + notif list scrolls past today |
| `4d85cb6` | fix(notif): paginate notif list so older buckets become visible |

### DMs IG/FB style + chat overhaul
| Commit | Cambio |
|---|---|
| `8fe5993` | feat(messages): IG/FB-style message requests with DM policy gating |
| `a9ac5f1` | feat(messages): chat overhaul — replies, reactions, voice, GIFs, optimistic send |
| `d6ae403` | feat(chat): image + sticker attachments end-to-end |
| `8609a3e` | feat(chat): real-time read receipts + last-seen presence |
| `24e8d3a` | feat(chat): suppress notif while in thread + voice recording presence |
| `2fabe11` | fix(socket): Railway fallback + polling first for chat gateway |
| `7b3944c` | fix(messages): voice notes loop + chat polish pass |

### Social
| Commit | Cambio |
|---|---|
| `199a117` | feat(social): friend requests + privacy gating (FB/IG hybrid) |
| `ff4f5b5` | feat(social): polymorphic mentions — @-tag + photo tag for posts & stories |
| `022cd5a` | feat(comments): mention autocomplete on post comment composer |
| `ad13a38` | feat(comments+push): mentions en comentarios + avatar del remitente en push |
| `fbdcf0a` | fix(mentions): trigger autocomplete on first @ keystroke |
| `8543a46` | fix(mentions): read latest text from ref in onSelectionChange |

### Stories
| Commit | Cambio |
|---|---|
| `9cedf2f` | feat(realtime): broadcast story created/deleted on /rt |
| `85da104` | feat(mobile): subscribe community stories carousel to /rt story events |
| `67d207a` | fix(stories): visible viewer progress bar + ring refresh after upload |

### OTA / Updates overlay
| Commit | Cambio |
|---|---|
| `10f1347` | feat(updates): premium overlay with progress bar + auto-restart |
| `5a548fa` | fix(updates): belt-and-braces auto-reload + manual restart fallback |
| `6405f92` | fix(updates): auto-reload was cancelled by its own cleanup |
| `c5514b8` | fix(updates): remove non-existent Updates.addListener call |

### Performance + UX (Ola 3)
| Commit | Cambio |
|---|---|
| `87c0515` | perf(feeds): infinite scroll on events + community tabs (O3.1) |
| `1b16874` | perf(lists): select only card fields on public events + offers (O3.2) |
| `b8d781d` | feat(loyalty): emit LEVEL_UP notification on automatic level promotion (O3.3) |
| `e9fd97b` | feat(ux): EmptyState/ErrorState on search, post detail, venue, support chat (O3.6) |

### Infra / Deploy
| Commit | Cambio |
|---|---|
| `5021c5f` | fix(mobile): fall back to Railway when EXPO_PUBLIC_API_URL is a LAN IP in release |
| `0ef0b93` | fix(api): hydrate @CurrentUser on @Public routes when token is present |
| `223a8bb` | fix(deploy): startCommand service-aware so Postgres survives redeploys |
| `0786d8f` | fix(deploy): absolute path for docker-entrypoint.sh in Postgres branch |
| `db72c0f` | fix(deploy): drop NIXPACKS builder so Postgres uses its image source |
| `b0997aa` | chore: ignore claude scheduled_tasks.lock |
| `68db022` | docs: add INFRAESTRUCTURA.md with services map and monthly cost breakdown |

---

## 2026-04-24 — Realtime unificado + admin moderation

| Commit | Cambio |
|---|---|
| `1e3a63d` | feat(admin): moderación de mensajes privados entre usuarios |
| `202eb43` | feat(mobile): nuevo ícono OPALBAR sin fondo blanco + splash + login |
| `44fe79c` | feat(realtime): unified `/rt` socket gateway across API + admin + mobile |
| `536c563` | fix(realtime): emit /community event on admin post moderation |
| `c14c410` | fix(admin): point production build at Railway API for sockets |
| `158555e` | fix(admin): force absolute Railway host for socket.io in production |
| `3312d15` | fix(realtime): bust feed cache on admin post moderation |

---

## 2026-04-23 — Auth, EAS, Cloudinary, Admin Panel

### Auth
| Commit | Cambio |
|---|---|
| `d45d5d1` | feat(otp): migrar canal SMS a Twilio Verify API |
| `56ef4d4` | feat(auth): registro por email en vez de SMS |
| `7dfeeda` | fix(auth): don't block login on Redis session tracking |

### EAS / OTA / Splash / Iconos
| Commit | Cambio |
|---|---|
| `b8a327c` | chore(mobile): vincular proyecto EAS e inyectar URL de Railway en builds |
| `48916b2` | feat(mobile): configure expo-updates (OTA) for EAS Update |
| `b771103` | feat(mobile): OTA update overlay + manual check button |
| `bb3ca2b` | chore(mobile): add app icon + splash from OPAL BAR cocktail logo |
| `c9e3b7f` | feat(mobile): switch to definitive OPAL BAR neon cocktail icon |
| `387aa5d` | fix(mobile): replace default Android launcher icons with OPAL BAR logo |
| `4bc2fad` | feat(mobile): proper adaptive icon (anydpi-v26) + Android 12+ splash |
| `07dd2f6` | fix(mobile): quitar ref a splashscreen_logo inexistente en styles.xml Android |
| `33949c5` | fix(mobile): keyboard hides input on Android, admin back arrow skips hub, sounds silent after first |
| `8a4c56e` | fix(mobile): ignore LAN EXPO_PUBLIC_API_URL in release builds |

### Cloudinary + sonidos + community polish
| Commit | Cambio |
|---|---|
| `72e16c0` | feat(mobile): migrate images from base64 to Cloudinary + rich share |
| `e331dba` | feat(mobile): wire haptic + sound feedback in post detail |
| `925be70` | feat(mobile): sonidos en login, muro de usuario, follow, new post/story |
| `74590f2` | feat(mobile): filled red heart on like across feed, post detail y muro |
| `88f0098` | fix(mobile): unlike post now toggles via react endpoint |
| `bbe256e` | fix(mobile): + button in community header now responds to taps |
| `bf7e375` | feat: wire community notifications (like/comment) + push via Expo |
| `a10891c` | feat(community): actor tappable en notifs, deep-link a post y anillo activo propio |

### Admin web (Vercel)
| Commit | Cambio |
|---|---|
| `f1dee2d` | feat(admin): full admin panel — users, offers, reservations, reports, support, push, analytics, venues, config |
| `b8361a0` | fix(admin): type Field/Select props so Vercel build compiles |
| `12def1a` | fix(api): allow admin Vercel origins in CORS |
| `2434067` | fix(admin): pin react-dom to same version as react |
| `3edc441` | fix(build): force rollup linux native dep for Vercel |
| `f91953e` | feat(admin): proxy API calls through Vercel rewrite |
| `e39a454` | fix(admin): back arrow no longer gets stuck in manage sub-sections |
| `23a1102` | fix(admin+profile): wire real stats, extend useSafeBack to detail screens |

---

## 2026-04-22 — Deploy a Railway

| Commit | Cambio |
|---|---|
| `dd2ce1d` | feat: OPALBAR v1.0 — app móvil completa, API NestJS, admin web |
| `00f646b` | chore: railway.json — build/start config para deploy Nx monorepo |
| `963c0e3` | fix: --legacy-peer-deps en build (Expo 19 + Prisma Studio) |
| `5aa8f16` | fix(railway): .npmrc legacy-peer-deps + Node 20 via .nvmrc |
| `17d5e70` | fix(railway): Node 22 (Prisma 7 requiere >=20.19) |
| `7015d8f` | fix(railway): quitar npm ci duplicado del buildCommand |
| `a1f93a1` | fix: desconectar Nx Cloud para builds en Railway |
| `a086a28` | fix: bind API a 0.0.0.0 para healthcheck Railway |
| `2387727` | fix: quitar migrate deploy del startCommand para diagnosticar |
| `ab61bce` | fix: ruta correcta del artefacto (apps/api/dist/main.js) y restaurar migrate |

---

## 2026-04-18 — Inicio del repo

| Commit | Cambio |
|---|---|
| `ab407a4` | chore: init Nx workspace opalbar-app |
| `209ea61` | feat: Fase 2 completa — Base técnica e infraestructura OPALBAR |

---

## Cómo regenerar este changelog

```bash
git log --since="2026-04-18" --pretty="%h|%ad|%s" --date=short --reverse
```
