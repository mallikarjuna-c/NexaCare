import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { FOLLOW_UP_BADGES } from '../components/FollowUpCard';
import { openExternal } from '../components/ProviderRow';
import {
  deleteFollowUp, getActiveReminderIds, getFollowUpById, setFollowUpStatus,
} from '../services/followUpService';
import { getProviderById } from '../services/directoryService';
import { dialUrl, mapsDirectionsUrl, providerMapsUrl, type Provider } from '../types/directory';
import {
  FOLLOW_UP_TYPE_LABELS,
  REMINDER_OFFSET_LABELS,
  formatAbsolute,
  formatWhen,
  isOverdue,
  reminderTimeFor,
  type FollowUp,
  type FollowUpStatus,
} from '../types/followUps';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'FollowUpDetail'>;

const DANGER_TINT = '#FCE1E1';

function reminderDescription(f: FollowUp, hasReminder: boolean): string {
  if (f.reminderOffset === 'none') return 'No reminder';
  const at = reminderTimeFor(f.scheduledAt, f.reminderOffset);
  const label = REMINDER_OFFSET_LABELS[f.reminderOffset];
  if (hasReminder && at) return `${label} · ${formatAbsolute(at)}`;
  if (f.status !== 'scheduled') return `${label} · no longer active`;
  if (at && at.getTime() <= Date.now()) return `${label} · time has passed`;
  return `${label} · not active (notifications are off)`;
}

