import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Linking, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { closeHelpRequest, getHelpRequest, reportHelpRequest, respondToRequest } from '../services/communityService';
import { KIND_LABELS, STATUS_LABELS, URGENCY_INFO, shareText, timeAgo, type HelpRequest } from '../types/community';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'HelpRequest'>;

const DANGER_TINT = '#FCE1E1';

function call(phone: string) {
  Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => Alert.alert('Couldn’t start the call', phone));
}

export default function HelpRequestScreen({ navigation, route }: Props) {
  const { requestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRequest(await getHelpRequest(requestId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t load this request.');
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (action: () => Promise<HelpRequest | void>) => {
    setIsBusy(true);
    try {
      const result = await action();
      if (result) setRequest(result);
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const offer = () =>
    Alert.alert(
      'Offer to donate?',
      'The family will get your name and phone number so they can call you. Please only offer if you can go to the hospital.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Yes, I can donate',
          onPress: () =>
            run(async () => {
              const updated = await respondToRequest(requestId);
              Alert.alert('Thank you 💚', 'The family has been notified. Call them to agree on a time at the hospital.');
              return updated;
            }),
        },
      ]
    );

  const close = (status: 'fulfilled' | 'closed') =>
    Alert.alert(
      status === 'fulfilled' ? 'Mark as fulfilled?' : 'Close this request?',
      status === 'fulfilled' ? 'Donors who offered to help will be thanked, and the request will stop showing.' : 'It will stop showing to donors.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: status === 'fulfilled' ? 'Mark fulfilled' : 'Close request', onPress: () => run(() => closeHelpRequest(requestId, status)) },
      ]
    );

  const report = () =>
    Alert.alert('Report this request?', 'Report requests that look fake, spam or inappropriate. Requests with several reports are hidden.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await reportHelpRequest(requestId, 'Reported from the app');
            Alert.alert('Thanks for reporting', 'We’ll review it.');
            navigation.goBack();
          }),
      },
    ]);

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !request) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.textSecondary} />
        <Text style={styles.muted}>{error ?? 'This request is no longer available.'}</Text>
        <Pressable onPress={() => { setIsLoading(true); load(); }} hitSlop={8}>
          <Text style={styles.link}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const r = request;
  const open = r.status === 'open';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.groupCircle}>
          <Text style={styles.groupText}>{r.bloodGroup}</Text>
        </View>
        <Text style={styles.heroTitle}>
          {r.units} unit{r.units > 1 ? 's' : ''} of {KIND_LABELS[r.kind].toLowerCase()} needed
        </Text>
        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: r.urgency === 'critical' ? DANGER_TINT : colors.badge.orangeBg }]}>
            <Text style={[styles.tagText, { color: r.urgency === 'critical' ? colors.danger : colors.badge.orangeIcon }]}>
              {URGENCY_INFO[r.urgency].label} · {URGENCY_INFO[r.urgency].window}
            </Text>
          </View>
          {!open && (
            <View style={[styles.tag, { backgroundColor: colors.blobLight }]}>
              <Text style={[styles.tagText, { color: colors.green }]}>{STATUS_LABELS[r.status]}</Text>
            </View>
          )}
        </View>
        <Text style={styles.heroMeta}>
          Posted by {r.isMine ? 'you' : r.requesterName} · {timeAgo(r.createdAt)}
        </Text>
      </View>

      <View style={styles.card}>
        <Row icon="person-outline" label="Patient" value={r.patientName} />
        <Row icon="business-outline" label="Hospital" value={r.hospital} />
        <Row icon="location-outline" label="City" value={r.city} />
        <Row icon="call-outline" label="Contact" value={r.contactPhone} />
        {!!r.note && <Row icon="document-text-outline" label="Note" value={r.note} />}
      </View>

      {!r.isMine && open && (
        <>
          {r.responded ? (
            <View style={styles.thanks}>
              <Ionicons name="checkmark-circle" size={22} color={colors.green} />
              <Text style={styles.thanksText}>You offered to donate. Call the family to agree on a time.</Text>
            </View>
          ) : r.canDonate ? (
            <Pressable style={({ pressed }) => [styles.cta, styles.ctaDanger, pressed && styles.pressed]} onPress={offer} disabled={isBusy}>
              {isBusy ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Ionicons name="water" size={20} color="#FFFFFF" />
                  <Text style={typography.button}>I can donate</Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.infoText}>
                Your blood group isn’t a match, or you’re not set up as a donor. You can still help by sharing this request.
              </Text>
            </View>
          )}
          <View style={styles.actionsRow}>
            <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => call(r.contactPhone)}>
              <Ionicons name="call" size={18} color={colors.green} />
              <Text style={styles.secondaryText}>Call</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => Share.share({ message: shareText(r) })}>
              <Ionicons name="share-social-outline" size={18} color={colors.green} />
              <Text style={styles.secondaryText}>Share</Text>
            </Pressable>
          </View>
        </>
      )}

      {r.isMine && (
        <>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{r.notifiedCount}</Text>
              <Text style={styles.statLabel}>Donors alerted</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.green }]}>{r.responseCount}</Text>
              <Text style={styles.statLabel}>Can donate</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>DONORS WHO RESPONDED</Text>
          {r.responders.length === 0 ? (
            <View style={styles.infoBox}>
              <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.infoText}>No responses yet. You’ll get a notification as soon as someone offers. Sharing on WhatsApp helps.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {r.responders.map((d, i) => (
                <View key={`${d.name}${i}`} style={[styles.responder, i > 0 && styles.divider]}>
                  <View style={styles.responderGroup}>
                    <Text style={styles.responderGroupText}>{d.bloodGroup || '—'}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.responderName}>{d.name}</Text>
                    <Text style={styles.responderMeta}>{d.phone} · {timeAgo(d.respondedAt)}</Text>
                  </View>
                  <Pressable style={({ pressed }) => [styles.callButton, pressed && styles.pressed]} onPress={() => call(d.phone)}>
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Pressable style={({ pressed }) => [styles.secondaryWide, pressed && styles.pressed]} onPress={() => Share.share({ message: shareText(r) })}>
            <Ionicons name="logo-whatsapp" size={18} color={colors.green} />
            <Text style={styles.secondaryText}>Share on WhatsApp & more</Text>
          </Pressable>

          {open && (
            <>
              <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={() => close('fulfilled')} disabled={isBusy}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={typography.button}>Mark as fulfilled</Text>
              </Pressable>
              <Pressable style={styles.linkButton} onPress={() => close('closed')} hitSlop={8}>
                <Text style={styles.closeText}>Close without fulfilling</Text>
              </Pressable>
            </>
          )}
        </>
      )}

      {!r.isMine && open && (
        <Pressable style={styles.linkButton} onPress={report} hitSlop={8}>
          <Text style={styles.reportText}>Report this request</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  pressed: { opacity: 0.75 },
  muted: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '700', color: colors.green },

  hero: { alignItems: 'center' },
  groupCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  groupText: { fontSize: 34, fontWeight: '900', color: '#FFFFFF' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  tag: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 999 },
  tagText: { fontSize: 12, fontWeight: '800' },
  heroMeta: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm },

  card: { marginTop: spacing.md, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 12 },
  rowLabel: { width: 72, fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  rowValue: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.lg, minHeight: 56,
  },
  ctaDanger: { backgroundColor: colors.danger },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.green, backgroundColor: colors.surface,
  },
  secondaryWide: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md,
    paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.green, backgroundColor: colors.surface,
  },
  secondaryText: { fontSize: 14, fontWeight: '800', color: colors.green },
  thanks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md, borderRadius: 14, backgroundColor: colors.blobLight },
  thanksText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.green, lineHeight: 18 },
  infoBox: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6, marginTop: spacing.lg },
  responder: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  responderGroup: { width: 40, height: 40, borderRadius: 20, backgroundColor: DANGER_TINT, alignItems: 'center', justifyContent: 'center' },
  responderGroupText: { fontSize: 13, fontWeight: '900', color: colors.danger },
  responderName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  responderMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  callButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  linkButton: { alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm },
  closeText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  reportText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
