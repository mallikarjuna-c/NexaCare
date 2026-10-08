import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Share, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { openExternal } from '../components/ProviderRow';
import { getEmergencyContacts, getMedicalInfo } from '../services/emergencyService';
import { getCurrentLocation, type LocationResult } from '../services/locationService';
import { dialUrl } from '../types/directory';
import {
  PRIMARY_EMERGENCY_NUMBER,
  RELATION_LABELS,
  buildHelpMessage,
  smsUrl,
  whatsappUrls,
  type Coordinates,
  type EmergencyContact,
  type MedicalInfo,
} from '../types/emergency';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Sos'>;

type LocationState =
  | { status: 'loading' }
  | { status: 'ready'; coords: Coordinates; isApproximate: boolean }
  | { status: 'unavailable'; reason: string };

const DANGER_TINT = '#FCE1E1';
const WAIT_FOR_LOCATION_MS = 4000; // how long a tap waits for a pending location before sending without it

const UNAVAILABLE_TEXT: Record<string, string> = {
  permission_denied: 'Location permission is off',
  services_off: 'Phone location (GPS) is off',
  unavailable: "Couldn't get location",
};

export default function SosScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [medical, setMedical] = useState<MedicalInfo>({});
  const [location, setLocation] = useState<LocationState>({ status: 'loading' });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const locationRequest = useRef<Promise<LocationResult> | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [c, info] = await Promise.all([getEmergencyContacts(user.id), getMedicalInfo(user.id)]);
      setContacts(c);
      setMedical(info);
    } catch {
      // Call 112 still works without saved data.
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Start locating the moment the panel opens, so it's usually ready by the time a button is tapped.
  const locate = useCallback(() => {
    setLocation({ status: 'loading' });
    const request = getCurrentLocation().catch((): LocationResult => ({ ok: false, reason: 'unavailable' }));
    locationRequest.current = request;
    request.then((result) => {
      if (locationRequest.current !== request) return; // a newer retry replaced this one
      setLocation(
        result.ok
          ? { status: 'ready', coords: result.coords, isApproximate: result.isApproximate }
          : { status: 'unavailable', reason: result.reason }
      );
    });
  }, []);

  useEffect(() => { locate(); }, [locate]);

  // Uses the location if it's ready; otherwise waits briefly, then sends without it rather than blocking.
  const resolveCoords = async (): Promise<Coordinates | null> => {
    const request = locationRequest.current;
    if (!request) return null;
    const result = await Promise.race([
      request,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), WAIT_FOR_LOCATION_MS)),
    ]);
    return result && result.ok ? result.coords : null;
  };

  const senderName = user?.name ?? 'Someone';

  const withBusy = async (key: string, action: () => Promise<void>) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await action();
    } finally {
      setBusyKey(null);
    }
  };

  const sendSms = (contact: EmergencyContact) =>
    withBusy(`sms-${contact.id}`, async () => {
      const body = buildHelpMessage(senderName, await resolveCoords(), medical);
      await openExternal(smsUrl(contact.phone, body), "Your phone couldn't open Messages.");
    });

  const sendWhatsApp = (contact: EmergencyContact) =>
    withBusy(`wa-${contact.id}`, async () => {
      const body = buildHelpMessage(senderName, await resolveCoords(), medical);
      for (const url of whatsappUrls(contact.phone, body)) {
        try {
          await Linking.openURL(url);
          return;
        } catch {
          // try the next link
        }
      }
      Alert.alert('WhatsApp unavailable', `Send ${contact.name} an SMS instead? SMS works without mobile data.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send SMS', onPress: () => openExternal(smsUrl(contact.phone, body), "Your phone couldn't open Messages.") },
      ]);
    });

  const shareToSeveral = () =>
    withBusy('share', async () => {
      const body = buildHelpMessage(senderName, await resolveCoords(), medical);
      try {
        await Share.share({ message: body });
      } catch {
        Alert.alert('Unable to share', 'Call your contact or 112 directly.');
      }
    });

  const call = (number: string) => openExternal(dialUrl(number), 'Dial the number manually from your phone app.');

  const primary = contacts[0];
  const others = contacts.slice(1);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.closeButton} accessibilityLabel="Close SOS">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Emergency</Text>
        <View style={styles.closeButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {/* Location status */}
        <Pressable
          style={[
            styles.locationPill,
            location.status === 'ready' && styles.locationPillReady,
            location.status === 'unavailable' && styles.locationPillOff,
          ]}
          onPress={location.status === 'unavailable' ? locate : undefined}
          disabled={location.status !== 'unavailable'}
        >
          {location.status === 'loading' ? (
            <>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={styles.locationText}>Getting your location…</Text>
            </>
          ) : location.status === 'ready' ? (
            <>
              <Ionicons name="location" size={16} color={colors.green} />
              <Text style={[styles.locationText, styles.locationTextReady]}>
                Location ready
                {location.coords.accuracy ? ` · ±${Math.round(location.coords.accuracy)} m` : ''}
                {location.isApproximate ? ' (last known)' : ''}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.locationText}>{UNAVAILABLE_TEXT[location.reason] ?? UNAVAILABLE_TEXT.unavailable} · tap to retry</Text>
            </>
          )}
        </Pressable>

        {/* 1. Alert primary trusted contact */}
        {primary ? (
          <Pressable
            style={({ pressed }) => [styles.alertButton, pressed && styles.bigPressed]}
            onPress={() => sendWhatsApp(primary)}
            disabled={!!busyKey}
            accessibilityRole="button"
            accessibilityLabel={`Alert ${primary.name} on WhatsApp`}
          >
            {busyKey === `wa-${primary.id}` ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons name="logo-whatsapp" size={30} color="#FFFFFF" />
            )}
            <View style={styles.flexText}>
              <Text style={styles.alertTitle}>SOS — Alert {primary.name}</Text>
              <Text style={styles.alertSub}>Opens WhatsApp with your help message{location.status === 'ready' ? ' & location' : ''}</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.setupButton, pressed && styles.bigPressed]}
            onPress={() => navigation.navigate('AddEmergencyContact')}
          >
            <Ionicons name="person-add-outline" size={24} color={colors.danger} />
            <View style={styles.flexText}>
              <Text style={styles.setupTitle}>Add a trusted contact</Text>
              <Text style={styles.setupSub}>So SOS can alert them on WhatsApp in one tap</Text>
            </View>
          </Pressable>
        )}

        {/* 2. Call 112 */}
        <Pressable
          style={({ pressed }) => [styles.callButton, pressed && styles.bigPressed]}
          onPress={() => call(PRIMARY_EMERGENCY_NUMBER)}
          accessibilityRole="button"
          accessibilityLabel="Call 112, emergency services"
        >
          <Ionicons name="call" size={28} color={colors.danger} />
          <View style={styles.flexText}>
            <Text style={styles.callTitle}>Call {PRIMARY_EMERGENCY_NUMBER}</Text>
            <Text style={styles.callSub}>Police · ambulance · fire</Text>
          </View>
        </Pressable>

        {primary && (
          <Pressable style={styles.smsLink} onPress={() => sendSms(primary)} disabled={!!busyKey} hitSlop={6}>
            <Ionicons name="chatbubble-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.smsLinkText}>No internet? Send SMS to {primary.name}</Text>
          </Pressable>
        )}

        {/* Other trusted contacts */}
        {others.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Other trusted contacts</Text>
            <View style={styles.card}>
              {others.map((c, i) => (
                <View key={c.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.contactRow}>
                    <View style={styles.flexText}>
                      <Text style={styles.contactName} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.contactSub}>{RELATION_LABELS[c.relation]}</Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.roundButton, styles.roundWhatsApp, pressed && styles.pressed]}
                      onPress={() => sendWhatsApp(c)}
                      disabled={!!busyKey}
                      accessibilityLabel={`WhatsApp ${c.name}`}
                    >
                      {busyKey === `wa-${c.id}` ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                      )}
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
                      onPress={() => sendSms(c)}
                      disabled={!!busyKey}
                      accessibilityLabel={`SMS ${c.name}`}
                    >
                      <Ionicons name="chatbubble-outline" size={17} color={colors.blue} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
                      onPress={() => call(c.phone)}
                      accessibilityLabel={`Call ${c.name}`}
                    >
                      <Ionicons name="call-outline" size={17} color={colors.green} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {contacts.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.shareRow, pressed && styles.pressed]}
            onPress={shareToSeveral}
            disabled={!!busyKey}
          >
            {busyKey === 'share' ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} />
            )}
            <View style={styles.flexText}>
              <Text style={styles.shareTitle}>Send to several people</Text>
              <Text style={styles.shareSub}>Pick any app — WhatsApp lets you choose up to 5 chats</Text>
            </View>
          </Pressable>
        )}

        <Pressable style={styles.moreLink} onPress={() => navigation.navigate('Emergency')} hitSlop={6}>
          <Text style={styles.moreLinkText}>Medical ID, helplines & setup</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.green} />
        </Pressable>

        <Text style={styles.footnote}>
          Nothing is sent until you press Send in WhatsApp or Messages. If mobile data is down, use Call {PRIMARY_EMERGENCY_NUMBER} or SMS.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },
  bigPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 18, fontWeight: '800', color: colors.danger, letterSpacing: 0.5 },

  locationPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, alignSelf: 'center',
    backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6,
    marginBottom: spacing.lg,
  },
  locationPillReady: { backgroundColor: colors.badge.greenBg },
  locationPillOff: { backgroundColor: colors.background },
  locationText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  locationTextReady: { color: colors.green },

  alertButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.danger, borderRadius: 20, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
    minHeight: 96,
  },
  alertTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  alertSub: { fontSize: 13, color: '#FFFFFF', opacity: 0.9, marginTop: 2 },

  setupButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: DANGER_TINT, borderRadius: 20, borderWidth: 1.5, borderColor: colors.danger, borderStyle: 'dashed',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 96,
  },
  setupTitle: { fontSize: 18, fontWeight: '800', color: colors.danger },
  setupSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  callButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md,
    backgroundColor: DANGER_TINT, borderRadius: 20, borderWidth: 1.5, borderColor: colors.danger,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 84,
  },
  callTitle: { fontSize: 20, fontWeight: '800', color: colors.danger },
  callSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  smsLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginTop: spacing.md, paddingVertical: spacing.sm,
  },
  smsLinkText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textDecorationLine: 'underline' },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  contactName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  contactSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  roundButton: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  roundWhatsApp: { backgroundColor: colors.green, borderColor: colors.green },

  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.background, borderRadius: 16, padding: spacing.md,
  },
  shareTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  shareSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  moreLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginTop: spacing.lg, paddingVertical: spacing.sm,
  },
  moreLinkText: { fontSize: 14, fontWeight: '700', color: colors.green },
  footnote: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 17, marginTop: spacing.sm },
});
