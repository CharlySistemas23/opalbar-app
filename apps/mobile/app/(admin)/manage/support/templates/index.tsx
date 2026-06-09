import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Modal, TextInput, ScrollView, Pressable,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors } from '@/constants/tokens';
import { ConfirmDialog } from '@/components/ui';
import { AdminHeader } from '@/components/admin';

const CATEGORY_OPTIONS = [
  { value: 'GREETING', label: 'Saludo', color: Colors.accentPrimary },
  { value: 'APOLOGY', label: 'Disculpa', color: Colors.accentChampagne },
  { value: 'CLOSURE', label: 'Cierre', color: Colors.accentInfo },
  { value: 'INFO', label: 'Información', color: Colors.accentChampagne },
  { value: 'OFFER', label: 'Oferta', color: Colors.accentSuccess },
];

export default function QuickRepliesList() {
  const goBack = useSafeBack('/(admin)/manage/support');
  const [replies, setReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ id: string; title: string } | null>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.quickReplies();
      setReplies(r.data?.data ?? r.data ?? []);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openNew() {
    setEditId(null);
    setEditTitle('');
    setEditBody('');
    setEditCategory(null);
    setShowEdit(true);
  }

  function openEdit(r: any) {
    setEditId(r.id);
    setEditTitle(r.title);
    setEditBody(r.body);
    setEditCategory(r.category ?? null);
    setShowEdit(true);
  }

  async function save() {
    if (!editTitle.trim() || !editBody.trim()) {
      Alert.alert('Faltan datos', 'Título y mensaje son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const payload = { title: editTitle.trim(), body: editBody.trim(), category: editCategory ?? undefined };
      if (editId) {
        await adminApi.updateQuickReply(editId, payload);
      } else {
        await adminApi.createQuickReply(payload);
      }
      setShowEdit(false);
      await load();
    } catch (err) { Alert.alert('Error', apiError(err)); }
    finally { setSaving(false); }
  }

  async function performDelete() {
    if (!confirmDel) return;
    const id = confirmDel.id;
    setConfirmDel(null);
    try {
      await adminApi.deleteQuickReply(id);
      setReplies((p) => p.filter((x) => x.id !== id));
    } catch (err) {
      Alert.alert('Error', apiError(err));
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Plantillas de respuesta"
        kicker={`${replies.length} disponibles`}
        onBack={goBack}
        right={
          <Pressable
            onPress={openNew}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Nueva plantilla"
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="plus" size={18} color={Colors.textInverse} />
          </Pressable>
        }
      />

      <View style={styles.hint}>
        <Feather name="zap" size={13} color={Colors.accentPrimary} />
        <Text style={styles.hintText}>
          Estas plantillas aparecen con el botón zap en el chat de soporte.
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={replies}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="zap" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Sin plantillas</Text>
              <Text style={styles.emptyText}>Crea la primera para responder tickets en segundos.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cat = CATEGORY_OPTIONS.find((c) => c.value === item.category);
            return (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  {cat && (
                    <View style={[styles.catTag, { backgroundColor: cat.color + '20' }]}>
                      <Text style={[styles.catLbl, { color: cat.color }]}>{cat.label.toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                </View>
                <Text style={styles.cardBody} numberOfLines={3}>{item.body}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                    <Feather name="edit-2" size={13} color={Colors.accentPrimary} />
                    <Text style={styles.editLbl}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.delBtn} onPress={() => setConfirmDel({ id: item.id, title: item.title })}>
                    <Feather name="trash-2" size={13} color={Colors.accentDanger} />
                    <Text style={styles.delLbl}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal visible={showEdit} transparent animationType="fade" onRequestClose={() => setShowEdit(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowEdit(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>
                {editId ? 'Editar plantilla' : 'Nueva plantilla'}
              </Text>
              <TouchableOpacity onPress={() => setShowEdit(false)} hitSlop={10}>
                <Feather name="x" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.mLbl}>TÍTULO</Text>
            <TextInput
              style={styles.mInp}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Ej. Saludo inicial"
              placeholderTextColor={Colors.textMuted}
              maxLength={80}
            />

            <Text style={styles.mLbl}>MENSAJE</Text>
            <TextInput
              style={[styles.mInp, { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }]}
              value={editBody}
              onChangeText={setEditBody}
              placeholder="Ej. ¡Hola! Gracias por contactarnos. ¿En qué podemos ayudarte?"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={1000}
            />

            <Text style={styles.mLbl}>CATEGORÍA (OPCIONAL)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATEGORY_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.catChip,
                    editCategory === c.value && { backgroundColor: c.color + '20', borderColor: c.color },
                  ]}
                  onPress={() => setEditCategory(editCategory === c.value ? null : c.value)}
                >
                  <Text style={[styles.catChipLbl, editCategory === c.value && { color: c.color }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, (!editTitle.trim() || !editBody.trim() || saving) && { opacity: 0.5 }]}
              onPress={save}
              disabled={!editTitle.trim() || !editBody.trim() || saving}
            >
              {saving
                ? <ActivityIndicator color={Colors.textInverse} size="small" />
                : <Text style={styles.saveLbl}>{editId ? 'Guardar cambios' : 'Crear plantilla'}</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={performDelete}
        title="Eliminar plantilla"
        description={`Eliminar "${confirmDel?.title ?? ''}"? Ya no podra insertarse en el chat.`}
        confirmLabel="Eliminar"
        confirmVariant="danger"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  addBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },

  hint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(201,169,97,0.10)',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(201,169,97,0.30)',
  },
  hintText: { color: Colors.textSecondary, fontSize: 11, flex: 1 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  catTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  cardBody: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  cardActions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 32, borderRadius: 8,
    backgroundColor: 'rgba(201,169,97,0.12)',
    borderWidth: 1, borderColor: 'rgba(201,169,97,0.30)',
  },
  editLbl: { color: Colors.accentPrimary, fontSize: 11, fontWeight: '700' },
  delBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 32, borderRadius: 8,
    backgroundColor: 'rgba(196,104,104,0.10)',
    borderWidth: 1, borderColor: 'rgba(196,104,104,0.30)',
  },
  delLbl: { color: Colors.accentDanger, fontSize: 11, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center' },

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
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  mLbl: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 6 },
  mInp: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 14,
  },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  catChipLbl: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  saveBtn: {
    marginTop: 10,
    height: 48, borderRadius: 12,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  saveLbl: { color: Colors.textInverse, fontSize: 14, fontWeight: '800' },
});
