// ─────────────────────────────────────────────
//  PhonePicker — input internacional con selector de país.
//
//  · Botón izquierdo abre bottom-sheet con búsqueda por nombre/código/lada
//  · Pre-selecciona México (MX) o el país detectado por locale del dispositivo
//  · Auto-formatea el número mientras se escribe (AsYouType)
//  · Emite onChange con el valor en formato E.164 (+523221234567)
//  · Bandera = emoji generado del ISO-2 (no necesita assets)
// ─────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { Colors, Radius } from '@/constants/tokens';

// ── Lista de países priorizados arriba en el picker ────────────
// MX primero porque es el target principal; los demás son países
// frecuentes en venues / turismo de Vallarta.
const PRIORITY_COUNTRIES: CountryCode[] = ['MX', 'US', 'CA', 'ES', 'AR', 'CO', 'CL', 'BR'];

// Nombres en español para los países más comunes. Para los demás
// fallback al ISO. Ampliable luego si hace falta.
const COUNTRY_NAMES_ES: Partial<Record<CountryCode, string>> = {
  MX: 'México',
  US: 'Estados Unidos',
  CA: 'Canadá',
  ES: 'España',
  AR: 'Argentina',
  CO: 'Colombia',
  CL: 'Chile',
  PE: 'Perú',
  BR: 'Brasil',
  GT: 'Guatemala',
  HN: 'Honduras',
  SV: 'El Salvador',
  CR: 'Costa Rica',
  PA: 'Panamá',
  CU: 'Cuba',
  DO: 'República Dominicana',
  VE: 'Venezuela',
  EC: 'Ecuador',
  BO: 'Bolivia',
  PY: 'Paraguay',
  UY: 'Uruguay',
  PR: 'Puerto Rico',
  GB: 'Reino Unido',
  FR: 'Francia',
  DE: 'Alemania',
  IT: 'Italia',
  PT: 'Portugal',
  JP: 'Japón',
  CN: 'China',
};

