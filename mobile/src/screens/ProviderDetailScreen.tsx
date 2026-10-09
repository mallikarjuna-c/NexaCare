import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { PROVIDER_BADGES, openExternal } from '../components/ProviderRow';
import { FOLLOW_UP_BADGES } from '../components/FollowUpCard';
import { deleteProvider, getProviderById, setProviderFavorite } from '../services/directoryService';
import { getFollowUps } from '../services/followUpService';
import { getExpenses } from '../services/expenseService';
import { PROVIDER_TYPE_LABELS, dialUrl, providerMapsUrl, type Provider } from '../types/directory';
import { formatWhen, isOverdue, type FollowUp } from '../types/followUps';
import { formatAmount, type Expense } from '../types/expenses';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'ProviderDetail'>;

export default function ProviderDetailScreen({ navigation, route }: Props) {
  const { providerId } = route.params;
  const { user } = useAuth();
  const { activeProfile } = useFamily();
  const profileId = activeProfile?.id;
  const [provider, setProvider] = useState<Provider | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user || !profileId) return;
    try {
      const [p, allFollowUps, allExpenses] = await Promise.all([
        getProviderById(user.id, providerId),
        getFollowUps(profileId),
        getExpenses(profileId),
      ]);
      setProvider(p);
      setFollowUps(allFollowUps.filter((f) => f.providerId === providerId));
      setExpenses(allExpenses.filter((e) => e.providerId === providerId));
    } catch {
      setProvider(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, profileId, providerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleFavorite = async () => {
    if (!user || !provider || isBusy) return;
    setIsBusy(true);
    try {
      setProvider(await setProviderFavorite(user.id, providerId, !provider.isFavorite));
    } catch {
      Alert.alert('Something went wrong', "We couldn't update this provider. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Remove provider?',
      'This removes it from your directory. Linked follow-ups and expenses are kept and still show the name.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setIsBusy(true);
            try {
              await deleteProvider(user.id, providerId);
              navigation.goBack();
            } catch {
              setIsBusy(false);
              Alert.alert('Something went wrong', "We couldn't remove this provider. Please try again.");
            }
          },
        },
      ]
    );

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Ionicons name="help-circle-outline" size={32} color={colors.textSecondary} />
        <Text style={styles.stateText}>This provider couldn't be found.</Text>
      </View>
    );
  }

  const badge = PROVIDER_BADGES[provider.type];
  const mapsUrl = providerMapsUrl(provider);

  const now = Date.now();
  const nextFollowUp = followUps.find((f) => f.status === 'scheduled' && !isOverdue(f, now));
  const overdueCount = followUps.filter((f) => isOverdue(f, now)).length;
  const completedCount = followUps.filter((f) => f.status === 'completed').length;
  const thisYear = String(new Date().getFullYear());
  const spentThisYear = expenses.filter((e) => e.date.startsWith(thisYear)).reduce((sum, e) => sum + e.amountPaise, 0);
  const spentAllTime = expenses.reduce((sum, e) => sum + e.amountPaise, 0);
  const hasActivity = followUps.length > 0 || expenses.length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: badge.bg }]}>
          <Ionicons name={badge.icon} size={28} color={badge.tint} />
        </View>
        <Text style={styles.typeLabel}>{PROVIDER_TYPE_LABELS[provider.type]}</Text>
        <Text style={styles.name}>{provider.name}</Text>
        {provider.specialty ? <Text style={styles.specialty}>{provider.specialty}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.favoriteChip, provider.isFavorite && styles.favoriteChipOn, pressed && styles.pressed]}
          onPress={toggleFavorite}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityState={{ selected: provider.isFavorite }}
        >
          <Ionicons name={provider.isFavorite ? 'star' : 'star-outline'} size={14} color={colors.accent} />
          <Text style={styles.favoriteText}>{provider.isFavorite ? 'Favourite' : 'Add to favourites'}</Text>
        </Pressable>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionTile, !provider.phone && styles.actionTileDisabled, pressed && styles.pressed]}
          onPress={() => provider.phone && openExternal(dialUrl(provider.phone), "Your phone couldn't open the dialer.")}
          disabled={!provider.phone}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.badge.greenBg }]}>
            <Ionicons name="call-outline" size={20} color={colors.green} />
          </View>
          <Text style={styles.actionLabel}>Call</Text>
          {!provider.phone && <Text style={styles.actionHint}>No number saved</Text>}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionTile, !mapsUrl && styles.actionTileDisabled, pressed && styles.pressed]}
          onPress={() => mapsUrl && openExternal(mapsUrl, "Your phone couldn't open Maps.")}
          disabled={!mapsUrl}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.badge.blueBg }]}>
            <Ionicons name="navigate-outline" size={20} color={colors.badge.blueIcon} />
          </View>
          <Text style={styles.actionLabel}>{provider.mapsUrl ? 'Open in Maps' : 'Directions'}</Text>
          {!mapsUrl && <Text style={styles.actionHint}>No address or link</Text>}
        </Pressable>
      </View>

      {(provider.phone || provider.address || provider.mapsUrl) && (
        <View style={styles.card}>
          {provider.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
              <View style={styles.flexText}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue} selectable>{provider.phone}</Text>
              </View>
            </View>
          )}
          {provider.phone && provider.address && <View style={styles.divider} />}
          {provider.address && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <View style={styles.flexText}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue} selectable>{provider.address}</Text>
              </View>
            </View>
          )}
          {provider.mapsUrl && (
            <>
              {(provider.phone || provider.address) && <View style={styles.divider} />}
              <View style={styles.infoRow}>
                <Ionicons name="pin-outline" size={18} color={colors.textSecondary} />
                <View style={styles.flexText}>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValue}>Pinned on Google Maps</Text>
                </View>
                <Ionicons name="checkmark-circle" size={18} color={colors.green} />
              </View>
            </>
          )}
        </View>
      )}

      {provider.notes ? (
        <View style={[styles.card, styles.notesCard]}>
          <Text style={styles.infoLabel}>Notes</Text>
          <Text style={styles.notesText}>{provider.notes}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Activity</Text>
      <View style={styles.card}>
        {nextFollowUp ? (
          <Pressable
            style={({ pressed }) => [styles.nextRow, pressed && styles.pressed]}
            onPress={() => navigation.navigate('FollowUpDetail', { followUpId: nextFollowUp.id })}
          >
            <View style={[styles.nextIcon, { backgroundColor: FOLLOW_UP_BADGES[nextFollowUp.type].bg }]}>
              <Ionicons
                name={FOLLOW_UP_BADGES[nextFollowUp.type].icon}
                size={18}
                color={FOLLOW_UP_BADGES[nextFollowUp.type].tint}
              />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.infoLabel}>Next follow-up</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{nextFollowUp.title}</Text>
              <Text style={styles.nextWhen}>{formatWhen(nextFollowUp.scheduledAt)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={styles.nextRow}>
            <Ionicons name="calendar-clear-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.mutedText}>No upcoming follow-up with this provider</Text>
          </View>
        )}
        {overdueCount > 0 && (
          <>
            <View style={styles.dividerFull} />
            <Pressable
              style={({ pressed }) => [styles.nextRow, pressed && styles.pressed]}
              onPress={() => navigation.navigate('FollowUps')}
            >
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={[styles.flexText, styles.overdueText]}>
                {overdueCount} overdue {overdueCount === 1 ? 'follow-up' : 'follow-ups'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </>
        )}
        <View style={styles.dividerFull} />
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatAmount(spentThisYear)}</Text>
            <Text style={styles.statLabel}>Spent in {thisYear}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatAmount(spentAllTime)}</Text>
            <Text style={styles.statLabel}>All time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>Visits done</Text>
          </View>
        </View>
        {!hasActivity && (
          <Text style={styles.activityHint}>
            Link follow-ups and expenses to this provider (tap the people icon in those forms) to see them here.
          </Text>
        )}
      </View>

      <View style={styles.quickRow}>
        <Pressable
          style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('AddFollowUp', { providerId })}
          disabled={isBusy}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.green} />
          <Text style={styles.secondaryText}>Book follow-up</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('AddExpense', { providerId })}
          disabled={isBusy}
        >
          <Ionicons name="wallet-outline" size={18} color={colors.green} />
          <Text style={styles.secondaryText}>Log expense</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        onPress={() => navigation.navigate('AddProvider', { providerId })}
        disabled={isBusy}
      >
        <Ionicons name="create-outline" size={18} color={colors.green} />
        <Text style={styles.secondaryText}>Edit</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={confirmDelete} disabled={isBusy} hitSlop={8}>
        <Ionicons name="trash-outline" size={16} color={colors.danger} />
        <Text style={styles.deleteText}>Remove provider</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },
  stateText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  hero: { alignItems: 'center', marginBottom: spacing.lg },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  typeLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.xs, textAlign: 'center' },
  specialty: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  favoriteChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  favoriteChipOn: { backgroundColor: colors.badge.orangeBg, borderColor: colors.badge.orangeBg },
  favoriteText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },

  actionsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  actionTile: {
    flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
  },
  actionTileDisabled: { opacity: 0.5 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  actionHint: { fontSize: 11, color: colors.textSecondary },

  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 18 + spacing.md },
  infoLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  infoValue: { fontSize: 14, color: colors.textPrimary, marginTop: 2, lineHeight: 20 },
  notesCard: { padding: spacing.md, marginTop: spacing.md },
  notesText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginTop: spacing.xs },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  nextIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  nextWhen: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  mutedText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  overdueText: { fontSize: 13, fontWeight: '700', color: colors.danger },
  dividerFull: { height: 1, backgroundColor: colors.border },
  statsRow: { flexDirection: 'row', paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValue: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  activityHint: {
    fontSize: 12, color: colors.textSecondary, lineHeight: 17,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md, textAlign: 'center',
  },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quickButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border, borderRadius: 30, paddingVertical: 12, backgroundColor: colors.surface,
  },

  secondaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xl,
    borderWidth: 1, borderColor: colors.green, borderRadius: 30, paddingVertical: 12, backgroundColor: colors.surface,
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: colors.green },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginTop: spacing.lg, paddingVertical: spacing.sm,
  },
  deleteText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
