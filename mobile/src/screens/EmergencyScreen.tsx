import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import ProviderRow, { openExternal } from '../components/ProviderRow';
import { getEmergencyContacts, getMedicalInfo } from '../services/emergencyService';
import { getProviders } from '../services/directoryService';
import { hasLocationPermission, requestLocationPermission } from '../services/locationService';
import { dialUrl, type Provider } from '../types/directory';
import {
  HELPLINES,
  PRIMARY_EMERGENCY_NUMBER,
  RELATION_LABELS,
  hasMedicalInfo,
  type EmergencyContact,
  type MedicalInfo,
} from '../types/emergency';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Emergency'>;

const DANGER_TINT = '#FCE1E1';
const DANGER_BORDER = '#F3C6C6';

function dial(number: string) {
  openExternal(dialUrl(number), "Your phone couldn't open the dialer. Dial the number manually.");
}

export default function EmergencyScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [healthcare, setHealthcare] = useState<Provider[]>([]);
  const [medical, setMedical] = useState<MedicalInfo>({});
  const [locationGranted, setLocationGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [c, providers, info, granted] = await Promise.all([
        getEmergencyContacts(user.id),
        getProviders(user.id),
        getMedicalInfo(user.id),
        hasLocationPermission().catch(() => false),
      ]);
      setContacts(c);
      setHealthcare(providers.filter((p) => p.isEmergencyContact));
      setMedical(info);
      setLocationGranted(granted);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const allowLocation = async () => {
    try {
      const result = await requestLocationPermission();
      if (result === 'granted') setLocationGranted(true);
      else if (result === 'blocked') {
        Alert.alert('Location is blocked', 'Allow location for NexaCare in your phone settings.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
      }
    } catch {
      Alert.alert('Something went wrong', "We couldn't request location access.");
    }
  };

  const readiness = [
    {
      key: 'contact',
      done: contacts.length > 0,
      label: 'Trusted contact',
      action: 'Add',
      onPress: () => navigation.navigate('AddEmergencyContact'),
    },
    {
      key: 'medical',
      done: hasMedicalInfo(medical),
      label: 'Medical ID',
      action: 'Add',
      onPress: () => navigation.navigate('MedicalInfo', { profileId: user?.id }),
    },
    { key: 'location', done: locationGranted, label: 'Location access', action: 'Allow', onPress: allowLocation },
  ];
  const readyCount = readiness.filter((r) => r.done).length;
  const isReady = readyCount === readiness.length;

  const medicalRows = [
    { label: 'Allergies', value: medical.allergies, important: true },
    { label: 'Conditions', value: medical.conditions },
    { label: 'Medications', value: medical.medications },
    { label: 'Notes', value: medical.notes },
  ].filter((r) => r.value);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable
        style={({ pressed }) => [styles.sosCard, pressed && styles.pressed]}
        onPress={() => navigation.navigate('Sos')}
        accessibilityRole="button"
        accessibilityLabel="Open SOS"
      >
        <View style={styles.sosBadge}>
          <Text style={styles.sosBadgeText}>SOS</Text>
        </View>
        <View style={styles.flexText}>
          <Text style={styles.sosTitle}>Need help now?</Text>
          <Text style={styles.sosSub}>Alert your trusted contacts on WhatsApp or call {PRIMARY_EMERGENCY_NUMBER}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.danger} />
      </Pressable>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <>
          {isReady ? (
            <View style={styles.readyBanner}>
              <Ionicons name="shield-checkmark" size={18} color={colors.green} />
              <Text style={styles.readyBannerText}>You're prepared — SOS has everything it needs.</Text>
            </View>
          ) : (
            <View style={[styles.card, styles.readinessCard]}>
              <View style={styles.readinessHeader}>
                <Text style={styles.sectionLabel}>Get ready for SOS</Text>
                <Text style={styles.readinessCount}>{readyCount}/{readiness.length}</Text>
              </View>
              <Text style={styles.readinessHint}>Set these up now so you don't have to during an emergency.</Text>
              {readiness.map((item) => (
                <View key={item.key} style={styles.readinessRow}>
                  <Ionicons
                    name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={item.done ? colors.green : colors.textSecondary}
                  />
                  <Text style={[styles.readinessLabel, item.done && styles.readinessLabelDone]}>{item.label}</Text>
                  {!item.done && (
                    <Pressable style={({ pressed }) => [styles.readinessAction, pressed && styles.pressed]} onPress={item.onPress}>
                      <Text style={styles.readinessActionText}>{item.action}</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.sectionHeaderRow}>
            <View style={styles.flexText}>
              <Text style={styles.sectionLabel}>Trusted contacts</Text>
              <Text style={styles.sectionHintTight}>SOS alerts your primary contact first</Text>
            </View>
            <Pressable onPress={() => navigation.navigate('AddEmergencyContact')} hitSlop={8}>
              <Text style={styles.linkText}>Add</Text>
            </Pressable>
          </View>
          {contacts.length === 0 ? (
            <Pressable
              style={({ pressed }) => [styles.emptyCard, pressed && styles.pressed]}
              onPress={() => navigation.navigate('AddEmergencyContact')}
            >
              <Ionicons name="people-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.emptyText}>Add a family member or friend. The first one becomes your primary contact.</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.card}>
              {contacts.map((c, i) => (
                <View key={c.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={({ pressed }) => [styles.contactRow, pressed && styles.pressed]}
                    onPress={() => navigation.navigate('AddEmergencyContact', { contactId: c.id })}
                    accessibilityHint="Opens contact settings"
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{c.name.trim().charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.flexText}>
                      <View style={styles.nameRow}>
                        <Text style={styles.contactName} numberOfLines={1}>{c.name}</Text>
                        {i === 0 && (
                          <View style={styles.primaryBadge}>
                            <Text style={styles.primaryBadgeText}>Primary</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.contactSub} numberOfLines={1}>
                        {RELATION_LABELS[c.relation]} · {c.phone}
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
                      onPress={(e) => { e.stopPropagation(); dial(c.phone); }}
                      hitSlop={6}
                      accessibilityLabel={`Call ${c.name}`}
                    >
                      <Ionicons name="call-outline" size={17} color={colors.green} />
                    </Pressable>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
            <View style={styles.flexText}>
              <Text style={styles.sectionLabel}>Medical ID</Text>
              <Text style={styles.sectionHintTight}>Included in your SOS message</Text>
            </View>
            <Pressable onPress={() => navigation.navigate('MedicalInfo', { profileId: user?.id })} hitSlop={8}>
              <Text style={styles.linkText}>{hasMedicalInfo(medical) ? 'Edit' : 'Add'}</Text>
            </Pressable>
          </View>
          {hasMedicalInfo(medical) ? (
            <View style={styles.card}>
              <View style={styles.medicalHeader}>
                <View style={styles.bloodBadge}>
                  <Ionicons name="water" size={16} color={colors.danger} />
                  <Text style={styles.bloodText}>{medical.bloodGroup ?? '—'}</Text>
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.medicalName}>{user?.name}</Text>
                  <Text style={styles.medicalSub}>Blood group {medical.bloodGroup ?? 'not set'}</Text>
                </View>
              </View>
              {medicalRows.map((row) => (
                <View key={row.label} style={styles.medicalRow}>
                  <Text style={styles.medicalLabel}>{row.label}</Text>
                  <Text style={[styles.medicalValue, row.important && styles.medicalValueImportant]}>{row.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.emptyCard, pressed && styles.pressed]}
              onPress={() => navigation.navigate('MedicalInfo', { profileId: user?.id })}
            >
              <Ionicons name="id-card-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                Add your blood group, allergies and medications so anyone helping you knows at a glance.
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          )}

          <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
            <View style={styles.flexText}>
              <Text style={styles.sectionLabel}>Healthcare contacts</Text>
              <Text style={styles.sectionHintTight}>Your nearest hospital & family doctor</Text>
            </View>
          </View>
          {healthcare.length === 0 ? (
            <Pressable
              style={({ pressed }) => [styles.emptyCard, pressed && styles.pressed]}
              onPress={() => navigation.navigate('Directory')}
            >
              <Ionicons name="business-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                In Healthcare Directory, turn on "Show on Emergency screen" for your nearest hospital or family doctor.
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.card}>
              {healthcare.map((p, i) => (
                <View key={p.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <ProviderRow provider={p} onPress={() => navigation.navigate('ProviderDetail', { providerId: p.id })} />
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Helplines</Text>
      <Text style={styles.sectionHint}>Numbers for India · tap to open your dialer</Text>
      <View style={styles.helplineGrid}>
        {HELPLINES.map((h) => (
          <Pressable
            key={h.number}
            style={({ pressed }) => [styles.helplineTile, pressed && styles.pressed]}
            onPress={() => dial(h.number)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${h.label}, ${h.number}`}
          >
            <Ionicons name={h.icon} size={18} color={colors.danger} />
            <Text style={styles.helplineNumber}>{h.number}</Text>
            <Text style={styles.helplineLabel} numberOfLines={2}>{h.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.card, styles.builtInCard]}>
        <View style={styles.builtInHeader}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.textPrimary} />
          <Text style={styles.builtInTitle}>Also set up your phone's own SOS</Text>
        </View>
        <Text style={styles.builtInText}>
          Most Android phones can call for help and share your location when you press the power button 5 times — even
          when the phone is locked. You can also add medical info that shows on the lock screen.
        </Text>
        <Text style={styles.builtInText}>
          Look in Settings → Safety & emergency (or search "Emergency SOS" in Settings). Menu names vary by brand.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.builtInButton, pressed && styles.pressed]}
          onPress={() => Linking.openSettings().catch(() => {})}
        >
          <Text style={styles.builtInButtonText}>Open Settings</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.green} />
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>
        NexaCare doesn't contact emergency services for you. Always call {PRIMARY_EMERGENCY_NUMBER} if someone's life is
        at risk.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },
  loader: { marginTop: spacing.lg },

  sosCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: DANGER_TINT, borderRadius: 16, borderWidth: 1, borderColor: DANGER_BORDER,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  sosBadge: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  sosBadgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  sosTitle: { fontSize: 16, fontWeight: '800', color: colors.danger },
  sosSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },

  readyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg,
    backgroundColor: colors.badge.greenBg, borderRadius: 14, padding: spacing.md,
  },
  readyBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.green },
  readinessCard: { padding: spacing.md, marginBottom: spacing.lg },
  readinessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readinessCount: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  readinessHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, minHeight: 40 },
  readinessLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  readinessLabelDone: { color: colors.textSecondary },
  readinessAction: { backgroundColor: colors.green, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  readinessActionText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sectionSpacing: { marginTop: spacing.lg },
  sectionHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm },
  sectionHintTight: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.green },

  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 40 + spacing.md },
  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  emptyText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.badge.greenBg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.green },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  contactName: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  contactSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  primaryBadge: { backgroundColor: DANGER_TINT, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  primaryBadgeText: { fontSize: 10, fontWeight: '800', color: colors.danger },
  roundButton: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },

  medicalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  bloodBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: DANGER_TINT, alignItems: 'center', justifyContent: 'center' },
  bloodText: { fontSize: 15, fontWeight: '800', color: colors.danger },
  medicalName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  medicalSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  medicalRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  medicalLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  medicalValue: { fontSize: 14, color: colors.textPrimary, marginTop: 2, lineHeight: 20 },
  medicalValueImportant: { color: colors.danger, fontWeight: '700' },

  helplineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  helplineTile: {
    width: '31.5%', alignItems: 'center', gap: 2, paddingVertical: spacing.md, paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  helplineNumber: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.xs },
  helplineLabel: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },

  builtInCard: { padding: spacing.md, marginTop: spacing.lg },
  builtInHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  builtInTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  builtInText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: spacing.xs },
  builtInButton: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginTop: spacing.sm },
  builtInButtonText: { fontSize: 13, fontWeight: '700', color: colors.green },

  disclaimer: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg, lineHeight: 17 },
});
