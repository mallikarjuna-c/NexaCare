import type { Ionicons } from '@expo/vector-icons';

export type Tone = 'good' | 'warn' | 'bad' | 'info';
export type MetricStatus = { label: string; tone: Tone };

export function heartRateStatus(bpm: number): MetricStatus {
  if (bpm < 50) return { label: 'Low', tone: 'warn' };
  if (bpm < 60) return { label: 'Low', tone: 'info' };
  if (bpm <= 100) return { label: 'Normal', tone: 'good' };
  if (bpm <= 120) return { label: 'High', tone: 'warn' };
  return { label: 'High', tone: 'bad' };
}

export function breathingStatus(bpm: number): MetricStatus {
  if (bpm < 12) return { label: 'Low', tone: 'warn' };
  if (bpm <= 20) return { label: 'Normal', tone: 'good' };
  if (bpm <= 24) return { label: 'High', tone: 'warn' };
  return { label: 'High', tone: 'bad' };
}

export function rmssdStatus(ms: number): MetricStatus {
  if (ms < 15) return { label: 'Low', tone: 'warn' };
  if (ms <= 80) return { label: 'Typical', tone: 'good' };
  return { label: 'Very high', tone: 'info' };
}

export function bloodPressureStatus(sys: number, dia: number): MetricStatus {
  if (sys >= 180 || dia >= 120) return { label: 'Crisis', tone: 'bad' };
  if (sys >= 140 || dia >= 90) return { label: 'Stage 2 high', tone: 'bad' };
  if (sys >= 130 || dia >= 80) return { label: 'Stage 1 high', tone: 'warn' };
  if (sys >= 120) return { label: 'Elevated', tone: 'warn' };
  return { label: 'Normal', tone: 'good' };
}

export type HealthConnectStatus = 'available' | 'update_required' | 'unavailable';

export type WatchMetricKey =
  | 'heartRate'
  | 'restingHeartRate'
  | 'hrv'
  | 'spo2'
  | 'respiratoryRate'
  | 'bloodPressure'
  | 'steps'
  | 'sleep';

export type WatchReading = {
  value: number;
  value2?: number;
  time: string;
  source: string;
};

export type DailyValue = { day: string; value: number };

export type WatchMetricSummary = {
  key: WatchMetricKey;
  latest: WatchReading | null;
  average7d: number | null;
  count: number;
  granted: boolean;
  daily: DailyValue[];
  daily2?: DailyValue[];
};

export const WATCH_SCALES: Record<WatchMetricKey, { min: number; max: number; normalLo: number; normalHi: number }> = {
  heartRate: { min: 40, max: 140, normalLo: 60, normalHi: 100 },
  restingHeartRate: { min: 40, max: 110, normalLo: 60, normalHi: 100 },
  hrv: { min: 0, max: 100, normalLo: 15, normalHi: 80 },
  spo2: { min: 85, max: 100, normalLo: 95, normalHi: 100 },
  respiratoryRate: { min: 6, max: 30, normalLo: 12, normalHi: 20 },
  bloodPressure: { min: 90, max: 180, normalLo: 90, normalHi: 120 },
  steps: { min: 0, max: 15000, normalLo: 8000, normalHi: 15000 },
  sleep: { min: 3, max: 11, normalLo: 7, normalHi: 9 },
};

export const STEP_GOAL = 8000;

export const NORMAL_RANGE_TEXT: Record<WatchMetricKey, string> = {
  heartRate: 'Normal 60–100 bpm at rest',
  restingHeartRate: 'Normal 60–100 bpm (fit people can be lower)',
  hrv: 'Typical 15–80 ms; higher usually means better recovery',
  spo2: 'Normal 95–100%',
  respiratoryRate: 'Normal 12–20 breaths per minute',
  bloodPressure: 'Normal below 120/80 mmHg',
  steps: `Goal ${STEP_GOAL.toLocaleString('en-IN')} steps a day`,
  sleep: 'Adults need 7–9 hours',
};

