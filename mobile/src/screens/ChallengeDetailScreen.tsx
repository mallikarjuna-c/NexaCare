import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { getChallengeById, getProgress, logProgress, joinChallenge, getLeaderboard } from '../services/challengesService';
import type { Challenge, ChallengeProgress, LeaderboardEntry } from '../types/challenges';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'ChallengeDetail'>;

export default function ChallengeDetailScreen({ route }: Props) {
  const { challengeId } = route.params;
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [progress, setProgress] = useState<ChallengeProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [logValue, setLogValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLogging, setIsLogging] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const c = await getChallengeById(challengeId);
    if (!c) { setIsLoading(false); return; }

    await joinChallenge(user.id, challengeId); // no-op if already joined
    const [p, lb] = await Promise.all([getProgress(user.id, challengeId), getLeaderboard(user.id, c)]);

    setChallenge(c);
    setProgress(p);
    setLeaderboard(lb);
    setIsLoading(false);
  }, [user, challengeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLog = async () => {
    const amount = Number(logValue);
    if (!user || !amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a positive number.');
      return;
    }
    setIsLogging(true);
    await logProgress(user.id, challengeId, amount);
    setLogValue('');
    await load();
    setIsLogging(false);
  };

  if (isLoading || !challenge) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const current = progress?.currentValue ?? 0;
  const pct = Math.min(100, Math.round((current / challenge.goalValue) * 100));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.heading}>{challenge.title}</Text>
      <Text style={[typography.body, styles.description]}>{challenge.description}</Text>

      <View style={styles.progressCard}>
        <View style={styles.progressHeaderRow}>
          <Text style={styles.progressLabel}>Your Progress</Text>
          <Text style={styles.progressValue}>{current} / {challenge.goalValue} {challenge.goalUnit}</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressPercent}>{pct}% complete</Text>
      </View>

      <Text style={styles.fieldLabel}>Log progress ({challenge.goalUnit})</Text>
      <View style={styles.logRow}>
        <TextInput
          style={styles.logInput}
          placeholder={`e.g. 20`}
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          value={logValue}
          onChangeText={setLogValue}
        />
        <Pressable style={styles.logButton} onPress={handleLog} disabled={isLogging}>
          <Text style={styles.logButtonText}>{isLogging ? '...' : 'Log'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Leaderboard</Text>
      <View style={styles.leaderboardCard}>
        {leaderboard.map((entry, i) => (
          <View key={entry.name} style={[styles.leaderboardRow, entry.isCurrentUser && styles.leaderboardRowSelf]}>
            <Text style={styles.leaderboardRank}>#{i + 1}</Text>
            <Text style={[styles.leaderboardName, entry.isCurrentUser && styles.leaderboardNameSelf]}>{entry.name}</Text>
            <Text style={styles.leaderboardValue}>{entry.value} {challenge.goalUnit}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.leaderboardNote}>
        Other participants shown are sample data until community accounts are connected.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  description: { marginTop: spacing.xs, marginBottom: spacing.lg },

  progressCard: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  progressHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  progressLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  progressValue: { fontSize: 13, color: colors.textSecondary },
  progressBarTrack: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.green, borderRadius: 5 },
  progressPercent: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  logRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  logInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  logButton: { backgroundColor: colors.green, paddingHorizontal: spacing.lg, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logButtonText: { color: '#FFFFFF', fontWeight: '700' },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  leaderboardCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  leaderboardRowSelf: { backgroundColor: colors.badge.greenBg },
  leaderboardRank: { width: 28, fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  leaderboardName: { flex: 1, fontSize: 13, color: colors.textPrimary },
  leaderboardNameSelf: { fontWeight: '700', color: colors.green },
  leaderboardValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  leaderboardNote: { fontSize: 11, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
});