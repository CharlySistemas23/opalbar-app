import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Switch, Image } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { adminApi, offersApi, venueApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { DateTimeField } from '@/components/DateTimeField';
import { useAuthStore } from '@/stores/auth.store';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors } from '@/constants/tokens';
import { uploadImage, UploadError } from '@/utils/uploadImage';
import { ErrorState } from '@/components/ErrorState';
import { OptionSheet } from '@/components/admin';
import type { OptionSheetItem } from '@/components/admin';

interface OfferFormProps {
  offerId?: string;
}

const OFFER_TYPES: { value: string; label: string }[] = [
  { value: 'PERCENTAGE', label: 'Descuento %' },
  { value: 'FIXED_AMOUNT', label: 'Monto fijo' },
  { value: 'FREE_ITEM', label: 'Ítem gratis' },
  { value: 'BUY_X_GET_Y', label: '2x1 / NxM' },
  { value: 'POINTS_REWARD', label: 'Por puntos' },
];

const TITLE_MIN = 3;
const DESCRIPTION_MIN = 10;

export function OfferForm({ offerId }: OfferFormProps) {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage/offers');
  const me = useAuthStore((s) => s.user);
  // Backend: offers create/update/delete are ADMIN/SUPER_ADMIN only —
  // unlike events, MODERATOR has no write access here at all.
  const canWrite = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const isEdit = !!offerId;

  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [description, setDescription] = useState('');
  const [terms, setTerms] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [venueId, setVenueId] = useState('');
  const [venueName, setVenueName] = useState('');
  const [type, setType] = useState<string>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [maxPerUser, setMaxPerUser] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pointsRequired, setPointsRequired] = useState('0');
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'DEPLETED'>('ACTIVE');

  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [showVenuePicker, setShowVenuePicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  async function pickImage() {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Sin permiso', 'Necesitamos acceso a la galería para subir la imagen.');
      return;
    }
    setPickingImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        try {
          const url = await uploadImage(result.assets[0].uri, { kind: 'offer' });
          setImageUrl(url);
        } catch (err) {
          const msg = err instanceof UploadError ? err.message : 'Error';
          Alert.alert('No se pudo subir', msg);
        }
      }
    } finally { setPickingImage(false); }
  }

  const loadOffer = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const vRes = await venueApi.list({}).catch(() => null);
    const vs = vRes?.data?.data?.data ?? vRes?.data?.data ?? [];
    setVenues(vs);
    if (!isEdit && vs[0]) {
      setVenueId(vs[0].id);
      setVenueName(vs[0].name);
      setLoading(false);
      return;
    }

    if (isEdit && offerId) {
      try {
        const r = await offersApi.get(offerId);
        const o = r.data?.data;
        if (o) {
          setTitle(o.title ?? '');
          setTitleEn(o.titleEn ?? '');
          setDescription(o.description ?? '');
          setTerms(o.terms ?? '');
          setImageUrl(o.imageUrl ?? '');
          setVenueId(o.venueId ?? '');
          setVenueName(o.venue?.name ?? '');
          setType(o.type ?? 'PERCENTAGE');
          setDiscountValue(o.discountValue ? String(o.discountValue) : '');
          setMaxRedemptions(o.maxRedemptions ? String(o.maxRedemptions) : '');
          setMaxPerUser(String(o.maxPerUser ?? 1));
          setStartDate(o.startDate ? toLocal(o.startDate) : '');
          setEndDate(o.endDate ? toLocal(o.endDate) : '');
          setPointsRequired(String(o.pointsRequired ?? 0));
          setIsHighlighted(!!o.isHighlighted);
          setStatus(o.status ?? 'ACTIVE');
        }
      } catch (err) {
        // A failed edit-load must not silently fall back to a blank "new
        // offer" form — that would let someone overwrite an existing offer
        // with empty fields without realizing the load actually failed.
        setLoadError(apiError(err));
      }
      finally { setLoading(false); }
    }
  }, [offerId, isEdit]);

  useEffect(() => { loadOffer(); }, [loadOffer]);

  async function handleSave() {
    if (!canWrite) return;
    if (!title.trim() || !description.trim() || !venueId || !startDate || !endDate) {
      Alert.alert('Faltan datos', 'Completa los campos requeridos.');
      return;
    }
    if (title.trim().length < TITLE_MIN) {
      Alert.alert('Título muy corto', `Usa al menos ${TITLE_MIN} caracteres.`);
      return;
    }
    if (description.trim().length < DESCRIPTION_MIN) {
      Alert.alert('Descripción muy corta', `Usa al menos ${DESCRIPTION_MIN} caracteres.`);
      return;
    }
    setSaving(true);
    try {
      // The service spreads `{...dto}` — a field sent as `undefined` never
      // becomes a key on the parsed body (JSON drops it), so it's silently
      // skipped instead of clearing the old value. `null` is what clears it.
      const payload: any = {
        title: title.trim(),
        titleEn: titleEn.trim() || null,
        description: description.trim(),
        terms: terms.trim() || null,
        imageUrl: imageUrl.trim() || null,
        venueId,
        type,
        discountValue: discountValue ? Number(discountValue) : null,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        maxPerUser: Number(maxPerUser) || 1,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        pointsRequired: Number(pointsRequired) || 0,
        isHighlighted,
        status,
      };
      if (isEdit && offerId) {
        await adminApi.updateOffer(offerId, payload);
      } else {
        await adminApi.createOffer(payload);
      }
      goBack();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!offerId || !canWrite) return;
    Alert.alert('Eliminar oferta', '¿Eliminar permanentemente? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await adminApi.deleteOffer(offerId);
            goBack();
          } catch (err) {
            Alert.alert('Error', apiError(err));
          } finally { setDeleting(false); }
        },
      },
    ]);
  }

  // Alert.alert silently truncates past 3 buttons on Android — the 5-option
  // type picker and venue picker both blew past that. OptionSheet replaces
  // all three pickers below.
  function pickVenue() { setShowVenuePicker(true); }
  function pickType() { setShowTypePicker(true); }
  function pickStatus() { setShowStatusPicker(true); }

  const venueOptions: OptionSheetItem<string>[] = venues.map((v) => ({ value: v.id, label: v.name }));
  const typeOptions: OptionSheetItem<string>[] = OFFER_TYPES.map((o) => ({ value: o.value, label: o.label }));
  const statusOptions: OptionSheetItem<typeof status>[] = [
    { value: 'ACTIVE', label: 'Activa' },
    { value: 'DRAFT', label: 'Borrador' },
    { value: 'PAUSED', label: 'Pausada' },
    { value: 'DEPLETED', label: 'Agotada' },
    { value: 'EXPIRED', label: 'Archivada', tone: 'danger' },
  ];

  const typeLabel = OFFER_TYPES.find((o) => o.value === type)?.label ?? type;

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  if (loadError) return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={goBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Editar Oferta' : 'Nueva Oferta'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ErrorState message={loadError} onRetry={loadOffer} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={goBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Editar Oferta' : 'Nueva Oferta'}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {isEdit && offerId && (
            <TouchableOpacity
              style={styles.previewBtn}
              onPress={() => router.push(`/(app)/offers/${offerId}` as never)}
              hitSlop={8}
            >
              <Feather name="eye" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
          {canWrite ? (
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
              hitSlop={8}
            >
              {saving
                ? <ActivityIndicator color={Colors.textInverse} size="small" />
                : <Text style={styles.saveLabel}>Guardar</Text>}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140, gap: 14 }} showsVerticalScrollIndicator={false}>
        {!canWrite ? (
          <View style={styles.roModeBox}>
            <Feather name="lock" size={12} color={Colors.textMuted} />
            <Text style={styles.roModeText}>Solo lectura — necesitas rol de admin para crear o editar ofertas.</Text>
          </View>
        ) : null}
        <Field label="Título *" value={title} onChangeText={setTitle} placeholder="2x1 en Mezcal Artesanal" editable={canWrite} />
        <Field label="Título (EN)" value={titleEn} onChangeText={setTitleEn} editable={canWrite} />
        <Field label="Descripción *" value={description} onChangeText={setDescription} multiline placeholder="Explica la oferta, condiciones básicas…" editable={canWrite} />
        <Field label="Términos y condiciones" value={terms} onChangeText={setTerms} multiline placeholder="Válido lunes-jueves, 8pm–12am…" editable={canWrite} />

        <View>
          <Text style={styles.fieldLabel}>Imagen de la oferta</Text>
          {imageUrl ? (
            <View style={styles.imgBox}>
              <Image source={{ uri: imageUrl }} style={styles.imgPreview} />
              {canWrite ? (
                <>
                  <TouchableOpacity style={styles.imgRemove} onPress={() => setImageUrl('')} hitSlop={8}>
                    <Feather name="x" size={14} color={Colors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imgChange} onPress={pickImage} disabled={pickingImage}>
                    {pickingImage
                      ? <ActivityIndicator color={Colors.accentPrimary} size="small" />
                      : <>
                          <Feather name="refresh-cw" size={14} color={Colors.accentPrimary} />
                          <Text style={styles.imgChangeLbl}>Cambiar</Text>
                        </>}
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          ) : canWrite ? (
            <TouchableOpacity style={styles.imgUpload} onPress={pickImage} disabled={pickingImage} activeOpacity={0.85}>
              {pickingImage
                ? <ActivityIndicator color={Colors.accentPrimary} />
                : <>
                    <Feather name="image" size={22} color={Colors.accentPrimary} />
                    <Text style={styles.imgUploadTitle}>Subir imagen</Text>
                    <Text style={styles.imgUploadSub}>JPG/PNG · 16:9 recomendado</Text>
                  </>}
            </TouchableOpacity>
          ) : (
            <View style={styles.imgUpload}>
              <Feather name="image" size={22} color={Colors.textMuted} />
              <Text style={styles.imgUploadSub}>Sin imagen</Text>
            </View>
          )}
        </View>

        <PickerField label="Venue *" value={venueName || 'Seleccionar…'} onPress={pickVenue} disabled={!canWrite} />
        <PickerField label="Tipo de oferta *" value={typeLabel} onPress={pickType} disabled={!canWrite} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Descuento (% o $)" value={discountValue} onChangeText={setDiscountValue} keyboardType="decimal-pad" editable={canWrite} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Puntos requeridos" value={pointsRequired} onChangeText={setPointsRequired} keyboardType="number-pad" editable={canWrite} />
          </View>
        </View>

        <DateTimeField
          label="Vigente desde *"
          value={startDate}
          onChange={setStartDate}
          placeholder="Elegir fecha y hora"
        />
        <DateTimeField
          label="Vigente hasta *"
          value={endDate}
          onChange={setEndDate}
          placeholder="Elegir fecha y hora"
          minimumDate={startDate ? new Date(startDate) : undefined}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Máx canjes totales" value={maxRedemptions} onChangeText={setMaxRedemptions} keyboardType="number-pad" placeholder="100" editable={canWrite} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Máx por usuario" value={maxPerUser} onChangeText={setMaxPerUser} keyboardType="number-pad" editable={canWrite} />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Destacada</Text>
            <Text style={styles.fieldHint}>Aparece arriba en la lista de ofertas.</Text>
          </View>
          <Switch
            value={isHighlighted}
            onValueChange={setIsHighlighted}
            disabled={!canWrite}
            trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
            thumbColor="#fff"
          />
        </View>

        {isEdit && (
          <PickerField label="Status" value={statusLabel(status)} onPress={pickStatus} disabled={!canWrite} />
        )}

        {isEdit && canWrite && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting} activeOpacity={0.85}>
            {deleting
              ? <ActivityIndicator color={Colors.accentDanger} size="small" />
              : <><Feather name="trash-2" size={16} color={Colors.accentDanger} />
                  <Text style={styles.deleteLabel}>Eliminar oferta</Text></>}
          </TouchableOpacity>
        )}
      </ScrollView>

      <OptionSheet<string>
        open={showVenuePicker}
        onClose={() => setShowVenuePicker(false)}
        title="Elegir venue"
        options={venueOptions}
        value={venueId}
        onSelect={(id) => {
          const v = venues.find((x) => x.id === id);
          if (v) { setVenueId(v.id); setVenueName(v.name); }
        }}
      />

      <OptionSheet<string>
        open={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        title="Tipo de oferta"
        options={typeOptions}
        value={type}
        onSelect={setType}
      />

      <OptionSheet<typeof status>
        open={showStatusPicker}
        onClose={() => setShowStatusPicker(false)}
        title="Status de la oferta"
        options={statusOptions}
        value={status}
        onSelect={setStatus}
      />
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, editable }: any) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        editable={editable !== false}
      />
    </View>
  );
}
function PickerField({ label, value, onPress, disabled }: any) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={[styles.picker, disabled && { opacity: 0.6 }]} onPress={onPress} activeOpacity={0.8} disabled={disabled}>
        <Text style={styles.pickerText}>{value}</Text>
        <Feather name="chevron-down" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}
