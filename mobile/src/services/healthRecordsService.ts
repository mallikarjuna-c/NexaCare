import { loadData, removeLocalData, saveData } from './profileStore';
import type { HealthRecord, NewHealthRecordInput } from '../types/healthRecords';

async function readAll(profileId: string): Promise<HealthRecord[]> {
  const list = await loadData<HealthRecord[]>('records', profileId, []);
  return Array.isArray(list) ? list : [];
}

async function writeAll(profileId: string, records: HealthRecord[]): Promise<void> {
  await saveData('records', profileId, records);
}

export async function getAllRecords(profileId: string): Promise<HealthRecord[]> {
  const records = await readAll(profileId);
  return records.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function addRecord(profileId: string, input: NewHealthRecordInput): Promise<HealthRecord> {
  const records = await readAll(profileId);
  const newRecord: HealthRecord = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  await writeAll(profileId, [newRecord, ...records]);
  return newRecord;
}

export async function updateRecord(profileId: string, id: string, input: NewHealthRecordInput): Promise<HealthRecord> {
  const records = await readAll(profileId);
  const existing = records.find((r) => r.id === id);
  if (!existing) throw new Error('Record not found.');
  const updated: HealthRecord = { id: existing.id, createdAt: existing.createdAt, ...input };
  await writeAll(profileId, records.map((r) => (r.id === id ? updated : r)));
  return updated;
}

export async function deleteRecord(profileId: string, id: string): Promise<void> {
  const records = await readAll(profileId);
  await writeAll(profileId, records.filter((r) => r.id !== id));
}

export async function getRecordById(profileId: string, id: string): Promise<HealthRecord | null> {
  const records = await readAll(profileId);
  return records.find((r) => r.id === id) ?? null;
}

export async function removeAllRecords(profileId: string): Promise<void> {
  await removeLocalData('records', profileId);
}

export async function getRecordsByType(profileId: string, type: HealthRecord['type']): Promise<HealthRecord[]> {
  const records = await readAll(profileId);
  return records.filter((r) => r.type === type);
}
