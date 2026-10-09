import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatWhen, type FollowUp, type FollowUpType } from '../types/followUps';
import { colors, spacing } from '../theme/theme';

const DANGER_TINT = '#FCE1E1';

export const FOLLOW_UP_BADGES: Record<FollowUpType, { icon: keyof typeof Ionicons.glyphMap; bg: string; tint: string }> = {
  appointment: { icon: 'medical-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon },
  test: { icon: 'flask-outline', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon },
  medication: { icon: 'medkit-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon },
  checkup: { icon: 'clipboard-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon },
};

type Props = {
  followUp: FollowUp;
  overdue: boolean;
  hasReminder: boolean;
  isBusy: boolean;
  onPress: () => void;
  onComplete?: () => void;
};

export default function FollowUpCard({ followUp, overdue, hasReminder, isBusy, onPress, onComplete }: Props) {
  const badge = FOLLOW_UP_BADGES[followUp.type];
  const subtitle = [followUp.providerName, followUp.location].filter(Boolean).join(' · ');
  const isDone = followUp.status === 'completed';
  const isCancelled = followUp.status === 'cancelled';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, overdue && styles.cardOverdue, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.iconBadge, { backgroundColor: badge.bg }]}>
        <Ionicons name={badge.icon} size={20} color={badge.tint} />
      </View>

      <View style={styles.textWrap}>
        <Text style={[styles.title, isCancelled && styles.titleCancelled]} numberOfLines={1}>
          {followUp.title}
        </Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}

        <View style={styles.chipRow}>
          <View style={[styles.chip, overdue && styles.chipOverdue]}>
            <Ionicons
              name={overdue ? 'alert-circle-outline' : 'calendar-outline'}
              size={12}
              color={overdue ? colors.danger : colors.textSecondary}
            />
            <Text style={[styles.chipText, overdue && styles.chipTextOverdue]}>
              {overdue ? `Overdue · ${formatWhen(followUp.scheduledAt)}` : formatWhen(followUp.scheduledAt)}
            </Text>
          </View>
          {hasReminder && (
            <View style={[styles.chip, styles.chipReminder]}>
              <Ionicons name="notifications-outline" size={12} color={colors.green} />
            </View>
          )}
          {isDone && (
            <View style={[styles.chip, styles.chipReminder]}>
              <Text style={[styles.chipText, styles.chipTextGreen]}>Completed</Text>
            </View>
          )}
          {isCancelled && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>Cancelled</Text>
            </View>
          )}
        </View>
      </View>

      {onComplete && (
        <View style={styles.actionSlot}>
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.green} />
          ) : (
            <Pressable
              style={({ pressed }) => [styles.completeButton, pressed && styles.pressed]}
              onPress={(e) => {
                e.stopPropagation();
                onComplete();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${followUp.title} as done`}
            >
              <Ionicons name="checkmark" size={18} color={colors.green} />
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  cardOverdue: { borderColor: '#F3C6C6' },
  pressed: { opacity: 0.7 },
  iconBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  titleCancelled: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.background,
  },
  chipOverdue: { backgroundColor: DANGER_TINT },
  chipReminder: { backgroundColor: colors.badge.greenBg },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  chipTextOverdue: { color: colors.danger },
  chipTextGreen: { color: colors.green },

  actionSlot: { width: 36, alignItems: 'center', justifyContent: 'center' },
  completeButton: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.green,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
});
