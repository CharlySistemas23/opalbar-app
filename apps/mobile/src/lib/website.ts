// ─────────────────────────────────────────────
//  Website — central helper para abrir opalbar.com.mx desde la app
//
//  Single source of truth para URL pública. Funciones que aceptan path
//  relativo (/reservas, /menu, /contacto) y delegan a Linking.openURL
//  con fallback graceful (no rompe si el navegador no abre).
// ─────────────────────────────────────────────
import { Alert, Linking } from 'react-native';

export const OPALBAR_WEBSITE = 'https://www.opalbar.com.mx';

/**
 * Paths que NUNCA se abren desde la app (admin, dashboard, login,
 * panel interno). Si una URL incluye uno, se reemplaza por la raíz pública.
 */
const ADMIN_PATH_BLOCKLIST = /\/(admin|dashboard|panel|backoffice|login|auth|signin)(\/|$|\?|#)/i;

/**
 * Sanitiza una URL para garantizar que NUNCA apunte al panel admin.
 * Si la URL contiene un path bloqueado, devuelve la home pública.
 */
export function sanitizePublicUrl(url: string | undefined | null): string {
  if (!url) return OPALBAR_WEBSITE;
  try {
    const u = new URL(url);
    if (ADMIN_PATH_BLOCKLIST.test(u.pathname)) return OPALBAR_WEBSITE;
    // Si el host no es opalbar.com.mx, dejarlo pasar tal cual (links externos como
    // mapas/instagram). El blocklist solo bloquea rutas opalbar admin.
    return url;
  } catch {
    return OPALBAR_WEBSITE;
  }
}

/**
 * Abre la web pública de OPALBAR. Si se pasa `path` se concatena
 * (debe empezar con `/`). Si la URL no puede abrirse muestra un Alert
 * con la URL para que el usuario la copie.
 */
export async function openOpalbarWebsite(path?: string): Promise<void> {
  const url = path ? `${OPALBAR_WEBSITE}${path}` : OPALBAR_WEBSITE;
  const safe = sanitizePublicUrl(url);
  try {
    const can = await Linking.canOpenURL(safe);
    if (can) {
      await Linking.openURL(safe);
      return;
    }
  } catch {
    // fall through
  }
  Alert.alert('OPALBAR', `Visítanos en:\n${safe}`);
}

/** Atajos a rutas conocidas de la web pública. Mantener sync con sitemap. */
export const OpalbarRoutes = {
  home: () => openOpalbarWebsite(),
  reservas: () => openOpalbarWebsite('/reservas'),
  menu: () => openOpalbarWebsite('/menu'),
  eventos: () => openOpalbarWebsite('/eventos'),
  contacto: () => openOpalbarWebsite('/contacto'),
  terminos: () => openOpalbarWebsite('/terminos'),
  privacidad: () => openOpalbarWebsite('/privacidad'),
  prensa: () => openOpalbarWebsite('/prensa'),
};
