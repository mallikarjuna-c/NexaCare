import { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import ProfileBanner from '../components/ProfileBanner';
import { deleteReminder, getReminder, saveReminder } from '../services/reminderService';
import { rescheduleReminders } from '../services/reminderScheduler';
import { requestNotificationPermission } from '../services/notificationService';
import {
  KIND_INFO,
  MEAL_LABELS,
  MEASUREMENT_LABELS,
  TEMPLATES,
  WEEKDAY_SHORT,
  formatTimeLabel,
  parseDayKey,
  sortTimes,
  toDayKey,
  type MealTiming,
  type MeasurementType,
  type ReminderKind,
  type RepeatRule,
} from '../types/reminders';
import { formatCalendarDate } from '../types/followUps';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'AddReminder'>;
type RepeatType = RepeatRule['type'];

const KINDS = Object.keys(KIND_INFO) as ReminderKind[];
const MEALS = Object.keys(MEAL_LABELS) as MealTiming[];
const MEASUREMENTS = Object.keys(MEASUREMENT_LABELS) as MeasurementType[];
const REPEATS: { type: RepeatType; label: string }[] = [
  { type: 'daily', label: 'Every day' },
  { type: 'weekdays', label: 'Specific days' },
  { type: 'interval', label: 'Every few days' },
  { type: 'once', label: 'Once' },
];
const NAME_PLACEHOLDER: Record<ReminderKind, string> = {
  medicine: 'e.g. Metformin',
  measurement: 'e.g. Check blood pressure',
  activity: 'e.g. Evening walk',
  custom: 'e.g. Refill prescription',
};

const pad = (n: number) => String(n).padStart(2, '0');
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dateFromTime = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 8, m || 0, 0, 0);
  return d;
};

