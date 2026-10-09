import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import TrendChart, { SERIES_COLORS } from '../components/TrendChart';
import { getTrend } from '../services/trendsService';
import { formatCalendarDate } from '../types/followUps';
import { parseLocalISODate } from '../types/expenses';
import { sourceAppName } from '../types/smartwatch';
import {
  TREND_METRICS,
  TREND_PERIODS,
  formatTrendValue,
  type TrendMetric,
  type TrendPeriod,
  type TrendResult,
} from '../types/trends';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Trends'>;

export default function TrendsScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const [metric, setMetric] = useState<TrendMetric>(route.params?.metric ?? 'heartRate');
  const [period, setPeriod] = useState<TrendPeriod>(7);
  const [trend, setTrend] = useState<TrendResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const def = TREND_METRICS.find((m) => m.key === metric)!;

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setLoadError(false);
    try {
      const t = await getTrend(user.id, metric, period);
      setTrend(t);
      setSelectedDay(t.points.length ? t.points[t.points.length - 1].day : null);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user, metric, period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const points = trend?.points ?? [];
  const selected = points.find((p) => p.day === selectedDay) ?? points[points.length - 1];
  const values = points.map((p) => p.value);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const isBp = metric === 'bloodPressure';
  const avg2 = isBp && points.some((p) => p.value2 != null)
    ? points.filter((p) => p.value2 != null).reduce((a, p) => a + (p.value2 as number), 0) / points.filter((p) => p.value2 != null).length
    : null;

  const fmt = (v: number) => formatTrendValue(def, v);
  const fmtPair = (v: number, v2?: number) => (isBp && v2 != null ? `${Math.round(v)}/${Math.round(v2)}` : fmt(v));

  const sourceText = trend
    ? [
        trend.sources.includes('watch') &&
          `your watch${trend.watchApps.length ? ` (${trend.watchApps.map(sourceAppName).join(', ')})` : ''}`,
        trend.sources.includes('records') && 'Health Records',
      ]
        .filter(Boolean)
        .join(' and ')
    : '';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {TREND_METRICS.map((m) => {
          const active = m.key === metric;
          return (
            <Pressable
              key={m.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setMetric(m.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={m.icon} size={14} color={active ? '#FFFFFF' : colors.textSecondary} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.segment}>
        {TREND_PERIODS.map((p) => (
          <Pressable key={p} style={[styles.segmentItem, period === p && styles.segmentItemActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.segmentText, period === p && styles.segmentTextActive]}>{p} days</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{def.label}</Text>
            <Text style={styles.cardSub}>{def.rangeText}</Text>
          </View>
          {selected && (
            <View style={styles.readout}>
              <Text style={styles.readoutValue}>
                {fmtPair(selected.value, selected.value2)}
                <Text style={styles.readoutUnit}> {def.unit}</Text>
              </Text>
              <Text style={styles.cardSub}>{formatCalendarDate(parseLocalISODate(selected.day))}</Text>
            </View>
          )}
        </View>

        {isLoading ? (
          <View style={styles.chartPlaceholder}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.chartPlaceholder}>
            <Text style={styles.emptyText}>Couldn’t load this trend.</Text>
            <Pressable onPress={load} hitSlop={8}>
              <Text style={styles.linkText}>Try again</Text>
            </Pressable>
          </View>
        ) : points.length === 0 ? (
          <View style={styles.chartPlaceholder}>
            <Ionicons name={def.icon} size={28} color={colors.border} />
            <Text style={styles.emptyText}>No {def.label.toLowerCase()} data in the last {period} days.</Text>
            {def.watchKey && (
              <Pressable onPress={() => navigation.getParent()?.navigate('Watch' as never)} hitSlop={8}>
                <Text style={styles.linkText}>Check your smartwatch ›</Text>
              </Pressable>
            )}
            {def.recordType && (
              <Pressable onPress={() => navigation.navigate('AddRecord', { initialType: def.recordType })} hitSlop={8}>
                <Text style={styles.linkText}>Add a reading ›</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <TrendChart
              points={points}
              days={period}
              kind={def.chart}
              band={def.band}
              selectedDay={selected?.day ?? null}
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

      {!isLoading && points.length > 0 && (
        <View style={styles.statsRow}>
          {[
            { label: 'Average', value: avg != null ? (isBp && avg2 != null ? `${Math.round(avg)}/${Math.round(avg2)}` : fmt(avg)) : '—' },
            { label: 'Lowest', value: fmt(Math.min(...values)) },
            { label: 'Highest', value: fmt(Math.max(...values)) },
            { label: 'Days', value: `${points.length}/${period}` },
          ].map((s) => (
            <View key={s.label} style={styles.statTile}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
      {!isLoading && points.length > 0 && isBp && (
        <Text style={styles.footnote}>Lowest and highest refer to systolic (the top number).</Text>
      )}

      {!!sourceText && (
        <View style={styles.sourceRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.sourceText}>
            From {sourceText}. One value per day — the daily {def.chart === 'bar' ? 'total' : 'average'}.
          </Text>
        </View>
      )}

      <Text style={styles.footnote}>For general wellness tracking, not a medical diagnosis.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingVertical: spacing.lg, paddingBottom: spacing.xl },
  flex: { flex: 1 },

  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: '#FFFFFF' },

  segment: {
    flexDirection: 'row', alignSelf: 'flex-start', marginHorizontal: spacing.lg, marginTop: spacing.md,
    backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.border, padding: 3,
  },
  segmentItem: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 },
  segmentItemActive: { backgroundColor: colors.textPrimary },
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  segmentTextActive: { color: '#FFFFFF' },

  card: {
    marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  readout: { alignItems: 'flex-end' },
  readoutValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  readoutUnit: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  chartPlaceholder: { height: 190, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.green },

  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md },
  statTile: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xs, alignItems: 'center',
  },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  sourceRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start', marginHorizontal: spacing.lg, marginTop: spacing.md },
  sourceText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  footnote: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, marginHorizontal: spacing.lg },
});
