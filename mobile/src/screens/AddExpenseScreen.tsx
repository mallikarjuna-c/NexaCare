import { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Switch, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import ProfileBanner from '../components/ProfileBanner';
import { EXPENSE_BADGES } from '../components/ExpenseRow';
import ProviderPicker, { type ProviderSelection } from '../components/ProviderPicker';
import { addExpense, getExpenseById, updateExpense } from '../services/expenseService';
import { getProviderById } from '../services/directoryService';
import type { Provider, ProviderType } from '../types/directory';
import { formatRelativeDay } from '../types/followUps';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  paiseToInput,
  parseAmountToPaise,
  parseLocalISODate,
  toLocalISODate,
  type ExpenseCategory,
  type PaymentMethod,
  type ReceiptType,
} from '../types/expenses';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'AddExpense'>;

const TITLE_PLACEHOLDERS: Record<ExpenseCategory, string> = {
  consultation: 'e.g. Cardiologist consultation',
  medicine: 'e.g. Monthly BP medicines',
  lab_test: 'e.g. Lipid profile test',
  hospital: 'e.g. Day-care admission',
  insurance: 'e.g. Health insurance premium',
  other: 'e.g. Physiotherapy session',
};

const PROVIDER_PLACEHOLDERS: Record<ExpenseCategory, string> = {
  consultation: 'e.g. Dr. Sharma, Apollo Clinic',
  medicine: 'e.g. MedPlus Pharmacy',
  lab_test: 'e.g. Thyrocare Diagnostics',
  hospital: 'e.g. City General Hospital',
  insurance: 'e.g. Star Health',
  other: 'e.g. Provider name',
};

const CATEGORY_FROM_PROVIDER: Record<ProviderType, ExpenseCategory> = {
  hospital: 'hospital',
  clinic: 'consultation',
  doctor: 'consultation',
  pharmacy: 'medicine',
  lab: 'lab_test',
  other: 'other',
};

type Errors = { amount?: string; title?: string };

