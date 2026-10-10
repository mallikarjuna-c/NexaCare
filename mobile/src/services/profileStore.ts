import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, apiRequest } from './apiClient';
import { isMemberProfileId } from '../types/family';

export type DataCollection =
  | 'records'
  | 'followups'
  | 'expenses'
  | 'medical'
  | 'watch'
  | 'reminders'
  | 'reminder_logs'
  | 'challenges';
export type ProfileAccess = 'owner' | 'edit' | 'view' | 'local';

const LOCAL_PREFIX: Record<DataCollection, string> = {
  records: 'nexacare_health_records_',
  followups: 'nexacare_followups_',
  expenses: 'nexacare_expenses_',
  medical: 'nexacare_medical_info_',
  watch: 'nexacare_watch_summary_',
  reminders: 'nexacare_reminders_',
  reminder_logs: 'nexacare_reminder_logs_',
  challenges: 'nexacare_challenges_',
};

let sessionUserId: string | null = null;

export function setSessionUser(userId: string | null): void {
  sessionUserId = userId;
}

export function isLinkedProfile(profileId: string): boolean {
  return !!sessionUserId && profileId !== sessionUserId && !isMemberProfileId(profileId);
}

function isRemote(profileId: string): boolean {
  return !!sessionUserId && !isMemberProfileId(profileId);
}

const localKey = (collection: DataCollection, profileId: string) => `${LOCAL_PREFIX[collection]}${profileId}`;
const cacheKey = (collection: DataCollection, profileId: string) => `nexacare_cache_${collection}_${profileId}`;
const dataPath = (collection: DataCollection, profileId: string) =>
  `/profiles/${encodeURIComponent(profileId)}/data/${collection}`;

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type RemoteData<T> = { exists: boolean; data: T | null; access: ProfileAccess };

export async function loadData<T>(collection: DataCollection, profileId: string, fallback: T): Promise<T> {
  if (!isRemote(profileId)) return (await readJson<T>(localKey(collection, profileId))) ?? fallback;

  try {
    const remote = await apiRequest<RemoteData<T>>(dataPath(collection, profileId));
    if (remote.exists && remote.data != null) {
      await AsyncStorage.setItem(cacheKey(collection, profileId), JSON.stringify(remote.data));
      return remote.data;
    }
    if (profileId === sessionUserId) {
      const legacy = await readJson<T>(localKey(collection, profileId));
      if (legacy != null) {
        await saveData(collection, profileId, legacy);
        return legacy;
      }
    }
    return fallback;
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      const cached = await readJson<T>(cacheKey(collection, profileId));
      if (cached != null) return cached;
      if (profileId === sessionUserId) return (await readJson<T>(localKey(collection, profileId))) ?? fallback;
    }
    throw error;
  }
}

export async function loadCachedData<T>(collection: DataCollection, profileId: string, fallback: T): Promise<T> {
  if (isRemote(profileId)) {
    const cached = await readJson<T>(cacheKey(collection, profileId));
    if (cached != null) return cached;
  }
  return (await readJson<T>(localKey(collection, profileId))) ?? fallback;
}

export async function saveData<T>(collection: DataCollection, profileId: string, data: T): Promise<void> {
  if (!isRemote(profileId)) {
    await AsyncStorage.setItem(localKey(collection, profileId), JSON.stringify(data));
    return;
  }
  await apiRequest(dataPath(collection, profileId), { method: 'PUT', body: { data } });
  await AsyncStorage.setItem(cacheKey(collection, profileId), JSON.stringify(data));
}

export async function removeLocalData(collection: DataCollection, profileId: string): Promise<void> {
  await AsyncStorage.multiRemove([localKey(collection, profileId), cacheKey(collection, profileId)]);
}
