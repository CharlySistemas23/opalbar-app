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
 * Abre la web pública de OPALBAR. Si se pasa `path` se concatena
 * (debe empezar con `/`). Si la URL no puede abrirse muestra un Alert
 * con la URL para que el usuario la copie.
 */
export async function openOpalbarWebsite(path?: string): Promise<void> {
  const url = path ? `${OPALBAR_WEBSITE}${path}` : OPALBAR_WEBSITE;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    // fall through
  }
  Alert.alert('OPALBAR', `Visítanos en:\n${url}`);
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
