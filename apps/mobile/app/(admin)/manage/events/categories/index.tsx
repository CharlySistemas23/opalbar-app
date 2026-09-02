import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import {
  Body,
  Button,
  Caption,
  ConfirmDialog,
  Input,
  Kicker,
  SegmentedControl,
  Sheet,
  Subhead,
} from '@/components/ui';
import { AdminHeader } from '@/components/admin';
import type { SegmentOption } from '@/components/ui';

type Tab = 'active' | 'archived';

// Palette restricted to the NOIR brand accents + champagne/info/danger tones.
const COLOR_PALETTE = [
  Colors.accentPrimary,
  Colors.accentChampagne,
  Colors.accentSuccess,
  Colors.accentInfo,
  Colors.accentDanger,
  Colors.accentPrimaryDark,
  Colors.accentChampagneDark,
  Colors.textSecondary,
];

export default function AdminCategoriesList() {
  const goBack = useSafeBack('/(admin)/manage/events');
  const [tab, setTab] = useState<Tab>('active');
  const [active, setActive] = useState<any[]>([]);
  const [archived, setArchived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [creating, setCreating] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<any>(null);
  const [hardDelTarget, setHardDelTarget] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.allCategories();
      const all = r.data?.data ?? r.data ?? [];
      setActive(all.filter((c: any) => c.isActive));
      setArchived(all.filter((c: any) => !c.isActive));
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function createCategory() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await adminApi.createCategory({ name: newName.trim(), color: newColor });
      const cat = r.data?.data ?? r.data;
      setActive((p) => [...p, cat]);
      setNewName('');
      setNewColor(COLOR_PALETTE[0]);
      setShowCreate(false);
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function performArchive() {
    const cat = archiveTarget;
    if (!cat) return;
    setArchiveTarget(null);
    setDeletingId(cat.id);
    try {
      await adminApi.deleteCategory(cat.id, false);
      setActive((p) => p.filter((c) => c.id !== cat.id));
      setArchived((p) => [...p, { ...cat, isActive: false }]);
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function performHardDelete() {
    const cat = hardDelTarget;
    if (!cat) return;
    setHardDelTarget(null);
    setDeletingId(cat.id);
    try {
      const r = await adminApi.deleteCategory(cat.id, true);
      const data = r.data?.data ?? r.data;
      setActive((p) => p.filter((c) => c.id !== cat.id));
      setArchived((p) => p.filter((c) => c.id !== cat.id));
      if (data?.eventsDeleted > 0 || data?.interestsDeleted > 0) {
        Alert.alert(
          'Categoria eliminada',
          `Se eliminaron ${data.eventsDeleted ?? 0} eventos y ${data.interestsDeleted ?? 0} intereses de usuarios.`,
        );
      }
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function restoreCat(cat: any) {
    setDeletingId(cat.id);
    try {
      await adminApi.restoreCategory(cat.id);
      setArchived((p) => p.filter((c) => c.id !== cat.id));
      setActive((p) => [...p, { ...cat, isActive: true }]);
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setDeletingId(null);
    }
  }

  const shown = tab === 'active' ? active : archived;

  const segments: SegmentOption<Tab>[] = [
    { value: 'active', label: `Activas (${active.length})` },
    { value: 'archived', label: `Archivadas (${archived.length})` },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Categorias"
        kicker={`${active.length} activas · ${archived.length} archivadas`}
        onBack={goBack}
        right={
          <Pressable
            onPress={() => setShowCreate(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Nueva categoria"
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Feather name="plus" size={18} color={Colors.textInverse} />
          </Pressable>
        }
      />

      <View style={styles.tabsWrap}>
        <SegmentedControl<Tab> value={tab} onChange={setTab} options={segments} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: Spacing[5], paddingBottom: 120, gap: Spacing[2] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={Colors.accentPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather
                name={tab === 'active' ? 'tag' : 'archive'}
                size={32}
                color={Colors.textMuted}
              />
              <Subhead style={{ marginTop: Spacing[2] }}>
                {tab === 'active' ? 'Sin categorias activas' : 'Sin categorias archivadas'}
              </Subhead>
              <Caption tone="muted" align="center" style={{ paddingHorizontal: 40 }}>
                {tab === 'active'
                  ? 'Crea la primera con el boton + arriba.'
                  : 'Cuando archives una categoria aparecera aqui.'}
              </Caption>
            </View>
          }
          renderItem={({ item }) => {
            const isArchived = !item.isActive;
            return (
              <View style={[styles.card, isArchived && { opacity: 0.7 }]}>
                <View
                  style={[styles.colorDot, { backgroundColor: item.color || Colors.accentPrimary }]}
                />
                <View style={{ flex: 1 }}>
                  <Subhead numberOfLines={1}>{item.name}</Subhead>
                  {item.nameEn && item.nameEn !== item.name && (
                    <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
                      {item.nameEn}
                    </Caption>
                  )}
                </View>
                {deletingId === item.id ? (
                  <ActivityIndicator color={Colors.accentDanger} size="small" />
                ) : isArchived ? (
                  <Pressable
                    onPress={() => restoreCat(item)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Restaurar"
                    style={({ pressed }) => [styles.restoreBtn, pressed && styles.pressed]}
                  >
                    <Feather name="rotate-ccw" size={12} color={Colors.accentSuccess} />
                    <Kicker tone="success" style={{ fontSize: 10 }}>Restaurar</Kicker>
                  </Pressable>
                ) : (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => setArchiveTarget(item)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Archivar"
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    >
                      <Feather name="archive" size={15} color={Colors.accentPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => setHardDelTarget(item)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Eliminar permanente"
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    >
                      <Feather name="trash-2" size={15} color={Colors.accentDanger} />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Sheet open={showCreate} onClose={() => setShowCreate(false)} title="Nueva categoria">
        <View style={{ gap: Spacing[3] }}>
          <Caption tone="muted">Elige un nombre y un color distintivo</Caption>
          <Input
            label="Nombre"
            value={newName}
            onChangeText={setNewName}
            placeholder="Ej. Noche de salsa"
            autoFocus
          />

          <View>
            <Kicker style={{ marginBottom: Spacing[2] }}>Color</Kicker>
            <View style={styles.palette}>
              {COLOR_PALETTE.map((c) => {
                const active = newColor === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setNewColor(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Color ${c}`}
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.paletteDot,
                      { backgroundColor: c },
                      active && styles.paletteDotActive,
                    ]}
                  >
                    {active && <Feather name="check" size={14} color="#fff" />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.preview}>
            <View style={[styles.previewDot, { backgroundColor: newColor }]} />
            <Body size="sm" weight="semiBold">
              {newName || 'Vista previa'}
            </Body>
          </View>

          <Button
            label={creating ? 'Creando...' : 'Crear categoria'}
            variant="primary"
            onPress={createCategory}
            loading={creating}
            disabled={!newName.trim() || creating}
            leftIcon={<Feather name="plus" size={14} color={Colors.textInverse} />}
          />
        </View>
      </Sheet>

      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={performArchive}
        title="Archivar categoría"
        description={`¿Archivar "${archiveTarget?.name ?? ''}"? Los eventos existentes la conservarán, pero ya no aparecerá al crear nuevos.`}
        confirmLabel="Archivar"
        confirmVariant="danger"
      />
      <ConfirmDialog
        open={!!hardDelTarget}
        onClose={() => setHardDelTarget(null)}
        onConfirm={performHardDelete}
        title="Eliminar permanentemente"
        description={`¿Eliminar "${hardDelTarget?.name ?? ''}" y TODOS los eventos asociados? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar todo"
        confirmVariant="danger"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabsWrap: { paddingHorizontal: Spacing[5], paddingVertical: Spacing[3] },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  colorDot: { width: 18, height: 18, borderRadius: 9 },

  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing[2],
    paddingVertical: 6,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(111,168,138,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(111,168,138,0.30)',
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: 4, paddingHorizontal: 40 },

  // Sheet
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  paletteDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteDotActive: { borderWidth: 3, borderColor: '#fff' },

  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
  },
  previewDot: { width: 14, height: 14, borderRadius: 7 },
});
