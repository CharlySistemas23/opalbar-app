import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Switch, Image, Modal } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { adminApi, eventsApi, venueApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { DateTimeField } from '@/components/DateTimeField';
import { useAuthStore } from '@/stores/auth.store';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors } from '@/constants/tokens';
import { uploadImage, UploadError } from '@/utils/uploadImage';
import { ErrorState } from '@/components/ErrorState';
import { OptionSheet } from '@/components/admin';
import type { OptionSheetItem } from '@/components/admin';

interface EventFormProps {
  eventId?: string;
}

const TITLE_MIN = 3;
const DESCRIPTION_MIN = 10;

export function EventForm({ eventId }: EventFormProps) {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage/events');
  const me = useAuthStore((s) => s.user);
  // Backend: events create/update are open to MODERATOR too — only hard
  // delete is ADMIN/SUPER_ADMIN-only (events.controller.ts `@Delete(':id')`).
  const canDelete = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const isEdit = !!eventId;

  const [showVenuePicker, setShowVenuePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [venueId, setVenueId] = useState('');
  const [venueName, setVenueName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [pointsReward, setPointsReward] = useState('50');
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED' | 'FULL'>('PUBLISHED');

  const [venues, setVenues] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [manageTab, setManageTab] = useState<'active' | 'archived'>('active');
  const [archivedCategories, setArchivedCategories] = useState<any[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  async function loadArchived() {
    setLoadingArchived(true);
    try {
      const r = await adminApi.allCategories();
      const all = r.data?.data ?? r.data ?? [];
      setArchivedCategories(all.filter((c: any) => !c.isActive));
    } catch (err) {
      Alert.alert('Error', apiError(err));
    }
    finally { setLoadingArchived(false); }
  }

  async function restoreCategory(cat: any) {
    try {
      await adminApi.restoreCategory(cat.id);
      setArchivedCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setCategories((prev) => [...prev, { ...cat, isActive: true }]);
    } catch (err: any) {
      Alert.alert('Error', apiError(err));
    }
  }

  async function runCategoryDelete(cat: any, hard: boolean) {
    setDeletingCategoryId(cat.id);
    try {
      const r = await adminApi.deleteCategory(cat.id, hard);
      const data = r.data?.data ?? r.data;
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      if (categoryId === cat.id) { setCategoryId(''); setCategoryName(''); }
      if (hard && (data?.eventsDeleted > 0 || data?.interestsDeleted > 0)) {
        Alert.alert(
          'Categoría eliminada',
          `Se eliminaron ${data.eventsDeleted ?? 0} eventos y ${data.interestsDeleted ?? 0} intereses de usuarios.`,
        );
      }
    } catch (err: any) {
      Alert.alert('Error', apiError(err));
    } finally { setDeletingCategoryId(null); }
  }

  function confirmArchiveCategory(cat: any) {
    Alert.alert(
      'Archivar categoría',
      `¿Archivar "${cat.name}"? Los eventos existentes la conservarán, pero ya no aparecerá al crear nuevos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Archivar', style: 'destructive', onPress: () => runCategoryDelete(cat, false) },
      ],
    );
  }

  function confirmHardDeleteCategory(cat: any) {
    Alert.alert(
      'Eliminar permanentemente',
      `¿Eliminar "${cat.name}" y TODOS los eventos asociados? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar todo', style: 'destructive', onPress: () => runCategoryDelete(cat, true) },
      ],
    );
  }

  async function createCategoryNow() {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      const r = await adminApi.createCategory({ name });
      const newCat = r.data?.data ?? r.data;
      setCategories((prev) => [...prev, newCat]);
      setCategoryId(newCat.id);
      setCategoryName(newCat.name);
      setNewCategoryName('');
      setShowNewCategory(false);
    } catch (err: any) {
      Alert.alert('Error', apiError(err));
    } finally { setCreatingCategory(false); }
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
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
          const url = await uploadImage(result.assets[0].uri, { kind: 'event' });
          setImageUrl(url);
        } catch (err) {
          const msg = err instanceof UploadError ? err.message : 'Error';
          Alert.alert('No se pudo subir', msg);
        }
      }
    } finally { setPickingImage(false); }
  }

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [vRes, cRes] = await Promise.all([
      venueApi.list({}).catch(() => null),
      eventsApi.categories().catch(() => null),
    ]);
    const vs = vRes?.data?.data?.data ?? vRes?.data?.data ?? [];
    const cs = cRes?.data?.data ?? [];
    setVenues(vs);
    setCategories(cs);
    if (!isEdit) {
      if (vs[0]) { setVenueId(vs[0].id); setVenueName(vs[0].name); }
      if (cs[0]) { setCategoryId(cs[0].id); setCategoryName(cs[0].name); }
      setLoading(false);
      return;
    }

    if (eventId) {
      try {
        const r = await eventsApi.get(eventId);
        const e = r.data?.data;
        if (e) {
          setTitle(e.title ?? '');
          setTitleEn(e.titleEn ?? '');
          setDescription(e.description ?? '');
          setImageUrl(e.imageUrl ?? '');
          setVenueId(e.venueId ?? '');
          setVenueName(e.venue?.name ?? '');
          setCategoryId(e.categoryId ?? '');
          setCategoryName(e.category?.name ?? '');
          setStartDate(e.startDate ? toLocal(e.startDate) : '');
          setEndDate(e.endDate ? toLocal(e.endDate) : '');
          setMaxCapacity(e.maxCapacity ? String(e.maxCapacity) : '');
          setPointsReward(String(e.pointsReward ?? 50));
          setIsFree(!!e.isFree);
          setPrice(e.price ? String(e.price) : '');
          setStatus(e.status ?? 'PUBLISHED');
        }
      } catch (err) {
        // A failed edit-load must not silently fall back to a blank "new
        // event" form — that would let someone overwrite an existing event
        // with empty fields without realizing the load actually failed.
        setLoadError(apiError(err));
      }
      finally { setLoading(false); }
    }
  }, [eventId, isEdit]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  async function handleSave() {
    if (!title.trim() || !description.trim() || !venueId || !categoryId || !startDate || !endDate) {
      Alert.alert('Faltan datos', 'Completa los campos requeridos.');
      return;
    }
    if (title.trim().length < TITLE_MIN) {
      Alert.alert('Nombre muy corto', `Usa al menos ${TITLE_MIN} caracteres.`);
      return;
    }
    if (description.trim().length < DESCRIPTION_MIN) {
      Alert.alert('Descripción muy corta', `Usa al menos ${DESCRIPTION_MIN} caracteres.`);
      return;
    }
    setSaving(true);
    try {
      // The service only writes a field when it's !== undefined, so an
      // emptied optional field must be sent as `null` (not omitted/undefined)
      // to actually clear it — otherwise the old value just sticks around.
      const payload: any = {
        title: title.trim(),
        titleEn: titleEn.trim() || null,
        description: description.trim(),
        imageUrl: imageUrl.trim() || null,
        venueId,
        categoryId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        maxCapacity: maxCapacity ? Number(maxCapacity) : null,
        pointsReward: Number(pointsReward) || 0,
        isFree,
        price: !isFree && price ? Number(price) : null,
        status,
      };
      if (isEdit && eventId) {
        await adminApi.updateEvent(eventId, payload);
      } else {
        await adminApi.createEvent(payload);
      }
      goBack();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!eventId) return;
    Alert.alert('Borrar evento', '¿Estás seguro? Esta acción es permanente.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar', style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await adminApi.deleteEvent(eventId);
            goBack();
          } catch (err) {
            Alert.alert('Error', apiError(err));
          } finally { setDeleting(false); }
        },
      },
    ]);
  }

  // Alert.alert silently truncates past 3 buttons on Android — venue/category
  // lists (and the extra category actions) blew past that easily. OptionSheet
  // replaces all three pickers below.
  function pickVenue() { setShowVenuePicker(true); }
  function pickCategory() { setShowCategoryPicker(true); }
  function pickStatus() { setShowStatusPicker(true); }

  const venueOptions: OptionSheetItem<string>[] = venues.map((v) => ({ value: v.id, label: v.name }));
  const categoryOptions: OptionSheetItem<string>[] = [
    ...categories.map((c) => ({ value: c.id, label: c.name })),
    { value: '__new__', label: 'Nueva categoría…', icon: 'plus-circle' as const, tone: 'accent' as const },
    { value: '__manage__', label: 'Administrar categorías…', icon: 'sliders' as const },
  ];
  const statusOptions: OptionSheetItem<typeof status>[] = [
    { value: 'PUBLISHED', label: 'Publicado' },
    { value: 'DRAFT', label: 'Borrador' },
    { value: 'CANCELLED', label: 'Cancelado', tone: 'danger' },
    { value: 'COMPLETED', label: 'Finalizado' },
    { value: 'FULL', label: 'Cupo lleno' },
  ];

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  if (loadError) return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={goBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Editar Evento' : 'Nuevo Evento'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ErrorState message={loadError} onRetry={loadEvent} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={goBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Editar Evento' : 'Nuevo Evento'}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {isEdit && eventId && (
            <TouchableOpacity
              style={styles.previewBtn}
              onPress={() => router.push(`/(app)/events/${eventId}` as never)}
              hitSlop={8}
            >
              <Feather name="eye" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
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
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Field label="Nombre del evento *" value={title} onChangeText={setTitle} placeholder="Jazz & Cocktails Night" />
        <Field label="Nombre (EN)" value={titleEn} onChangeText={setTitleEn} placeholder="Jazz & Cocktails Night" />

        <PickerField label="Categoría *" value={categoryName || 'Seleccionar…'} onPress={pickCategory} />
        <Field label="Descripción *" value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="Cuenta qué va a pasar…" />

        <View>
          <Text style={styles.fieldLabel}>Imagen del evento</Text>
          {imageUrl ? (
            <View style={styles.imgBox}>
              <Image source={{ uri: imageUrl }} style={styles.imgPreview} />
              <TouchableOpacity style={styles.imgRemove} onPress={() => setImageUrl('')} hitSlop={8}>
                <Feather name="x" size={14} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.imgChange} onPress={pickImage} disabled={pickingImage} activeOpacity={0.85}>
                {pickingImage
                  ? <ActivityIndicator color={Colors.accentPrimary} size="small" />
                  : <>
                      <Feather name="refresh-cw" size={14} color={Colors.accentPrimary} />
                      <Text style={styles.imgChangeLbl}>Cambiar foto</Text>
                    </>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.imgUpload} onPress={pickImage} disabled={pickingImage} activeOpacity={0.85}>
              {pickingImage
                ? <ActivityIndicator color={Colors.accentPrimary} />
                : <>
                    <Feather name="image" size={22} color={Colors.accentPrimary} />
                    <Text style={styles.imgUploadTitle}>Subir imagen</Text>
                    <Text style={styles.imgUploadSub}>JPG/PNG · Recomendado 1600×900</Text>
                  </>}
            </TouchableOpacity>
          )}
        </View>

        <PickerField label="Venue *" value={venueName || 'Seleccionar…'} onPress={pickVenue} />

        <DateTimeField
          label="Inicio del evento *"
          value={startDate}
          onChange={setStartDate}
          placeholder="Elegir fecha y hora"
        />
        <DateTimeField
          label="Fin del evento *"
          value={endDate}
          onChange={setEndDate}
          placeholder="Elegir fecha y hora"
          minimumDate={startDate ? new Date(startDate) : undefined}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Cupo máx." value={maxCapacity} onChangeText={setMaxCapacity} keyboardType="number-pad" placeholder="150" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Puntos reward" value={pointsReward} onChangeText={setPointsReward} keyboardType="number-pad" />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Entrada libre</Text>
            <Text style={styles.fieldHint}>Si está off, el cover se cobra en la puerta.</Text>
          </View>
          <Switch
            value={isFree}
            onValueChange={setIsFree}
            trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
            thumbColor="#fff"
          />
        </View>

        {!isFree && (
          <Field label="Precio (MXN)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="150" />
        )}

        <PickerField label="Status" value={statusLabel(status)} onPress={pickStatus} />

        {isEdit && canDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting} activeOpacity={0.85}>
            {deleting
              ? <ActivityIndicator color={Colors.accentDanger} size="small" />
              : <><Feather name="trash-2" size={16} color={Colors.accentDanger} />
                  <Text style={styles.deleteLabel}>Borrar evento</Text></>}
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
        open={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        title="Elegir categoría"
        options={categoryOptions}
        value={categoryId}
        onSelect={(id) => {
          if (id === '__new__') { setShowNewCategory(true); return; }
          if (id === '__manage__') { setShowManageCategories(true); return; }
          const c = categories.find((x) => x.id === id);
          if (c) { setCategoryId(c.id); setCategoryName(c.name); }
        }}
      />

      <OptionSheet<typeof status>
        open={showStatusPicker}
        onClose={() => setShowStatusPicker(false)}
        title="Status del evento"
        options={statusOptions}
        value={status}
        onSelect={setStatus}
      />

      <Modal visible={showNewCategory} transparent animationType="fade" onRequestClose={() => setShowNewCategory(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva categoría</Text>
            <Text style={styles.modalSub}>Crea una categoría libre para tus eventos.</Text>
            <TextInput
              style={styles.modalInput}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Ej. Noche de salsa"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowNewCategory(false); setNewCategoryName(''); }}>
                <Text style={styles.modalCancelLbl}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (!newCategoryName.trim() || creatingCategory) && { opacity: 0.5 }]}
                onPress={createCategoryNow}
                disabled={!newCategoryName.trim() || creatingCategory}
              >
                {creatingCategory
                  ? <ActivityIndicator color={Colors.textInverse} size="small" />
                  : <Text style={styles.modalConfirmLbl}>Crear</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showManageCategories} transparent animationType="fade" onRequestClose={() => setShowManageCategories(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowManageCategories(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => { /* swallow tap */ }} style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Administrar categorías</Text>
              <TouchableOpacity onPress={() => setShowManageCategories(false)} hitSlop={10}>
                <Feather name="x" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.manageTabs}>
              <TouchableOpacity
                style={[styles.manageTab, manageTab === 'active' && styles.manageTabActive]}
                onPress={() => setManageTab('active')}
              >
                <Text style={[styles.manageTabLbl, manageTab === 'active' && styles.manageTabLblActive]}>
                  Activas ({categories.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.manageTab, manageTab === 'archived' && styles.manageTabActive]}
                onPress={() => { setManageTab('archived'); if (archivedCategories.length === 0) loadArchived(); }}
              >
                <Text style={[styles.manageTabLbl, manageTab === 'archived' && styles.manageTabLblActive]}>
                  Archivadas{archivedCategories.length ? ` (${archivedCategories.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {manageTab === 'active' ? (
              <>
                <View style={styles.legendBox}>
                  <View style={styles.legendRow}>
                    <View style={styles.legendIcon}>
                      <Feather name="archive" size={12} color={Colors.accentPrimary} />
                    </View>
                    <Text style={styles.legendText}>
                      <Text style={styles.legendLabel}>Archivar: </Text>
                      oculta del picker, conserva eventos existentes. Puedes restaurar después.
                    </Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendIcon, { backgroundColor: 'rgba(228,88,88,0.15)' }]}>
                      <Feather name="trash-2" size={12} color={Colors.accentDanger} />
                    </View>
                    <Text style={styles.legendText}>
                      <Text style={styles.legendLabel}>Eliminar: </Text>
                      borra la categoría y todos sus eventos. No se puede deshacer.
                    </Text>
                  </View>
                </View>
                <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 6 }}>
                  {categories.length === 0 ? (
                    <Text style={styles.emptyModalText}>No hay categorías activas.</Text>
                  ) : categories.map((c) => (
                    <View key={c.id} style={styles.catRow}>
                      <View style={[styles.catDot, { backgroundColor: c.color || Colors.accentPrimary }]} />
                      <Text style={styles.catName} numberOfLines={1}>{c.name}</Text>
                      {deletingCategoryId === c.id ? (
                        <ActivityIndicator color={Colors.accentDanger} size="small" />
                      ) : (
                        <>
                          <TouchableOpacity onPress={() => confirmArchiveCategory(c)} hitSlop={6} style={styles.catActionBtn}>
                            <Feather name="archive" size={16} color={Colors.accentPrimary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => confirmHardDeleteCategory(c)} hitSlop={6} style={styles.catActionBtn}>
                            <Feather name="trash-2" size={16} color={Colors.accentDanger} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <View style={styles.legendBox}>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendIcon, { backgroundColor: 'rgba(56,199,147,0.15)' }]}>
                      <Feather name="rotate-ccw" size={12} color={Colors.accentSuccess} />
                    </View>
                    <Text style={styles.legendText}>
                      Toca el icono para restaurar. Volverá a aparecer en el picker de categoría.
                    </Text>
                  </View>
                </View>
                <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 6 }}>
                  {loadingArchived ? (
                    <ActivityIndicator color={Colors.accentPrimary} style={{ marginVertical: 20 }} />
                  ) : archivedCategories.length === 0 ? (
                    <Text style={styles.emptyModalText}>No tienes categorías archivadas.</Text>
                  ) : archivedCategories.map((c) => (
                    <View key={c.id} style={[styles.catRow, { opacity: 0.7 }]}>
                      <View style={[styles.catDot, { backgroundColor: c.color || Colors.textMuted }]} />
                      <Text style={styles.catName} numberOfLines={1}>{c.name}</Text>
                      <TouchableOpacity onPress={() => restoreCategory(c)} hitSlop={6} style={styles.catRestoreBtn}>
                        <Feather name="rotate-ccw" size={13} color={Colors.accentSuccess} />
                        <Text style={styles.catRestoreLbl}>Restaurar</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={styles.modalConfirm} onPress={() => setShowManageCategories(false)}>
              <Text style={styles.modalConfirmLbl}>Cerrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, numberOfLines, keyboardType }: any) {
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
        numberOfLines={numberOfLines}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function PickerField({ label, value, onPress }: any) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.picker} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.pickerText}>{value}</Text>
        <Feather name="chevron-down" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function statusLabel(s: string) {
  switch (s) {
    case 'PUBLISHED': return 'Publicado';
    case 'DRAFT': return 'Borrador';
    case 'CANCELLED': return 'Cancelado';
    case 'COMPLETED': return 'Finalizado';
    case 'FULL': return 'Cupo lleno';
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

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: Colors.bgCard,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
    gap: 8,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  modalSub: { color: Colors.textMuted, fontSize: 12, marginBottom: 6 },
  modalInput: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 14,
    marginVertical: 6,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  modalCancelLbl: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
  modalConfirm: {
    flex: 1.3, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accentPrimary,
  },
  modalConfirmLbl: { color: Colors.textInverse, fontWeight: '800', fontSize: 13 },

  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.bgElevated,
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  catActionBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCard,
  },
  modalHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  legendBox: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 6, marginBottom: 4,
  },
  legendRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  legendIcon: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  legendText: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, flex: 1 },
  legendLabel: { color: Colors.textPrimary, fontWeight: '700' },

  manageTabs: {
    flexDirection: 'row', gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: 4,
  },
  manageTab: {
    flex: 1, paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: Colors.bgElevated,
  },
  manageTabActive: { backgroundColor: 'rgba(244,163,64,0.15)' },
  manageTabLbl: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  manageTabLblActive: { color: Colors.accentPrimary },

  emptyModalText: { color: Colors.textMuted, textAlign: 'center', padding: 20, fontSize: 13 },

  catRestoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(56,199,147,0.12)',
    borderWidth: 1, borderColor: 'rgba(56,199,147,0.3)',
  },
  catRestoreLbl: { color: Colors.accentSuccess, fontSize: 11, fontWeight: '800' },
});
