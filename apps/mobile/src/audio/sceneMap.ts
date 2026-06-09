// ─────────────────────────────────────────────
//  Ambient scene map — route → auditory scene
//
//  Maps the current expo-router segments to a background ambience scene.
//  Returns `null` for areas that should stay silent (auth, splash, guest).
//
//  Scenes:
//   · 'lounge' — warm, intimate. Home, community, profile, deep (app) screens.
//   · 'night'  — energetic club/night. Bar (Club) + events (Experiencias).
// ─────────────────────────────────────────────

export type AmbientScene = 'lounge' | 'night';

/**
 * Derive the ambient scene from `useSegments()` output.
 * segments[0] = route group ('(tabs)', '(app)', '(auth)', '(admin)', '(guest)', 'index'…)
 * segments[1] = screen / sub-folder name.
 */
export function sceneForSegments(segments: string[]): AmbientScene | null {
  const group = segments[0];
  const screen = segments[1];

  // Silent zones — no ambience while logging in, on splash, or as a guest.
  if (!group || group === 'index' || group === '(auth)' || group === '(guest)') {
    return null;
  }

  // Admin is owned elsewhere; keep it quiet so it never surprises operators.
  if (group === '(admin)') return null;

  if (group === '(tabs)') {
    if (screen === 'bar' || screen === 'events') return 'night';
    return 'lounge'; // home, community, profile
  }

  // Any deep (app)/* detail screen keeps the intimate lounge bed.
  if (group === '(app)') return 'lounge';

  return null;
}
