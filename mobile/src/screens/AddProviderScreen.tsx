import { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { PROVIDER_BADGES } from '../components/ProviderRow';
import { addProvider, getProviderById, updateProvider } from '../services/directoryService';
import {
  PROVIDER_TYPES, PROVIDER_TYPE_LABELS, extractMapsLink, isValidPhone, type ProviderType,
} from '../types/directory';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'AddProvider'>;

const NAME_PLACEHOLDERS: Record<ProviderType, string> = {
  hospital: 'e.g. City General Hospital',
  clinic: 'e.g. Apollo Clinic, Indiranagar',
  doctor: 'e.g. Dr. Anita Sharma',
  pharmacy: 'e.g. MedPlus Pharmacy',
  lab: 'e.g. Thyrocare Diagnostics',
  other: 'e.g. Physiotherapy centre',
};

const SHOWS_SPECIALTY: ProviderType[] = ['doctor', 'clinic', 'hospital'];

type Errors = { name?: string; phone?: string; mapsLink?: string };

export default function AddProviderScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const editingId = route.params?.providerId;

  const [type, setType] = useState<ProviderType>('doctor');
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isEmergencyContact, setIsEmergencyContact] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(!!editingId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editingId ? 'Edit Provider' : 'Add Provider' });
  }, [navigation, editingId]);

  useEffect(() => {
    if (!user || !editingId) return;
    getProviderById(user.id, editingId)
      .then((existing) => {
        if (!existing) {
          Alert.alert('Not found', 'This provider no longer exists.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          return;
        }
        setType(existing.type);
        setName(existing.name);
        setSpecialty(existing.specialty ?? '');
        setPhone(existing.phone ?? '');
        setAddress(existing.address ?? '');
        setMapsLink(existing.mapsUrl ?? '');
        setNotes(existing.notes ?? '');
        setIsFavorite(existing.isFavorite);
        setIsEmergencyContact(existing.isEmergencyContact ?? false);
      })
      .catch(() => Alert.alert('Something went wrong', "We couldn't load this provider."))
      .finally(() => setIsLoadingExisting(false));
  }, [user, editingId, navigation]);

  const showSpecialty = SHOWS_SPECIALTY.includes(type);

  const handleSave = async () => {
    if (!user || isSubmitting) return;

    const nextErrors: Errors = {};
    if (!name.trim()) nextErrors.name = 'Please enter a name.';
    if (phone.trim() && !isValidPhone(phone)) nextErrors.phone = 'Enter a valid phone number, e.g. +91 98765 43210';
    const mapsUrl = mapsLink.trim() ? extractMapsLink(mapsLink) : null;
    if (mapsLink.trim() && !mapsUrl) nextErrors.mapsLink = 'Paste a Google Maps link, e.g. https://maps.app.goo.gl/…';
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.phone || nextErrors.mapsLink) return;

    const input = {
      type,
      name: name.trim(),
      specialty: showSpecialty && specialty.trim() ? specialty.trim() : undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      mapsUrl: mapsUrl ?? undefined,
      notes: notes.trim() || undefined,
      isFavorite,
      isEmergencyContact,
    };

    setIsSubmitting(true);
    try {
      if (editingId) await updateProvider(user.id, editingId, input);
      else await addProvider(user.id, input);
      navigation.goBack();
    } catch {
      Alert.alert('Something went wrong', "We couldn't save this provider. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingExisting) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.fieldLabel, styles.firstLabel]}>Type</Text>
        <View style={styles.typeGrid}>
          {PROVIDER_TYPES.map((t) => {
            const badge = PROVIDER_BADGES[t];
            const active = type === t;
            return (
              <Pressable key={t} style={[styles.typeCard, active && styles.typeCardActive]} onPress={() => setType(t)}>
                <View style={[styles.typeIcon, { backgroundColor: active ? colors.surface : badge.bg }]}>
                  <Ionicons name={badge.icon} size={16} color={badge.tint} />
                </View>
                <Text style={[styles.typeText, active && styles.typeTextActive]} numberOfLines={1}>
                  {PROVIDER_TYPE_LABELS[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder={NAME_PLACEHOLDERS[type]}
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errors.name && text.trim()) setErrors((e) => ({ ...e, name: undefined }));
          }}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

        {showSpecialty && (
          <>
            <Text style={styles.fieldLabel}>Specialty (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Cardiologist, General Physician"
              placeholderTextColor={colors.textSecondary}
              value={specialty}
              onChangeText={setSpecialty}
            />
          </>
        )}

        <Text style={styles.fieldLabel}>Phone (optional)</Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          placeholder="e.g. +91 98765 43210"
          placeholderTextColor={colors.textSecondary}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
          }}
          keyboardType="phone-pad"
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

        <Text style={styles.fieldLabel}>Address (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Street, area, city — used for directions"
          placeholderTextColor={colors.textSecondary}
          value={address}
          onChangeText={setAddress}
          multiline
        />

        <Text style={styles.fieldLabel}>Google Maps link (optional)</Text>
        <TextInput
          style={[styles.input, errors.mapsLink && styles.inputError]}
          placeholder="https://maps.app.goo.gl/…"
          placeholderTextColor={colors.textSecondary}
          value={mapsLink}
          onChangeText={(text) => {
            setMapsLink(text);
            if (errors.mapsLink) setErrors((e) => ({ ...e, mapsLink: undefined }));
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        {errors.mapsLink ? (
          <Text style={styles.errorText}>{errors.mapsLink}</Text>
        ) : (
          <Text style={styles.hintText}>
            In Google Maps, open the place → Share → Copy link, then paste it here for an exact pin.
          </Text>
        )}

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="e.g. OPD timings 10am–2pm, ask for Room 12"
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <View style={styles.switchCard}>
          <Ionicons name="star-outline" size={20} color={colors.accent} />
          <View style={styles.flexText}>
            <Text style={styles.switchTitle}>Favourite</Text>
            <Text style={styles.switchSubtitle}>Favourites appear at the top of your list</Text>
          </View>
          <Switch
            value={isFavorite}
            onValueChange={setIsFavorite}
            trackColor={{ true: colors.green, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>

        <View style={[styles.switchCard, styles.switchCardTight]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <View style={styles.flexText}>
            <Text style={styles.switchTitle}>Show on Emergency screen</Text>
            <Text style={styles.switchSubtitle}>For your nearest hospital or family doctor</Text>
          </View>
          <Switch
            value={isEmergencyContact}
            onValueChange={setIsEmergencyContact}
            trackColor={{ true: colors.green, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, isSubmitting && styles.ctaDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={typography.button}>{editingId ? 'Save changes' : 'Save provider'}</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flexText: { flex: 1 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.md },
  firstLabel: { marginTop: 0 },
  errorText: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },
  hintText: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 17 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: {
    width: '31%', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  typeCardActive: { borderColor: colors.green, backgroundColor: colors.blobLight },
  typeIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  typeTextActive: { color: colors.green, fontWeight: '700' },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  multiline: { minHeight: 72, textAlignVertical: 'top' },

  switchCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  switchCardTight: { marginTop: spacing.sm },
  switchTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  switchSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.xl, minHeight: 56,
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.6 },
});
