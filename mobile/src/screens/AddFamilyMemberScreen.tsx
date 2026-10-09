import { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FamilyStackParamList } from '../navigation/FamilyStack';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { addFamilyMember, getFamilyMember, updateFamilyMember } from '../services/familyService';
import { removeFamilyMember } from '../services/profileDataService';
import {
  FAMILY_RELATIONS, FAMILY_RELATION_LABELS, GENDER_LABELS, ageFrom, type FamilyRelation, type Gender,
} from '../types/family';
import { parseLocalISODate, toLocalISODate } from '../types/expenses';
import { formatCalendarDate } from '../types/followUps';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<FamilyStackParamList, 'AddFamilyMember'>;

const GENDERS = Object.keys(GENDER_LABELS) as Gender[];
const DEFAULT_PICKER_DATE = new Date(1970, 0, 1);

export default function AddFamilyMemberScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { refreshFamily } = useFamily();
  const editingId = route.params?.memberId;

  const [name, setName] = useState('');
  const [relation, setRelation] = useState<FamilyRelation>('mother');
  const [dateOfBirth, setDateOfBirth] = useState<string | undefined>();
  const [gender, setGender] = useState<Gender | undefined>();
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(!!editingId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editingId ? 'Edit Family Member' : 'Add Family Member' });
  }, [navigation, editingId]);

  useEffect(() => {
    if (!user || !editingId) return;
    getFamilyMember(user.id, editingId)
      .then((member) => {
        if (!member) {
          Alert.alert('Not found', 'This family member no longer exists.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          return;
        }
        setName(member.name);
        setRelation(member.relation);
        setDateOfBirth(member.dateOfBirth);
        setGender(member.gender);
      })
      .catch(() => Alert.alert('Something went wrong', "We couldn't load this family member."))
      .finally(() => setIsLoadingExisting(false));
  }, [user, editingId, navigation]);

  const pickerValue = dateOfBirth ? parseLocalISODate(dateOfBirth) : DEFAULT_PICKER_DATE;
  const age = ageFrom(dateOfBirth);

  const openDatePicker = () => {
    DateTimePickerAndroid.open({
      value: pickerValue,
      mode: 'date',
      maximumDate: new Date(),
      onValueChange: (_event, selected) => setDateOfBirth(toLocalISODate(selected)),
    });
  };

  const handleSave = async () => {
    if (!user || isSubmitting) return;
    if (!name.trim()) {
      setNameError('Please enter a name.');
      return;
    }
    const input = { name: name.trim(), relation, dateOfBirth, gender };
    setIsSubmitting(true);
    try {
      if (editingId) await updateFamilyMember(user.id, editingId, input);
      else await addFamilyMember(user.id, input);
      await refreshFamily();
      navigation.goBack();
    } catch {
      Alert.alert('Something went wrong', "We couldn't save this family member. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      `Remove ${name.trim() || 'this member'}?`,
      'Their health records, follow-ups, reminders, Medical ID and expenses on this phone will be deleted. This can’t be undone.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user || !editingId) return;
            try {
              await removeFamilyMember(user.id, editingId);
              await refreshFamily();
              navigation.goBack();
            } catch {
              Alert.alert('Something went wrong', "We couldn't remove this family member. Please try again.");
            }
          },
        },
      ]
    );

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
          style={[styles.input, nameError && styles.inputError]}
          placeholder="e.g. Lakshmi Devi"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (nameError && text.trim()) setNameError(null);
          }}
          autoFocus={!editingId}
          maxLength={60}
        />
        {nameError && <Text style={styles.errorText}>{nameError}</Text>}

        <Text style={styles.fieldLabel}>Relationship</Text>
        <View style={styles.chipRow}>
          {FAMILY_RELATIONS.map((r) => (
            <Pressable key={r} style={[styles.chip, relation === r && styles.chipActive]} onPress={() => setRelation(r)}>
              <Text style={[styles.chipText, relation === r && styles.chipTextActive]}>{FAMILY_RELATION_LABELS[r]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Date of birth (optional)</Text>
        {Platform.OS === 'android' ? (
          <View style={styles.dateRow}>
            <Pressable style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]} onPress={openDatePicker}>
              <Ionicons name="calendar-outline" size={18} color={colors.blue} />
              <Text style={[styles.dateButtonText, !dateOfBirth && styles.placeholderText]}>
                {dateOfBirth ? formatCalendarDate(parseLocalISODate(dateOfBirth)) : 'Choose date'}
              </Text>
            </Pressable>
            {dateOfBirth && (
              <Pressable onPress={() => setDateOfBirth(undefined)} hitSlop={8} accessibilityLabel="Clear date of birth">
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.iosPickerWrap}>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display="compact"
              maximumDate={new Date()}
              onValueChange={(_event, selected) => setDateOfBirth(toLocalISODate(selected))}
            />
          </View>
        )}
        {age != null && <Text style={styles.hintText}>{age} years old</Text>}

        <Text style={styles.fieldLabel}>Gender (optional)</Text>
        <View style={styles.chipRow}>
          {GENDERS.map((g) => (
            <Pressable
              key={g}
              style={[styles.chip, gender === g && styles.chipActive]}
              onPress={() => setGender(gender === g ? undefined : g)}
            >
              <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{GENDER_LABELS[g]}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.green} />
          <Text style={styles.infoText}>
            Their records, follow-ups, Medical ID and expenses are kept separately and stay on this phone.
          </Text>
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
              <Text style={typography.button}>{editingId ? 'Save changes' : 'Add member'}</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>

        {editingId && (
          <Pressable style={styles.deleteButton} onPress={confirmDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteText}>Remove family member</Text>
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
  pressed: { opacity: 0.7 },
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

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.surface,
  },
  dateButtonText: { fontSize: 15, color: colors.textPrimary },
  placeholderText: { color: colors.textSecondary },
  clearText: { fontSize: 13, fontWeight: '700', color: colors.danger },
  iosPickerWrap: { alignItems: 'flex-start' },

  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg,
    backgroundColor: colors.blobLight, borderRadius: 14, padding: spacing.md,
  },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

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
