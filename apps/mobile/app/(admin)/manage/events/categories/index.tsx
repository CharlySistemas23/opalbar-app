import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, eventsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors } from '@/constants/tokens';

type Tab = 'active' | 'archived';

const COLOR_PALETTE = [
  '#F4A340', '#60A5FA', '#A855F7', '#38C793',
  '#E45858', '#EC4899', '#FFD700', '#14B8A6',
];

export default function AdminCategoriesList() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('active');
  const [active, setActive] = useState<any[]>([]);
  const [archived, setArchived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New category modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [creating, setCreating] = useState(false);

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
    } finally { setCreating(false); }
  }

  function archiveCat(cat: any) {
    Alert.alert(
      'Archivar categoría',
      `¿Archivar "${cat.name}"? Los eventos existentes la conservarán, pero ya no aparecerá al crear nuevos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar', style: 'destructive',
          onPress: async () => {
            setDeletingId(cat.id);
            try {
              await adminApi.deleteCategory(cat.id, false);
              setActive((p) => p.filter((c) => c.id !== cat.id));
              setArchived((p) => [...p, { ...cat, isActive: false }]);
            } catch (err) { Alert.alert('Error', apiError(err)); }
            finally { setDeletingId(null); }
          },
        },
      ],
    );
  }

  function hardDeleteCat(cat: any) {
    Alert.alert(
      'Eliminar permanentemente',
      `¿Eliminar "${cat.name}" y TODOS los eventos asociados? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todo', style: 'destructive',
          onPress: async () => {
            setDeletingId(cat.id);
            try {
              const r = await adminApi.deleteCategory(cat.id, true);
              const data = r.data?.data ?? r.data;
              setActive((p) => p.filter((c) => c.id !== cat.id));
              setArchived((p) => p.filter((c) => c.id !== cat.id));
              if (data?.eventsDeleted > 0 || data?.interestsDeleted > 0) {
                Alert.alert(
                  'Categoría eliminada',
                  `Se eliminaron ${data.eventsDeleted ?? 0} eventos y ${data.interestsDeleted ?? 0} intereses de usuarios.`,
                );
              }
            } catch (err) { Alert.alert('Error', apiError(err)); }
            finally { setDeletingId(null); }
          },
        },
      ],
    );
  }

  async function restoreCat(cat: any) {
    setDeletingId(cat.id);
    try {
      await adminApi.restoreCategory(cat.id);
      setArchived((p) => p.filter((c) => c.id !== cat.id));
      setActive((p) => [...p, { ...cat, isActive: true }]);
    } catch (err) { Alert.alert('Error', apiError(err)); }
    finally { setDeletingId(null); }
  }

  const shown = tab === 'active' ? active : archived;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Categorías</Text>
          <Text style={styles.subtitle}>{active.length} activas · {archived.length} archivadas</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowCreate(true)}
          hitSlop={10}
        >
          <Feather name="plus" size={20} color={Colors.textInverse} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabLbl, tab === 'active' && styles.tabLblActive]}>
            Activas ({active.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'archived' && styles.tabActive]}
          onPress={() => setTab('archived')}
        >
          <Text style={[styles.tabLbl, tab === 'archived' && styles.tabLblActive]}>
            Archivadas ({archived.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name={tab === 'active' ? 'tag' : 'archive'} size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {tab === 'active' ? 'Sin categorías activas' : 'Sin categorías archivadas'}
              </Text>
              <Text style={styles.emptyText}>
                {tab === 'active'
                  ? 'Crea la primera con el botón + arriba.'
                  : 'Cuando archives una categoría aparecerá aquí.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isArchived = !item.isActive;
            return (
              <View style={[styles.card, isArchived && { opacity: 0.7 }]}>
                <View style={[styles.colorDot, { backgroundColor: item.color || Colors.accentPrimary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName} numberOfLines={1}>{item.name}</Text>
                  {item.nameEn && item.nameEn !== item.name && (
                    <Text style={styles.catNameEn} numberOfLines={1}>{item.nameEn}</Text>
                  )}
                </View>
                {deletingId === item.id ? (
                  <ActivityIndicator color={Colors.accentDanger} size="small" />
                ) : isArchived ? (
                  <TouchableOpacity style={styles.restoreBtn} onPress={() => restoreCat(item)} hitSlop={8}>
                    <Feather name="rotate-ccw" size={13} color={Colors.accentSuccess} />
                    <Text style={styles.restoreLbl}>Restaurar</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => archiveCat(item)} hitSlop={6}>
                      <Feather name="archive" size={15} color={Colors.accentPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => hardDeleteCat(item)} hitSlop={6}>
                      <Feather name="trash-2" size={15} color={Colors.accentDanger} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowCreate(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>Nueva categoría</Text>
                <Text style={styles.modalSub}>Elige un nombre y un color distintivo</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreate(false)} hitSlop={10}>
                <Feather name="x" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>NOMBRE</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Ej. Noche de salsa"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />

            <Text style={styles.modalLabel}>COLOR</Text>
            <View style={styles.palette}>
              {COLOR_PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.paletteDot, { backgroundColor: c }, newColor === c && styles.paletteDotActive]}
                  onPress={() => setNewColor(c)}
                >
                  {newColor === c && <Feather name="check" size={14} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.preview}>
              <View style={[styles.previewDot, { backgroundColor: newColor }]} />
              <Text style={styles.previewName}>{newName || 'Vista previa'}</Text>
            </View>

            <TouchableOpacity
              style={[styles.createBtn, (!newName.trim() || creating) && { opacity: 0.5 }]}
              onPress={createCategory}
              disabled={!newName.trim() || creating}
            >
              {creating
                ? <ActivityIndicator color={Colors.textInverse} size="small" />
                : <>
                    <Feather name="plus" size={16} color={Colors.textInverse} />
                    <Text style={styles.createLbl}>Crear categoría</Text>
                  </>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  subtitle: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: 'rgba(244,163,64,0.15)', borderColor: Colors.accentPrimary },
  tabLbl: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  tabLblActive: { color: Colors.accentPrimary },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  colorDot: { width: 18, height: 18, borderRadius: 9 },
  catName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  catNameEn: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },

  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(56,199,147,0.12)',
    borderWidth: 1, borderColor: 'rgba(56,199,147,0.3)',
  },
  restoreLbl: { color: Colors.accentSuccess, fontSize: 11, fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8, paddingHorizontal: 40 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  modalHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 4,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  modalSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  modalLabel: {
    color: Colors.textMuted, fontSize: 10, fontWeight: '700',
    letterSpacing: 1, marginTop: 6,
  },
  modalInput: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 14,
  },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  paletteDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  paletteDotActive: { borderWidth: 3, borderColor: '#fff' },

  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10,
    backgroundColor: Colors.bgElevated,
    marginTop: 8,
  },
  previewDot: { width: 14, height: 14, borderRadius: 7 },
  previewName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
    marginTop: 10,
  },
  createLbl: { color: Colors.textInverse, fontSize: 14, fontWeight: '800' },
});
