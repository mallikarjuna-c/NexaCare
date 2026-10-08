import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { getAllRecords } from '../services/healthRecordsService';
import { getFollowUps } from '../services/followUpService';
import { getExpenses } from '../services/expenseService';
import { getMedicalInfo } from '../services/emergencyService';
import { hasReportContent, sharePdfReport, shareTextReport, type ReportData } from '../services/healthReportService';
import { RECORD_TYPE_LABELS, type HealthRecord } from '../types/healthRecords';
import { isOverdue, type FollowUp } from '../types/followUps';
import { toLocalISODate, type Expense } from '../types/expenses';
import { hasMedicalInfo, type MedicalInfo } from '../types/emergency';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'ShareHealthData'>;

type Period = '30d' | '3m' | '1y' | 'all';

const PERIODS: { key: Period; label: string; longLabel: string; days: number | null }[] = [
  { key: '30d', label: '30 days', longLabel: 'Last 30 days', days: 30 },
  { key: '3m', label: '3 months', longLabel: 'Last 3 months', days: 91 },
  { key: '1y', label: '1 year', longLabel: 'Last 12 months', days: 365 },
  { key: 'all', label: 'All', longLabel: 'All time', days: null },
];

function cutoffFor(period: Period): string | null {
  const days = PERIODS.find((p) => p.key === period)?.days;
  if (days == null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalISODate(d);
}

export default function ShareHealthDataScreen({ route }: Props) {
  const { user } = useAuth();
  const preselectedIds = route.params?.recordIds;

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medical, setMedical] = useState<MedicalInfo>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [period, setPeriod] = useState<Period>(preselectedIds ? 'all' : '3m');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preselectedIds ?? []));
  const [includeMedical, setIncludeMedical] = useState(!preselectedIds);
  const [includeFollowUps, setIncludeFollowUps] = useState(false);
  const [includeExpenses, setIncludeExpenses] = useState(false);
  const [claimableOnly, setClaimableOnly] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'text' | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([getAllRecords(user.id), getFollowUps(user.id), getExpenses(user.id), getMedicalInfo(user.id)])
      .then(([r, f, e, m]) => {
        setRecords(r);
        setFollowUps(f.filter((x) => x.status === 'scheduled' && !isOverdue(x)));
        setExpenses(e);
        setMedical(m);
        if (!hasMedicalInfo(m)) setIncludeMedical(false);
        // Coming from "Share this record": keep that selection. Otherwise start with the whole default period.
        if (!preselectedIds) {
          const cutoff = cutoffFor('3m');
          setSelectedIds(new Set(r.filter((x) => !cutoff || x.date >= cutoff).map((x) => x.id)));
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
  }, [user, preselectedIds]);

  const cutoff = cutoffFor(period);
  const recordsInPeriod = useMemo(
    () => records.filter((r) => !cutoff || r.date >= cutoff),
    [records, cutoff]
  );
  const expensesInPeriod = useMemo(
    () => expenses.filter((e) => (!cutoff || e.date >= cutoff) && (!claimableOnly || e.claimable)),
    [expenses, cutoff, claimableOnly]
  );

  const changePeriod = (next: Period) => {
    setPeriod(next);
    const nextCutoff = cutoffFor(next);
    setSelectedIds(new Set(records.filter((r) => !nextCutoff || r.date >= nextCutoff).map((r) => r.id)));
  };

  const toggleRecord = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedInPeriod = recordsInPeriod.filter((r) => selectedIds.has(r.id));
  const allSelected = recordsInPeriod.length > 0 && selectedInPeriod.length === recordsInPeriod.length;

  const reportData: ReportData = {
    patientName: user?.name ?? 'Patient',
    generatedAt: new Date(),
    medical: includeMedical && hasMedicalInfo(medical) ? medical : undefined,
    records: selectedInPeriod,
    followUps: includeFollowUps ? followUps : [],
    expenses: includeExpenses
      ? { items: expensesInPeriod, periodLabel: PERIODS.find((p) => p.key === period)!.longLabel, claimableOnly }
      : undefined,
  };
  const canShare = hasReportContent(reportData);

  const summaryParts = [
    reportData.medical && 'Medical ID',
    selectedInPeriod.length > 0 && `${selectedInPeriod.length} record${selectedInPeriod.length === 1 ? '' : 's'}`,
    reportData.followUps.length > 0 && `${reportData.followUps.length} follow-up${reportData.followUps.length === 1 ? '' : 's'}`,
    reportData.expenses?.items.length && `${reportData.expenses.items.length} expense${reportData.expenses.items.length === 1 ? '' : 's'}`,
  ].filter(Boolean);

  const share = async (format: 'pdf' | 'text') => {
    if (!canShare || busy) return;
    setBusy(format);
    try {
      if (format === 'pdf') await sharePdfReport(reportData);
      else await shareTextReport(reportData);
    } catch {
      Alert.alert(
        'Unable to share',
        format === 'pdf' ? "We couldn't create the PDF. Try sharing as text instead." : "We couldn't open the share sheet."
      );
    } finally {
      setBusy(null);
    }
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
        <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
        <Text style={styles.stateText}>We couldn't load your health data. Go back and try again.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="document-text-outline" size={22} color={colors.badge.blueIcon} />
          </View>
          <Text style={styles.introText}>
            Create a health summary for your doctor, a specialist or family. Choose exactly what to include.
          </Text>
        </View>

        {/* Period — applies to records and expenses */}
        <Text style={styles.fieldLabel}>Time period</Text>
        <View style={styles.chipRow}>
          {PERIODS.map((p) => (
            <Pressable key={p.key} style={[styles.chip, period === p.key && styles.chipActive]} onPress={() => changePeriod(p.key)}>
              <Text style={[styles.chipText, period === p.key && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Medical ID */}
        <View style={[styles.card, styles.sectionCard]}>
          <View style={styles.toggleRow}>
            <Ionicons name="id-card-outline" size={20} color={colors.danger} />
            <View style={styles.flexText}>
              <Text style={styles.toggleTitle}>Medical ID</Text>
              <Text style={styles.toggleSub}>
                {hasMedicalInfo(medical) ? 'Blood group, allergies, conditions, medications' : 'Not set up yet — add it in Emergency Assistance'}
              </Text>
            </View>
            <Switch
              value={includeMedical}
              onValueChange={setIncludeMedical}
              disabled={!hasMedicalInfo(medical)}
              trackColor={{ true: colors.green, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* Records */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>
            Health records <Text style={styles.sectionCount}>{selectedInPeriod.length}/{recordsInPeriod.length}</Text>
          </Text>
          {recordsInPeriod.length > 0 && (
            <Pressable
              onPress={() => setSelectedIds(allSelected ? new Set() : new Set(recordsInPeriod.map((r) => r.id)))}
              hitSlop={8}
            >
              <Text style={styles.linkText}>{allSelected ? 'Select none' : 'Select all'}</Text>
            </Pressable>
          )}
        </View>
        {recordsInPeriod.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No health records in this period.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {recordsInPeriod.map((r, i) => {
              const checked = selectedIds.has(r.id);
              return (
                <View key={r.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={({ pressed }) => [styles.recordRow, pressed && styles.pressed]}
                    onPress={() => toggleRecord(r.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? colors.green : colors.textSecondary}
                    />
                    <View style={styles.flexText}>
                      <Text style={styles.recordTitle} numberOfLines={1}>
                        {RECORD_TYPE_LABELS[r.type]} · {r.value}
                      </Text>
                      <Text style={styles.recordSub}>
                        {r.date}
                        {r.attachmentName ? ' · has attachment (not included)' : ''}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Follow-ups & expenses */}
        <View style={[styles.card, styles.sectionCard]}>
          <View style={styles.toggleRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.badge.purpleIcon} />
            <View style={styles.flexText}>
              <Text style={styles.toggleTitle}>Upcoming follow-ups</Text>
              <Text style={styles.toggleSub}>
                {followUps.length ? `${followUps.length} scheduled` : 'None scheduled'}
              </Text>
            </View>
            <Switch
              value={includeFollowUps}
              onValueChange={setIncludeFollowUps}
              disabled={followUps.length === 0}
              trackColor={{ true: colors.green, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
          <View style={styles.dividerFull} />
          <View style={styles.toggleRow}>
            <Ionicons name="wallet-outline" size={20} color={colors.green} />
            <View style={styles.flexText}>
              <Text style={styles.toggleTitle}>Medical expenses</Text>
              <Text style={styles.toggleSub}>
                {expensesInPeriod.length} in {PERIODS.find((p) => p.key === period)!.longLabel.toLowerCase()} · useful for insurance claims
              </Text>
            </View>
            <Switch
              value={includeExpenses}
              onValueChange={setIncludeExpenses}
              trackColor={{ true: colors.green, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
          {includeExpenses && (
            <Pressable style={styles.subOption} onPress={() => setClaimableOnly((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: claimableOnly }}>
              <Ionicons
                name={claimableOnly ? 'checkbox' : 'square-outline'}
                size={20}
                color={claimableOnly ? colors.green : colors.textSecondary}
              />
              <Text style={styles.subOptionText}>Only expenses marked claimable from insurance</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.privacyText}>
            Share only with people you trust. Once sent, they can keep or forward it — NexaCare can't take it back.
            Attached files aren't included.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <View style={styles.actionBar}>
        <Text style={styles.summaryText} numberOfLines={1}>
          {canShare ? summaryParts.join(' · ') : 'Choose at least one thing to share'}
        </Text>
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.textButton, (!canShare || !!busy) && styles.disabled, pressed && styles.pressed]}
            onPress={() => share('text')}
            disabled={!canShare || !!busy}
          >
            {busy === 'text' ? <ActivityIndicator color={colors.green} /> : <Text style={styles.textButtonText}>Share as text</Text>}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.pdfButton, (!canShare || !!busy) && styles.disabled, pressed && styles.pressed]}
            onPress={() => share('pdf')}
            disabled={!canShare || !!busy}
          >
            {busy === 'pdf' ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={typography.button}>Creating PDF…</Text>
              </>
            ) : (
              <>
                <Text style={typography.button}>Share PDF</Text>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  stateText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  introCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  introIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.badge.blueBg, alignItems: 'center', justifyContent: 'center' },
  introText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextActive: { color: '#FFFFFF' },

  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  sectionCard: { marginTop: spacing.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  toggleSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  dividerFull: { height: 1, backgroundColor: colors.border },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 22 + spacing.md },
  subOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingLeft: spacing.md + 20 + spacing.md,
  },
  subOptionText: { flex: 1, fontSize: 13, color: colors.textPrimary },

  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sectionCount: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.green },

  recordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 12 },
  recordTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  recordSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  emptyCard: {
    padding: spacing.lg, backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  privacyNote: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.lg,
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  privacyText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  actionBar: {
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  summaryText: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  textButton: {
    flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52,
    borderRadius: 30, borderWidth: 1, borderColor: colors.green, backgroundColor: colors.surface,
  },
  textButtonText: { fontSize: 15, fontWeight: '700', color: colors.green },
  pdfButton: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 52,
    borderRadius: 30, backgroundColor: colors.green,
  },
});
