import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSharedWatchSummary, getWatchDaily } from '../services/healthConnectService';
import { formatRecordDate } from '../types/healthRecords';
import { timeAgo, type DailyValue } from '../types/smartwatch';
import { colors, spacing } from '../theme/theme';

type Props = {
  userId: string;
  type: 'heart_rate' | 'blood_pressure';
  refreshKey: number;
  onOpenWatch?: () => void;
  sharedBy?: string;
};

type Row = { day: string; text: string };
type Daily = { daily: DailyValue[]; daily2?: DailyValue[] } | null;

const DAYS = 7;

async function readDaily(userId: string, key: 'heartRate' | 'bloodPressure', shared: boolean): Promise<{ result: Daily; syncedAt: string | null }> {
  if (!shared) return { result: await getWatchDaily(userId, key, DAYS), syncedAt: null };
  const summary = await getSharedWatchSummary(userId);
  const metric = summary?.metrics?.[key];
  return { result: metric ? { daily: metric.daily ?? [], daily2: metric.daily2 } : null, syncedAt: summary?.fetchedAt ?? null };
}

export default function WatchReadingsCard({ userId, type, refreshKey, onOpenWatch, sharedBy }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [connected, setConnected] = useState(true);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const unit = type === 'heart_rate' ? 'bpm' : 'mmHg';
  const what = type === 'heart_rate' ? 'heart rate' : 'blood pressure';

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    readDaily(userId, type === 'heart_rate' ? 'heartRate' : 'bloodPressure', !!sharedBy)
      .then(({ result, syncedAt: synced }) => {
        if (cancelled) return;
        setSyncedAt(synced);
        if (!result) {
          setConnected(false);
          setRows([]);
          return;
        }
        setConnected(true);
        const diastolic = new Map((result.daily2 ?? []).map((d) => [d.day, d.value]));
        setRows(
          [...result.daily]
            .sort((a, b) => b.day.localeCompare(a.day))
            .map((d) => ({
              day: d.day,
              text:
                type === 'blood_pressure' && diastolic.has(d.day)
                  ? `${Math.round(d.value)}/${Math.round(diastolic.get(d.day)!)}`
                  : String(Math.round(d.value)),
            }))
        );
      })
      .catch(() => !cancelled && setRows([]))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, type, refreshKey, sharedBy]);

  if (!isLoading && !connected && sharedBy) {
    return (
      <View style={styles.connectCard}>
        <Ionicons name="watch-outline" size={20} color={colors.green} />
        <Text style={styles.connectText}>
          No watch data from {sharedBy} yet. It appears after they open NexaCare with their watch connected.
        </Text>
      </View>
    );
  }

  if (!isLoading && !connected) {
    return (
      <Pressable style={({ pressed }) => [styles.connectCard, pressed && styles.pressed]} onPress={onOpenWatch}>
        <Ionicons name="watch-outline" size={20} color={colors.green} />
        <Text style={styles.connectText}>Connect your watch to fill in {what} automatically.</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="watch-outline" size={16} color={colors.green} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{sharedBy ? `From ${sharedBy}’s watch` : 'From your watch'}</Text>
          <Text style={styles.subtitle}>
            Last {DAYS} days · daily average{syncedAt ? ` · synced ${timeAgo(syncedAt)}` : ''}
          </Text>
        </View>
        {onOpenWatch && (
          <Pressable onPress={onOpenWatch} hitSlop={8}>
            <Text style={styles.link}>Open ›</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : !rows?.length ? (
        <Text style={styles.empty}>No {what} readings from the watch in the last {DAYS} days.</Text>
      ) : (
        rows.map((r, i) => (
          <View key={r.day} style={[styles.row, i > 0 && styles.rowDivider]}>
            <Text style={styles.rowDate}>{formatRecordDate(r.day)}</Text>
            <Text style={styles.rowValue}>
              {r.text} <Text style={styles.rowUnit}>{unit}</Text>
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  card: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.green,
    padding: spacing.md, marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  headerIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.blobLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  link: { fontSize: 13, fontWeight: '700', color: colors.green },
  loader: { marginVertical: spacing.md },
  empty: { fontSize: 13, color: colors.textSecondary, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowDate: { fontSize: 13, color: colors.textSecondary },
  rowValue: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  rowUnit: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  connectCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md,
    backgroundColor: colors.blobLight, borderRadius: 14, padding: spacing.md,
  },
  connectText: { flex: 1, fontSize: 13, color: colors.textPrimary },
});
