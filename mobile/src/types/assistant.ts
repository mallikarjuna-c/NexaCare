import type { Ionicons } from '@expo/vector-icons';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
  failed?: boolean;
};

export const ASSISTANT_SUGGESTIONS: { icon: keyof typeof Ionicons.glyphMap; title: string; prompt: string }[] = [
  { icon: 'heart-outline', title: 'Heart rate', prompt: 'Is my resting heart rate normal?' },
  { icon: 'moon-outline', title: 'Better sleep', prompt: 'How much sleep do I really need, and how can I sleep better?' },
  { icon: 'water-outline', title: 'Blood oxygen', prompt: 'What does SpO₂ mean and what is a normal level?' },
  { icon: 'fitness-outline', title: 'Blood pressure', prompt: 'What are simple ways to lower blood pressure naturally?' },
];

const EMERGENCY_PATTERN = new RegExp(
  [
    'chest (pain|pressure|tightness)',
    "can'?t breathe|cannot breathe|unable to breathe|trouble breathing|difficulty breathing|short(ness)? of breath|gasping",
    'heart attack|stroke|face (is )?drooping|slurred speech',
    'unconscious|passed out|fainted|not waking|collapsed',
    'seizure|convulsion',
    'severe bleeding|bleeding (heavily|a lot|won.?t stop)|lots of blood',
    'overdose|poison(ed|ing)?|swallowed (bleach|pills)',
    'anaphyla|throat (is )?(closing|swelling)|severe allergic',
    'suicid|kill (my ?self|myself)|end my life|self.?harm|want to die',
  ].join('|'),
  'i'
);

export function looksLikeEmergency(text: string): boolean {
  return EMERGENCY_PATTERN.test(text);
}

export type ContextMedical = { bloodGroup?: string; allergies?: string; conditions?: string; medications?: string };
export type ContextWatchLine = { name: string; unit: string; latest: string; latestAt: string; average?: string };
export type ContextRecordLine = { label: string; value: string; date: string };

const pad = (n: number) => String(n).padStart(2, '0');

export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatContextTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatHealthContext(input: {
  today: Date;
  medical: ContextMedical | null;
  watch: ContextWatchLine[];
  records: ContextRecordLine[];
}): string | null {
  const sections: string[] = [];

  const m = input.medical;
  const medicalLines = m
    ? ([
        ['Blood group', m.bloodGroup],
        ['Allergies', m.allergies],
        ['Conditions', m.conditions],
        ['Medications', m.medications],
      ] as const)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `- ${k}: ${v!.trim()}`)
    : [];
  if (medicalLines.length) sections.push(['Medical ID:', ...medicalLines].join('\n'));

  if (input.watch.length) {
    sections.push(
      [
        'Smartwatch (last 7 days, via Health Connect):',
        ...input.watch.map(
          (w) =>
            `- ${w.name}: latest ${w.latest} ${w.unit} (${formatContextTime(w.latestAt)})` +
            (w.average ? `, 7-day average ${w.average} ${w.unit}` : '')
        ),
      ].join('\n')
    );
  }

  if (input.records.length) {
    sections.push(
      [
        'Health Records (latest of each type, entered by the user):',
        ...input.records.map((r) => `- ${r.label}: ${r.value} (${r.date})`),
      ].join('\n')
    );
  }

  if (!sections.length) return null;
  return [`Today: ${formatContextTime(input.today.toISOString()).slice(0, 10)}`, ...sections].join('\n\n');
}
