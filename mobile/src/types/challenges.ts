export type Challenge = {
  id: string;
  title: string;
  description: string;
  icon: string; // Ionicons name, kept as string to avoid a circular type import
  goalValue: number;
  goalUnit: string; // "steps", "minutes", "km", etc.
  durationDays: number;
};

export type ChallengeProgress = {
  challengeId: string;
  currentValue: number;
  joinedAt: string; // ISO timestamp
  logs: { date: string; value: number }[];
};

export type LeaderboardEntry = {
  name: string;
  value: number;
  isCurrentUser: boolean;
};