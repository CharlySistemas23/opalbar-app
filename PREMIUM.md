# OPALBAR — Premium Design System

> Cómo lograr que toda la app se sienta elegante y premium sin tocar 100 archivos.

## Arquitectura (3 capas)

```
┌──────────────────────────────────────────────────────────┐
│  Capa 1 — Tokens                                         │
│  apps/mobile/src/constants/tokens.ts                     │  ← fuente de verdad
│  Colores · Tipografía · Spacing · Radius · Shadows       │
├──────────────────────────────────────────────────────────┤
│  Capa 2 — Primitivos UI                                  │
│  apps/mobile/src/components/ui/                          │  ← úsalos en vez de <Text>/<Pressable>
│  Display · Heading · Subhead · Body · Caption · Label    │
│  Card · Hairline · Skeleton · Pressy · Button · Badge    │
├──────────────────────────────────────────────────────────┤
│  Capa 3 — Hooks                                          │
│  apps/mobile/src/hooks/                                  │
│  useFeedback (haptics + sounds) · useFonts (root only)   │
└──────────────────────────────────────────────────────────┘
```

**Regla #1 — Nunca hardcodear valores visuales.** Siempre pasar por tokens.
**Regla #2 — Nunca usar `<Text>` crudo.** Siempre un primitivo tipográfico.
**Regla #3 — Nunca usar `<Pressable>` crudo.** Usar `Pressy` (haptic + scale built-in).

## Tipografía

Dos familias cargadas en [_layout.tsx](apps/mobile/app/_layout.tsx):

| Familia    | Uso                                  | Primitivos                  |
|------------|--------------------------------------|-----------------------------|
| Fraunces   | Display, headlines, titulares serif  | `<Display>`, `<Heading>`    |
| Inter      | Body, UI text, data, números         | `<Subhead>`, `<Body>`, `<Caption>`, `<Label>` |

### Cuándo usar qué

```tsx
import { Display, Heading, Subhead, Body, Caption, Label } from '@/components/ui';

// Hero (pantalla de bienvenida, números grandes de stats)
<Display size="xl">OPAL BAR</Display>
<Display size="lg">1,284</Display>

// Títulos de pantalla / secciones
<Heading size="lg">Tu perfil</Heading>
<Heading size="md">Eventos destacados</Heading>

// Título de bloque / fila importante
<Subhead>Viernes 25 de abril</Subhead>

// Texto del cuerpo
<Body>Disfruta la noche con amigos en el mejor ambiente.</Body>
<Body size="lg" weight="semiBold">Título de card</Body>

// Metadata, horarios, detalles secundarios
<Caption>hace 3h</Caption>
<Caption weight="semiBold">12 asistentes</Caption>

// Tags, badges, overlines
<Label tone="champagne">VIP</Label>
<Label>EVENTO EXCLUSIVO</Label>
```

### Tone prop (color)

Todos los primitivos aceptan `tone`:
- `primary` (default) — texto principal
- `secondary` — texto secundario
- `muted` — texto terciario / metadata
- `accent` — naranja `accentPrimary`, CTAs
- `champagne` — dorado premium, para VIP / loyalty / verified
- `danger` — rojo, para errores
- `inverse` — negro sobre fondo claro

## Paleta premium

### Fondos (warm off-black)
```ts
Colors.bgPrimary      // #0F0D0C — base warm
Colors.bgCard         // #17141A — cards
Colors.bgElevated     // #1E1A20 — overlays, sheets
Colors.bgSubtle       // rgba(255,255,255,0.03) — tint sobre bg
```

### Hairlines con alpha (NO gris sólido)
```ts
Colors.borderSubtle   // rgba(255,255,255,0.04) — casi invisible
Colors.border         // rgba(255,255,255,0.06) — default
Colors.borderStrong   // rgba(255,255,255,0.10) — énfasis
Colors.highlightTop   // rgba(255,255,255,0.04) — simula luz desde arriba en cards
```

