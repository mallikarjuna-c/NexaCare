import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { getDonorProfile, saveDonorProfile } from '../services/communityService';
import { getMedicalInfoOffline } from '../services/emergencyService';
import { getCurrentCity } from '../services/locationService';
import { registerForPush } from '../services/pushService';
import { requestNotificationPermission } from '../services/notificationService';
import { BLOOD_GROUPS, type BloodGroup } from '../types/emergency';
import { DONATION_GAP_DAYS, POPULAR_CITIES, nextEligibleDate } from '../types/community';
import { parseLocalISODate, toLocalISODate } from '../types/expenses';
import { formatCalendarDate } from '../types/followUps';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'DonorSettings'>;

export default function DonorSettingsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [city, setCity] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [willing, setWilling] = useState(false);
  const [lastDonation, setLastDonation] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getDonorProfile(), getMedicalInfoOffline(user.id)])
      .then(([profile, medical]) => {
        if (profile) {
          setCity(profile.city);
          setBloodGroup(profile.bloodGroup);
          setWilling(profile.willing);
          setLastDonation(profile.lastDonation);
          setPhone(profile.phone);
        } else if (medical.bloodGroup) {
          setBloodGroup(medical.bloodGroup);
        }
      })
      .catch((error) => Alert.alert('Couldn’t load', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setIsLoading(false));
  }, [user]);

  const locate = async () => {
    setIsLocating(true);
    try {
      const found = await getCurrentCity();
      if (found) setCity(found);
      else Alert.alert('Location unavailable', 'Turn on location, or type your city.');
    } catch {
      Alert.alert('Location unavailable', 'Turn on location, or type your city.');
    } finally {
      setIsLocating(false);
    }
  };

  const pickDate = () => {
    DateTimePickerAndroid.open({
      value: lastDonation ? parseLocalISODate(lastDonation) : new Date(),
      mode: 'date',
      maximumDate: new Date(),
      onValueChange: (_event, selected) => setLastDonation(toLocalISODate(selected)),
    });
  };

  const save = async () => {
    if (isSaving) return;
    if (city.trim().length < 2) {
      Alert.alert('Add your city', 'Your city decides which requests you see.');
      return;
    }
    if (willing && !bloodGroup) {
      Alert.alert('Choose your blood group', 'Donors need a blood group so we only alert you for matching requests.');
      return;
    }
    setIsSaving(true);
    try {
      await saveDonorProfile({ city, bloodGroup, willing, lastDonation, phone });
      if (willing) {
        await requestNotificationPermission().catch(() => {});
        await registerForPush().catch(() => {});
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Couldn’t save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const waitUntil = nextEligibleDate(lastDonation);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, styles.first]}>Your city</Text>
        <View style={styles.cityRow}>
          <TextInput
            style={[styles.input, styles.flex]}
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Bengaluru"
            placeholderTextColor={colors.textSecondary}
            maxLength={60}
          />
          <Pressable style={({ pressed }) => [styles.locate, pressed && styles.pressed]} onPress={locate} disabled={isLocating}>
            {isLocating ? <ActivityIndicator color={colors.green} /> : <Ionicons name="locate" size={20} color={colors.green} />}
          </Pressable>
        </View>
        <View style={styles.chips}>
          {POPULAR_CITIES.map((c) => (
            <Pressable key={c} style={[styles.chip, city === c && styles.chipActive]} onPress={() => setCity(c)}>
              <Text style={[styles.chipText, city === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>You’ll see blood requests from this city.</Text>

        <View style={styles.switchCard}>
          <View style={styles.flex}>
            <Text style={styles.switchTitle}>I’m willing to donate blood</Text>
            <Text style={styles.hint}>We’ll alert you only when someone nearby needs a group you can give to.</Text>
          </View>
          <Switch value={willing} onValueChange={setWilling} trackColor={{ true: colors.danger, false: colors.border }} thumbColor="#FFFFFF" />
        </View>

        <Text style={styles.label}>Blood group</Text>
        <View style={styles.chips}>
          {BLOOD_GROUPS.map((g) => (
            <Pressable key={g} style={[styles.groupChip, bloodGroup === g && styles.groupChipActive]} onPress={() => setBloodGroup(g)}>
              <Text style={[styles.groupChipText, bloodGroup === g && styles.chipTextActive]}>{g}</Text>
            </Pressable>
          ))}
        </View>

        {willing && (
          <>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              maxLength={18}
            />
            <Text style={styles.hint}>Shared only with families whose request you respond to.</Text>

            <Text style={styles.label}>Last donation (optional)</Text>
            {Platform.OS === 'android' ? (
              <View style={styles.cityRow}>
                <Pressable style={[styles.input, styles.flex, styles.dateButton]} onPress={pickDate}>
                  <Ionicons name="calendar-outline" size={18} color={colors.blue} />
                  <Text style={[styles.dateText, !lastDonation && styles.placeholder]}>
                    {lastDonation ? formatCalendarDate(parseLocalISODate(lastDonation)) : 'Never / not sure'}
                  </Text>
                </Pressable>
                {lastDonation && (
                  <Pressable onPress={() => setLastDonation(null)} hitSlop={8}>
                    <Text style={styles.clear}>Clear</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <DateTimePicker
                value={lastDonation ? parseLocalISODate(lastDonation) : new Date()}
                mode="date"
                display="compact"
                maximumDate={new Date()}
                onValueChange={(_e, d) => setLastDonation(toLocalISODate(d))}
              />
            )}
            <View style={[styles.notice, waitUntil && styles.noticeWait]}>
              <Ionicons name={waitUntil ? 'time-outline' : 'checkmark-circle-outline'} size={18} color={waitUntil ? colors.badge.orangeIcon : colors.green} />
              <Text style={styles.noticeText}>
                {waitUntil
                  ? `For your safety you won’t get alerts until ${formatCalendarDate(waitUntil)} (${DONATION_GAP_DAYS} days after donating).`
                  : 'You can receive donation requests now.'}
              </Text>
            </View>
          </>
        )}

        <Pressable style={({ pressed }) => [styles.cta, (pressed || isSaving) && styles.pressed]} onPress={save} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={typography.button}>Save</Text>}
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
  pressed: { opacity: 0.75 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  first: { marginTop: 0 },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 17 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface,
  },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locate: {
    width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.green, backgroundColor: colors.blobLight,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextActive: { color: '#FFFFFF' },
  groupChip: {
    width: 64, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  groupChipActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  groupChipText: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  switchCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, padding: spacing.md,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  switchTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  dateButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateText: { fontSize: 15, color: colors.textPrimary },
  placeholder: { color: colors.textSecondary },
  clear: { fontSize: 13, fontWeight: '700', color: colors.danger },
  notice: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.md, padding: spacing.md,
    borderRadius: 14, backgroundColor: colors.blobLight,
  },
  noticeWait: { backgroundColor: colors.badge.orangeBg },
  noticeText: { flex: 1, fontSize: 12, color: colors.textPrimary, lineHeight: 17 },
  cta: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green, paddingVertical: 16,
    borderRadius: 30, marginTop: spacing.xl, minHeight: 56,
  },
});
