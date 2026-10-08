import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  SdkAvailabilityStatus,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  type Permission,
  type RecordType,
} from 'react-native-health-connect';
import type {
  DailyValue,
  HealthConnectStatus,
  WatchMetricKey,
  WatchMetricSummary,
  WatchReading,
  WatchSummary,
} from '../types/smartwatch';

// Which Health Connect record type backs each NexaCare metric.
const RECORD_FOR: Record<WatchMetricKey, RecordType> = {
  heartRate: 'HeartRate',
  restingHeartRate: 'RestingHeartRate',
  hrv: 'HeartRateVariabilityRmssd',
  spo2: 'OxygenSaturation',
  respiratoryRate: 'RespiratoryRate',
  bloodPressure: 'BloodPressure',
  steps: 'Steps',
  sleep: 'SleepSession',
};

const READ_PERMISSIONS: Permission[] = (Object.values(RECORD_FOR) as RecordType[]).map((recordType) => ({
  accessType: 'read',
  recordType,
}));

const DAYS = 7;
const CONNECTED_PREFIX = 'nexacare_watch_connected_';

let initialized = false;
async function ensureInitialized(): Promise<boolean> {
  if (!initialized) initialized = await initialize();
  return initialized;
}

export async function getHealthConnectStatus(): Promise<HealthConnectStatus> {
  if (Platform.OS !== 'android') return 'unavailable';
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

// "Connected" is NexaCare's own per-user switch. Health Connect permissions belong to the whole app,
// and revoking them only takes effect after an app restart — so we track the user's choice ourselves.
export async function isWatchConnected(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(`${CONNECTED_PREFIX}${userId}`)) === 'true';
}

export async function setWatchConnected(userId: string, connected: boolean): Promise<void> {
  if (connected) await AsyncStorage.setItem(`${CONNECTED_PREFIX}${userId}`, 'true');
  else await AsyncStorage.removeItem(`${CONNECTED_PREFIX}${userId}`);
}

// Shows Android's Health Connect permission screen. Returns the record types the user allowed.
export async function connectHealthConnect(userId: string): Promise<RecordType[]> {
  if (!(await ensureInitialized())) throw new Error('Health Connect could not be started.');
  const granted = await requestPermission(READ_PERMISSIONS);
  const types = grantedReadTypes(granted);
  if (types.length) await setWatchConnected(userId, true);
  return types;
}

function grantedReadTypes(granted: unknown[]): RecordType[] {
  return granted
    .filter((p): p is Permission => !!p && typeof p === 'object' && 'recordType' in p && (p as Permission).accessType === 'read')
    .map((p) => p.recordType);
}

export async function getGrantedTypes(): Promise<RecordType[]> {
  if (!(await ensureInitialized())) return [];
  return grantedReadTypes(await getGrantedPermissions());
}

export function openHealthConnect() {
  openHealthConnectSettings();
}

// ---------------- Reading ----------------

