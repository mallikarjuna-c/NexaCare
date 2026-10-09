import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Provider, ProviderInput } from '../types/directory';

const KEY_PREFIX = 'nexacare_providers_';

function keyFor(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

async function readAll(userId: string): Promise<Provider[]> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Provider[]) : [];
  } catch {
    console.warn('Provider data was unreadable.');
    return [];
  }
}

async function writeAll(userId: string, list: Provider[]): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(list));
}

// Favourites first, then alphabetical.
export async function getProviders(userId: string): Promise<Provider[]> {
  const list = await readAll(userId);
  return list.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.name.localeCompare(b.name));
}

export async function getProviderById(userId: string, id: string): Promise<Provider | null> {
  const list = await readAll(userId);
  return list.find((p) => p.id === id) ?? null;
}

export async function addProvider(userId: string, input: ProviderInput): Promise<Provider> {
  const now = new Date().toISOString();
  const provider: Provider = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  const list = await readAll(userId);
  await writeAll(userId, [...list, provider]);
  return provider;
}

export async function updateProvider(userId: string, id: string, input: ProviderInput): Promise<Provider> {
  const list = await readAll(userId);
  const existing = list.find((p) => p.id === id);
  if (!existing) throw new Error('Provider not found.');

  const provider: Provider = { ...existing, ...input, updatedAt: new Date().toISOString() };
  await writeAll(userId, list.map((p) => (p.id === id ? provider : p)));
  return provider;
}

export async function setProviderFavorite(userId: string, id: string, isFavorite: boolean): Promise<Provider> {
  const list = await readAll(userId);
  const existing = list.find((p) => p.id === id);
  if (!existing) throw new Error('Provider not found.');

  const provider: Provider = { ...existing, isFavorite, updatedAt: new Date().toISOString() };
  await writeAll(userId, list.map((p) => (p.id === id ? provider : p)));
  return provider;
}

export async function deleteProvider(userId: string, id: string): Promise<void> {
  const list = await readAll(userId);
  await writeAll(userId, list.filter((p) => p.id !== id));
}