export type WatchSummary = { fetchedAt: string; metrics: Record<WatchMetricKey, WatchMetricSummary> };

export const WATCH_METRICS: {
  key: WatchMetricKey;
  name: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  averageLabel: string;
}[] = [
  { key: 'heartRate', name: 'Heart rate', unit: 'bpm', icon: 'heart-outline', averageLabel: '7-day avg' },
  { key: 'restingHeartRate', name: 'Resting heart rate', unit: 'bpm', icon: 'bed-outline', averageLabel: '7-day avg' },
  { key: 'hrv', name: 'HRV (RMSSD)', unit: 'ms', icon: 'pulse-outline', averageLabel: '7-day avg' },
  { key: 'spo2', name: 'Blood oxygen', unit: '%', icon: 'water-outline', averageLabel: '7-day avg' },
  { key: 'respiratoryRate', name: 'Breathing rate', unit: 'br/min', icon: 'leaf-outline', averageLabel: '7-day avg' },
  { key: 'bloodPressure', name: 'Blood pressure', unit: 'mmHg', icon: 'speedometer-outline', averageLabel: '7-day avg (sys)' },
  { key: 'steps', name: 'Steps', unit: 'today', icon: 'walk-outline', averageLabel: 'Daily avg' },
  { key: 'sleep', name: 'Sleep', unit: 'h', icon: 'moon-outline', averageLabel: 'Nightly avg' },
];

export function spo2Status(pct: number): MetricStatus {
  if (pct >= 95) return { label: 'Normal', tone: 'good' };
  if (pct >= 90) return { label: 'Low', tone: 'warn' };
  return { label: 'Very low', tone: 'bad' };
}

export function sleepStatus(hours: number): MetricStatus {
  if (hours < 6) return { label: 'Short', tone: 'warn' };
  if (hours <= 9) return { label: 'Healthy', tone: 'good' };
  return { label: 'Long', tone: 'info' };
}

export function stepsStatus(steps: number): MetricStatus {
  if (steps >= 8000) return { label: 'Active', tone: 'good' };
  if (steps >= 4000) return { label: 'Moderate', tone: 'info' };
  return { label: 'Low', tone: 'warn' };
}

export function watchMetricStatus(key: WatchMetricKey, r: WatchReading): MetricStatus | null {
  switch (key) {
    case 'heartRate':
    case 'restingHeartRate':
      return heartRateStatus(r.value);
    case 'hrv':
      return rmssdStatus(r.value);
    case 'spo2':
      return spo2Status(r.value);
    case 'respiratoryRate':
      return breathingStatus(r.value);
    case 'bloodPressure':
      return r.value2 != null ? bloodPressureStatus(r.value, r.value2) : null;
    case 'steps':
      return stepsStatus(r.value);
    case 'sleep':
      return sleepStatus(r.value);
  }
}

export function formatWatchValue(key: WatchMetricKey, r: WatchReading): string {
  if (key === 'bloodPressure') return `${Math.round(r.value)}/${Math.round(r.value2 ?? 0)}`;
  if (key === 'steps') return Math.round(r.value).toLocaleString('en-IN');
  if (key === 'sleep') return r.value.toFixed(1);
  return String(Math.round(r.value));
}

const SOURCE_NAMES: Record<string, string> = {
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.mi.health': 'Mi Fitness',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.ouraring.oura': 'Oura',
  'com.withings.wiscale2': 'Withings',
  'com.noisefit': 'NoiseFit',
  'com.vivo.health': 'vivo Health',
  'com.vivo.exhealth': 'vivo Health',
  'com.huawei.health': 'Huawei Health',
  'com.heytap.health': 'OHealth',
  'com.realme.link': 'realme Link',
  'com.google.android.apps.fitness.wear': 'Google Fit',
};

export function sourceAppName(pkg: string): string {
  if (SOURCE_NAMES[pkg]) return SOURCE_NAMES[pkg];
  if (!pkg || pkg === 'unknown') return 'Unknown app';
  return 'Other health app';
}

export function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
