import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EmergencyContact, EmergencyContactInput, MedicalInfo } from '../types/emergency';

const CONTACTS_PREFIX = 'nexacare_emergency_contacts_';
const MEDICAL_PREFIX = 'nexacare_medical_info_';

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

// ---- Emergency contacts ----

async function readContacts(userId: string): Promise<EmergencyContact[]> {
  const list = await readJson<unknown>(`${CONTACTS_PREFIX}${userId}`, []);
  return Array.isArray(list) ? (list as EmergencyContact[]) : [];
}

async function writeContacts(userId: string, list: EmergencyContact[]): Promise<void> {
  await AsyncStorage.setItem(`${CONTACTS_PREFIX}${userId}`, JSON.stringify(list));
}

// Kept in the order they were added — the first contact is the "primary" one.
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

// The first contact is the primary one the SOS panel alerts first.
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

// ---- Medical ID ----

export async function getMedicalInfo(userId: string): Promise<MedicalInfo> {
  const info = await readJson<unknown>(`${MEDICAL_PREFIX}${userId}`, {});
  return info && typeof info === 'object' && !Array.isArray(info) ? (info as MedicalInfo) : {};
}

export async function saveMedicalInfo(userId: string, info: MedicalInfo): Promise<MedicalInfo> {
  const saved: MedicalInfo = { ...info, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(`${MEDICAL_PREFIX}${userId}`, JSON.stringify(saved));
  return saved;
}
