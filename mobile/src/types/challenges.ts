export type Challenge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  goalValue: number;
  goalUnit: string;
  durationDays: number;
};

export type ChallengeProgress = {
  challengeId: string;
  currentValue: number;
  joinedAt: string;
  logs: { date: string; value: number }[];
};

export type LeaderboardEntry = {
  name: string;
  value: number;
  isCurrentUser: boolean;
};