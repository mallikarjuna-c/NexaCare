import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { getChallenges, getJoinedChallengeIds, joinChallenge } from '../services/challengesService';
import type { Challenge } from '../types/challenges';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Challenges'>;

export default function ChallengesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const [list, joined] = await Promise.all([getChallenges(), getJoinedChallengeIds(user.id)]);
    setChallenges(list);
    setJoinedIds(joined);
    setIsLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleJoin = async (challengeId: string) => {
    if (!user) return;
    setJoiningId(challengeId);
    await joinChallenge(user.id, challengeId);
    setJoinedIds((prev) => [...prev, challengeId]);
    setJoiningId(null);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {challenges.map((c) => {
        const isJoined = joinedIds.includes(c.id);
        return (
          <Pressable
            key={c.id}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })}
          >
            <View style={styles.cardIcon}>
              <Ionicons name={c.icon as keyof typeof Ionicons.glyphMap} size={24} color={colors.blue} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={styles.cardDescription}>{c.description}</Text>
              <Text style={styles.cardMeta}>
                Goal: {c.goalValue} {c.goalUnit} · {c.durationDays} days
              </Text>
            </View>
            {isJoined ? (
              <View style={styles.joinedBadge}>
                <Ionicons name="checkmark" size={14} color={colors.green} />
                <Text style={styles.joinedText}>Joined</Text>
              </View>
            ) : (
              <Pressable
                style={styles.joinButton}
                onPress={(e) => { e.stopPropagation(); handleJoin(c.id); }}
                disabled={joiningId === c.id}
              >
                <Text style={styles.joinButtonText}>{joiningId === c.id ? '...' : 'Join'}</Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.md },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  cardPressed: { opacity: 0.85 },
  cardIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.badge.blueBg, alignItems: 'center', justifyContent: 'center' },
  cardTextWrap: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  cardDescription: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },

  joinButton: { backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 16 },
  joinButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  joinedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.badge.greenBg, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: 12 },
  joinedText: { fontSize: 11, fontWeight: '700', color: colors.green },
});