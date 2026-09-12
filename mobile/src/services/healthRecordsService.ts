import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HealthRecord, NewHealthRecordInput } from '../types/healthRecords';

const RECORDS_KEY_PREFIX = 'nexacare_health_records_';

// Scoping by user id keeps one account's records from leaking into another's
// on a shared device — same reasoning as authService's per-account storage.
function keyFor(userId: string) {
  return `${RECORDS_KEY_PREFIX}${userId}`;
}

export async function getAllRecords(userId: string): Promise<HealthRecord[]> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  const records: HealthRecord[] = raw ? JSON.parse(raw) : [];
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addRecord(userId: string, input: NewHealthRecordInput): Promise<HealthRecord> {
  const records = await getAllRecords(userId);

  const newRecord: HealthRecord = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...input,
  };

  const updated = [newRecord, ...records];
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(updated));

  return newRecord;
}

export async function getRecordById(userId: string, id: string): Promise<HealthRecord | null> {
  const records = await getAllRecords(userId);
  return records.find((r) => r.id === id) ?? null;
}

export async function getRecordsByType(userId: string, type: HealthRecord['type']): Promise<HealthRecord[]> {
  const records = await getAllRecords(userId);
  return records.filter((r) => r.type === type);
}