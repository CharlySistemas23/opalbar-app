import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { loyaltyApi, adminApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Level {
  id: string;
  name: string;
  nameEn?: string;
  slug?: string;
  color?: string;
  icon?: string;
  minPoints: number;
  maxPoints?: number | null;
  benefits?: string[] | null;
  discountPercent?: number;
  sortOrder?: number;
}

const PALETTE = [Colors.accentPrimary, '#60A5FA', '#A855F7', Colors.accentSuccess, '#EC4899', '#F59E0B'];
const ICON_CHOICES: FeatherIcon[] = ['star', 'award', 'gift', 'shield', 'zap', 'heart'];

export default function AdminLoyalty() {
  const router = useRouter();
  const { user } = useAuthStore();
  const canEdit = user?.role === 'SUPER_ADMIN';

  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Partial<Level> | null>(null);
  const [benefitsText, setBenefitsText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await loyaltyApi.levels();
      const rows = r.data?.data?.data ?? r.data?.data ?? [];
      const sorted = [...rows].sort((a: Level, b: Level) =>
        (a.sortOrder ?? a.minPoints) - (b.sortOrder ?? b.minPoints));
      setLevels(sorted);
    } catch (err) { setError(apiError(err)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditor({ name: '', minPoints: 0, color: PALETTE[0], icon: 'star', sortOrder: levels.length });
    setBenefitsText('');
  }

  function openEdit(l: Level) {
    setEditor({ ...l });
    setBenefitsText((l.benefits ?? []).join('\n'));
  }

  async function save() {
    if (!editor?.name || editor.minPoints == null) {
      Alert.alert('Error', 'Nombre y puntos mínimos son obligatorios');
      return;
    }
    const payload = {
      name: editor.name,
      nameEn: editor.nameEn,
      slug: editor.slug ?? editor.name.toLowerCase().replace(/\s+/g, '-'),
      minPoints: Number(editor.minPoints) || 0,
      maxPoints: editor.maxPoints != null && editor.maxPoints !== undefined && String(editor.maxPoints) !== ''
        ? Number(editor.maxPoints) : null,
      color: editor.color ?? PALETTE[0],
      icon: editor.icon ?? 'star',
      benefits: benefitsText.split('\n').map((s) => s.trim()).filter(Boolean),
      sortOrder: Number(editor.sortOrder) || 0,
      discountPercent: editor.discountPercent != null ? Number(editor.discountPercent) : undefined,
    };
    setSaving(true);
    try {
      if (editor.id) await adminApi.updateLoyaltyLevel(editor.id, payload);
      else await adminApi.createLoyaltyLevel(payload);
      setEditor(null);
      await load();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally { setSaving(false); }
  }

  async function remove(l: Level) {
    Alert.alert('Eliminar nivel', `¿Eliminar "${l.name}"? Los usuarios caerán al nivel inferior.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
          try { await adminApi.deleteLoyaltyLevel(l.id); await load(); }
          catch (err) { Alert.alert('Error', apiError(err)); }
        } },
    ]);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Niveles de fidelidad</Text>
        {canEdit ? (
          <TouchableOpacity onPress={openNew} style={[styles.backBtn, { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary }]} hitSlop={10}>
            <Feather name="plus" size={18} color={Colors.textInverse} />
          </TouchableOpacity>
        ) : <View style={styles.backBtn} />}
      </View>

      <View style={styles.intro}>
        <View style={styles.introIcon}>
          <Feather name="award" size={18} color={Colors.accentPrimary} />
        </View>
        <Text style={styles.introText}>
          Los niveles se otorgan automáticamente según los puntos acumulados. {canEdit ? 'Toca un nivel para editarlo.' : 'Solo un Super Admin puede editar.'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color={Colors.accentDanger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryLbl}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={levels}
          keyExtractor={(x) => x.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Feather name="award" size={32} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Sin niveles configurados</Text>
              {canEdit && (
                <TouchableOpacity onPress={openNew} style={styles.retryBtn}>
                  <Text style={styles.retryLbl}>Crear primero</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            const color = item.color ?? PALETTE[index % PALETTE.length];
            const icon = (item.icon as FeatherIcon) || 'star';
            const range = item.maxPoints != null
              ? `${item.minPoints.toLocaleString()} – ${item.maxPoints.toLocaleString()} pts`
              : `${item.minPoints.toLocaleString()}+ pts`;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={canEdit ? 0.85 : 1}
                onPress={() => canEdit && openEdit(item)}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.iconBox, { backgroundColor: color + '25' }]}>
                    <Feather name={icon} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardRange}>{range}</Text>
                  </View>
                  {item.discountPercent ? (
                    <View style={[styles.discountBadge, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.discountText, { color }]}>-{item.discountPercent}%</Text>
                    </View>
                  ) : null}
                  {canEdit && (
                    <TouchableOpacity onPress={() => remove(item)} style={styles.deleteBtn} hitSlop={8}>
                      <Feather name="trash-2" size={16} color={Colors.accentDanger} />
                    </TouchableOpacity>
                  )}
                </View>
                {Array.isArray(item.benefits) && item.benefits.length > 0 && (
                  <View style={styles.benefits}>
                    {item.benefits.map((b, i) => (
                      <View key={i} style={styles.benefitRow}>
                        <Feather name="check" size={12} color={color} />
                        <Text style={styles.benefitText}>{b}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={!!editor} transparent animationType="slide" onRequestClose={() => setEditor(null)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{editor?.id ? 'Editar nivel' : 'Nuevo nivel'}</Text>
              <TouchableOpacity onPress={() => setEditor(null)} hitSlop={10}>
                <Feather name="x" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}>
              <Field label="Nombre"
                value={editor?.name ?? ''}
                onChangeText={(v) => setEditor((p) => ({ ...p, name: v }))}
              />
              <Field label="Nombre (EN)"
                value={editor?.nameEn ?? ''}
                onChangeText={(v) => setEditor((p) => ({ ...p, nameEn: v }))}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Puntos mín."
                    value={String(editor?.minPoints ?? '')}
                    keyboardType="numeric"
                    onChangeText={(v) => setEditor((p) => ({ ...p, minPoints: Number(v) || 0 }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Puntos máx."
                    value={editor?.maxPoints != null ? String(editor.maxPoints) : ''}
                    keyboardType="numeric"
                    placeholder="Sin límite"
                    onChangeText={(v) => setEditor((p) => ({ ...p, maxPoints: v ? Number(v) : null }))}
                  />
                </View>
              </View>
              <Field label="Descuento %"
                value={editor?.discountPercent != null ? String(editor.discountPercent) : ''}
                keyboardType="numeric"
                placeholder="0"
                onChangeText={(v) => setEditor((p) => ({ ...p, discountPercent: v ? Number(v) : undefined }))}
              />

              <Text style={styles.fieldLbl}>COLOR</Text>
              <View style={styles.palette}>
                {PALETTE.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.paletteDot, { backgroundColor: c }, editor?.color === c && styles.paletteDotActive]}
                    onPress={() => setEditor((p) => ({ ...p, color: c }))}
                  />
                ))}
              </View>

              <Text style={styles.fieldLbl}>ÍCONO</Text>
              <View style={styles.iconGrid}>
                {ICON_CHOICES.map((ic) => {
                  const active = editor?.icon === ic;
                  return (
                    <TouchableOpacity
                      key={ic}
                      style={[styles.iconChoice, active && { backgroundColor: (editor?.color ?? PALETTE[0]) + '25', borderColor: editor?.color ?? PALETTE[0] }]}
                      onPress={() => setEditor((p) => ({ ...p, icon: ic }))}
                    >
                      <Feather name={ic} size={18} color={active ? (editor?.color ?? PALETTE[0]) : Colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLbl}>BENEFICIOS (uno por línea)</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                multiline
                value={benefitsText}
                onChangeText={setBenefitsText}
                placeholder={'10% descuento en ofertas\nEntrada prioritaria'}
                placeholderTextColor={Colors.textMuted}
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={save}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color={Colors.textInverse} />
                  : <Text style={styles.saveLbl}>{editor?.id ? 'Guardar cambios' : 'Crear nivel'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'email-address';
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLbl}>{label.toUpperCase()}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },

  intro: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 20, marginTop: 12,
    padding: 14, borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  introIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  introText: { flex: 1, color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  errorText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.accentPrimary, marginTop: 4 },
  retryLbl: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },

  list: { padding: 16, gap: 12 },
  card: {
    padding: 14, gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  cardRange: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  discountBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  discountText: { fontSize: 12, fontWeight: '800' },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(228,88,88,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  benefits: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitText: { color: Colors.textSecondary, fontSize: 13, flex: 1 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgPrimary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%',
    borderWidth: 1, borderColor: Colors.border,
  },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },

  fieldLbl: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 14,
  },

  palette: { flexDirection: 'row', gap: 10 },
  paletteDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  paletteDotActive: { borderColor: Colors.textPrimary },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  saveBtn: {
    height: 52, borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  saveLbl: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
});
