import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { getAllRecords } from '../services/healthRecordsService';
import { RECORD_TYPE_LABELS, type HealthRecord, type HealthRecordType } from '../types/healthRecords';
import { colors, typography, spacing } from '../theme/theme';

const CATEGORIES: { type: HealthRecordType; icon: keyof typeof Ionicons.glyphMap; bg: string; tint: string }[] = [
  { type: 'blood_pressure', icon: 'pulse-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon },
  { type: 'heart_rate', icon: 'heart-outline', bg: '#FCE1E1', tint: colors.danger },
  { type: 'weight', icon: 'body-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon },
  { type: 'blood_glucose', icon: 'water-outline', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon },
  { type: 'medical_report', icon: 'document-text-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon },
  { type: 'prescription', icon: 'medkit-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon },
];

type Props = NativeStackScreenProps<HomeStackParamList, 'HealthRecords'>;

export default function HealthRecordsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const data = await getAllRecords(user.id);
    setRecords(data);
    setIsLoading(false);
  }, [user]);

  // Refresh every time this screen comes into focus, so a record added
  // via the Add Record screen shows up immediately on return.
  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  const countFor = (type: HealthRecordType) => records.filter((r) => r.type === type).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Categories</Text>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('AddRecord')}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Record</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {CATEGORIES.map((c) => (
          <View key={c.type} style={styles.categoryCard}>
            <View style={[styles.categoryIcon, { backgroundColor: c.bg }]}>
              <Ionicons name={c.icon} size={22} color={c.tint} />
            </View>
            <Text style={styles.categoryLabel}>{RECORD_TYPE_LABELS[c.type]}</Text>
            <Text style={styles.categoryCount}>{countFor(c.type)} entries</Text>
          </View>
        ))}
      </View>

      <View style={styles.timelineHeaderRow}>
        <Text style={styles.sectionLabel}>Health Timeline</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
      ) : records.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="clipboard-outline" size={28} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No health records yet. Tap "Add Record" to get started.</Text>
        </View>
      ) : (
        <View style={styles.timelineList}>
          {records.map((r) => (
            <Pressable
              key={r.id}
              style={({ pressed }) => [styles.timelineItem, pressed && { opacity: 0.7 }]}
              onPress={() => navigation.navigate('RecordDetail', { record: r })}
            >
              <Text style={styles.timelineType}>{RECORD_TYPE_LABELS[r.type]}</Text>
              <Text style={styles.timelineValue}>{r.value}</Text>
              <Text style={styles.timelineDate}>{r.date}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 20,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  categoryCard: {
    width: '47%', backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  categoryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  categoryCount: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  timelineHeaderRow: { marginBottom: spacing.sm },

  emptyCard: {
    alignItems: 'center', gap: spacing.sm, padding: spacing.xl,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  timelineList: { gap: spacing.sm },
  timelineItem: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  timelineType: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  timelineValue: { fontSize: 14, color: colors.textPrimary, marginTop: 2 },
  timelineDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
});