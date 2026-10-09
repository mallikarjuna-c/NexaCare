import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Challenge, ChallengeProgress, LeaderboardEntry } from '../types/challenges';

const PROGRESS_KEY_PREFIX = 'nexacare_challenge_progress_';

function keyFor(userId: string) {
  return `${PROGRESS_KEY_PREFIX}${userId}`;
}

const CHALLENGE_CATALOG: Challenge[] = [
  { id: 'c1', title: '10,000 Steps Challenge', description: 'Walk 10,000 steps every day for a week.', icon: 'walk-outline', goalValue: 70000, goalUnit: 'steps', durationDays: 7 },
  { id: 'c2', title: 'Daily Meditation', description: 'Meditate for at least 10 minutes a day.', icon: 'leaf-outline', goalValue: 100, goalUnit: 'minutes', durationDays: 10 },
  { id: 'c3', title: '5K Walk/Run', description: 'Cover a total of 5 kilometers this week.', icon: 'bicycle-outline', goalValue: 5, goalUnit: 'km', durationDays: 7 },
  { id: 'c4', title: 'Hydration Habit', description: 'Log 8 glasses of water daily for 5 days.', icon: 'water-outline', goalValue: 40, goalUnit: 'glasses', durationDays: 5 },
];

export async function getChallenges(): Promise<Challenge[]> {
  return CHALLENGE_CATALOG;
}

export async function getChallengeById(id: string): Promise<Challenge | null> {
  return CHALLENGE_CATALOG.find((c) => c.id === id) ?? null;
}

async function getAllProgress(userId: string): Promise<Record<string, ChallengeProgress>> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  return raw ? JSON.parse(raw) : {};
}

async function saveAllProgress(userId: string, progress: Record<string, ChallengeProgress>): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(progress));
}

export async function getProgress(userId: string, challengeId: string): Promise<ChallengeProgress | null> {
  const all = await getAllProgress(userId);
  return all[challengeId] ?? null;
}

export async function getJoinedChallengeIds(userId: string): Promise<string[]> {
  const all = await getAllProgress(userId);
  return Object.keys(all);
}

export async function joinChallenge(userId: string, challengeId: string): Promise<ChallengeProgress> {
  const all = await getAllProgress(userId);
  if (all[challengeId]) return all[challengeId];

  const newProgress: ChallengeProgress = { challengeId, currentValue: 0, joinedAt: new Date().toISOString(), logs: [] };
  all[challengeId] = newProgress;
  await saveAllProgress(userId, all);
  return newProgress;
}

export async function logProgress(userId: string, challengeId: string, amount: number): Promise<ChallengeProgress> {
  const all = await getAllProgress(userId);
  const existing = all[challengeId] ?? { challengeId, currentValue: 0, joinedAt: new Date().toISOString(), logs: [] };

  const updated: ChallengeProgress = {
    ...existing,
    currentValue: existing.currentValue + amount,
    logs: [...existing.logs, { date: new Date().toISOString().split('T')[0], value: amount }],
  };

  all[challengeId] = updated;
  await saveAllProgress(userId, all);
  return updated;
}

export async function getLeaderboard(userId: string, challenge: Challenge): Promise<LeaderboardEntry[]> {
  const myProgress = await getProgress(userId, challenge.id);
  const mockNames = ['Aditi R.', 'Rahul K.', 'Priya S.', 'Vikram T.'];

  const mockEntries: LeaderboardEntry[] = mockNames.map((name, i) => ({
    name,
    value: Math.round(challenge.goalValue * (0.3 + i * 0.15)),
    isCurrentUser: false,
  }));

  const myEntry: LeaderboardEntry = { name: 'You', value: myProgress?.currentValue ?? 0, isCurrentUser: true };

  return [...mockEntries, myEntry].sort((a, b) => b.value - a.value);
}