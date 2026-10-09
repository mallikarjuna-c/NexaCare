import { getRecordsByType } from './healthRecordsService';
import { getWatchDaily } from './healthConnectService';
import { toLocalISODate } from '../types/expenses';
import {
  TREND_METRICS,
  parseRecordValue,
  type TrendMetric,
  type TrendPoint,
  type TrendResult,
  type TrendSource,
} from '../types/trends';

export async function getTrend(userId: string, metric: TrendMetric, days: number): Promise<TrendResult> {
  const def = TREND_METRICS.find((m) => m.key === metric)!;
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const startDay = toLocalISODate(start);

  const byDay = new Map<string, { values: number[]; values2: number[] }>();
  const add = (day: string, value: number, value2?: number) => {
    if (day < startDay) return;
    const entry = byDay.get(day) ?? { values: [], values2: [] };
    entry.values.push(value);
    if (value2 != null) entry.values2.push(value2);
    byDay.set(day, entry);
  };

  const sources = new Set<TrendSource>();
  let watchApps: string[] = [];

  const [watch, records] = await Promise.all([
    def.watchKey ? getWatchDaily(userId, def.watchKey, days) : Promise.resolve(null),
    def.recordType ? getRecordsByType(userId, def.recordType) : Promise.resolve([]),
  ]);

  if (watch && watch.daily.length) {
    sources.add('watch');
    watchApps = watch.sources;
    const second = new Map((watch.daily2 ?? []).map((d) => [d.day, d.value]));
    for (const d of watch.daily) add(d.day, d.value, second.get(d.day));
  }

  for (const r of records) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const parsed = parseRecordValue(metric, r.value);
    if (!parsed) continue;
    add(r.date, parsed.value, parsed.value2);
    if (r.date >= startDay) sources.add('records');
  }

  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const points: TrendPoint[] = [...byDay.entries()]
    .map(([day, e]) => ({ day, value: mean(e.values), value2: e.values2.length ? mean(e.values2) : undefined }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return { points, sources: [...sources], watchApps };
}