async function readAll<T extends RecordType>(recordType: T, startTime: string, endTime: string) {
  const out = [];
  let pageToken: string | undefined;
  do {
    const page = await readRecords(recordType, {
      timeRangeFilter: { operator: 'between', startTime, endTime },
      ascendingOrder: false,
      pageSize: 1000,
      pageToken,
    });
    out.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken && out.length < 20000);
  return out;
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const sourceOf = (r: { metadata?: { dataOrigin?: string } }) => r.metadata?.dataOrigin ?? 'unknown';

function emptySummary(key: WatchMetricKey, granted: boolean): WatchMetricSummary {
  return { key, latest: null, average7d: null, count: 0, granted, daily: [] };
}

// Local calendar day (YYYY-MM-DD) for grouping readings into days.
function isoDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// One value per day, oldest first: the day's total (steps) or the day's average (everything else).
function dailyValues(readings: { value: number; time: string }[], mode: 'sum' | 'avg'): DailyValue[] {
  const byDay = new Map<string, number[]>();
  for (const r of readings) {
    const day = isoDay(r.time);
    byDay.set(day, [...(byDay.get(day) ?? []), r.value]);
  }
  return [...byDay.entries()]
    .map(([day, values]) => ({
      day,
      value: mode === 'sum' ? values.reduce((a, b) => a + b, 0) : values.reduce((a, b) => a + b, 0) / values.length,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

async function summarise(key: WatchMetricKey, start: string, end: string): Promise<Omit<WatchMetricSummary, 'granted'>> {
  switch (key) {
    case 'heartRate': {
      const records = await readAll('HeartRate', start, end);
      const samples = records.flatMap((r) =>
        r.samples.map((s) => ({ value: s.beatsPerMinute, time: s.time, source: sourceOf(r) }))
      );
      samples.sort((a, b) => b.time.localeCompare(a.time));
      return {
        key,
        latest: samples[0] ?? null,
        average7d: avg(samples.map((s) => s.value)),
        count: samples.length,
        daily: dailyValues(samples, 'avg'),
      };
    }
    case 'restingHeartRate':
    case 'hrv':
    case 'spo2':
    case 'respiratoryRate': {
      const recordType = RECORD_FOR[key] as 'RestingHeartRate' | 'HeartRateVariabilityRmssd' | 'OxygenSaturation' | 'RespiratoryRate';
      const records = await readAll(recordType, start, end);
      const readings: WatchReading[] = records.map((r) => {
        const rec = r as unknown as {
          time: string;
          beatsPerMinute?: number;
          heartRateVariabilityMillis?: number;
          percentage?: number;
          rate?: number;
          metadata?: { dataOrigin?: string };
        };
        const value = rec.beatsPerMinute ?? rec.heartRateVariabilityMillis ?? rec.percentage ?? rec.rate ?? 0;
        return { value, time: rec.time, source: sourceOf(rec) };
      });
      readings.sort((a, b) => b.time.localeCompare(a.time));
      return {
        key,
        latest: readings[0] ?? null,
        average7d: avg(readings.map((r) => r.value)),
        count: readings.length,
        daily: dailyValues(readings, 'avg'),
      };
    }
    case 'bloodPressure': {
      const records = await readAll('BloodPressure', start, end);
      const readings: WatchReading[] = records.map((r) => ({
        value: r.systolic.inMillimetersOfMercury,
        value2: r.diastolic.inMillimetersOfMercury,
        time: r.time,
        source: sourceOf(r),
      }));
      readings.sort((a, b) => b.time.localeCompare(a.time));
      return {
        key,
        latest: readings[0] ?? null,
        average7d: avg(readings.map((r) => r.value)),
        count: readings.length,
        daily: dailyValues(readings, 'avg'),
        daily2: dailyValues(readings.map((r) => ({ value: r.value2 ?? 0, time: r.time })), 'avg'),
      };
    }
    case 'steps': {
      const records = await readAll('Steps', start, end);
      const daily = dailyValues(records.map((r) => ({ value: r.count, time: r.endTime })), 'sum');
      const today = daily.find((d) => d.day === isoDay(new Date().toISOString()))?.value ?? 0;
      const newest = records.reduce<(typeof records)[number] | null>((a, r) => (!a || r.endTime > a.endTime ? r : a), null);
      return {
        key,
        latest: newest ? { value: today, time: newest.endTime, source: sourceOf(newest) } : null,
        average7d: avg(daily.map((d) => d.value)),
        count: records.length,
        daily,
      };
    }
    case 'sleep': {
      const records = await readAll('SleepSession', start, end);
      const sessions = records
        .map((r) => ({
          hours: (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 3_600_000,
          time: r.endTime,
          source: sourceOf(r),
        }))
        .filter((s) => s.hours > 0.5)
        .sort((a, b) => b.time.localeCompare(a.time));
      return {
        key,
        latest: sessions[0] ? { value: sessions[0].hours, time: sessions[0].time, source: sessions[0].source } : null,
        average7d: avg(sessions.map((s) => s.hours)),
        count: sessions.length,
        daily: dailyValues(sessions.map((s) => ({ value: s.hours, time: s.time })), 'sum'),
      };
    }
  }
}

// Reads the last 7 days for every metric the user allowed. One failing type doesn't break the rest.
export async function getWatchSummary(): Promise<WatchSummary> {
  const grantedTypes = await getGrantedTypes();
  const end = new Date();
  const start = new Date(end.getTime() - DAYS * 86_400_000);
  const keys = Object.keys(RECORD_FOR) as WatchMetricKey[];

  const entries = await Promise.all(
    keys.map(async (key) => {
      const granted = grantedTypes.includes(RECORD_FOR[key]);
      if (!granted) return [key, emptySummary(key, false)] as const;
      try {
        return [key, { ...(await summarise(key, start.toISOString(), end.toISOString())), granted: true }] as const;
      } catch (error) {
        console.warn(`Health Connect read failed for ${key}`, error);
        return [key, emptySummary(key, true)] as const;
      }
    })
  );

  return { fetchedAt: end.toISOString(), metrics: Object.fromEntries(entries) as WatchSummary['metrics'] };
}

// Daily values for one metric over the last `days` days — for the Trends screen.
// Returns null when the watch isn't connected or this data type isn't allowed.
export async function getWatchDaily(
  userId: string,
  key: WatchMetricKey,
  days: number
): Promise<{ daily: DailyValue[]; daily2?: DailyValue[]; sources: string[] } | null> {
  try {
    if (Platform.OS !== 'android' || !(await isWatchConnected(userId))) return null;
    if ((await getHealthConnectStatus()) !== 'available') return null;
    if (!(await getGrantedTypes()).includes(RECORD_FOR[key])) return null;
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    const s = await summarise(key, start.toISOString(), end.toISOString());
    return { daily: s.daily, daily2: s.daily2, sources: s.latest ? [s.latest.source] : [] };
  } catch (error) {
    console.warn(`Health Connect trend read failed for ${key}`, error);
    return null;
  }
}

// Latest blood pressure from the watch / cuff app, for the wellness report's BP card.
export async function getLatestWatchBp(userId: string): Promise<WatchReading | null> {
  try {
    if (Platform.OS !== 'android' || !(await isWatchConnected(userId))) return null;
    if ((await getHealthConnectStatus()) !== 'available') return null;
    if (!(await getGrantedTypes()).includes('BloodPressure')) return null;
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86_400_000);
    const s = await summarise('bloodPressure', start.toISOString(), end.toISOString());
    return s.latest;
  } catch {
    return null;
  }
}