export default function AddReminderScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { activeProfile } = useFamily();
  const profileId = activeProfile?.id;
  const editingId = route.params?.reminderId;
  const template = route.params?.preset ?? (route.params?.templateIndex != null ? TEMPLATES[route.params.templateIndex] : undefined);

  const [kind, setKind] = useState<ReminderKind>(template?.kind ?? 'medicine');
  const [title, setTitle] = useState(template && template.kind !== 'medicine' ? template.title : '');
  const [dose, setDose] = useState('');
  const [mealTiming, setMealTiming] = useState<MealTiming>('none');
  const templateMeasurement = (template as { measurementType?: MeasurementType } | undefined)?.measurementType;
  const [measurementType, setMeasurementType] = useState<MeasurementType>(templateMeasurement ?? 'blood_pressure');
  const [times, setTimes] = useState<string[]>(template?.times ?? ['08:00']);
  const [repeatType, setRepeatType] = useState<RepeatType>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [everyDays, setEveryDays] = useState(2);
  const [startDate, setStartDate] = useState(toDayKey(new Date()));
  const [endDate, setEndDate] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [titleError, setTitleError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(!!editingId);
  const [iosNewTime, setIosNewTime] = useState(() => dateFromTime('09:00'));

  useLayoutEffect(() => {
    navigation.setOptions({ title: editingId ? 'Edit reminder' : 'New reminder' });
  }, [navigation, editingId]);

  useEffect(() => {
    if (!profileId || !editingId) return;
    getReminder(profileId, editingId)
      .then((r) => {
        if (!r) {
          Alert.alert('Not found', 'This reminder no longer exists.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          return;
        }
        setKind(r.kind);
        setTitle(r.title);
        setDose(r.dose ?? '');
        setMealTiming(r.mealTiming ?? 'none');
        if (r.measurementType) setMeasurementType(r.measurementType);
        setTimes(r.times);
        setRepeatType(r.repeat.type);
        if (r.repeat.type === 'weekdays') setWeekdays(r.repeat.days);
        if (r.repeat.type === 'interval') setEveryDays(r.repeat.everyDays);
        setStartDate(r.startDate);
        setEndDate(r.endDate);
        setNotes(r.notes ?? '');
        setActive(r.active);
      })
      .catch(() => Alert.alert('Something went wrong', "We couldn't load this reminder."))
      .finally(() => setIsLoadingExisting(false));
  }, [profileId, editingId, navigation]);

  const addTime = (time: string) => setTimes((prev) => sortTimes([...prev, time]));
  const removeTime = (time: string) => setTimes((prev) => prev.filter((t) => t !== time));

  const pickTime = (existing?: string) => {
    DateTimePickerAndroid.open({
      value: dateFromTime(existing ?? '09:00'),
      mode: 'time',
      is24Hour: false,
      onValueChange: (_event, selected) => {
        const next = timeOf(selected);
        setTimes((prev) => sortTimes([...prev.filter((t) => t !== existing), next]));
      },
    });
  };

  const pickDate = (current: string, onPick: (key: string) => void, minimum?: string) => {
    DateTimePickerAndroid.open({
      value: parseDayKey(current),
      mode: 'date',
      minimumDate: minimum ? parseDayKey(minimum) : undefined,
      onValueChange: (_event, selected) => onPick(toDayKey(selected)),
    });
  };

  const toggleWeekday = (day: number) =>
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));

  const buildRepeat = (): RepeatRule => {
    if (repeatType === 'weekdays') return { type: 'weekdays', days: weekdays };
    if (repeatType === 'interval') return { type: 'interval', everyDays };
    return { type: repeatType };
  };

  const save = async () => {
    if (!profileId || !user || isSaving) return;
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    if (!times.length) {
      Alert.alert('Add a time', 'Choose at least one time for this reminder.');
      return;
    }
    if (repeatType === 'weekdays' && !weekdays.length) {
      Alert.alert('Choose days', 'Pick at least one day of the week.');
      return;
    }
    if (endDate && endDate < startDate) {
      Alert.alert('Check the dates', 'The end date is before the start date.');
      return;
    }
    setIsSaving(true);
    try {
      await saveReminder(
        profileId,
        {
          kind,
          title,
          dose,
          mealTiming,
          measurementType,
          times,
          repeat: buildRepeat(),
          startDate,
          endDate,
          active,
          notes,
        },
        editingId
      );
      await requestNotificationPermission().catch(() => {});
      rescheduleReminders(user.id).catch(() => {});
      navigation.goBack();
    } catch {
      Alert.alert('Something went wrong', "We couldn't save this reminder. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete reminder?', `“${title.trim() || 'This reminder'}” and its history will be removed.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!profileId || !editingId || !user) return;
          try {
            await deleteReminder(profileId, editingId);
            rescheduleReminders(user.id).catch(() => {});
            navigation.goBack();
          } catch {
            Alert.alert('Something went wrong', "We couldn't delete this reminder. Please try again.");
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
        <ProfileBanner what="reminders" switchable={false} style={styles.banner} />

        <Text style={[styles.label, styles.firstLabel]}>Type</Text>
        <View style={styles.kindGrid}>
          {KINDS.map((k) => {
            const selected = kind === k;
            return (
              <Pressable key={k} style={[styles.kindCard, selected && styles.kindCardActive]} onPress={() => setKind(k)}>
                <Ionicons name={KIND_INFO[k].icon} size={20} color={selected ? '#FFFFFF' : colors.green} />
                <Text style={[styles.kindText, selected && styles.kindTextActive]}>{KIND_INFO[k].label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{kind === 'medicine' ? 'Medicine name' : 'Name'}</Text>
        <TextInput
          style={[styles.input, titleError && styles.inputError]}
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            if (titleError && text.trim()) setTitleError(false);
          }}
          placeholder={NAME_PLACEHOLDER[kind]}
          placeholderTextColor={colors.textSecondary}
          maxLength={60}
        />
        {titleError && <Text style={styles.error}>Please enter a name.</Text>}

        {kind === 'medicine' && (
          <>
            <Text style={styles.label}>Dose (optional)</Text>
            <TextInput
              style={styles.input}
              value={dose}
              onChangeText={setDose}
              placeholder="e.g. 500 mg · 1 tablet"
              placeholderTextColor={colors.textSecondary}
              maxLength={40}
            />
            <Text style={styles.label}>When to take</Text>
            <View style={styles.chipRow}>
              {MEALS.map((m) => (
                <Pressable key={m} style={[styles.chip, mealTiming === m && styles.chipActive]} onPress={() => setMealTiming(m)}>
                  <Text style={[styles.chipText, mealTiming === m && styles.chipTextActive]}>{MEAL_LABELS[m]}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {kind === 'measurement' && (
          <>
            <Text style={styles.label}>What to measure</Text>
            <View style={styles.chipRow}>
              {MEASUREMENTS.map((m) => (
                <Pressable
                  key={m}
                  style={[styles.chip, measurementType === m && styles.chipActive]}
                  onPress={() => setMeasurementType(m)}
                >
                  <Text style={[styles.chipText, measurementType === m && styles.chipTextActive]}>{MEASUREMENT_LABELS[m]}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>Marking it done opens Health Records so you can save the reading.</Text>
          </>
        )}

        <Text style={styles.label}>Times</Text>
        <View style={styles.chipRow}>
          {times.map((t) => (
            <View key={t} style={styles.timeChip}>
              <Pressable onPress={Platform.OS === 'android' ? () => pickTime(t) : undefined} hitSlop={4}>
                <Text style={styles.timeChipText}>{formatTimeLabel(t)}</Text>
              </Pressable>
              {times.length > 1 && (
                <Pressable onPress={() => removeTime(t)} hitSlop={8} accessibilityLabel={`Remove ${formatTimeLabel(t)}`}>
                  <Ionicons name="close-circle" size={18} color={colors.green} />
                </Pressable>
              )}
            </View>
          ))}
          {Platform.OS === 'android' ? (
            <Pressable style={styles.addTime} onPress={() => pickTime()}>
              <Ionicons name="add" size={16} color={colors.green} />
              <Text style={styles.addTimeText}>Add time</Text>
            </Pressable>
          ) : (
            <View style={styles.iosAddRow}>
              <DateTimePicker value={iosNewTime} mode="time" display="compact" onValueChange={(_e, d) => setIosNewTime(d)} />
              <Pressable style={styles.addTime} onPress={() => addTime(timeOf(iosNewTime))}>
                <Ionicons name="add" size={16} color={colors.green} />
                <Text style={styles.addTimeText}>Add</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={styles.label}>How often</Text>
        <View style={styles.chipRow}>
          {REPEATS.map((r) => (
            <Pressable key={r.type} style={[styles.chip, repeatType === r.type && styles.chipActive]} onPress={() => setRepeatType(r.type)}>
              <Text style={[styles.chipText, repeatType === r.type && styles.chipTextActive]}>{r.label}</Text>
            </Pressable>
          ))}
        </View>

        {repeatType === 'weekdays' && (
          <View style={styles.weekdayRow}>
            {WEEKDAY_SHORT.map((name, day) => {
              const on = weekdays.includes(day);
              return (
                <Pressable key={name} style={[styles.weekday, on && styles.weekdayOn]} onPress={() => toggleWeekday(day)}>
                  <Text style={[styles.weekdayText, on && styles.weekdayTextOn]}>{name.slice(0, 2)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {repeatType === 'interval' && (
          <View style={styles.stepper}>
            <Pressable style={styles.stepButton} onPress={() => setEveryDays((n) => Math.max(2, n - 1))} hitSlop={6}>
              <Ionicons name="remove" size={20} color={colors.green} />
            </Pressable>
            <Text style={styles.stepText}>Every {everyDays} days</Text>
            <Pressable style={styles.stepButton} onPress={() => setEveryDays((n) => Math.min(30, n + 1))} hitSlop={6}>
              <Ionicons name="add" size={20} color={colors.green} />
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>{repeatType === 'once' ? 'Date' : 'Starts'}</Text>
        {Platform.OS === 'android' ? (
          <Pressable style={styles.dateButton} onPress={() => pickDate(startDate, setStartDate)}>
            <Ionicons name="calendar-outline" size={18} color={colors.blue} />
            <Text style={styles.dateText}>{formatCalendarDate(parseDayKey(startDate))}</Text>
          </Pressable>
        ) : (
          <DateTimePicker
            value={parseDayKey(startDate)}
            mode="date"
            display="compact"
            onValueChange={(_e, d) => setStartDate(toDayKey(d))}
          />
        )}

        {repeatType !== 'once' && (
          <>
            <Text style={styles.label}>Duration</Text>
            <View style={styles.chipRow}>
              <Pressable style={[styles.chip, !endDate && styles.chipActive]} onPress={() => setEndDate(undefined)}>
                <Text style={[styles.chipText, !endDate && styles.chipTextActive]}>Ongoing</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, !!endDate && styles.chipActive]}
                onPress={() => {
                  const fallback = new Date(parseDayKey(startDate).getTime() + 29 * 86_400_000);
                  const current = endDate ?? toDayKey(fallback);
                  setEndDate(current);
                  if (Platform.OS === 'android') pickDate(current, setEndDate, startDate);
                }}
              >
                <Text style={[styles.chipText, !!endDate && styles.chipTextActive]}>
                  {endDate ? `Until ${formatCalendarDate(parseDayKey(endDate))}` : 'Until a date'}
                </Text>
              </Pressable>
            </View>
            {Platform.OS === 'ios' && endDate && (
              <DateTimePicker
                value={parseDayKey(endDate)}
                mode="date"
                display="compact"
                minimumDate={parseDayKey(startDate)}
                onValueChange={(_e, d) => setEndDate(toDayKey(d))}
              />
            )}
          </>
        )}

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notes]}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Keep away from tea"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={200}
        />

        {editingId && (
          <View style={styles.pauseRow}>
            <View style={styles.flex}>
              <Text style={styles.pauseTitle}>{active ? 'Reminder is on' : 'Reminder is paused'}</Text>
              <Text style={styles.hint}>Paused reminders don’t ring and aren’t counted.</Text>
            </View>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#FFFFFF" />
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed, isSaving && styles.disabled]}
          onPress={save}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={typography.button}>{editingId ? 'Save changes' : 'Save reminder'}</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>

        {editingId && (
          <Pressable style={styles.deleteButton} onPress={confirmDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteText}>Delete reminder</Text>
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
  banner: { marginBottom: spacing.md },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },

  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  firstLabel: { marginTop: 0 },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 17 },
  error: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  notes: { minHeight: 70, textAlignVertical: 'top' },

  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  kindCard: {
    width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  kindCardActive: { backgroundColor: colors.green, borderColor: colors.green },
  kindText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  kindTextActive: { color: '#FFFFFF' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextActive: { color: '#FFFFFF' },

  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: spacing.md, paddingRight: spacing.sm, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.blobLight, borderWidth: 1, borderColor: colors.green,
  },
  timeChipText: { fontSize: 14, fontWeight: '800', color: colors.green },
  addTime: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: colors.green, borderStyle: 'dashed',
  },
  addTimeText: { fontSize: 13, fontWeight: '700', color: colors.green },
  iosAddRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  weekday: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  weekdayOn: { backgroundColor: colors.green, borderColor: colors.green },
  weekdayText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  weekdayTextOn: { color: '#FFFFFF' },

  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: spacing.sm,
  },
  stepButton: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blobLight,
  },
  stepText: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },

  dateButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.surface,
  },
  dateText: { fontSize: 15, color: colors.textPrimary },

  pauseRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, padding: spacing.md,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  pauseTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.xl, minHeight: 56,
  },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginTop: spacing.lg, paddingVertical: spacing.sm,
  },
  deleteText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
