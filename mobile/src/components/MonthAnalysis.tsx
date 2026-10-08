import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TrendChart, { SERIES_COLORS } from './TrendChart';
import { getTrend } from '../services/trendsService';
import { formatCalendarDate } from '../types/followUps';
import { parseLocalISODate } from '../types/expenses';
import { TREND_METRICS, formatTrendValue, type TrendMetric, type TrendResult } from '../types/trends';
import { colors, spacing } from '../theme/theme';

// Home's "Wellness Summary" card: pick a metric, see every day from the 1st to today, plus lowest/highest.

const HOME_METRICS: TrendMetric[] = ['bloodPressure', 'heartRate', 'steps', 'sleep', 'spo2', 'hrv'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type Props = {
  userId: string;
  refreshKey: number; // bump to reload (e.g. when Home regains focus)
  onViewAll: (metric: TrendMetric) => void;
  onConnectWatch: () => void;
};

export default function MonthAnalysis({ userId, refreshKey, onViewAll, onConnectWatch }: Props) {
  const [metric, setMetric] = useState<TrendMetric>('bloodPressure');
  const [trend, setTrend] = useState<TrendResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const today = new Date();
  // Days so far this month (at least 2 so the chart has width to draw on the 1st).
  const days = Math.max(2, today.getDate());
  const def = TREND_METRICS.find((m) => m.key === metric)!;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getTrend(userId, metric, days)
      .then((t) => {
        if (cancelled) return;
        setTrend(t);
        setSelectedDay(t.points.length ? t.points[t.points.length - 1].day : null);
      })
      .catch(() => !cancelled && setTrend(null))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, metric, days, refreshKey]);

  const points = trend?.points ?? [];
  const isBp = metric === 'bloodPressure';
  const lowest = points.length ? points.reduce((a, p) => (p.value < a.value ? p : a)) : null;
  const highest = points.length ? points.reduce((a, p) => (p.value > a.value ? p : a)) : null;
  const show = (p: { value: number; value2?: number }) =>
    isBp && p.value2 != null ? `${Math.round(p.value)}/${Math.round(p.value2)}` : formatTrendValue(def, p.value);
  const selected = points.find((p) => p.day === selectedDay);

  return (
    <View>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionLabel}>Wellness Summary</Text>
          <Text style={styles.subLabel}>Your health at a glance</Text>
        </View>
        <Pressable onPress={() => onViewAll(metric)} hitSlop={8}>
          <Text style={styles.link}>View all →</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {HOME_METRICS.map((key) => {
          const m = TREND_METRICS.find((t) => t.key === key)!;
          const active = key === metric;
          return (
            <Pressable
              key={key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setMetric(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardRange}>{def.rangeText}</Text>
          {selected && (
            <Text style={styles.readout}>
              {show(selected)} <Text style={styles.readoutUnit}>{def.unit}</Text>
            </Text>
          )}
        </View>

        {isLoading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : points.length === 0 ? (
          <Pressable style={styles.placeholder} onPress={def.watchKey ? onConnectWatch : () => onViewAll(metric)}>
            <Ionicons name={def.icon} size={28} color={colors.border} />
            <Text style={styles.emptyText}>
              No {def.label.toLowerCase()} readings since {MONTHS[today.getMonth()]} 1.
            </Text>
            {def.watchKey && <Text style={styles.link}>Check your smartwatch ›</Text>}
          </Pressable>
        ) : (
          <>
            <TrendChart
              points={points}
              days={days}
              kind={def.chart}
              band={def.band}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              formatAxis={(v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : def.decimals ? v.toFixed(1) : String(Math.round(v)))}
            />
            {isBp && (
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SERIES_COLORS.primary }]} />
                  <Text style={styles.legendText}>Systolic</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SERIES_COLORS.secondary }]} />
                  <Text style={styles.legendText}>Diastolic</Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {!isLoading && lowest && highest && (
        <View style={styles.extremes}>
          <View style={styles.extreme}>
            <View style={styles.extremeLabelRow}>
              <Ionicons name="arrow-down" size={14} color={colors.badge.blueIcon} />
              <Text style={styles.extremeLabel}>Lowest</Text>
            </View>
            <Text style={styles.extremeValue}>{show(lowest)}</Text>
            <Text style={styles.extremeDate}>{formatCalendarDate(parseLocalISODate(lowest.day))}</Text>
          </View>
          <View style={styles.extremeDivider} />
          <View style={styles.extreme}>
            <View style={styles.extremeLabelRow}>
              <Ionicons name="arrow-up" size={14} color={colors.danger} />
              <Text style={styles.extremeLabel}>Highest</Text>
            </View>
            <Text style={styles.extremeValue}>{show(highest)}</Text>
            <Text style={styles.extremeDate}>{formatCalendarDate(parseLocalISODate(highest.day))}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.md, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  subLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  link: { fontSize: 13, fontWeight: '700', color: colors.green },

  tabs: { gap: spacing.sm, paddingBottom: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.blobLight, borderColor: colors.green },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: colors.green },

  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  cardRange: { flex: 1, fontSize: 12, color: colors.textSecondary },
  readout: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  readoutUnit: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  placeholder: { height: 190, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  extremes: {
    flexDirection: 'row', marginTop: spacing.sm, backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md,
  },
  extreme: { flex: 1, alignItems: 'center' },
  extremeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  extremeLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  extremeValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 4 },
  extremeDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  extremeDivider: { width: 1, backgroundColor: colors.border },
});