export default function AddExpenseScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { activeProfile } = useFamily();
  const profileId = activeProfile?.id;
  const editingId = route.params?.expenseId;
  const prefillProviderId = route.params?.providerId;

  const [amountText, setAmountText] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('consultation');
  const [date, setDate] = useState<Date>(() => new Date());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [provider, setProvider] = useState<ProviderSelection>({ providerName: '' });
  const [claimable, setClaimable] = useState(false);
  const [notes, setNotes] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | undefined>();
  const [receiptName, setReceiptName] = useState<string | undefined>();
  const [receiptType, setReceiptType] = useState<ReceiptType | undefined>();
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(!!editingId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editingId ? 'Edit Expense' : 'Add Expense' });
  }, [navigation, editingId]);

  useEffect(() => {
    if (!profileId || !editingId) return;
    getExpenseById(profileId, editingId)
      .then((existing) => {
        if (!existing) {
          Alert.alert('Not found', 'This expense no longer exists.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          return;
        }
        setAmountText(paiseToInput(existing.amountPaise));
        setTitle(existing.title);
        setCategory(existing.category);
        setDate(parseLocalISODate(existing.date));
        setPaymentMethod(existing.paymentMethod);
        setProvider({ providerId: existing.providerId, providerName: existing.providerName ?? '' });
        setClaimable(existing.claimable);
        setNotes(existing.notes ?? '');
        setReceiptUri(existing.receiptUri);
        setReceiptName(existing.receiptName);
        setReceiptType(existing.receiptType);
      })
      .catch(() => Alert.alert('Something went wrong', "We couldn't load this expense."))
      .finally(() => setIsLoadingExisting(false));
  }, [profileId, editingId, navigation]);

  useEffect(() => {
    if (!user || editingId || !prefillProviderId) return;
    getProviderById(user.id, prefillProviderId)
      .then((p) => p && applyPickedProvider(p))
      .catch(() => {});
  }, [user, editingId, prefillProviderId]);

  function applyPickedProvider(p: Provider) {
    setProvider({ providerId: p.id, providerName: p.name });
    if (!editingId) setCategory(CATEGORY_FROM_PROVIDER[p.type]);
  }

  const openDatePicker = () => {
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      maximumDate: new Date(),
      onValueChange: (_event, selected) => setDate(selected),
    });
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setReceiptUri(asset.uri);
      setReceiptName(asset.name);
      setReceiptType(asset.mimeType?.includes('pdf') ? 'pdf' : 'image');
    } catch {
      Alert.alert('Something went wrong', "We couldn't attach that file.");
    }
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to attach a receipt photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setReceiptUri(asset.uri);
    setReceiptName(asset.fileName ?? 'Receipt photo');
    setReceiptType('image');
  };

  const removeReceipt = () => {
    setReceiptUri(undefined);
    setReceiptName(undefined);
    setReceiptType(undefined);
  };

  const handleSave = async () => {
    if (!profileId || isSubmitting) return;

    const amountPaise = parseAmountToPaise(amountText);
    const nextErrors: Errors = {};
    if (amountPaise === null) nextErrors.amount = amountText.trim() ? 'Enter a valid amount, e.g. 450 or 1250.50' : 'Please enter the amount.';
    if (!title.trim()) nextErrors.title = 'Please describe what this was for.';
    setErrors(nextErrors);
    if (amountPaise === null || nextErrors.title) return;

    const input = {
      title: title.trim(),
      amountPaise,
      category,
      date: toLocalISODate(date),
      paymentMethod,
      providerName: provider.providerName.trim() || undefined,
      providerId: provider.providerName.trim() ? provider.providerId : undefined,
      claimable,
      notes: notes.trim() || undefined,
      receiptUri,
      receiptName,
      receiptType,
    };

    setIsSubmitting(true);
    try {
      if (editingId) await updateExpense(profileId, editingId, input);
      else await addExpense(profileId, input);
      navigation.goBack();
    } catch {
      Alert.alert('Something went wrong', "We couldn't save this expense. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingExisting) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ProfileBanner what="expenses" switchable={false} style={styles.banner} />
        <View style={[styles.amountCard, errors.amount && styles.amountCardError]}>
          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>₹</Text>
            <TextInput
              style={styles.amountInput}
              value={amountText}
              onChangeText={(text) => {
                setAmountText(text);
                if (errors.amount) setErrors((e) => ({ ...e, amount: undefined }));
              }}
              placeholder="0"
              placeholderTextColor={colors.border}
              keyboardType="decimal-pad"
              autoFocus={!editingId}
              accessibilityLabel="Amount in rupees"
            />
          </View>
        </View>
        {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}

        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.categoryGrid}>
          {EXPENSE_CATEGORIES.map((c) => {
            const badge = EXPENSE_BADGES[c];
            const active = category === c;
            return (
              <Pressable key={c} style={[styles.categoryCard, active && styles.categoryCardActive]} onPress={() => setCategory(c)}>
                <View style={[styles.categoryIcon, { backgroundColor: active ? colors.surface : badge.bg }]}>
                  <Ionicons name={badge.icon} size={16} color={badge.tint} />
                </View>
                <Text style={[styles.categoryText, active && styles.categoryTextActive]} numberOfLines={1}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>What was it for?</Text>
        <TextInput
          style={[styles.input, errors.title && styles.inputError]}
          placeholder={TITLE_PLACEHOLDERS[category]}
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            if (errors.title && text.trim()) setErrors((e) => ({ ...e, title: undefined }));
          }}
        />
        {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

        <Text style={styles.fieldLabel}>Date</Text>
        {Platform.OS === 'android' ? (
          <Pressable style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]} onPress={openDatePicker}>
            <Ionicons name="calendar-outline" size={18} color={colors.blue} />
            <Text style={styles.dateButtonText}>{formatRelativeDay(date)}</Text>
          </Pressable>
        ) : (
          <View style={styles.iosPickerWrap}>
            <DateTimePicker
              value={date}
              mode="date"
              display="compact"
              maximumDate={new Date()}
              onValueChange={(_event, selected) => setDate(selected)}
            />
          </View>
        )}

        <Text style={styles.fieldLabel}>Paid via</Text>
        <View style={styles.chipRow}>
          {PAYMENT_METHODS.map((m) => (
            <Pressable key={m} style={[styles.chip, paymentMethod === m && styles.chipActive]} onPress={() => setPaymentMethod(m)}>
              <Text style={[styles.chipText, paymentMethod === m && styles.chipTextActive]}>{PAYMENT_METHOD_LABELS[m]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Paid to (optional)</Text>
        {user && (
          <ProviderPicker
            userId={user.id}
            value={provider}
            onChange={setProvider}
            onPick={applyPickedProvider}
            placeholder={PROVIDER_PLACEHOLDERS[category]}
          />
        )}

        <View style={styles.switchCard}>
          <View style={styles.flexText}>
            <Text style={styles.switchTitle}>Claimable from insurance</Text>
            <Text style={styles.switchSubtitle}>Mark bills you plan to submit for reimbursement</Text>
          </View>
          <Switch
            value={claimable}
            onValueChange={setClaimable}
            trackColor={{ true: colors.green, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>

        <Text style={styles.fieldLabel}>Receipt (optional)</Text>
        {receiptUri ? (
          <View style={styles.receiptPreview}>
            {receiptType === 'image' ? (
              <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
            ) : (
              <View style={styles.receiptIconBox}>
                <Ionicons name="document-outline" size={20} color={colors.blue} />
              </View>
            )}
            <Text style={styles.receiptName} numberOfLines={1}>{receiptName}</Text>
            <Pressable onPress={removeReceipt} hitSlop={8} accessibilityLabel="Remove receipt">
              <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.receiptButtonsRow}>
            <Pressable style={({ pressed }) => [styles.receiptButton, pressed && styles.pressed]} onPress={pickDocument}>
              <Ionicons name="document-attach-outline" size={18} color={colors.blue} />
              <Text style={styles.receiptButtonText}>Attach file</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.receiptButton, pressed && styles.pressed]} onPress={pickPhoto}>
              <Ionicons name="image-outline" size={18} color={colors.blue} />
              <Text style={styles.receiptButtonText}>Attach photo</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="e.g. Bill number, claim reference"
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, isSubmitting && styles.ctaDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={typography.button}>{editingId ? 'Save changes' : 'Save expense'}</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  banner: { marginBottom: spacing.md },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },

  amountCard: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  amountCardError: { borderColor: colors.danger },
  amountLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  currency: { fontSize: 30, fontWeight: '700', color: colors.textSecondary },
  amountInput: { flex: 1, fontSize: 30, fontWeight: '800', color: colors.textPrimary, paddingVertical: spacing.xs },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.md },
  errorText: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryCard: {
    width: '31%', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  categoryCardActive: { borderColor: colors.green, backgroundColor: colors.blobLight },
  categoryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  categoryText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  categoryTextActive: { color: colors.green, fontWeight: '700' },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },

  dateButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  dateButtonText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  iosPickerWrap: { alignItems: 'flex-start' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextActive: { color: '#FFFFFF' },

  switchCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  switchTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  switchSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  receiptButtonsRow: { flexDirection: 'row', gap: spacing.sm },
  receiptButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, backgroundColor: colors.surface,
  },
  receiptButtonText: { fontSize: 13, fontWeight: '600', color: colors.blue },
  receiptPreview: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, backgroundColor: colors.surface,
  },
  receiptThumb: { width: 40, height: 40, borderRadius: 8 },
  receiptIconBox: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: colors.badge.blueBg, alignItems: 'center', justifyContent: 'center',
  },
  receiptName: { flex: 1, fontSize: 13, color: colors.textPrimary },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.xl, minHeight: 56,
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.6 },
});
