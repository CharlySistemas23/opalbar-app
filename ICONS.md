# Icon System - OPALBAR

## Overview
This project uses **Feather Icons** for consistent iconography across all platforms. No emojis are used in the codebase.

## Available Icons (By Module)

### Loyalty Levels
- **award** - Bronze level
- **shield** - Silver level  
- **star** - Gold level
- **hexagon** - Diamond level

### Event Categories
- **music** - Live Music events
- **disc** - DJ Set events
- **mic** - Karaoke events
- **wine** - Wine Tasting events
- **help-circle** - Trivia events
- **star** - Special events

## Implementation

### Mobile (React Native)
Uses **expo-vector-icons** which supports Feather icons natively:

```tsx
import { Feather } from '@expo/vector-icons';

<Feather name="award" size={24} color="#333" />
```

### Admin Web (React)
Uses **react-feather** or **lucide-react** (drop-in replacements):

```tsx
import { Award, Shield, Star } from 'react-feather';

<Award size={24} />
```

### API/Backend
Icons are stored as string identifiers in the database (no actual icon objects). 
Frontend clients fetch the icon name and render using their local icon library.

## Naming Convention
- All icon names use **kebab-case** (e.g., `help-circle`, not `help_circle`)
- Icons must exist in Feather Icons library
- Add new icons through migrations, not hardcoded in services

## Consistency Rules
✅ **DO**: Use feather icon names from the official Feather Icons set  
✅ **DO**: Store icon names in database as strings  
✅ **DO**: Use [STATUS] format for console logging (e.g., `[OK]`, `[ERROR]`)

❌ **DON'T**: Use emojis in code or logging  
❌ **DON'T**: Invent icon names not in Feather Icons  
❌ **DON'T**: Mix multiple icon libraries in one view  

## Resources
- **Feather Icons**: https://feathericons.com
- **expo-vector-icons**: https://docs.expo.dev/guides/icons/
- **react-feather**: https://github.com/feathericons/react-feather