function flagEmoji(iso2: string): string {
  // Cada letra A-Z se mapea a un Regional Indicator Symbol Letter.
  // Concatenadas, dos letras forman el emoji de bandera.
  if (iso2.length !== 2) return '🏳️';
  const codePoints = iso2
    .toUpperCase()
    .split('')
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function countryLabel(iso: CountryCode): string {
  return COUNTRY_NAMES_ES[iso] ?? iso;
}

interface PhonePickerProps {
  value: string; // E.164 (+523221234567) o vacío
  onChange: (e164: string, isValid: boolean) => void;
  placeholder?: string;
  defaultCountry?: CountryCode;
  hasError?: boolean;
  isValid?: boolean;
}

export function PhonePicker({
  value,
  onChange,
  placeholder = '322 123 4567',
  defaultCountry = 'MX',
  hasError,
  isValid,
}: PhonePickerProps) {
  // Si hay valor inicial, deduce el país de ahí. Si no, usa default.
  const initialCountry = useMemo<CountryCode>(() => {
    if (value) {
      const parsed = parsePhoneNumberFromString(value);
      if (parsed?.country) return parsed.country;
    }
    return defaultCountry;
  }, [defaultCountry, value]);

  const [country, setCountry] = useState<CountryCode>(initialCountry);
  const [localNumber, setLocalNumber] = useState<string>(() => {
    if (!value) return '';
    const parsed = parsePhoneNumberFromString(value);
    return parsed?.formatNational() ?? '';
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  // ── Países ordenados: prioritarios primero, luego el resto alfabético ──
  const allCountries = useMemo<CountryCode[]>(() => {
    const all = getCountries();
    const prio = PRIORITY_COUNTRIES.filter((c) => all.includes(c));
    const rest = all
      .filter((c) => !PRIORITY_COUNTRIES.includes(c))
      .sort((a, b) => countryLabel(a).localeCompare(countryLabel(b), 'es'));
    return [...prio, ...rest];
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCountries;
    return allCountries.filter((iso) => {
      const name = countryLabel(iso).toLowerCase();
      const code = `+${getCountryCallingCode(iso)}`;
      return (
        name.includes(q) ||
        iso.toLowerCase().includes(q) ||
        code.includes(q.replace(/\s/g, ''))
      );
    });
  }, [allCountries, search]);

  // ── Formato AsYouType cuando el usuario escribe ───────────────
  function handleLocalChange(raw: string) {
    const digits = raw.replace(/\D/g, '');
    const formatter = new AsYouType(country);
    const formatted = formatter.input(digits);
    setLocalNumber(formatted);

    const dialCode = `+${getCountryCallingCode(country)}`;
    const e164 = digits.length > 0 ? `${dialCode}${digits}` : '';
    onChange(e164, e164 ? isValidPhoneNumber(e164, country) : false);
  }

  function handleSelectCountry(iso: CountryCode) {
    setCountry(iso);
    setPickerOpen(false);
    setSearch('');

    // Re-emit con la nueva lada usando el número local actual
    const digits = localNumber.replace(/\D/g, '');
    const dialCode = `+${getCountryCallingCode(iso)}`;
    const e164 = digits.length > 0 ? `${dialCode}${digits}` : '';
    onChange(e164, e164 ? isValidPhoneNumber(e164, iso) : false);

    // Re-formatea con la nueva máscara
    const formatter = new AsYouType(iso);
    setLocalNumber(formatter.input(digits));
  }

  // Si cambia el `value` desde fuera (controlled), sincroniza
  useEffect(() => {
    if (!value) return;
    const parsed = parsePhoneNumberFromString(value);
    if (parsed?.country && parsed.country !== country) {
      setCountry(parsed.country);
    }
    if (parsed) {
      setLocalNumber(parsed.formatNational());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <>
      <View
        style={[
          styles.container,
          hasError ? styles.containerError : null,
          isValid ? styles.containerValid : null,
        ]}
      >
        <TouchableOpacity
          style={styles.codeButton}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.7}
          hitSlop={6}
        >
          <Text style={styles.flag}>{flagEmoji(country)}</Text>
          <Text style={styles.dialCode}>+{getCountryCallingCode(country)}</Text>
          <Feather name="chevron-down" size={14} color={Colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TextInput
          style={styles.numberInput}
          value={localNumber}
          onChangeText={handleLocalChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="phone-pad"
          autoComplete="tel-national"
          maxLength={20}
        />
      </View>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
            >
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Selecciona país</Text>
                <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={10}>
                  <Feather name="x" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchBox}>
                <Feather name="search" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar país o código (+52, MX, México)…"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
                    <Feather name="x-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filtered}
                keyExtractor={(iso) => iso}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                maxToRenderPerBatch={30}
                renderItem={({ item: iso }) => (
                  <TouchableOpacity
                    style={[styles.row, country === iso && styles.rowSelected]}
                    onPress={() => handleSelectCountry(iso)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.rowFlag}>{flagEmoji(iso)}</Text>
                    <Text style={styles.rowName}>{countryLabel(iso)}</Text>
                    <Text style={styles.rowCode}>+{getCountryCallingCode(iso)}</Text>
                    {country === iso && (
                      <Feather name="check" size={16} color={Colors.accentPrimary} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Sin resultados</Text>
                  </View>
                }
              />
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingLeft: 8,
    paddingRight: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  containerValid: { borderColor: Colors.accentSuccess },
  containerError: { borderColor: Colors.accentDanger },

  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.button - 4,
  },
  flag: { fontSize: 22, lineHeight: 26 },
  dialCode: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },

  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
    marginHorizontal: 6,
  },

  numberInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    padding: 0,
    paddingLeft: 4,
  },

  // ── Modal ────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bgPrimary,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, padding: 0 },

  list: { paddingHorizontal: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowSelected: { backgroundColor: Colors.bgCard },
  rowFlag: { fontSize: 24, lineHeight: 28 },
  rowName: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  rowCode: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },

  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
