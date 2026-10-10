import type { Ionicons } from '@expo/vector-icons';

export type ChallengeCategory = 'activity' | 'mindfulness' | 'nutrition' | 'sleep';
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';
export type ChallengeMode = 'daily' | 'total' | 'check';
export type AutoSource = 'steps' | 'sleep';

export type Challenge = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  mode: ChallengeMode;
  target: number;
  unit: string;
  durationDays: number;
  autoSource?: AutoSource;
  quickAdd: number[];
  tip: string;
  reminderTime: string;
};

export type ChallengeEntry = {
  id: string;
  date: string;
  value: number;
  source: 'manual' | 'watch';
  at: string;
};

export type RunStatus = 'active' | 'completed' | 'ended' | 'left';

export type ChallengeRun = {
  id: string;
  challengeId: string;
  startDate: string;
  endDate: string;
  status: RunStatus;
  entries: ChallengeEntry[];
  joinedAt: string;
  finishedAt?: string;
};

export type DayStatus = { date: string; value: number; met: boolean; state: 'past' | 'today' | 'future' };

export type RunProgress = {
  dayNumber: number;
  daysMet: number;
  totalValue: number;
  todayValue: number;
  percent: number;
  streak: number;
  bestDay: number;
  days: DayStatus[];
  isComplete: boolean;
};

export const CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  activity: 'Activity',
  mindfulness: 'Mindfulness',
  nutrition: 'Nutrition',
  sleep: 'Sleep',
};

export const DIFFICULTY_LABELS: Record<ChallengeDifficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export const CHALLENGES: Challenge[] = [
  {
    id: 'steps-10k-7', title: '10K Steps a Day', description: 'Reach 10,000 steps every day for a week.',
    icon: 'walk-outline', category: 'activity', difficulty: 'hard', mode: 'daily', target: 10000, unit: 'steps',
    durationDays: 7, autoSource: 'steps', quickAdd: [1000, 2000], tip: 'Take a 10-minute walk after each meal — it adds up to about 3,000 steps.', reminderTime: '18:00',
  },
  {
    id: 'steps-7500-14', title: 'Steady Stepper', description: 'Walk 7,500 steps a day for two weeks.',
    icon: 'footsteps-outline', category: 'activity', difficulty: 'medium', mode: 'daily', target: 7500, unit: 'steps',
    durationDays: 14, autoSource: 'steps', quickAdd: [1000, 2000], tip: 'Take the stairs and walk while you’re on phone calls.', reminderTime: '18:00',
  },
  {
    id: 'walk-30-7', title: '30-Minute Walk', description: 'Walk briskly for 30 minutes every day for 7 days.',
    icon: 'timer-outline', category: 'activity', difficulty: 'easy', mode: 'daily', target: 30, unit: 'min',
    durationDays: 7, quickAdd: [10, 15, 30], tip: 'Splitting it into three 10-minute walks counts just as well.', reminderTime: '07:00',
  },
  {
    id: 'distance-5k-7', title: '5 km Week', description: 'Walk or run a total of 5 km within 7 days.',
    icon: 'map-outline', category: 'activity', difficulty: 'easy', mode: 'total', target: 5, unit: 'km',
    durationDays: 7, quickAdd: [0.5, 1, 2], tip: 'An easy 1 km walk takes about 12–15 minutes.', reminderTime: '07:00',
  },
  {
    id: 'water-8-7', title: 'Hydration Habit', description: 'Drink 8 glasses of water every day for 7 days.',
    icon: 'water-outline', category: 'nutrition', difficulty: 'easy', mode: 'daily', target: 8, unit: 'glasses',
    durationDays: 7, quickAdd: [1, 2], tip: 'Keep a bottle on your desk and refill it twice before lunch.', reminderTime: '10:00',
  },
  {
    id: 'no-sugar-7', title: 'Sugar-Free Week', description: 'Skip sweets and sugary drinks for 7 days.',
    icon: 'nutrition-outline', category: 'nutrition', difficulty: 'medium', mode: 'check', target: 1, unit: 'day',
    durationDays: 7, quickAdd: [], tip: 'Swap sweets for fruit, nuts or plain curd when cravings hit.', reminderTime: '21:00',
  },
  {
    id: 'meditate-10-10', title: 'Mindful Minutes', description: 'Meditate for at least 10 minutes a day for 10 days.',
    icon: 'leaf-outline', category: 'mindfulness', difficulty: 'easy', mode: 'daily', target: 10, unit: 'min',
    durationDays: 10, quickAdd: [5, 10, 15], tip: 'Same time, same place each day makes the habit stick.', reminderTime: '07:30',
  },
  {
    id: 'sleep-7h-7', title: '7 Hours of Sleep', description: 'Sleep at least 7 hours every night for a week.',
    icon: 'moon-outline', category: 'sleep', difficulty: 'medium', mode: 'daily', target: 7, unit: 'h',
    durationDays: 7, autoSource: 'sleep', quickAdd: [6, 7, 8], tip: 'Put the phone away 30 minutes before bed.', reminderTime: '22:00',
  },
];

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

export function formatAmount(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  const text = unit === 'steps' ? Math.round(value).toLocaleString('en-IN') : String(rounded);
  return `${text} ${unit}`;
}

export function dailyTotals(run: ChallengeRun): Map<string, number> {
  const watch = new Map<string, number>();
  const manual = new Map<string, number>();
  for (const e of run.entries) {
    const bucket = e.source === 'watch' ? watch : manual;
    bucket.set(e.date, (bucket.get(e.date) ?? 0) + e.value);
  }
  const totals = new Map<string, number>();
  for (const date of new Set([...watch.keys(), ...manual.keys()])) {
    totals.set(date, Math.max(watch.get(date) ?? 0, 0) + (manual.get(date) ?? 0));
  }
  return totals;
}

export function runProgress(run: ChallengeRun, challenge: Challenge, today: string): RunProgress {
  const totals = dailyTotals(run);
  const days: DayStatus[] = [];
  for (let i = 0; i < challenge.durationDays; i++) {
    const date = addDays(run.startDate, i);
    const value = totals.get(date) ?? 0;
    days.push({
      date,
      value,
      met: challenge.mode === 'total' ? value > 0 : value >= challenge.target,
      state: date < today ? 'past' : date === today ? 'today' : 'future',
    });
  }
  const totalValue = days.reduce((sum, d) => sum + d.value, 0);
  const daysMet = days.filter((d) => d.met).length;
  const percent =
    challenge.mode === 'total'
      ? Math.min(100, Math.round((totalValue / challenge.target) * 100))
      : Math.round((daysMet / challenge.durationDays) * 100);
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.state === 'future') continue;
    if (d.state === 'today' && !d.met) continue;
    if (!d.met) break;
    streak++;
  }
  const dayNumber = Math.min(challenge.durationDays, Math.max(1, days.findIndex((d) => d.date === today) + 1 || (today > run.endDate ? challenge.durationDays : 1)));
  return {
    dayNumber,
    daysMet,
    totalValue,
    todayValue: totals.get(today) ?? 0,
    percent,
    streak,
    bestDay: days.reduce((max, d) => Math.max(max, d.value), 0),
    days,
    isComplete: challenge.mode === 'total' ? totalValue >= challenge.target : daysMet >= challenge.durationDays,
  };
}

export function nextStatus(run: ChallengeRun, challenge: Challenge, today: string): RunStatus {
  if (run.status !== 'active') return run.status;
  const progress = runProgress(run, challenge, today);
  if (progress.isComplete) return 'completed';
  if (today > run.endDate) return 'ended';
  return 'active';
}
