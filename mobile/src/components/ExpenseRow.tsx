import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, formatAmount, type Expense, type ExpenseCategory,
} from '../types/expenses';
import { colors, spacing } from '../theme/theme';

export const EXPENSE_BADGES: Record<ExpenseCategory, { icon: keyof typeof Ionicons.glyphMap; bg: string; tint: string }> = {
  consultation: { icon: 'medical-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon },
  medicine: { icon: 'medkit-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon },
  lab_test: { icon: 'flask-outline', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon },
  hospital: { icon: 'business-outline', bg: '#FCE1E1', tint: colors.danger },
  insurance: { icon: 'shield-checkmark-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon },
  other: { icon: 'receipt-outline', bg: colors.background, tint: colors.textSecondary },
};

type Props = { expense: Expense; onPress: () => void };

export default function ExpenseRow({ expense, onPress }: Props) {
  const badge = EXPENSE_BADGES[expense.category];
  const subtitle = [expense.providerName ?? EXPENSE_CATEGORY_LABELS[expense.category], PAYMENT_METHOD_LABELS[expense.paymentMethod]]
    .join(' · ');

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
      <View style={[styles.iconBadge, { backgroundColor: badge.bg }]}>
        <Ionicons name={badge.icon} size={18} color={badge.tint} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>{expense.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          {expense.receiptUri && <Ionicons name="attach-outline" size={13} color={colors.textSecondary} />}
          {expense.claimable && <Ionicons name="shield-checkmark-outline" size={13} color={colors.green} />}
        </View>
      </View>
      <Text style={styles.amount}>{formatAmount(expense.amountPaise)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12, paddingHorizontal: spacing.md },
  pressed: { opacity: 0.7 },
  iconBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  subtitle: { flexShrink: 1, fontSize: 12, color: colors.textSecondary },
  amount: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
});
