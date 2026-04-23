import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Switch, TextInput, Image, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { venueApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius } from '@/constants/tokens';

// ─────────────────────────────────────────────
//  Admin · Venue editor
//  · Name, description, contact, location, media, active toggle
//  · Paste Google Maps URL → extracts lat/lng
//  · Static map preview (requires EXPO_PUBLIC_GOOGLE_MAPS_KEY)
//    fallback: tappable card that opens Google Maps externally
// ─────────────────────────────────────────────

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

/**
 * Parse lat/lng from common Google Maps URLs.
 * Handles:
 *   - /@20.62,-105.23,15z
 *   - /?q=20.62,-105.23
 *   - ?ll=20.62,-105.23
 *   - !3d20.62!4d-105.23
 */
function parseLatLng(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    }
  }
  return null;
}

function staticMapUrl(lat: number, lng: number, apiKey?: string): string | null {
  if (!lat || !lng) return null;
  if (apiKey) {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=640x320&scale=2&markers=color:0xF4A340%7C${lat},${lng}&key=${apiKey}`;
  }
  // Key-free fallback (may be rate-limited, shows basic map)
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=16&size=640x320&markers=${lat},${lng},red-pushpin`;
}

export default function AdminVenueEdit() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const googleKey = (process.env as any).EXPO_PUBLIC_GOOGLE_MAPS_KEY as string | undefined;

  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('MX');
  const [zipCode, setZipCode] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [gmapsUrl, setGmapsUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await venueApi.list({ limit: 1 });
        const first = r.data?.data?.data?.[0] ?? r.data?.data?.[0];
        if (first) {
          setVenue(first);
          setName(first.name ?? '');
          setDescription(first.description ?? '');
          setAddress(first.address ?? '');
          setCity(first.city ?? '');
          setState(first.state ?? '');
          setCountry(first.country ?? 'MX');
          setZipCode(first.zipCode ?? '');
          setLat(first.lat != null ? String(first.lat) : '');
          setLng(first.lng != null ? String(first.lng) : '');
          setPhone(first.phone ?? '');
          setEmail(first.email ?? '');
          setWebsite(first.website ?? '');
          setInstagram(first.instagram ?? '');
          setImageUrl(first.imageUrl ?? '');
          setCoverUrl(first.coverUrl ?? '');
          setIsActive(first.isActive ?? true);
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const hasCoords = !Number.isNaN(latNum) && !Number.isNaN(lngNum);
  const mapUrl = useMemo(
    () => (hasCoords ? staticMapUrl(latNum, lngNum, googleKey) : null),
    [latNum, lngNum, hasCoords, googleKey],
  );

  function handlePasteGmaps() {
    const parsed = parseLatLng(gmapsUrl);
    if (!parsed) {
      Alert.alert(
        'No se encontraron coordenadas',
        'Pega un enlace completo de Google Maps (no el acortado maps.app.goo.gl).',
      );
      return;
    }
    setLat(String(parsed.lat));
    setLng(String(parsed.lng));
  }

  async function pickImage(target: 'logo' | 'cover') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos.');
      return;
    }
    const setter = target === 'logo' ? setImageUrl : setCoverUrl;
    const setBusy = target === 'logo' ? setUploadingLogo : setUploadingCover;
    const aspect: [number, number] = target === 'logo' ? [1, 1] : [16, 9];
    setBusy(true);
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect,
        quality: 0.75,
        base64: true,
      });
      if (!r.canceled && r.assets[0]?.base64) {
        setter(`data:image/jpeg;base64,${r.assets[0].base64}`);
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir la galería.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!venue) return;
    if (!name.trim()) {
      Alert.alert('Falta el nombre');
      return;
    }
    const payload: Record<string, any> = {
      name: name.trim(),
      description: description.trim() || null,
      address: address.trim(),
      city: city.trim(),
      state: state.trim() || null,
      country: country.trim().toUpperCase() || 'MX',
      zipCode: zipCode.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      website: website.trim() || null,
      instagram: instagram.trim() || null,
      imageUrl: imageUrl || null,
      coverUrl: coverUrl || null,
      isActive,
    };
    if (lat && lng) {
      const la = parseFloat(lat);
      const lo = parseFloat(lng);
      if (!Number.isNaN(la) && !Number.isNaN(lo)) {
        payload.lat = la;
        payload.lng = lo;
      }
    }
    setSaving(true);
    try {
      await venueApi.update(venue.id, payload);
      Alert.alert('Listo', 'Bar actualizado.');
      goBack();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  if (!venue) return (
    <View style={styles.center}>
      <Text style={{ color: Colors.textMuted }}>Sin venue registrado</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.iconBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Editar bar</Text>
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            hitSlop={8}
          >
            {saving
              ? <ActivityIndicator color={Colors.textInverse} size="small" />
              : <Text style={styles.saveBtnText}>Guardar</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cover image */}
          <TouchableOpacity
            onPress={() => pickImage('cover')}
            disabled={uploadingCover}
            activeOpacity={0.85}
            style={styles.coverBox}
          >
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Feather name="image" size={28} color={Colors.textMuted} />
                <Text style={styles.coverHint}>Toca para subir portada</Text>
              </View>
            )}
            <View style={styles.coverEditBadge}>
              {uploadingCover
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Feather name="camera" size={13} color="#fff" />
                    <Text style={styles.coverEditLabel}>
                      {coverUrl ? 'Cambiar' : 'Añadir'}
                    </Text>
                  </>}
            </View>
          </TouchableOpacity>

          {/* Logo + active toggle */}
          <View style={styles.logoRow}>
            <TouchableOpacity onPress={() => pickImage('logo')} disabled={uploadingLogo} style={styles.logoBox}>
              {imageUrl
                ? <Image source={{ uri: imageUrl }} style={styles.logoImg} />
                : <View style={[styles.logoImg, styles.logoPlaceholder]}>
                    <Feather name="image" size={18} color={Colors.textMuted} />
                  </View>}
              <View style={styles.logoBadge}>
                {uploadingLogo
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Feather name="camera" size={10} color="#fff" />}
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Estado</Text>
              <View style={styles.activeRow}>
                <Text style={styles.activeText}>{isActive ? 'Activo (visible)' : 'Inactivo (oculto)'}</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                />
              </View>
            </View>
          </View>

          <Section title="Información" icon="info">
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="OPAL BAR PV" icon="home" />
            <Field
              label="Descripción"
              value={description}
              onChangeText={setDescription}
              placeholder="Cuenta sobre tu bar…"
              icon="file-text"
              multiline
            />
          </Section>

          <Section title="Ubicación" icon="map-pin">
            {/* Map preview */}
            {hasCoords && mapUrl ? (
              <View style={styles.mapCard}>
                <Image source={{ uri: mapUrl }} style={styles.mapImg} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.mapOpenBtn}
                  activeOpacity={0.85}
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`)}
                >
                  <Feather name="external-link" size={12} color="#fff" />
                  <Text style={styles.mapOpenLabel}>Abrir en Maps</Text>
                </TouchableOpacity>
                {!googleKey && (
                  <View style={styles.mapWarn}>
                    <Text style={styles.mapWarnText}>
                      Tip: define EXPO_PUBLIC_GOOGLE_MAPS_KEY para mapas HD
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.mapEmpty}>
                <Feather name="map" size={24} color={Colors.textMuted} />
                <Text style={styles.mapEmptyText}>Sin coordenadas aún</Text>
              </View>
            )}

            {/* Paste GMaps */}
            <View style={styles.pasteBox}>
              <Feather name="link" size={14} color={Colors.accentPrimary} />
              <TextInput
                value={gmapsUrl}
                onChangeText={setGmapsUrl}
                placeholder="Pega URL de Google Maps"
                placeholderTextColor={Colors.textMuted}
                style={styles.pasteInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={handlePasteGmaps} style={styles.pasteBtn}>
                <Text style={styles.pasteBtnText}>Extraer</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Latitud" value={lat} onChangeText={setLat} placeholder="20.6296" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Longitud" value={lng} onChangeText={setLng} placeholder="-105.2333" keyboardType="numeric" />
              </View>
            </View>

            <Field label="Dirección" value={address} onChangeText={setAddress} placeholder="Av. Paseo Díaz Ordaz 630" icon="map-pin" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 2 }}>
                <Field label="Ciudad" value={city} onChangeText={setCity} placeholder="Puerto Vallarta" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Estado" value={state} onChangeText={setState} placeholder="JAL" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="País" value={country} onChangeText={setCountry} placeholder="MX" autoCapitalize="characters" maxLength={3} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="C.P." value={zipCode} onChangeText={setZipCode} placeholder="48380" keyboardType="numeric" />
              </View>
            </View>
          </Section>

          <Section title="Contacto" icon="phone">
            <Field label="Teléfono" value={phone} onChangeText={setPhone} placeholder="+52 322 123 4567" keyboardType="phone-pad" icon="phone" />
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="hola@opalbar.com" keyboardType="email-address" autoCapitalize="none" icon="mail" />
            <Field label="Sitio web" value={website} onChangeText={setWebsite} placeholder="https://opalbar.com" keyboardType="url" autoCapitalize="none" icon="globe" />
            <Field label="Instagram" value={instagram} onChangeText={setInstagram} placeholder="opalbar.pv" autoCapitalize="none" icon="instagram" />
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, icon, children }: { title: string; icon: FeatherIcon; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Feather name={icon} size={14} color={Colors.accentPrimary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

function Field({
  label, icon, multiline, ...props
}: React.ComponentProps<typeof TextInput> & { label: string; icon?: FeatherIcon }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBox, multiline && { height: 96, alignItems: 'flex-start', paddingTop: 12 }]}>
        {icon && <Feather name={icon} size={15} color={Colors.textMuted} />}
        <TextInput
          {...props}
          multiline={multiline}
          style={[styles.fieldInput, multiline && { textAlignVertical: 'top', height: 80 }]}
          placeholderTextColor={Colors.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  saveBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
    minWidth: 80,
    alignItems: 'center',
  },
  saveBtnText: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },

  scroll: { padding: 16, paddingBottom: 40, gap: 20 },

  // Cover
  coverBox: {
    height: 160,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  coverPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  coverHint: { color: Colors.textMuted, fontSize: 12 },
  coverEditBadge: {
    position: 'absolute', right: 12, bottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  coverEditLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Logo + active
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoBox: { position: 'relative' },
  logoImg: {
    width: 72, height: 72, borderRadius: 16,
    backgroundColor: Colors.bgCard,
  },
  logoPlaceholder: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  logoBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bgPrimary,
  },
  activeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, height: 48,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.button,
    marginTop: 6,
  },
  activeText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },

  // Sections
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingTop: 4,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Fields
  fieldLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  fieldInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, padding: 0 },

  // Map
  mapCard: {
    height: 180,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  mapImg: { width: '100%', height: '100%' },
  mapOpenBtn: {
    position: 'absolute', right: 10, top: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
  },
  mapOpenLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
  mapWarn: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(244,163,64,0.9)',
    paddingVertical: 4, paddingHorizontal: 10,
  },
  mapWarnText: { color: '#1a1200', fontSize: 10, fontWeight: '700' },
  mapEmpty: {
    height: 100,
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  mapEmptyText: { color: Colors.textMuted, fontSize: 12 },

  // Paste box
  pasteBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 12, paddingRight: 4,
    height: 46,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  pasteInput: { flex: 1, color: Colors.textPrimary, fontSize: 13, padding: 0 },
  pasteBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
  },
  pasteBtnText: { color: Colors.textInverse, fontSize: 12, fontWeight: '700' },
});
