import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ApiError, apiRequest } from './apiClient';
import { getMedicalInfo } from './emergencyService';
import { getAllRecords } from './healthRecordsService';
import { getHealthConnectStatus, getWatchSummary, isWatchConnected } from './healthConnectService';
import { WATCH_METRICS, formatWatchValue } from '../types/smartwatch';
import { DOCUMENT_TYPES, RECORD_TYPE_LABELS, type HealthRecordType } from '../types/healthRecords';
import {
  formatHealthContext,
  type ChatMessage,
  type ContextRecordLine,
  type ContextWatchLine,
} from '../types/assistant';

const REQUEST_TIMEOUT_MS = 75_000;
const HISTORY_SENT = 20;
const HISTORY_KEPT = 100;

const chatKey = (userId: string) => `nexacare_assistant_chat_${userId}`;
const shareKey = (userId: string) => `nexacare_assistant_share_${userId}`;

export async function getChatHistory(userId: string): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(chatKey(userId));
  return raw ? JSON.parse(raw) : [];
}

export async function saveChatHistory(userId: string, messages: ChatMessage[]): Promise<void> {
  await AsyncStorage.setItem(chatKey(userId), JSON.stringify(messages.slice(-HISTORY_KEPT)));
}

export async function clearChatHistory(userId: string): Promise<void> {
  await AsyncStorage.removeItem(chatKey(userId));
}

export async function getShareHealthData(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(shareKey(userId))) === 'true';
}

export async function setShareHealthData(userId: string, on: boolean): Promise<void> {
  await AsyncStorage.setItem(shareKey(userId), on ? 'true' : 'false');
}

export async function buildHealthContext(userId: string): Promise<string | null> {
  const [medical, watch, records] = await Promise.all([
    getMedicalInfo(userId).catch(() => null),
    readWatchLines(userId),
    readRecordLines(userId),
  ]);
  return formatHealthContext({ today: new Date(), medical, watch, records });
}

async function readWatchLines(userId: string): Promise<ContextWatchLine[]> {
  try {
    if (Platform.OS !== 'android' || !(await isWatchConnected(userId))) return [];
    if ((await getHealthConnectStatus()) !== 'available') return [];
    const summary = await getWatchSummary();
    return WATCH_METRICS.flatMap((m) => {
      const s = summary.metrics[m.key];
      if (!s?.latest) return [];
      const average =
        s.average7d != null && m.key !== 'bloodPressure'
          ? formatWatchValue(m.key, { value: s.average7d, time: s.latest.time, source: s.latest.source })
          : undefined;
      return [{ name: m.name, unit: m.unit, latest: formatWatchValue(m.key, s.latest), latestAt: s.latest.time, average }];
    });
  } catch {
    return [];
  }
}

async function readRecordLines(userId: string): Promise<ContextRecordLine[]> {
  try {
    const records = await getAllRecords(userId);
    const seen = new Set<HealthRecordType>();
    const lines: ContextRecordLine[] = [];
    for (const r of records) {
      if (DOCUMENT_TYPES.includes(r.type) || seen.has(r.type)) continue;
      seen.add(r.type);
      lines.push({ label: RECORD_TYPE_LABELS[r.type], value: r.value, date: r.date });
    }
    return lines;
  } catch {
    return [];
  }
}

export class AssistantError extends Error {}

export async function askAssistant(
  history: ChatMessage[],
  healthContext: string | null
): Promise<{ reply: string; refused: boolean }> {
  const messages = history
    .filter((m) => !m.failed)
    .slice(-HISTORY_SENT)
    .map((m) => ({ role: m.role, content: m.text }));

  let data: { reply?: unknown; refused?: unknown } | null;
  try {
    data = await apiRequest('/assistant/chat', {
      method: 'POST',
      body: { messages, health_context: healthContext },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    throw new AssistantError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
  }
  if (typeof data?.reply !== 'string') throw new AssistantError('The assistant sent an unexpected answer. Please try again.');
  return { reply: data.reply, refused: !!data.refused };
}
