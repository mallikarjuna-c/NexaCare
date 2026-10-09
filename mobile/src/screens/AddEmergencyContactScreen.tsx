import { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import {
  addEmergencyContact, deleteEmergencyContact, getEmergencyContacts, makePrimaryContact, updateEmergencyContact,
} from '../services/emergencyService';
import { isValidPhone } from '../types/directory';
import { RELATIONS, RELATION_LABELS, type Relation } from '../types/emergency';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'AddEmergencyContact'>;

type Errors = { name?: string; phone?: string };

export default function AddEmergencyContactScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const editingId = route.params?.contactId;

  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation>('parent');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(!!editingId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editingId ? 'Edit Trusted Contact' : 'Add Trusted Contact' });
  }, [navigation, editingId]);

  useEffect(() => {
    if (!user || !editingId) return;
    getEmergencyContacts(user.id)
      .then((list) => {
        const index = list.findIndex((c) => c.id === editingId);
        const existing = index >= 0 ? list[index] : null;
        setIsPrimary(index === 0);
        if (!existing) {
          Alert.alert('Not found', 'This contact no longer exists.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          return;
        }
        setName(existing.name);
        setRelation(existing.relation);
        setPhone(existing.phone);
      })
      .catch(() => Alert.alert('Something went wrong', "We couldn't load this contact."))
      .finally(() => setIsLoadingExisting(false));
  }, [user, editingId, navigation]);

  const handleSave = async () => {
    if (!user || isSubmitting) return;
    const nextErrors: Errors = {};
    if (!name.trim()) nextErrors.name = 'Please enter a name.';
    if (!phone.trim()) nextErrors.phone = 'A phone number is required for emergency contacts.';
    else if (!isValidPhone(phone)) nextErrors.phone = 'Enter a valid phone number, e.g. +91 98765 43210';
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.phone) return;

    const input = { name: name.trim(), relation, phone: phone.trim() };
    setIsSubmitting(true);
    try {
      if (editingId) await updateEmergencyContact(user.id, editingId, input);
      else await addEmergencyContact(user.id, input);
      navigation.goBack();
    } catch {
      Alert.alert('Something went wrong', "We couldn't save this contact. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const setAsPrimary = async () => {
    if (!user || !editingId) return;
    try {
      await makePrimaryContact(user.id, editingId);
      setIsPrimary(true);
    } catch {
      Alert.alert('Something went wrong', "We couldn't update your primary contact. Please try again.");
    }
  };

  const confirmDelete = () =>
    Alert.alert('Remove contact?', `${name.trim() || 'This contact'} will no longer appear on your Emergency screen.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!user || !editingId) return;
          try {
            await deleteEmergencyContact(user.id, editingId);
            navigation.goBack();
          } catch {
            Alert.alert('Something went wrong', "We couldn't remove this contact. Please try again.");
          }
        },
      },
    ]);

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
        <Text style={[styles.fieldLabel, styles.firstLabel]}>Name</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="e.g. Ramesh Kumar"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errors.name && text.trim()) setErrors((e) => ({ ...e, name: undefined }));
          }}
          autoFocus={!editingId}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

        <Text style={styles.fieldLabel}>Relationship</Text>
        <View style={styles.chipRow}>
          {RELATIONS.map((r) => (
            <Pressable key={r} style={[styles.chip, relation === r && styles.chipActive]} onPress={() => setRelation(r)}>
              <Text style={[styles.chipText, relation === r && styles.chipTextActive]}>{RELATION_LABELS[r]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Phone</Text>
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
        {!errors.phone && (
          <Text style={styles.hintText}>Add the country code if they're outside India, so WhatsApp finds them.</Text>
        )}

        {editingId && (
          <View style={styles.primaryCard}>
            <Ionicons name={isPrimary ? 'star' : 'star-outline'} size={20} color={colors.danger} />
            <View style={styles.flexText}>
              <Text style={styles.primaryTitle}>{isPrimary ? 'Primary contact' : 'Not your primary contact'}</Text>
              <Text style={styles.primarySub}>The SOS button alerts your primary contact first.</Text>
            </View>
            {!isPrimary && (
              <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={setAsPrimary}>
                <Text style={styles.primaryButtonText}>Set as primary</Text>
              </Pressable>
            )}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, isSubmitting && styles.ctaDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={typography.button}>{editingId ? 'Save changes' : 'Save contact'}</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>

        {editingId && (
          <Pressable style={styles.deleteButton} onPress={confirmDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteText}>Remove contact</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.md },
  firstLabel: { marginTop: 0 },
  errorText: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },
  hintText: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },
  primaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  primaryTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  primarySub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  primaryButton: { backgroundColor: colors.danger, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  primaryButtonText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextActive: { color: '#FFFFFF' },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.xl, minHeight: 56,
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.6 },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginTop: spacing.lg, paddingVertical: spacing.sm,
  },
  deleteText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
