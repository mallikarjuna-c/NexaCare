import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { getDonorProfile, listHelpRequests } from '../services/communityService';
import {
  KIND_LABELS,
  STATUS_LABELS,
  URGENCY_INFO,
  nextEligibleDate,
  timeAgo,
  type DonorProfile,
  type HelpRequest,
} from '../types/community';
import { formatCalendarDate } from '../types/followUps';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Community'>;
type Tab = 'nearby' | 'mine';

const DANGER_TINT = '#FCE1E1';
const URGENCY_TINT = {
  critical: { bg: DANGER_TINT, fg: colors.danger },
  urgent: { bg: colors.badge.orangeBg, fg: colors.badge.orangeIcon },
  planned: { bg: colors.badge.blueBg, fg: colors.badge.blueIcon },
};

export default function CommunityScreen({ navigation }: Props) {
  const [donor, setDonor] = useState<DonorProfile | null>(null);
  const [nearby, setNearby] = useState<HelpRequest[]>([]);
  const [mine, setMine] = useState<HelpRequest[]>([]);
  const [tab, setTab] = useState<Tab>('nearby');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [profile, near, own] = await Promise.all([getDonorProfile(), listHelpRequests('nearby'), listHelpRequests('mine')]);
      setDonor(profile);
      setNearby(near);
      setMine(own);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t load requests.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const hasCity = !!donor?.city;
  const waitUntil = nextEligibleDate(donor?.lastDonation ?? null);
  const list = tab === 'nearby' ? nearby : mine;

  const renderCard = (r: HelpRequest) => {
    const urgency = URGENCY_TINT[r.urgency];
    return (
      <Pressable
        key={r.id}
        style={({ pressed }) => [styles.card, r.canDonate && styles.cardMatch, pressed && styles.pressed]}
        onPress={() => navigation.navigate('HelpRequest', { requestId: r.id })}
      >
        <View style={styles.groupBadge}>
          <Text style={styles.groupText}>{r.bloodGroup}</Text>
          <Text style={styles.groupKind}>{KIND_LABELS[r.kind]}</Text>
        </View>
        <View style={styles.flex}>
          <View style={styles.cardTop}>
            <View style={[styles.urgency, { backgroundColor: urgency.bg }]}>
              <Text style={[styles.urgencyText, { color: urgency.fg }]}>{URGENCY_INFO[r.urgency].label}</Text>
            </View>
            <Text style={styles.time}>{timeAgo(r.createdAt)}</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {r.units} unit{r.units > 1 ? 's' : ''} · {r.hospital}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {r.city} · for {r.patientName}
          </Text>
          <View style={styles.cardFooter}>
            {r.isMine ? (
              <Text style={[styles.footerText, r.status !== 'open' && styles.muted]}>
                {r.status === 'open'
                  ? `${r.responseCount} donor${r.responseCount === 1 ? '' : 's'} responded · ${r.notifiedCount} alerted`
                  : STATUS_LABELS[r.status]}
              </Text>
            ) : r.responded ? (
              <Text style={[styles.footerText, { color: colors.green }]}>✓ You offered to donate</Text>
            ) : r.canDonate ? (
              <Text style={[styles.footerText, { color: colors.danger }]}>You’re a match — tap to help</Text>
            ) : (
              <Text style={styles.footerText}>Share with someone who can help</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} colors={[colors.green]} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [styles.donorCard, donor?.willing && styles.donorCardOn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('DonorSettings')}
        >
          <View style={[styles.donorIcon, donor?.willing && styles.donorIconOn]}>
            <Ionicons name="water" size={22} color={donor?.willing ? '#FFFFFF' : colors.danger} />
          </View>
          <View style={styles.flex}>
            {donor?.willing ? (
              <>
                <Text style={styles.donorTitle}>
                  You’re a donor · {donor.bloodGroup} · {donor.city}
                </Text>
                <Text style={styles.donorSub}>
                  {waitUntil
                    ? `You can donate again from ${formatCalendarDate(waitUntil)}`
                    : 'You’ll be alerted when someone nearby needs your blood group'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.donorTitle}>{hasCity ? 'Become a blood donor' : 'Set up your community'}</Text>
                <Text style={styles.donorSub}>
                  {hasCity
                    ? `Get alerts when someone in ${donor?.city} needs your blood group`
                    : 'Choose your city to see requests near you'}
                </Text>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.segment}>
          {(['nearby', 'mine'] as Tab[]).map((t) => (
            <Pressable key={t} style={[styles.segmentItem, tab === t && styles.segmentItemActive]} onPress={() => setTab(t)}>
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                {t === 'nearby' ? `Nearby${nearby.length ? ` (${nearby.length})` : ''}` : 'My requests'}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={refresh} hitSlop={8}>
              <Text style={styles.link}>Try again</Text>
            </Pressable>
          </View>
        ) : tab === 'nearby' && !hasCity ? (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={30} color={colors.green} />
            <Text style={styles.emptyTitle}>Choose your city</Text>
            <Text style={styles.muted}>Requests are shared with people in the same city, since donors travel to the hospital.</Text>
            <Pressable style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={() => navigation.navigate('DonorSettings')}>
              <Text style={styles.pillText}>Set my city</Text>
            </Pressable>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name={tab === 'nearby' ? 'heart-outline' : 'document-text-outline'} size={30} color={colors.green} />
            <Text style={styles.emptyTitle}>{tab === 'nearby' ? 'No open requests nearby' : 'You haven’t asked for help yet'}</Text>
            <Text style={styles.muted}>
              {tab === 'nearby'
                ? `When someone in ${donor?.city} needs blood, it will appear here.`
                : 'If you or a family member needs blood, post a request and matching donors will be alerted.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>{list.map(renderCard)}</View>
        )}
      </ScrollView>

      <View style={styles.ctaWrap}>
        <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={() => navigation.navigate('CreateHelpRequest')}>
          <Ionicons name="water" size={20} color="#FFFFFF" />
          <Text style={typography.button}>Request blood</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: 110 },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  muted: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  link: { fontSize: 13, fontWeight: '700', color: colors.green },

  donorCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 18,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  donorCardOn: { borderColor: colors.danger },
  donorIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: DANGER_TINT, alignItems: 'center', justifyContent: 'center' },
  donorIconOn: { backgroundColor: colors.danger },
  donorTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  donorSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },

  segment: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    padding: 4, marginTop: spacing.md, marginBottom: spacing.md,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.sm, borderRadius: 999, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.green },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  segmentTextActive: { color: '#FFFFFF' },

  list: { gap: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 18,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  cardMatch: { borderColor: colors.danger, borderWidth: 1.5 },
  groupBadge: { width: 58, height: 58, borderRadius: 16, backgroundColor: DANGER_TINT, alignItems: 'center', justifyContent: 'center' },
  groupText: { fontSize: 20, fontWeight: '900', color: colors.danger },
  groupKind: { fontSize: 9, fontWeight: '800', color: colors.danger, marginTop: -2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  urgency: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  urgencyText: { fontSize: 11, fontWeight: '800' },
  time: { fontSize: 11, color: colors.textSecondary },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginTop: 4 },
  cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  cardFooter: { marginTop: 6 },
  footerText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  pill: { marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: 999, backgroundColor: colors.green },
  pillText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  ctaWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.danger, paddingVertical: 15, borderRadius: 30,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
});
