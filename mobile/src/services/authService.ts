import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, apiRequest, getAuthToken, setAuthToken } from './apiClient';
import type { User } from '../types/auth';

const LEGACY_USERS_KEY = 'nexacare_users';
const CURRENT_USER_KEY = 'nexacare_current_user';

type LegacyUser = User & { password: string };
type AuthResponse = { token: string; user: User };

async function getLegacyUsers(): Promise<LegacyUser[]> {
  const raw = await AsyncStorage.getItem(LEGACY_USERS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LegacyUser[]) : [];
  } catch {
    return [];
  }
}

async function forgetLegacyUser(email: string): Promise<void> {
  const users = await getLegacyUsers();
  const remaining = users.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
  if (remaining.length === users.length) return;
  if (remaining.length) await AsyncStorage.setItem(LEGACY_USERS_KEY, JSON.stringify(remaining));
  else await AsyncStorage.removeItem(LEGACY_USERS_KEY);
}

async function startSession(response: AuthResponse): Promise<User> {
  await setAuthToken(response.token);
  await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(response.user));
  await forgetLegacyUser(response.user.email);
  return response.user;
}

export async function signup(name: string, email: string, password: string): Promise<User> {
  const legacy = (await getLegacyUsers()).find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  const response = await apiRequest<AuthResponse>('/auth/signup', {
    method: 'POST',
    auth: false,
    body: { name: name.trim(), email: email.trim(), password, legacy_id: legacy?.id },
  });
  return startSession(response);
}

export async function login(email: string, password: string): Promise<User> {
  try {
    const response = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: email.trim(), password },
    });
    return await startSession(response);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const legacy = (await getLegacyUsers()).find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
    );
    if (!legacy) throw error;
    if (password.length < 8) {
      throw new Error(
        'NexaCare accounts now need a password of at least 8 characters. Tap Sign up and create your account again with the same email. Your health data will be kept.'
      );
    }
    return signup(legacy.name, legacy.email, password);
  }
}

export async function logout(): Promise<void> {
  await setAuthToken(null);
  await AsyncStorage.removeItem(CURRENT_USER_KEY);
}

export async function getCurrentUser(): Promise<User | null> {
  const [raw, token] = await Promise.all([AsyncStorage.getItem(CURRENT_USER_KEY), getAuthToken()]);
  if (!raw || !token) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
