import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import ExpenseRow, { EXPENSE_BADGES } from '../components/ExpenseRow';
import { getExpenses } from '../services/expenseService';
import { formatRelativeDay } from '../types/followUps';
import {
  EXPENSE_CATEGORY_LABELS,
  currentMonthKey,
  formatAmount,
  formatMonthLabel,
  parseLocalISODate,
  shiftMonth,
  summarizeMonth,
  type Expense,
  type ExpenseCategory,
  type MonthKey,
} from '../types/expenses';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Expenses'>;

const DANGER_TINT = '#FCE1E1';

export default function ExpensesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [month, setMonth] = useState<MonthKey>(currentMonthKey);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      setExpenses(await getExpenses(user.id));
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeMonth = (delta: number) => {
    setMonth((m) => shiftMonth(m, delta));
    setCategoryFilter(null);
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <View style={[styles.stateIcon, { backgroundColor: DANGER_TINT }]}>
          <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
        </View>
        <Text style={styles.stateTitle}>Couldn't load expenses</Text>
        <Pressable
          style={({ pressed }) => [styles.pillButton, styles.stateButton, pressed && styles.pressed]}
          onPress={() => { setIsLoading(true); load(); }}
        >
          <Text style={styles.pillButtonText}>Try again</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  }

  const isCurrentMonth = month === currentMonthKey();
  const summary = summarizeMonth(expenses, month);
  const previousMonth = shiftMonth(month, -1);
  const previousTotal = summarizeMonth(expenses, previousMonth).total;
  const delta = summary.total - previousTotal;
  const largest = summary.byCategory[0]?.total ?? 0;

  const monthExpenses = expenses.filter(
    (e) => e.date.startsWith(month) && (!categoryFilter || e.category === categoryFilter)
  );

  // Group by day, keeping the newest-first order from the service.
  const groups: { date: string; items: Expense[] }[] = [];
  for (const e of monthExpenses) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={styles.monthSwitcher}>
          <Pressable onPress={() => changeMonth(-1)} hitSlop={10} style={styles.monthArrow} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
          <Pressable
            onPress={() => changeMonth(1)}
            hitSlop={10}
            style={[styles.monthArrow, isCurrentMonth && styles.monthArrowDisabled]}
            disabled={isCurrentMonth}
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('AddExpense')}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {/* Hero total */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total spent</Text>
        <Text style={styles.totalValue}>{formatAmount(summary.total)}</Text>
        <View style={styles.totalMetaRow}>
          <Text style={styles.totalMeta}>
            {summary.count} {summary.count === 1 ? 'expense' : 'expenses'}
          </Text>
          {previousTotal > 0 && (
            <>
              <Text style={styles.totalMeta}>·</Text>
              <Ionicons
                name={delta > 0 ? 'arrow-up' : delta < 0 ? 'arrow-down' : 'remove'}
                size={12}
                color={colors.textSecondary}
              />
              <Text style={styles.totalMeta}>
                {delta === 0
                  ? `Same as ${formatMonthLabel(previousMonth, true)}`
                  : `${formatAmount(Math.abs(delta))} vs ${formatMonthLabel(previousMonth, true)}`}
              </Text>
            </>
          )}
        </View>
        {summary.claimableTotal > 0 && (
          <View style={styles.claimChip}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.green} />
            <Text style={styles.claimChipText}>{formatAmount(summary.claimableTotal)} claimable from insurance</Text>
          </View>
        )}
      </View>

      {summary.count === 0 ? (
        <View style={styles.emptyCard}>
          <View style={[styles.stateIcon, { backgroundColor: colors.badge.greenBg }]}>
            <Ionicons name="wallet-outline" size={26} color={colors.badge.greenIcon} />
          </View>
          <Text style={styles.stateTitle}>No expenses in {formatMonthLabel(month)}</Text>
          <Text style={styles.stateBody}>
            Log consultation fees, medicine bills and lab costs to see where your healthcare money goes.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.pillButton, styles.stateButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate('AddExpense')}
          >
            <Text style={styles.pillButtonText}>Add expense</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : (
        <>
          {/* Category breakdown: one hue, sorted largest first; the label + icon carry identity. */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>By category</Text>
            {categoryFilter && (
              <Pressable onPress={() => setCategoryFilter(null)} hitSlop={8}>
                <Text style={styles.linkText}>Show all</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.card}>
            {summary.byCategory.map(({ category, total }, i) => {
              const badge = EXPENSE_BADGES[category];
              const active = categoryFilter === category;
              const share = summary.total ? Math.round((total / summary.total) * 100) : 0;
              return (
                <View key={category}>
                  {i > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={({ pressed }) => [styles.categoryRow, active && styles.categoryRowActive, pressed && styles.pressed]}
                    onPress={() => setCategoryFilter(active ? null : category)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${EXPENSE_CATEGORY_LABELS[category]}, ${formatAmount(total)}, ${share} percent`}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: badge.bg }]}>
                      <Ionicons name={badge.icon} size={16} color={badge.tint} />
                    </View>
                    <View style={styles.flexText}>
                      <View style={styles.categoryTopRow}>
                        <Text style={styles.categoryName}>{EXPENSE_CATEGORY_LABELS[category]}</Text>
                        <Text style={styles.categoryAmount}>{formatAmount(total)}</Text>
                      </View>
                      <View style={styles.barRow}>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${Math.max(4, (total / largest) * 100)}%` }]} />
                        </View>
                        <Text style={styles.categoryShare}>{share}%</Text>
                      </View>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, styles.sectionSpacing]}>
            {categoryFilter ? EXPENSE_CATEGORY_LABELS[categoryFilter] : 'All expenses'}
          </Text>
          {groups.map((group) => (
            <View key={group.date} style={styles.dayGroup}>
              <Text style={styles.dayLabel}>{formatRelativeDay(parseLocalISODate(group.date))}</Text>
              <View style={styles.card}>
                {group.items.map((e, i) => (
                  <View key={e.id}>
                    {i > 0 && <View style={styles.divider} />}
                    <ExpenseRow expense={e} onPress={() => navigation.navigate('ExpenseDetail', { expenseId: e.id })} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthSwitcher: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthArrow: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  monthArrowDisabled: { opacity: 0.35 },
  monthLabel: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, minWidth: 110, textAlign: 'center' },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 20,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  totalCard: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  totalLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  totalValue: { fontSize: 30, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.xs },
  totalMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  totalMeta: { fontSize: 13, color: colors.textSecondary },
  claimChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start',
    marginTop: spacing.md, backgroundColor: colors.badge.greenBg, borderRadius: 999,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  claimChipText: { fontSize: 12, fontWeight: '600', color: colors.green },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sectionSpacing: { marginTop: spacing.lg, marginBottom: spacing.sm },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.green },

  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },

  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  categoryRowActive: { backgroundColor: colors.blobLight },
  categoryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  categoryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  categoryName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  categoryAmount: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.background, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.green },
  categoryShare: { fontSize: 11, color: colors.textSecondary, width: 32, textAlign: 'right' },

  dayGroup: { marginBottom: spacing.md },
  dayLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: spacing.xs },

  emptyCard: {
    alignItems: 'center', padding: spacing.xl, backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  stateIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  stateTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  stateBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, lineHeight: 18 },
  pillButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999,
  },
  pillButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  stateButton: { marginTop: spacing.lg },
});