export default function FollowUpDetailScreen({ navigation, route }: Props) {
  const { followUpId } = route.params;
  const { user } = useAuth();
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [hasReminder, setHasReminder] = useState(false);
  const [linkedProvider, setLinkedProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [item, active] = await Promise.all([getFollowUpById(user.id, followUpId), getActiveReminderIds(user.id)]);
      setFollowUp(item);
      setHasReminder(active.has(followUpId));
      // The provider may have been removed since — then we just show the saved name.
      setLinkedProvider(item?.providerId ? await getProviderById(user.id, item.providerId) : null);
    } catch {
      setFollowUp(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, followUpId]);

  // Refresh after returning from the edit screen.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeStatus = async (status: FollowUpStatus) => {
    if (!user || isBusy) return;
    setIsBusy(true);
    try {
      await setFollowUpStatus(user.id, followUpId, status);
      await load();
    } catch {
      Alert.alert('Something went wrong', "We couldn't update this follow-up. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const confirmCancel = () =>
    Alert.alert('Cancel this follow-up?', 'It will move to History and its reminder will be removed.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel follow-up', style: 'destructive', onPress: () => changeStatus('cancelled') },
    ]);

  const confirmDelete = () =>
    Alert.alert('Delete follow-up?', 'This permanently removes it from your tracker.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          setIsBusy(true);
          try {
            await deleteFollowUp(user.id, followUpId);
            navigation.goBack();
          } catch {
            setIsBusy(false);
            Alert.alert('Something went wrong', "We couldn't delete this follow-up. Please try again.");
          }
        },
      },
    ]);

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!followUp) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Ionicons name="help-circle-outline" size={32} color={colors.textSecondary} />
        <Text style={styles.stateText}>This follow-up couldn't be found.</Text>
      </View>
    );
  }

  const badge = FOLLOW_UP_BADGES[followUp.type];
  const overdue = isOverdue(followUp);
  const isScheduled = followUp.status === 'scheduled';

  const status = overdue
    ? { label: 'Overdue', bg: DANGER_TINT, color: colors.danger }
    : followUp.status === 'completed'
      ? { label: 'Completed', bg: colors.badge.greenBg, color: colors.green }
      : followUp.status === 'cancelled'
        ? { label: 'Cancelled', bg: colors.background, color: colors.textSecondary }
        : { label: 'Scheduled', bg: colors.badge.blueBg, color: colors.badge.blueIcon };

  const callUrl = linkedProvider?.phone ? dialUrl(linkedProvider.phone) : null;
  const directionsUrl =
    (linkedProvider && providerMapsUrl(linkedProvider)) ?? (followUp.location ? mapsDirectionsUrl(followUp.location) : null);

  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress?: () => void }[] = [
    { icon: 'calendar-outline', label: 'Date & time', value: formatAbsolute(followUp.scheduledAt) },
    ...(followUp.providerName
      ? [{
          icon: 'person-outline' as const,
          label: 'Provider',
          value: followUp.providerName,
          onPress: linkedProvider
            ? () => navigation.navigate('ProviderDetail', { providerId: linkedProvider.id })
            : undefined,
        }]
      : []),
    ...(followUp.location ? [{ icon: 'location-outline' as const, label: 'Location', value: followUp.location }] : []),
    { icon: 'notifications-outline', label: 'Reminder', value: reminderDescription(followUp, hasReminder) },
    ...(followUp.completedAt
      ? [{ icon: 'checkmark-done-outline' as const, label: 'Completed on', value: formatAbsolute(followUp.completedAt) }]
      : []),
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: badge.bg }]}>
          <Ionicons name={badge.icon} size={30} color={badge.tint} />
        </View>
        <Text style={styles.typeLabel}>{FOLLOW_UP_TYPE_LABELS[followUp.type]}</Text>
        <Text style={[typography.display, styles.title]}>{followUp.title}</Text>
        <View style={styles.heroChips}>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.whenText}>{formatWhen(followUp.scheduledAt)}</Text>
        </View>
      </View>

      {(callUrl || directionsUrl) && (
        <View style={styles.contactRow}>
          {callUrl && (
            <Pressable
              style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
              onPress={() => openExternal(callUrl, "Your phone couldn't open the dialer.")}
            >
              <Ionicons name="call-outline" size={18} color={colors.green} />
              <Text style={styles.contactText}>Call</Text>
            </Pressable>
          )}
          {directionsUrl && (
            <Pressable
              style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
              onPress={() => openExternal(directionsUrl, "Your phone couldn't open Maps.")}
            >
              <Ionicons name="navigate-outline" size={18} color={colors.blue} />
              <Text style={[styles.contactText, { color: colors.blue }]}>Directions</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.card}>
        {rows.map((row, i) => {
          const content = (
            <>
              <Ionicons name={row.icon} size={18} color={colors.textSecondary} />
              <View style={styles.flexText}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
              {row.onPress && <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
            </>
          );
          return (
            <View key={row.label}>
              {i > 0 && <View style={styles.divider} />}
              {row.onPress ? (
                <Pressable style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]} onPress={row.onPress}>
                  {content}
                </Pressable>
              ) : (
                <View style={styles.infoRow}>{content}</View>
              )}
            </View>
          );
        })}
      </View>

      {followUp.notes ? (
        <View style={[styles.card, styles.notesCard]}>
          <Text style={styles.infoLabel}>Notes</Text>
          <Text style={styles.notesText}>{followUp.notes}</Text>
        </View>
      ) : null}

      {isScheduled ? (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, isBusy && styles.ctaDisabled]}
          onPress={() => changeStatus('completed')}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={typography.button}>Mark as done</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, styles.reopenButton, pressed && styles.pressed]}
          onPress={() => changeStatus('scheduled')}
          disabled={isBusy}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.green} />
          <Text style={styles.secondaryText}>Reopen</Text>
        </Pressable>
      )}

      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('AddFollowUp', { followUpId })}
          disabled={isBusy}
        >
          <Ionicons name="create-outline" size={18} color={colors.green} />
          <Text style={styles.secondaryText}>Edit</Text>
        </Pressable>
        {isScheduled && (
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={confirmCancel}
            disabled={isBusy}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.secondaryText, styles.mutedText]}>Cancel</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.deleteButton} onPress={confirmDelete} disabled={isBusy} hitSlop={8}>
        <Ionicons name="trash-outline" size={16} color={colors.danger} />
        <Text style={styles.deleteText}>Delete follow-up</Text>
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
  heroIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  typeLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { textAlign: 'center', marginTop: spacing.xs },
  heroChips: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  statusPill: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  whenText: { fontSize: 13, color: colors.textSecondary },

  contactRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  contactButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: 30, borderWidth: 1, borderColor: colors.border, paddingVertical: 12,
  },
  contactText: { fontSize: 14, fontWeight: '700', color: colors.green },

  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 18 + spacing.md },
  infoLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  infoValue: { fontSize: 14, color: colors.textPrimary, marginTop: 2 },
  notesCard: { padding: spacing.md, marginTop: spacing.md },
  notesText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginTop: spacing.xs },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.xl, minHeight: 56,
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.6 },

  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  secondaryButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border, borderRadius: 30, paddingVertical: 12, backgroundColor: colors.surface,
  },
  reopenButton: { flex: 0, marginTop: spacing.xl, borderColor: colors.green },
  secondaryText: { fontSize: 14, fontWeight: '700', color: colors.green },
  mutedText: { color: colors.textSecondary },

  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginTop: spacing.lg, paddingVertical: spacing.sm,
  },
  deleteText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
