# OPALBAR — Design System

> Cómo lograr que toda la app se sienta elegante y premium sin tocar 100 archivos.

Este documento fusiona el sistema visual ([PREMIUM](#parte-1--premium-design-system)) y el sistema de iconos ([ICONS](#parte-2--icon-system)).

---

## Parte 1 — Premium Design System

### Arquitectura (3 capas)

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

### Tipografía

Dos familias cargadas en [_layout.tsx](../apps/mobile/app/_layout.tsx):

| Familia    | Uso                                  | Primitivos                  |
|------------|--------------------------------------|-----------------------------|
| Fraunces   | Display, headlines, titulares serif  | `<Display>`, `<Heading>`    |
| Inter      | Body, UI text, data, números         | `<Subhead>`, `<Body>`, `<Caption>`, `<Label>` |

#### Cuándo usar qué

```tsx
import { Display, Heading, Subhead, Body, Caption, Label } from '@/components/ui';

// Hero
<Display size="xl">OPAL BAR</Display>
<Display size="lg">1,284</Display>

// Títulos de pantalla / secciones
<Heading size="lg">Tu perfil</Heading>
<Heading size="md">Eventos destacados</Heading>

// Bloque / fila importante
<Subhead>Viernes 25 de abril</Subhead>

// Cuerpo
<Body>Disfruta la noche con amigos en el mejor ambiente.</Body>
<Body size="lg" weight="semiBold">Título de card</Body>

// Metadata
<Caption>hace 3h</Caption>
<Caption weight="semiBold">12 asistentes</Caption>

// Tags / badges / overlines
<Label tone="champagne">VIP</Label>
<Label>EVENTO EXCLUSIVO</Label>
```

#### Tone prop

- `primary` (default), `secondary`, `muted`, `accent`, `champagne`, `danger`, `inverse`

### Paleta premium

#### Fondos (warm off-black)
```ts
Colors.bgPrimary      // #0F0D0C — base warm
Colors.bgCard         // #17141A — cards
Colors.bgElevated     // #1E1A20 — overlays, sheets
Colors.bgSubtle       // rgba(255,255,255,0.03)
```

#### Hairlines con alpha (NO gris sólido)
```ts
Colors.borderSubtle   // rgba(255,255,255,0.04)
Colors.border         // rgba(255,255,255,0.06)
Colors.borderStrong   // rgba(255,255,255,0.10)
Colors.highlightTop   // rgba(255,255,255,0.04) — luz desde arriba en cards
```

#### Acentos
- `accentPrimary` (`#F4A340`) — CTAs, like activo
- `accentChampagne` (`#D4B88C`) — loyalty, VIP, verified, badges premium
- `accentSuccess`, `accentDanger`, `accentInfo` — semánticos

### Superficies (Card)

```tsx
<Card>...</Card>                      // Flat: borde sutil, sin sombra
<Card variant="elevated">...</Card>   // Elevated: borde superior + sombra
<Card variant="glass">...</Card>      // Glass: fondo elevated + borde subtle
```

### Separadores (Hairline)

```tsx
<Hairline />
<Hairline variant="subtle" />
<Hairline variant="strong" />
<Hairline marginVertical={16} />
```

### Loading (Skeleton vs ActivityIndicator)

```tsx
<Skeleton width={120} height={16} />
<SkeletonList count={6} itemHeight={72} />
```

`ActivityIndicator` solo cuando la carga es <500ms (botones). Listas siempre con Skeleton.

### Interacciones (Pressy)

```tsx
<Pressy onPress={handle} haptic="tap">...</Pressy>
<Pressy onPress={like}  haptic="like">...</Pressy>
<Pressy onPress={save}  haptic="success">...</Pressy>
```

Haptics disponibles: `tap` · `select` · `success` · `error` · `warning` · `destructive` · `like` · `send`.

### Checklist al tocar cualquier pantalla

- [ ] ¿`<Text>` migrados a primitivos (`Display`/`Heading`/`Body`/`Caption`/`Label`)?
- [ ] ¿`<Pressable>` son `Pressy` con haptic apropiado?
- [ ] ¿Las líneas grises son `<Hairline>`?
- [ ] ¿Colores vienen de `Colors.*`, nunca hex hardcoded?
- [ ] ¿`ActivityIndicator` solo para acciones cortas, `Skeleton` para listas?
- [ ] ¿Cards elevadas usan `variant="elevated"`?

### Anti-patrones

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

---

## Parte 2 — Icon System

### Overview
OPALBAR usa **Feather Icons** para iconografía consistente. **No emojis en el código**.

### Implementación

#### Mobile (React Native)
Usa `expo-vector-icons` (Feather nativo):

```tsx
import { Feather } from '@expo/vector-icons';

<Feather name="award" size={24} color={Colors.accentChampagne} />
```

#### Admin Web (React)
Usa `react-feather` o `lucide-react` (drop-in):

```tsx
import { Award, Shield, Star } from 'react-feather';

<Award size={24} />
```

#### API/Backend
Iconos se guardan como string identifiers en DB. El cliente decide la librería para renderizar.

### Catálogo por módulo

#### Loyalty Levels
- **award** — Bronze
- **shield** — Silver
- **star** — Gold
- **hexagon** — Diamond

#### Event Categories
- **music** — Live Music
- **disc** — DJ Set
- **mic** — Karaoke
- **wine** — Wine Tasting
- **help-circle** — Trivia
- **star** — Special

### Reglas

✅ **DO**: usar nombres oficiales de Feather Icons
✅ **DO**: guardar nombres como strings en DB
✅ **DO**: format `[STATUS]` para logging (`[OK]`, `[ERROR]`)

❌ **DON'T**: emojis en código o logs
❌ **DON'T**: inventar nombres de icono
❌ **DON'T**: mezclar librerías de iconos en una vista

### Convención de nombres
- **kebab-case** (e.g., `help-circle`, no `help_circle`)
- Deben existir en Feather Icons
- Agregar nuevos vía migrations, no hardcoded en services

### Recursos
- Feather Icons: https://feathericons.com
- expo-vector-icons: https://docs.expo.dev/guides/icons/
- react-feather: https://github.com/feathericons/react-feather