function statusLabel(s: string) {
  switch (s) {
    case 'ACTIVE': return 'Activa';
    case 'DRAFT': return 'Borrador';
    case 'PAUSED': return 'Pausada';
    case 'DEPLETED': return 'Agotada';
    case 'EXPIRED': return 'Archivada';
    default: return s;
  }
}
function toLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 14,
    minWidth: 84,
    alignItems: 'center',
  },
  saveLabel: { color: Colors.textInverse, fontWeight: '700', fontSize: 13 },
  previewBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  roModeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  roModeText: { color: Colors.textMuted, fontSize: 11, flex: 1 },

  fieldLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  fieldHint: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  pickerText: { color: Colors.textPrimary, fontSize: 14 },

  row: { flexDirection: 'row', gap: 10 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 10,
    paddingVertical: 14,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.3)',
  },
  deleteLabel: { color: Colors.accentDanger, fontSize: 14, fontWeight: '700' },

  imgUpload: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: 24,
    backgroundColor: Colors.bgCard,
    minHeight: 140,
  },
  imgUploadTitle: { color: Colors.accentPrimary, fontSize: 14, fontWeight: '700' },
  imgUploadSub: { color: Colors.textMuted, fontSize: 11 },
  imgBox: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imgPreview: { width: '100%', height: 180 },
  imgRemove: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  imgChange: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  imgChangeLbl: { color: Colors.accentPrimary, fontSize: 12, fontWeight: '700' },
});
