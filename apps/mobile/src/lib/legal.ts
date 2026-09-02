// ─────────────────────────────────────────────
//  Legal documents — canonical URLs + opener.
//
//  El sitio público no publica /terminos (404). La API sirve los tres
//  documentos como HTML público, sin auth y cacheado:
//    GET /legal/terms · /legal/privacy · /legal/account-deletion
//  Ésas son las URLs que se declaran en App Store Connect y Play Console,
//  así que la app enlaza exactamente las mismas.
// ─────────────────────────────────────────────
import { Linking } from 'react-native';

import { BASE_URL } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { toast } from '@/components/Toast';

export const LEGAL_URLS = {
  terms: `${BASE_URL}/legal/terms`,
  privacy: `${BASE_URL}/legal/privacy`,
  accountDeletion: `${BASE_URL}/legal/account-deletion`,
} as const;

/** Opens a legal document, toasting instead of failing silently. */
export async function openLegal(url: string): Promise<void> {
  const es = useAppStore.getState().language !== 'en';
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) throw new Error('cannot open');
    await Linking.openURL(url);
  } catch {
    toast(
      es ? 'No se pudo abrir el documento. Intenta más tarde.' : 'Could not open the document. Try again later.',
      'danger',
    );
  }
}