### Acentos
- `accentPrimary` (naranja `#F4A340`) — CTAs, like activo, estados activos
- `accentChampagne` (dorado `#D4B88C`) — loyalty, VIP, verified, badges premium
- `accentSuccess`, `accentDanger`, `accentInfo` — semánticos suavizados

## Superficies premium (Card)

```tsx
import { Card } from '@/components/ui';

// Flat (default) — borde sutil, sin sombra, para contenido plano
<Card>...</Card>

// Elevated — borde superior iluminado + sombra suave
// Úsalo en cards flotantes (eventos, ofertas en home)
<Card variant="elevated">...</Card>

// Glass — fondo elevated con borde subtle, para overlays/sheets
<Card variant="glass">...</Card>
```

El borde superior iluminado (`highlightTop`) simula luz desde arriba. Es el detalle que separa UIs dark "planas" de UIs dark "premium".

## Separadores (Hairline)

Reemplaza líneas grises sólidas:

```tsx
import { Hairline } from '@/components/ui';

<Hairline />                       // normal
<Hairline variant="subtle" />      // casi invisible (entre secciones)
<Hairline variant="strong" />      // énfasis (antes de CTA principal)
<Hairline marginVertical={16} />
```

## Loading (Skeleton en lugar de ActivityIndicator)

```tsx
import { Skeleton, SkeletonList } from '@/components/ui';

// Placeholder individual
<Skeleton width={120} height={16} />

// Placeholder de lista
<SkeletonList count={6} itemHeight={72} />
```

**Regla**: `ActivityIndicator` solo cuando la carga es <500ms (botones, acciones). Listas siempre con Skeleton.

## Interacciones (Pressy)

```tsx
import { Pressy } from '@/components/ui';

// Drop-in replacement de Pressable
<Pressy onPress={handle} haptic="tap">...</Pressy>
<Pressy onPress={like}  haptic="like">...</Pressy>
<Pressy onPress={save}  haptic="success">...</Pressy>
```

Haptics disponibles (vía `useFeedback`): `tap` · `select` · `success` · `error` · `warning` · `destructive` · `like` · `send`.

## Fases de migración

1. **F1 ✅ (hecha)** — Tokens + fuentes + primitivos.
2. **F2** — Migrar pantallas top-5 a primitivos (home, profile propio, perfil ajeno, post detail, community).
3. **F3** — Sustituir `<Pressable>` → `Pressy` en todos los CTAs y rows.
4. **F4** — Sustituir `<ActivityIndicator>` de listas por `Skeleton`.
5. **F5** — `expo-blur` en tabbar + modals.
6. **F6 (opcional)** — Migración Feather → Phosphor Icons.

## Checklist al tocar cualquier pantalla

Al abrir un archivo para editar, revisa:

- [ ] ¿Todos los `<Text>` están migrados a primitivos (`Display`/`Heading`/`Body`/`Caption`/`Label`)?
- [ ] ¿Los `<Pressable>` son `Pressy` con haptic apropiado?
- [ ] ¿Las líneas grises son `<Hairline>`?
- [ ] ¿Los colores vienen de `Colors.*`, nunca hardcode hex?
- [ ] ¿`ActivityIndicator` solo para acciones cortas, `Skeleton` para listas?
- [ ] ¿Cards elevadas usan `variant="elevated"`?

## Anti-patrones

❌ `<Text style={{ fontSize: 16, fontWeight: '700' }}>…</Text>`
✅ `<Body size="lg" weight="bold">…</Body>`

❌ `<Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}>`
✅ `<Pressy onPress={…} haptic="tap">`

❌ `<View style={{ height: 1, backgroundColor: '#2A2A32' }} />`
✅ `<Hairline />`

❌ `<ActivityIndicator color={Colors.accentPrimary} />` (para listas)
✅ `<SkeletonList count={4} itemHeight={80} />`

❌ `borderColor: '#333'`
✅ `borderColor: Colors.border`
