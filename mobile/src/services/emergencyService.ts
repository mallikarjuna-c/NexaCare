import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EmergencyContact, EmergencyContactInput, MedicalInfo } from '../types/emergency';

import { loadCachedData, loadData, removeLocalData, saveData } from './profileStore';

const CONTACTS_PREFIX = 'nexacare_emergency_contacts_';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`Stored data for ${key} was unreadable.`);
    return fallback;
  }
}

async function readContacts(userId: string): Promise<EmergencyContact[]> {
  const list = await readJson<unknown>(`${CONTACTS_PREFIX}${userId}`, []);
  return Array.isArray(list) ? (list as EmergencyContact[]) : [];
}

async function writeContacts(userId: string, list: EmergencyContact[]): Promise<void> {
  await AsyncStorage.setItem(`${CONTACTS_PREFIX}${userId}`, JSON.stringify(list));
}

export async function getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  return readContacts(userId);
}

export async function getEmergencyContactById(userId: string, id: string): Promise<EmergencyContact | null> {
  const list = await readContacts(userId);
  return list.find((c) => c.id === id) ?? null;
}

export async function addEmergencyContact(userId: string, input: EmergencyContactInput): Promise<EmergencyContact> {
  const now = new Date().toISOString();
  const contact: EmergencyContact = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  const list = await readContacts(userId);
  await writeContacts(userId, [...list, contact]);
  return contact;
}

export async function updateEmergencyContact(userId: string, id: string, input: EmergencyContactInput): Promise<EmergencyContact> {
  const list = await readContacts(userId);
  const existing = list.find((c) => c.id === id);
  if (!existing) throw new Error('Contact not found.');
  const contact: EmergencyContact = { ...existing, ...input, updatedAt: new Date().toISOString() };
  await writeContacts(userId, list.map((c) => (c.id === id ? contact : c)));
  return contact;
}

export async function makePrimaryContact(userId: string, id: string): Promise<void> {
  const list = await readContacts(userId);
  const contact = list.find((c) => c.id === id);
  if (!contact) throw new Error('Contact not found.');
  await writeContacts(userId, [contact, ...list.filter((c) => c.id !== id)]);
}

export async function deleteEmergencyContact(userId: string, id: string): Promise<void> {
  const list = await readContacts(userId);
  await writeContacts(userId, list.filter((c) => c.id !== id));
}

function asMedicalInfo(info: unknown): MedicalInfo {
  return info && typeof info === 'object' && !Array.isArray(info) ? (info as MedicalInfo) : {};
}

export async function getMedicalInfo(userId: string): Promise<MedicalInfo> {
  return asMedicalInfo(await loadData<unknown>('medical', userId, {}));
}

export async function getMedicalInfoOffline(userId: string): Promise<MedicalInfo> {
  return asMedicalInfo(await loadCachedData<unknown>('medical', userId, {}));
}

export async function removeMedicalInfo(userId: string): Promise<void> {
  await removeLocalData('medical', userId);
}

export async function saveMedicalInfo(userId: string, info: MedicalInfo): Promise<MedicalInfo> {
  const saved: MedicalInfo = { ...info, updatedAt: new Date().toISOString() };
  await saveData('medical', userId, saved);
  return saved;
}
