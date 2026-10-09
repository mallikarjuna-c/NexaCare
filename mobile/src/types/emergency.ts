import type { Ionicons } from '@expo/vector-icons';

export type Relation = 'parent' | 'spouse' | 'sibling' | 'child' | 'friend' | 'other';

export type EmergencyContact = {
  id: string;
  name: string;
  relation: Relation;
  phone: string;
  createdAt: string;
  updatedAt: string;
};

export type EmergencyContactInput = Pick<EmergencyContact, 'name' | 'relation' | 'phone'>;

export const RELATION_LABELS: Record<Relation, string> = {
  parent: 'Parent',
  spouse: 'Spouse / Partner',
  sibling: 'Sibling',
  child: 'Child',
  friend: 'Friend',
  other: 'Other',
};

export const RELATIONS = Object.keys(RELATION_LABELS) as Relation[];

// Medical ID — shown on the Emergency screen for anyone helping you.
export type MedicalInfo = {
  bloodGroup?: BloodGroup;
  allergies?: string;
  conditions?: string;
  medications?: string;
  notes?: string;
  updatedAt?: string;
};

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export function hasMedicalInfo(info: MedicalInfo): boolean {
  return !!(info.bloodGroup || info.allergies || info.conditions || info.medications || info.notes);
}

// Public helplines in India. These are dialled by the user from their own dialer — the app never auto-calls.
export type Helpline = { number: string; label: string; icon: keyof typeof Ionicons.glyphMap };

export const PRIMARY_EMERGENCY_NUMBER = '112'; // National Emergency Response Support System (ERSS)

export const HELPLINES: Helpline[] = [
  { number: '108', label: 'Ambulance', icon: 'medkit-outline' },
  { number: '100', label: 'Police', icon: 'shield-outline' },
  { number: '101', label: 'Fire', icon: 'flame-outline' },
  { number: '1091', label: 'Women helpline', icon: 'woman-outline' },
  { number: '1098', label: 'Child helpline', icon: 'happy-outline' },
  { number: '14416', label: 'Mental health (Tele-MANAS)', icon: 'chatbubble-ellipses-outline' },
];

// ---- Help message ----

export type Coordinates = { latitude: number; longitude: number; accuracy?: number | null };

export function mapsPinUrl(coords: Coordinates): string {
  return `https://maps.google.com/?q=${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
}

export function buildHelpMessage(senderName: string, coords: Coordinates | null, info: MedicalInfo): string {
  const lines = [`🚨 I need help. This is an emergency. Please contact me immediately.`, `— ${senderName}`, ''];
  if (coords) {
    lines.push(`My location: ${mapsPinUrl(coords)}`);
    if (coords.accuracy) lines.push(`(accurate to about ${Math.round(coords.accuracy)} m)`);
  } else {
    lines.push('My location is unavailable — please call me.');
  }
  const medical = [
    info.bloodGroup && `Blood group: ${info.bloodGroup}`,
    info.allergies && `Allergies: ${info.allergies}`,
    info.conditions && `Conditions: ${info.conditions}`,
  ].filter(Boolean);
  if (medical.length) lines.push('', ...(medical as string[]));
  lines.push('', 'Sent from NexaCare');
  return lines.join('\n');
}

// WhatsApp needs the full international number without "+" (e.g. 919876543210).
// Numbers saved without a country code are assumed to be Indian.
export function whatsappNumber(phone: string): string {
  let digits = phone.replace(/[^\d]/g, '');
  if (phone.trim().startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.length === 10 ? `91${digits}` : digits;
}

// Try the WhatsApp app first; the https link is the fallback (opens WhatsApp or its web page).
export function whatsappUrls(phone: string, body: string): string[] {
  const number = whatsappNumber(phone);
  const text = encodeURIComponent(body);
  return [`whatsapp://send?phone=${number}&text=${text}`, `https://wa.me/${number}?text=${text}`];
}

export function smsUrl(phone: string, body: string): string {
  const cleaned = phone.trim().replace(/(?!^\+)[^\d]/g, '');
  return `sms:${cleaned}?body=${encodeURIComponent(body)}`;
}
