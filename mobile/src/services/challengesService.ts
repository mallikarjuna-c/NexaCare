import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadData, saveData } from './profileStore';
import { getWatchDaily } from './healthConnectService';
import {
  CHALLENGES,
  addDays,
  dayKey,
  nextStatus,
  type Challenge,
  type ChallengeEntry,
  type ChallengeRun,
} from '../types/challenges';

const LEGACY_PROGRESS_PREFIX = 'nexacare_challenge_progress_';

export function getChallenge(id: string): Challenge | null {
  return CHALLENGES.find((c) => c.id === id) ?? null;
}

async function readRuns(userId: string): Promise<ChallengeRun[]> {
  const list = await loadData<ChallengeRun[]>('challenges', userId, []);
  return Array.isArray(list) ? list : [];
}

async function writeRuns(userId: string, runs: ChallengeRun[]): Promise<void> {
  await saveData('challenges', userId, runs);
}

function settle(runs: ChallengeRun[], today: string): { runs: ChallengeRun[]; changed: boolean } {
  let changed = false;
  const settled = runs.map((run) => {
    const challenge = getChallenge(run.challengeId);
    if (!challenge || run.status !== 'active') return run;
    const status = nextStatus(run, challenge, today);
    if (status === run.status) return run;
    changed = true;
    return { ...run, status, finishedAt: new Date().toISOString() };
  });
  return { runs: settled, changed };
}

export async function getRuns(userId: string): Promise<ChallengeRun[]> {
  AsyncStorage.removeItem(`${LEGACY_PROGRESS_PREFIX}${userId}`).catch(() => {});
  const { runs, changed } = settle(await readRuns(userId), dayKey(new Date()));
  if (changed) await writeRuns(userId, runs);
  return runs.sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
}

export async function getActiveRun(userId: string, challengeId: string): Promise<ChallengeRun | null> {
  return (await getRuns(userId)).find((r) => r.challengeId === challengeId && r.status === 'active') ?? null;
}

export async function getRun(userId: string, runId: string): Promise<ChallengeRun | null> {
  return (await getRuns(userId)).find((r) => r.id === runId) ?? null;
}

export async function joinChallenge(userId: string, challengeId: string): Promise<ChallengeRun> {
  const challenge = getChallenge(challengeId);
  if (!challenge) throw new Error('Challenge not found.');
  const runs = await getRuns(userId);
  const existing = runs.find((r) => r.challengeId === challengeId && r.status === 'active');
  if (existing) return existing;
  const startDate = dayKey(new Date());
  const run: ChallengeRun = {
    id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    challengeId,
    startDate,
    endDate: addDays(startDate, challenge.durationDays - 1),
    status: 'active',
    entries: [],
    joinedAt: new Date().toISOString(),
  };
  await writeRuns(userId, [run, ...runs]);
  if (challenge.autoSource) await syncWatchProgress(userId).catch(() => {});
  return run;
}

async function updateRun(userId: string, runId: string, change: (run: ChallengeRun) => ChallengeRun): Promise<ChallengeRun> {
  const runs = await readRuns(userId);
  const target = runs.find((r) => r.id === runId);
  if (!target) throw new Error('Challenge not found.');
  const updated = change(target);
  const { runs: settled } = settle(runs.map((r) => (r.id === runId ? updated : r)), dayKey(new Date()));
  await writeRuns(userId, settled);
  return settled.find((r) => r.id === runId)!;
}

export async function logEntry(userId: string, runId: string, value: number, date = dayKey(new Date())): Promise<ChallengeRun> {
  const entry: ChallengeEntry = {
    id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    date,
    value,
    source: 'manual',
    at: new Date().toISOString(),
  };
  return updateRun(userId, runId, (run) => ({ ...run, entries: [...run.entries, entry] }));
}

export async function removeEntry(userId: string, runId: string, entryId: string): Promise<ChallengeRun> {
  return updateRun(userId, runId, (run) => ({ ...run, entries: run.entries.filter((e) => e.id !== entryId) }));
}

export async function leaveChallenge(userId: string, runId: string): Promise<void> {
  await updateRun(userId, runId, (run) => ({ ...run, status: 'left', finishedAt: new Date().toISOString() }));
}

export async function syncWatchProgress(userId: string): Promise<boolean> {
  const runs = await readRuns(userId);
  const active = runs.filter((r) => r.status === 'active' && getChallenge(r.challengeId)?.autoSource);
  if (!active.length) return false;
  let changed = false;
  const today = dayKey(new Date());
  const updated = await Promise.all(
    runs.map(async (run) => {
      if (!active.includes(run)) return run;
      const source = getChallenge(run.challengeId)!.autoSource!;
      const daysBack = Math.round((Date.now() - new Date(run.joinedAt).getTime()) / 86_400_000) + 2;
      const watch = await getWatchDaily(userId, source === 'steps' ? 'steps' : 'sleep', Math.max(2, daysBack)).catch(() => null);
      if (!watch) return run;
      const inRange = watch.daily.filter((d) => d.day >= run.startDate && d.day <= run.endDate && d.day <= today);
      const watchEntries: ChallengeEntry[] = inRange.map((d) => ({
        id: `watch-${d.day}`,
        date: d.day,
        value: Math.round(d.value * 10) / 10,
        source: 'watch',
        at: new Date().toISOString(),
      }));
      const previous = run.entries.filter((e) => e.source === 'watch');
      const same =
        previous.length === watchEntries.length &&
        previous.every((p) => watchEntries.some((w) => w.date === p.date && w.value === p.value));
      if (same) return run;
      changed = true;
      return { ...run, entries: [...run.entries.filter((e) => e.source !== 'watch'), ...watchEntries] };
    })
  );
  if (!changed) return false;
  const { runs: settled } = settle(updated, today);
  await writeRuns(userId, settled);
  return true;
}
