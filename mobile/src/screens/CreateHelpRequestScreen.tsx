import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { createHelpRequest, getDonorProfile } from '../services/communityService';
import { BLOOD_GROUPS, type BloodGroup } from '../types/emergency';
import { KIND_LABELS, URGENCY_INFO, type HelpKind, type HelpUrgency } from '../types/community';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'CreateHelpRequest'>;

const KINDS = Object.keys(KIND_LABELS) as HelpKind[];
const URGENCIES = Object.keys(URGENCY_INFO) as HelpUrgency[];

export default function CreateHelpRequestScreen({ navigation }: Props) {
  const [kind, setKind] = useState<HelpKind>('blood');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [units, setUnits] = useState(1);
  const [urgency, setUrgency] = useState<HelpUrgency>('urgent');
  const [patientName, setPatientName] = useState('');
  const [hospital, setHospital] = useState('');
  const [city, setCity] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    getDonorProfile()
      .then((profile) => {
        if (profile?.city) setCity((c) => c || profile.city);
        if (profile?.phone) setContactPhone((p) => p || profile.phone);
      })
      .catch(() => {});
  }, []);

  const send = async () => {
    if (isSending) return;
    if (!bloodGroup) return Alert.alert('Choose the blood group', 'Pick the patient’s blood group.');
    if (!patientName.trim() || hospital.trim().length < 2 || city.trim().length < 2) {
      return Alert.alert('Missing details', 'Add the patient’s name, hospital and city.');
    }
    if (contactPhone.replace(/\D/g, '').length < 8) return Alert.alert('Contact number', 'Add a number donors can call.');

    setIsSending(true);
    try {
      const created = await createHelpRequest({ kind, bloodGroup, units, urgency, patientName, hospital, city, contactPhone, note });
      Alert.alert(
        'Request posted',
        created.notifiedCount > 0
          ? `${created.notifiedCount} matching donor${created.notifiedCount === 1 ? '' : 's'} in ${created.city} ${created.notifiedCount === 1 ? 'has' : 'have'} been alerted. Share it on WhatsApp to reach more people.`
          : `No registered donors in ${created.city} match yet. Share it on WhatsApp so friends and family can help.`,
        [{ text: 'OK', onPress: () => navigation.replace('HelpRequest', { requestId: created.id }) }]
      );
    } catch (error) {
      Alert.alert('Couldn’t post', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.bannerText}>
            In a life-threatening emergency call 112 first. This request alerts compatible donors in the city you choose.
          </Text>
        </View>

        <Text style={[styles.label, styles.first]}>What is needed</Text>
        <View style={styles.chips}>
          {KINDS.map((k) => (
            <Pressable key={k} style={[styles.chip, kind === k && styles.chipActive]} onPress={() => setKind(k)}>
              <Text style={[styles.chipText, kind === k && styles.chipTextActive]}>{KIND_LABELS[k]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Patient’s blood group</Text>
        <View style={styles.chips}>
          {BLOOD_GROUPS.map((g) => (
            <Pressable key={g} style={[styles.groupChip, bloodGroup === g && styles.groupChipActive]} onPress={() => setBloodGroup(g)}>
              <Text style={[styles.groupText, bloodGroup === g && styles.chipTextActive]}>{g}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Units</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepButton} onPress={() => setUnits((u) => Math.max(1, u - 1))} hitSlop={6}>
            <Ionicons name="remove" size={20} color={colors.green} />
          </Pressable>
          <Text style={styles.stepText}>{units} unit{units > 1 ? 's' : ''}</Text>
          <Pressable style={styles.stepButton} onPress={() => setUnits((u) => Math.min(10, u + 1))} hitSlop={6}>
            <Ionicons name="add" size={20} color={colors.green} />
          </Pressable>
        </View>

        <Text style={styles.label}>How urgent</Text>
        <View style={styles.urgencyList}>
          {URGENCIES.map((u) => (
            <Pressable key={u} style={[styles.urgencyRow, urgency === u && styles.urgencyActive]} onPress={() => setUrgency(u)}>
              <Ionicons name={urgency === u ? 'radio-button-on' : 'radio-button-off'} size={20} color={urgency === u ? colors.danger : colors.textSecondary} />
              <Text style={styles.urgencyLabel}>{URGENCY_INFO[u].label}</Text>
              <Text style={styles.urgencyWindow}>{URGENCY_INFO[u].window}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Patient’s name</Text>
        <TextInput style={styles.input} value={patientName} onChangeText={setPatientName} placeholder="e.g. Ravi Kumar" placeholderTextColor={colors.textSecondary} maxLength={80} />

        <Text style={styles.label}>Hospital</Text>
        <TextInput style={styles.input} value={hospital} onChangeText={setHospital} placeholder="e.g. Manipal Hospital, Old Airport Road" placeholderTextColor={colors.textSecondary} maxLength={120} />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Bengaluru" placeholderTextColor={colors.textSecondary} maxLength={60} />

        <Text style={styles.label}>Contact number</Text>
        <TextInput
          style={styles.input}
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="+91 98765 43210"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
          maxLength={18}
        />

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={[styles.input, styles.note]}
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Surgery on Friday morning, ask for blood bank on 2nd floor"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={500}
        />

        <Pressable style={({ pressed }) => [styles.cta, (pressed || isSending) && styles.pressed]} onPress={send} disabled={isSending}>
          {isSending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="water" size={20} color="#FFFFFF" />
              <Text style={typography.button}>Post request</Text>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  pressed: { opacity: 0.75 },
  banner: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: '#FCE1E1', marginBottom: spacing.lg },
  bannerText: { flex: 1, fontSize: 12, color: colors.danger, lineHeight: 17, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  first: { marginTop: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  chipTextActive: { color: '#FFFFFF' },
  groupChip: { width: 64, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  groupChipActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  groupText: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, backgroundColor: colors.surface, padding: spacing.sm,
  },
  stepButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blobLight },
  stepText: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  urgencyList: { gap: spacing.sm },
  urgencyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  urgencyActive: { borderColor: colors.danger, borderWidth: 1.5 },
  urgencyLabel: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  urgencyWindow: { flex: 1, fontSize: 12, color: colors.textSecondary, textAlign: 'right' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface,
  },
  note: { minHeight: 80, textAlignVertical: 'top' },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.danger, paddingVertical: 16, borderRadius: 30, marginTop: spacing.xl, minHeight: 56,
  },
});
