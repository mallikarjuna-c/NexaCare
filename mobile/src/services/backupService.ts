import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './apiClient';

type Backup = { version: 1; createdAt: string; items: Record<string, string> };
type RemoteBackup = { exists: boolean; data: Backup | null };

const EXCLUDED_PREFIXES = ['nexacare_cache_', 'nexacare_backup_restored_', 'nexacare_auth_token', 'nexacare_current_user'];

const restoredKey = (userId: string) => `nexacare_backup_restored_${userId}`;
const backupPath = (userId: string) => `/profiles/${encodeURIComponent(userId)}/data/backup`;

function belongsToBackup(key: string, userId: string): boolean {
  return key.includes(userId) && !EXCLUDED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export async function restorePhoneData(userId: string): Promise<number> {
  if (await AsyncStorage.getItem(restoredKey(userId))) return 0;
  const remote = await apiRequest<RemoteBackup>(backupPath(userId));
  let restored = 0;
  if (remote.exists && remote.data?.items) {
    const existing = new Set(await AsyncStorage.getAllKeys());
    const missing = Object.entries(remote.data.items).filter(
      ([key]) => belongsToBackup(key, userId) && !existing.has(key)
    );
    if (missing.length) await AsyncStorage.multiSet(missing);
    restored = missing.length;
  }
  await AsyncStorage.setItem(restoredKey(userId), new Date().toISOString());
  return restored;
}

export async function backupPhoneData(userId: string): Promise<void> {
  if (!(await AsyncStorage.getItem(restoredKey(userId)))) return;
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => belongsToBackup(key, userId));
  const pairs = await AsyncStorage.multiGet(keys);
  const items: Record<string, string> = {};
  for (const [key, value] of pairs) if (value != null) items[key] = value;
  const backup: Backup = { version: 1, createdAt: new Date().toISOString(), items };
  await apiRequest(backupPath(userId), { method: 'PUT', body: { data: backup } });
}
