import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { EXPENSE_BADGES } from '../components/ExpenseRow';
import { deleteExpense, getExpenseById } from '../services/expenseService';
import { getProviderById } from '../services/directoryService';
import { formatCalendarDate } from '../types/followUps';
import {
  EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, formatAmount, parseLocalISODate, type Expense,
} from '../types/expenses';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'ExpenseDetail'>;

export default function ExpenseDetailScreen({ navigation, route }: Props) {
  const { expenseId } = route.params;
  const { user } = useAuth();
  const { activeProfile } = useFamily();
  const profileId = activeProfile?.id;
  const canEdit = activeProfile?.canEdit ?? true;
  const [expense, setExpense] = useState<Expense | null>(null);
  const [linkedProviderId, setLinkedProviderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!user || !profileId) return;
    try {
      const item = await getExpenseById(profileId, expenseId);
      setExpense(item);
      const provider = item?.providerId ? await getProviderById(user.id, item.providerId) : null;
      setLinkedProviderId(provider?.id ?? null);
    } catch {
      setExpense(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, profileId, expenseId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = () =>
    Alert.alert('Delete expense?', 'This permanently removes it from your expense history.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!profileId) return;
          setIsDeleting(true);
          try {
            await deleteExpense(profileId, expenseId);
            navigation.goBack();
          } catch {
            setIsDeleting(false);
            Alert.alert('Something went wrong', "We couldn't delete this expense. Please try again.");
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

  if (!expense) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Ionicons name="help-circle-outline" size={32} color={colors.textSecondary} />
        <Text style={styles.stateText}>This expense couldn't be found.</Text>
      </View>
    );
  }

  const badge = EXPENSE_BADGES[expense.category];
  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress?: () => void }[] = [
    { icon: 'calendar-outline', label: 'Date', value: formatCalendarDate(parseLocalISODate(expense.date)) },
    { icon: 'card-outline', label: 'Paid via', value: PAYMENT_METHOD_LABELS[expense.paymentMethod] },
    ...(expense.providerName
      ? [{
          icon: 'business-outline' as const,
          label: 'Paid to',
          value: expense.providerName,
          onPress: linkedProviderId
            ? () => navigation.navigate('ProviderDetail', { providerId: linkedProviderId })
            : undefined,
        }]
      : []),
    {
      icon: 'shield-checkmark-outline',
      label: 'Insurance',
      value: expense.claimable ? 'Claimable from insurance' : 'Not marked as claimable',
    },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: badge.bg }]}>
          <Ionicons name={badge.icon} size={28} color={badge.tint} />
        </View>
        <Text style={styles.categoryLabel}>{EXPENSE_CATEGORY_LABELS[expense.category]}</Text>
        <Text style={styles.amount}>{formatAmount(expense.amountPaise)}</Text>
        <Text style={styles.title}>{expense.title}</Text>
      </View>

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

      {expense.receiptUri && (
        <View style={[styles.card, styles.sectionCard]}>
          <Text style={styles.infoLabel}>Receipt</Text>
          {expense.receiptType === 'image' ? (
            <Image source={{ uri: expense.receiptUri }} style={styles.receiptImage} resizeMode="cover" />
          ) : (
            <View style={styles.receiptFileRow}>
              <Ionicons name="document-outline" size={22} color={colors.blue} />
              <Text style={styles.receiptFileName} numberOfLines={1}>{expense.receiptName}</Text>
            </View>
          )}
        </View>
      )}

      {expense.notes ? (
        <View style={[styles.card, styles.sectionCard]}>
          <Text style={styles.infoLabel}>Notes</Text>
          <Text style={styles.notesText}>{expense.notes}</Text>
        </View>
      ) : null}

      {canEdit && (
        <>
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={() => navigation.navigate('AddExpense', { expenseId })}
              disabled={isDeleting}
            >
              <Ionicons name="create-outline" size={18} color={colors.green} />
              <Text style={styles.secondaryText}>Edit</Text>
            </Pressable>
          </View>

          <Pressable style={styles.deleteButton} onPress={confirmDelete} disabled={isDeleting} hitSlop={8}>
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={styles.deleteText}>Delete expense</Text>
              </>
            )}
          </Pressable>
        </>
      )}
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
  categoryLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  amount: { fontSize: 30, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.xs },
  title: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },

  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  sectionCard: { padding: spacing.md, marginTop: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 18 + spacing.md },
  infoLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  infoValue: { fontSize: 14, color: colors.textPrimary, marginTop: 2 },

  receiptImage: { width: '100%', height: 220, borderRadius: 12, marginTop: spacing.sm },
  receiptFileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  receiptFileName: { flex: 1, fontSize: 14, color: colors.textPrimary },
  notesText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginTop: spacing.xs },

  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  secondaryButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.green, borderRadius: 30, paddingVertical: 12, backgroundColor: colors.surface,
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: colors.green },

  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginTop: spacing.lg, paddingVertical: spacing.sm, minHeight: 36,
  },
  deleteText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
