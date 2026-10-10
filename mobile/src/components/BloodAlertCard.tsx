import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KIND_LABELS, URGENCY_INFO, timeAgo, type HelpRequest } from '../types/community';
import { colors, spacing } from '../theme/theme';

const URGENCY_RANK = { critical: 0, urgent: 1, planned: 2 } as const;

export function pickAlerts(requests: HelpRequest[]): { matches: HelpRequest[]; mine: HelpRequest[] } {
  const matches = requests
    .filter((r) => r.status === 'open' && r.canDonate && !r.responded && !r.isMine)
    .sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || b.createdAt.localeCompare(a.createdAt));
  const mine = requests.filter((r) => r.status === 'open' && r.isMine);
  return { matches, mine };
}

type Props = {
  matches: HelpRequest[];
  mine: HelpRequest[];
  onOpen: (requestId: string) => void;
  onSeeAll: () => void;
};

export default function BloodAlertCard({ matches, mine, onOpen, onSeeAll }: Props) {
  const top = matches[0];
  const own = mine[0];
  if (!top && !own) return null;

  if (top) {
    const critical = top.urgency === 'critical';
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={() => onOpen(top.id)}
        accessibilityRole="button"
        accessibilityLabel={`${top.bloodGroup} ${KIND_LABELS[top.kind]} needed at ${top.hospital}. Help.`}
      >
        <View style={styles.row}>
          <View style={styles.badge}>
            <Text style={styles.badgeGroup}>{top.bloodGroup}</Text>
          </View>
          <View style={styles.flex}>
            <View style={styles.titleRow}>
              <Ionicons name="water" size={14} color="#FFFFFF" />
              <Text style={styles.label}>
                {top.bloodGroup} {KIND_LABELS[top.kind].toLowerCase()} needed
                {critical ? ' · URGENT' : ` · ${URGENCY_INFO[top.urgency].label}`}
              </Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {top.units} unit{top.units > 1 ? 's' : ''} · {top.hospital}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {top.city} · {timeAgo(top.createdAt)}
            </Text>
          </View>
          <View style={styles.help}>
            <Text style={styles.helpText}>Help</Text>
          </View>
        </View>
        {matches.length > 1 && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onSeeAll();
            }}
            hitSlop={6}
            style={styles.more}
          >
            <Text style={styles.moreText}>+{matches.length - 1} more nearby need your blood group</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </Pressable>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.ownCard, pressed && styles.pressed]}
      onPress={() => onOpen(own.id)}
      accessibilityRole="button"
    >
      <View style={styles.ownIcon}>
        <Text style={styles.ownGroup}>{own.bloodGroup}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.ownLabel}>YOUR REQUEST IS ACTIVE</Text>
        <Text style={styles.ownTitle} numberOfLines={1}>
          {own.responseCount > 0
            ? `${own.responseCount} donor${own.responseCount === 1 ? '' : 's'} can help — call them`
            : `Waiting for donors · ${own.notifiedCount} alerted`}
        </Text>
        <Text style={styles.ownMeta} numberOfLines={1}>{own.hospital}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.danger} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  card: {
    backgroundColor: colors.danger, borderRadius: 18, padding: spacing.md, marginBottom: spacing.lg,
    shadowColor: colors.danger, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  badgeGroup: { fontSize: 18, fontWeight: '900', color: colors.danger },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  title: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  meta: { fontSize: 12, color: '#FFFFFF', opacity: 0.85, marginTop: 1 },
  help: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF' },
  helpText: { fontSize: 14, fontWeight: '800', color: colors.danger },
  more: {
    flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)',
  },
  moreText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  ownCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginBottom: spacing.lg,
    borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.danger,
  },
  ownIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  ownGroup: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  ownLabel: { fontSize: 11, fontWeight: '800', color: colors.danger, letterSpacing: 0.4 },
  ownTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  ownMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
});
