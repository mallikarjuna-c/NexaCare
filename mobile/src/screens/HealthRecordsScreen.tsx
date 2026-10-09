import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import ProfileBanner from '../components/ProfileBanner';
import RecordIcon from '../components/RecordIcon';
import WatchReadingsCard from '../components/WatchReadingsCard';
import { getAllRecords } from '../services/healthRecordsService';
import { isWatchConnected } from '../services/healthConnectService';
import {
  RECORD_TYPE_LABELS,
  WATCH_TRACKED_TYPES,
  formatRecordDate,
  type HealthRecord,
  type HealthRecordType,
} from '../types/healthRecords';
import { colors, spacing } from '../theme/theme';

const CATEGORIES = Object.keys(RECORD_TYPE_LABELS) as HealthRecordType[];

type Props = NativeStackScreenProps<HomeStackParamList, 'HealthRecords'>;

export default function HealthRecordsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { activeProfile } = useFamily();
  const profileId = activeProfile?.id;
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [filter, setFilter] = useState<HealthRecordType | null>(null);
  const [watchConnected, setWatchConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!profileId) return;
    setLoadError(false);
    try {
      setRecords(await getAllRecords(profileId));
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
      setRefreshKey((k) => k + 1);
      if (user && activeProfile?.isSelf) {
        isWatchConnected(user.id).then(setWatchConnected).catch(() => setWatchConnected(false));
      } else {
        setWatchConnected(false);
      }
    }, [loadRecords, user, activeProfile?.isSelf])
  );

  const countFor = (type: HealthRecordType) => records.filter((r) => r.type === type).length;
  const visible = filter ? records.filter((r) => r.type === filter) : records;
  const watchType = filter === 'heart_rate' || filter === 'blood_pressure' ? filter : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ProfileBanner what="records" style={styles.banner} />
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Categories</Text>
        <View style={styles.headerButtons}>
          {records.length > 0 && (
            <Pressable style={styles.shareButton} onPress={() => navigation.navigate('ShareHealthData')}>
              <Ionicons name="share-outline" size={16} color={colors.green} />
              <Text style={styles.shareButtonText}>Share</Text>
            </Pressable>
          )}
          {(activeProfile?.canEdit ?? true) && (
            <Pressable
              style={styles.addButton}
              onPress={() => navigation.navigate('AddRecord', filter ? { initialType: filter } : undefined)}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Record</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.grid}>
        {CATEGORIES.map((type) => {
          const active = filter === type;
          const count = countFor(type);
          return (
            <Pressable
              key={type}
              style={({ pressed }) => [styles.categoryCard, active && styles.categoryCardActive, pressed && styles.pressed]}
              onPress={() => setFilter(active ? null : type)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${RECORD_TYPE_LABELS[type]}, ${count} entries${active ? ', showing only these' : ''}`}
            >
              <View style={styles.categoryTop}>
                <RecordIcon type={type} size={40} />
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.green} />}
              </View>
              <Text style={styles.categoryLabel}>{RECORD_TYPE_LABELS[type]}</Text>
              <Text style={styles.categoryCount}>
                {count} {count === 1 ? 'entry' : 'entries'}
                {watchConnected && WATCH_TRACKED_TYPES.includes(type) ? ' + watch' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.timelineHeaderRow}>
        <Text style={styles.sectionLabel}>{filter ? RECORD_TYPE_LABELS[filter] : 'Health Timeline'}</Text>
        {filter && (
          <Pressable onPress={() => setFilter(null)} hitSlop={8} style={styles.clearFilter}>
            <Text style={styles.clearFilterText}>Show all</Text>
            <Ionicons name="close" size={14} color={colors.green} />
          </Pressable>
        )}
      </View>

      {watchType && user && activeProfile?.isSelf && (
        <WatchReadingsCard
          userId={user.id}
          type={watchType}
          refreshKey={refreshKey}
          onOpenWatch={() => navigation.getParent()?.navigate('Watch' as never)}
        />
      )}
      {watchType && activeProfile?.kind === 'linked' && (
        <WatchReadingsCard userId={activeProfile.id} type={watchType} refreshKey={refreshKey} sharedBy={activeProfile.name} />
      )}
      {watchType && activeProfile?.kind === 'member' && (
        <View style={styles.hintCard}>
          <Ionicons name="watch-outline" size={20} color={colors.green} />
          <Text style={styles.hintText}>
            Readings from {activeProfile.name}’s own watch stay on their phone. Copy them from their watch app or BP
            monitor using Add Record.
          </Text>
        </View>
      )}
      {watchType && <Text style={styles.manualLabel}>Added manually</Text>}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : loadError ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
          <Text style={styles.emptyText}>Couldn’t load records.</Text>
          <Pressable onPress={() => { setIsLoading(true); loadRecords(); }} hitSlop={8}>
            <Text style={styles.linkText}>Try again</Text>
          </Pressable>
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="clipboard-outline" size={28} color={colors.textSecondary} />
          <Text style={styles.emptyText}>
            {filter
              ? `No ${RECORD_TYPE_LABELS[filter].toLowerCase()} entries yet.`
              : 'No health records yet. Tap "Add Record" to get started.'}
          </Text>
        </View>
      ) : (
        <View style={styles.timelineList}>
          {visible.map((r) => {
            return (
              <Pressable
                key={r.id}
                style={({ pressed }) => [styles.timelineItem, pressed && styles.pressed]}
                onPress={() => navigation.navigate('RecordDetail', { recordId: r.id })}
              >
                <RecordIcon type={r.type} />
                <View style={styles.flex}>
                  <Text style={styles.timelineType}>{RECORD_TYPE_LABELS[r.type]}</Text>
                  <Text style={styles.timelineValue} numberOfLines={1}>
                    {r.value}
                  </Text>
                  <Text style={styles.timelineDate}>{formatRecordDate(r.date)}</Text>
                </View>
                {r.attachmentUri && <Ionicons name="attach" size={18} color={colors.textSecondary} />}
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  banner: { marginBottom: spacing.md },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  loader: { marginTop: spacing.lg },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.green },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 20,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shareButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.green, backgroundColor: colors.surface,
    paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: 20,
  },
  shareButtonText: { color: colors.green, fontSize: 13, fontWeight: '700' },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  categoryCard: {
    width: '47%', backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  categoryCardActive: { borderColor: colors.green, backgroundColor: colors.blobLight },
  categoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  categoryCount: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  timelineHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  clearFilter: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  clearFilterText: { fontSize: 13, fontWeight: '700', color: colors.green },

  hintCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md,
    backgroundColor: colors.blobLight, borderRadius: 14, padding: spacing.md,
  },
  hintText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  manualLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },

  emptyCard: {
    alignItems: 'center', gap: spacing.sm, padding: spacing.xl,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  timelineList: { gap: spacing.sm },
  timelineItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  timelineType: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  timelineValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  timelineDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
});
