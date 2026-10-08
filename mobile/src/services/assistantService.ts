import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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

// The NexaCare backend (backend/ folder) runs on your PC. `adb reverse tcp:8010 tcp:8010` makes
// the phone's localhost:8010 reach it over USB / wireless debugging. The Anthropic key stays on the PC.
const ASSISTANT_URL = 'http://localhost:8010';
const REQUEST_TIMEOUT_MS = 75_000;
const HISTORY_SENT = 20; // latest messages sent with each question
const HISTORY_KEPT = 100; // messages kept on the phone

const chatKey = (userId: string) => `nexacare_assistant_chat_${userId}`;
const shareKey = (userId: string) => `nexacare_assistant_share_${userId}`;

// ---- Conversation (per user, on this phone) ----

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

// ---- "Use my health data" switch (off by default) ----

export async function getShareHealthData(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(shareKey(userId))) === 'true';
}

export async function setShareHealthData(userId: string, on: boolean): Promise<void> {
  await AsyncStorage.setItem(shareKey(userId), on ? 'true' : 'false');
}

// Medical ID + latest watch readings + latest Health Record of each measurement type.
// Returns null when there's nothing to share. A failing source is skipped, not fatal.
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
    const records = await getAllRecords(userId); // newest first
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

// ---- Asking the assistant ----

export class AssistantError extends Error {}

export async function askAssistant(
  history: ChatMessage[],
  healthContext: string | null
): Promise<{ reply: string; refused: boolean }> {
  const messages = history
    .filter((m) => !m.failed)
    .slice(-HISTORY_SENT)
    .map((m) => ({ role: m.role, content: m.text }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${ASSISTANT_URL}/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, health_context: healthContext }),
      signal: controller.signal,
    });
  } catch {
    throw new AssistantError(
      controller.signal.aborted
        ? 'The assistant took too long to answer. Please try again.'
        : "Can't reach the NexaCare server. Make sure it's running and your phone is connected."
    );
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : null;
    throw new AssistantError(detail ?? 'Something went wrong. Please try again.');
  }
  if (typeof data?.reply !== 'string') throw new AssistantError('The assistant sent an unexpected answer. Please try again.');
  return { reply: data.reply, refused: !!data.refused };
}
