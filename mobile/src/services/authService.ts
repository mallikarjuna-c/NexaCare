import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types/auth';

const USERS_KEY = 'nexacare_users';
const CURRENT_USER_KEY = 'nexacare_current_user';

type StoredUser = User & { password: string };

async function getAllUsers(): Promise<StoredUser[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveAllUsers(users: StoredUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function signup(name: string, email: string, password: string): Promise<User> {
  const users = await getAllUsers();

  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const newUser: StoredUser = {
    id: Date.now().toString(),
    name,
    email,
    password, // plain text is fine for now — mock/local only, never do this with a real backend
  };

  users.push(newUser);
  await saveAllUsers(users);

  const { password: _pw, ...publicUser } = newUser;
  await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(publicUser));

  return publicUser;
}

export async function login(email: string, password: string): Promise<User> {
  const users = await getAllUsers();

  const match = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!match) {
    throw new Error('Invalid email or password.');
  }

  const { password: _pw, ...publicUser } = match;
  await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(publicUser));

  return publicUser;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(CURRENT_USER_KEY);
}

export async function getCurrentUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}