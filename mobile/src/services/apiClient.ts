import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_API_URL: string = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8010';
const TOKEN_KEY = 'nexacare_auth_token';
const API_URL_KEY = 'nexacare_api_url';
const DEFAULT_TIMEOUT_MS = 20_000;

let apiUrl: string | null = null;

export async function getApiUrl(): Promise<string> {
  if (apiUrl) return apiUrl;
  apiUrl = (await AsyncStorage.getItem(API_URL_KEY)) || DEFAULT_API_URL;
  return apiUrl;
}

export function normalizeApiUrl(raw: string): string | null {
  let value = raw.trim().replace(/\/+$/, '');
  if (!value) return DEFAULT_API_URL;
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  if (!/^https?:\/\/[^\s/]+$/i.test(value)) return null;
  if (!/:\d+$/.test(value) && value.startsWith('http://')) value = `${value}:8010`;
  return value;
}

export async function setApiUrl(url: string): Promise<void> {
  apiUrl = url;
  if (url === DEFAULT_API_URL) await AsyncStorage.removeItem(API_URL_KEY);
  else await AsyncStorage.setItem(API_URL_KEY, url);
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setAuthToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

function messageFrom(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('detail' in data)) return null;
  const detail = (data as { detail: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first = detail.find((d) => d && typeof d.msg === 'string');
    if (first) return String(first.msg).replace(/^Value error, /, '');
  }
  return null;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${await getApiUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      controller.signal.aborted
        ? 'The server took too long to answer. Please try again.'
        : "Can't reach the NexaCare server. Make sure it's running and your phone is connected.",
      0
    );
  } finally {
    clearTimeout(timer);
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(messageFrom(data) ?? 'Something went wrong. Please try again.', response.status);
  }
  return data as T;
}
