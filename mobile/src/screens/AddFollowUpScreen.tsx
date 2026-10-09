import { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { FOLLOW_UP_BADGES } from '../components/FollowUpCard';
import ProviderPicker, { type ProviderSelection } from '../components/ProviderPicker';
import { addFollowUp, getFollowUpById, updateFollowUp } from '../services/followUpService';
import { getProviderById } from '../services/directoryService';
import type { Provider, ProviderType } from '../types/directory';
import {
  FOLLOW_UP_TYPES,
  FOLLOW_UP_TYPE_LABELS,
  REMINDER_OFFSETS,
  REMINDER_OFFSET_LABELS,
  formatAbsolute,
  formatCalendarDate,
  formatClockTime,
  reminderTimeFor,
  type FollowUpType,
  type ReminderOffset,
  type ReminderOutcome,
} from '../types/followUps';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'AddFollowUp'>;

const TITLE_PLACEHOLDERS: Record<FollowUpType, string> = {
  appointment: 'e.g. Cardiology consultation',
  test: 'e.g. HbA1c blood test',
  medication: 'e.g. Review BP medication dose',
  checkup: 'e.g. Annual health checkup',
};

const PROVIDER_LABELS: Record<FollowUpType, string> = {
  appointment: 'Doctor / Clinic',
  test: 'Lab / Diagnostic centre',
  medication: 'Prescribing doctor',
  checkup: 'Doctor / Clinic',
};

// A picked provider hints at what kind of follow-up this is.
const TYPE_FROM_PROVIDER: Partial<Record<ProviderType, FollowUpType>> = {
  lab: 'test',
  pharmacy: 'medication',
};

function defaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

export default function AddFollowUpScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const editingId = route.params?.followUpId;
  const prefillProviderId = route.params?.providerId;

  const [type, setType] = useState<FollowUpType>('appointment');
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState<ProviderSelection>({ providerName: '' });
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date>(defaultDate);
  const [reminderOffset, setReminderOffset] = useState<ReminderOffset>('1d');
  const [titleError, setTitleError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(!!editingId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editingId ? 'Edit Follow-up' : 'Add Follow-up' });
  }, [navigation, editingId]);

  // Prefill when editing.
  useEffect(() => {
    if (!user || !editingId) return;
    getFollowUpById(user.id, editingId)
      .then((existing) => {
        if (!existing) {
          Alert.alert('Not found', 'This follow-up no longer exists.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          return;
        }
        setType(existing.type);
        setTitle(existing.title);
        setProvider({ providerId: existing.providerId, providerName: existing.providerName ?? '' });
        setLocation(existing.location ?? '');
        setNotes(existing.notes ?? '');
        setScheduledAt(new Date(existing.scheduledAt));
        setReminderOffset(existing.reminderOffset);
      })
      .catch(() => Alert.alert('Something went wrong', "We couldn't load this follow-up."))
      .finally(() => setIsLoadingExisting(false));
  }, [user, editingId, navigation]);

  // Opened from a provider's page ("Book follow-up"): start linked to that provider.
  useEffect(() => {
    if (!user || editingId || !prefillProviderId) return;
    getProviderById(user.id, prefillProviderId)
      .then((p) => p && applyPickedProvider(p))
      .catch(() => {}); // the user can still pick or type a provider
  }, [user, editingId, prefillProviderId]);

  function applyPickedProvider(p: Provider) {
    setProvider({ providerId: p.id, providerName: p.name });
    if (!editingId) {
      const inferred = TYPE_FROM_PROVIDER[p.type];
      if (inferred) setType(inferred);
    }
  }

  const openAndroidPicker = (mode: 'date' | 'time') => {
    DateTimePickerAndroid.open({
      value: scheduledAt,
      mode,
      is24Hour: false,
      onValueChange: (_event, selected) => {
        setScheduledAt((prev) => {
          const next = new Date(prev);
          if (mode === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
          else next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          return next;
        });
      },
    });
  };

  const isPast = scheduledAt.getTime() < Date.now();
  const reminderAt = reminderTimeFor(scheduledAt.toISOString(), reminderOffset);
  const reminderInPast = !!reminderAt && reminderAt.getTime() <= Date.now();

  const finish = () => navigation.goBack();

  const explainReminder = (outcome: ReminderOutcome) => {
    switch (outcome) {
      case 'permission_needed':
        Alert.alert(
          'Saved without a reminder',
          'Allow notifications for NexaCare to get reminded about this follow-up.',
          [
            { text: 'OK', onPress: finish },
            { text: 'Open Settings', onPress: () => { Linking.openSettings(); finish(); } },
          ]
        );
        return;
      case 'time_passed':
        Alert.alert('Saved', 'The reminder time has already passed, so no reminder was set.', [{ text: 'OK', onPress: finish }]);
        return;
      case 'unsupported':
        Alert.alert('Saved', "Reminders need a physical device, so none was set.", [{ text: 'OK', onPress: finish }]);
        return;
      case 'failed':
        Alert.alert('Saved without a reminder', "We couldn't set the reminder. Try editing the follow-up again.", [
          { text: 'OK', onPress: finish },
        ]);
        return;
      default:
        finish();
    }
  };

  const handleSave = async () => {
    if (!user || isSubmitting) return;
    if (!title.trim()) {
      setTitleError(true);
      return;
    }

    const input = {
      type,
      title: title.trim(),
      scheduledAt: scheduledAt.toISOString(),
      providerName: provider.providerName.trim() || undefined,
      providerId: provider.providerName.trim() ? provider.providerId : undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      reminderOffset,
    };

    setIsSubmitting(true);
    try {
      const result = editingId ? await updateFollowUp(user.id, editingId, input) : await addFollowUp(user.id, input);
      explainReminder(result.reminder);
    } catch {
      Alert.alert('Something went wrong', "We couldn't save this follow-up. Please try again.");
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
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.typeGrid}>
          {FOLLOW_UP_TYPES.map((t) => {
            const badge = FOLLOW_UP_BADGES[t];
            const active = type === t;
            return (
              <Pressable key={t} style={[styles.typeCard, active && styles.typeCardActive]} onPress={() => setType(t)}>
                <View style={[styles.typeIcon, { backgroundColor: active ? colors.surface : badge.bg }]}>
                  <Ionicons name={badge.icon} size={18} color={badge.tint} />
                </View>
                <Text style={[styles.typeText, active && styles.typeTextActive]} numberOfLines={2}>
                  {FOLLOW_UP_TYPE_LABELS[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput
          style={[styles.input, titleError && styles.inputError]}
          placeholder={TITLE_PLACEHOLDERS[type]}
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            if (titleError && text.trim()) setTitleError(false);
          }}
        />
        {titleError && <Text style={styles.errorText}>Please enter a title.</Text>}

        <Text style={styles.fieldLabel}>Date & time</Text>
        {Platform.OS === 'android' ? (
          <View style={styles.dateRow}>
            <Pressable style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]} onPress={() => openAndroidPicker('date')}>
              <Ionicons name="calendar-outline" size={18} color={colors.blue} />
              <Text style={styles.dateButtonText}>{formatCalendarDate(scheduledAt)}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]} onPress={() => openAndroidPicker('time')}>
              <Ionicons name="time-outline" size={18} color={colors.blue} />
              <Text style={styles.dateButtonText}>{formatClockTime(scheduledAt)}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.iosPickerWrap}>
            <DateTimePicker
              value={scheduledAt}
              mode="datetime"
              display="compact"
              onValueChange={(_event, selected) => setScheduledAt(selected)}
            />
          </View>
        )}
        {isPast && (
          <View style={styles.noticeRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.noticeText}>This time is in the past, so it will show as overdue.</Text>
          </View>
        )}

        <Text style={styles.fieldLabel}>{PROVIDER_LABELS[type]} (optional)</Text>
        {user && (
          <ProviderPicker
            userId={user.id}
            value={provider}
            onChange={setProvider}
            onPick={applyPickedProvider}
            placeholder="e.g. Dr. Sharma, Apollo Clinic"
          />
        )}

        <Text style={styles.fieldLabel}>Location (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2nd floor, Room 204"
          placeholderTextColor={colors.textSecondary}
          value={location}
          onChangeText={setLocation}
        />

        <Text style={styles.fieldLabel}>Reminder</Text>
        <View style={styles.chipRow}>
          {REMINDER_OFFSETS.map((o) => (
            <Pressable
              key={o}
              style={[styles.chip, reminderOffset === o && styles.chipActive]}
              onPress={() => setReminderOffset(o)}
            >
              <Text style={[styles.chipText, reminderOffset === o && styles.chipTextActive]}>{REMINDER_OFFSET_LABELS[o]}</Text>
            </Pressable>
          ))}
        </View>
        {reminderAt && (
          <Text style={[styles.hintText, reminderInPast && styles.hintTextDanger]}>
            {reminderInPast
              ? 'This reminder time has already passed — pick a later date or a shorter reminder.'
              : `We'll remind you on ${formatAbsolute(reminderAt)}.`}
          </Text>
        )}

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="e.g. Fasting required, bring previous reports"
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
              <Text style={typography.button}>{editingId ? 'Save changes' : 'Save follow-up'}</Text>
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
  pressed: { opacity: 0.7 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.md },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: {
    width: '48%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.sm,
  },
  typeCardActive: { borderColor: colors.green, backgroundColor: colors.blobLight },
  typeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  typeText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  typeTextActive: { color: colors.green, fontWeight: '700' },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  errorText: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },

  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  dateButtonText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  iosPickerWrap: { alignItems: 'flex-start' },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  noticeText: { flex: 1, fontSize: 12, color: colors.danger },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextActive: { color: '#FFFFFF' },
  hintText: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  hintTextDanger: { color: colors.danger },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.xl, minHeight: 56,
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.6 },
});
