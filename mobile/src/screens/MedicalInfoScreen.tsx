import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { getMedicalInfo, saveMedicalInfo } from '../services/emergencyService';
import { BLOOD_GROUPS, type BloodGroup } from '../types/emergency';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'MedicalInfo'>;

export default function MedicalInfoScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | undefined>();
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getMedicalInfo(user.id)
      .then((info) => {
        setBloodGroup(info.bloodGroup);
        setAllergies(info.allergies ?? '');
        setConditions(info.conditions ?? '');
        setMedications(info.medications ?? '');
        setNotes(info.notes ?? '');
      })
      .catch(() => Alert.alert('Something went wrong', "We couldn't load your medical info."))
      .finally(() => setIsLoading(false));
  }, [user]);

  const handleSave = async () => {
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await saveMedicalInfo(user.id, {
        bloodGroup,
        allergies: allergies.trim() || undefined,
        conditions: conditions.trim() || undefined,
        medications: medications.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Something went wrong', "We couldn't save your medical info. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.privacyText}>
            Stored only on this phone. It's shown on your Emergency screen and included when you share your location.
          </Text>
        </View>

        <Text style={styles.fieldLabel}>Blood group</Text>
        <View style={styles.chipRow}>
          {BLOOD_GROUPS.map((g) => (
            <Pressable
              key={g}
              style={[styles.bloodChip, bloodGroup === g && styles.bloodChipActive]}
              onPress={() => setBloodGroup(bloodGroup === g ? undefined : g)}
              accessibilityState={{ selected: bloodGroup === g }}
            >
              <Text style={[styles.bloodChipText, bloodGroup === g && styles.bloodChipTextActive]}>{g}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hintText}>Tap again to clear if you're not sure.</Text>

        <Text style={styles.fieldLabel}>Allergies</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="e.g. Penicillin, peanuts"
          placeholderTextColor={colors.textSecondary}
          value={allergies}
          onChangeText={setAllergies}
          multiline
        />

        <Text style={styles.fieldLabel}>Medical conditions</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="e.g. Type 2 diabetes, asthma"
          placeholderTextColor={colors.textSecondary}
          value={conditions}
          onChangeText={setConditions}
          multiline
        />

        <Text style={styles.fieldLabel}>Current medications</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="e.g. Metformin 500 mg twice daily"
          placeholderTextColor={colors.textSecondary}
          value={medications}
          onChangeText={setMedications}
          multiline
        />

        <Text style={styles.fieldLabel}>Other notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="e.g. Pacemaker fitted, organ donor"
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, isSubmitting && styles.ctaDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={typography.button}>Save medical ID</Text>
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

  privacyNote: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  privacyText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.md },
  hintText: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  bloodChip: {
    minWidth: 56, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  bloodChipActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  bloodChipText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  bloodChipTextActive: { color: '#FFFFFF' },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.xl, minHeight: 56,
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.6 },
});
