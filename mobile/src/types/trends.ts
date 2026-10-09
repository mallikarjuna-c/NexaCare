import type { Ionicons } from '@expo/vector-icons';
import type { HealthRecordType } from './healthRecords';
import type { WatchMetricKey } from './smartwatch';

// Health Trends (Module 11): one value per day, from the smartwatch (Health Connect) and/or
// readings typed into Health Records.

export type TrendMetric =
  | 'heartRate'
  | 'restingHeartRate'
  | 'hrv'
  | 'spo2'
  | 'bloodPressure'
  | 'steps'
  | 'sleep'
  | 'weight'
  | 'glucose';

export type TrendPoint = { day: string; value: number; value2?: number }; // day = local YYYY-MM-DD

export type TrendSource = 'watch' | 'records';

export type TrendResult = {
  points: TrendPoint[]; // oldest first, only days with data
  sources: TrendSource[]; // which sources actually contributed
  watchApps: string[]; // package names of watch apps that contributed
};

export type TrendDefinition = {
  key: TrendMetric;
  label: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  chart: 'line' | 'bar';
  decimals: number;
  watchKey?: WatchMetricKey; // read from Health Connect
  recordType?: HealthRecordType; // read from Health Records
  band?: { lo: number; hi: number }; // healthy range, drawn as a light band
  rangeText: string;
};

export const TREND_METRICS: TrendDefinition[] = [
  {
    key: 'heartRate', label: 'Heart rate', unit: 'bpm', icon: 'heart-outline', chart: 'line', decimals: 0,
    watchKey: 'heartRate', recordType: 'heart_rate', band: { lo: 60, hi: 100 }, rangeText: 'Normal 60–100 bpm at rest',
  },
  {
    key: 'restingHeartRate', label: 'Resting HR', unit: 'bpm', icon: 'bed-outline', chart: 'line', decimals: 0,
    watchKey: 'restingHeartRate', band: { lo: 60, hi: 100 }, rangeText: 'Normal 60–100 bpm (fit people can be lower)',
  },
  {
    key: 'hrv', label: 'HRV', unit: 'ms', icon: 'pulse-outline', chart: 'line', decimals: 0,
    watchKey: 'hrv', band: { lo: 15, hi: 80 }, rangeText: 'Typical 15–80 ms — compare with your own trend',
  },
  {
    key: 'spo2', label: 'Blood oxygen', unit: '%', icon: 'water-outline', chart: 'line', decimals: 0,
    watchKey: 'spo2', band: { lo: 95, hi: 100 }, rangeText: 'Normal 95–100%',
  },
  {
    key: 'bloodPressure', label: 'Blood pressure', unit: 'mmHg', icon: 'speedometer-outline', chart: 'line', decimals: 0,
    watchKey: 'bloodPressure', recordType: 'blood_pressure', band: { lo: 60, hi: 120 }, rangeText: 'Normal below 120/80 mmHg',
  },
  {
    key: 'steps', label: 'Steps', unit: 'steps', icon: 'walk-outline', chart: 'bar', decimals: 0,
    watchKey: 'steps', rangeText: 'Goal 8,000 steps a day',
  },
  {
    key: 'sleep', label: 'Sleep', unit: 'h', icon: 'moon-outline', chart: 'bar', decimals: 1,
    watchKey: 'sleep', band: { lo: 7, hi: 9 }, rangeText: 'Adults need 7–9 hours',
  },
  {
    key: 'weight', label: 'Weight', unit: 'kg', icon: 'body-outline', chart: 'line', decimals: 1,
    recordType: 'weight', rangeText: 'Healthy weight depends on your height (see BMI)',
  },
  {
    key: 'glucose', label: 'Blood glucose', unit: 'mg/dL', icon: 'water-outline', chart: 'line', decimals: 0,
    recordType: 'blood_glucose', band: { lo: 70, hi: 99 }, rangeText: 'Fasting: normal 70–99 mg/dL',
  },
];

export const TREND_PERIODS = [7, 30] as const;
export type TrendPeriod = (typeof TREND_PERIODS)[number];

// ---- Parsing typed-in Health Records values ----

// Health Records store free text like "120/80", "72 bpm", "68 kg", "150 lb", "5.6 mmol/L".
export function parseRecordValue(metric: TrendMetric, text: string): { value: number; value2?: number } | null {
  if (metric === 'bloodPressure') {
    const m = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    return m ? { value: Number(m[1]), value2: Number(m[2]) } : null;
  }
  const n = text.replace(',', '.').match(/\d+(\.\d+)?/);
  if (!n) return null;
  let value = Number(n[0]);
  if (metric === 'weight' && /\b(lb|lbs|pound)/i.test(text)) value *= 0.45359237;
  if (metric === 'glucose' && /mmol/i.test(text)) value *= 18;
  return Number.isFinite(value) && value > 0 ? { value } : null;
}

export function formatTrendValue(def: TrendDefinition, value: number): string {
  return def.decimals ? value.toFixed(def.decimals) : Math.round(value).toLocaleString('en-IN');
}
