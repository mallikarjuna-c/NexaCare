import type { Ionicons } from '@expo/vector-icons';

export type ProviderType = 'hospital' | 'clinic' | 'doctor' | 'pharmacy' | 'lab' | 'other';

export type Provider = {
  id: string;
  name: string;
  type: ProviderType;
  specialty?: string;
  phone?: string;
  address?: string;
  mapsUrl?: string;
  notes?: string;
  isFavorite: boolean;
  isEmergencyContact?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProviderInput = Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>;

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  doctor: 'Doctor',
  pharmacy: 'Pharmacy',
  lab: 'Lab',
  other: 'Other',
};

export const PROVIDER_TYPES = Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[];

export type NearbySearch = { key: string; label: string; query: string; icon: keyof typeof Ionicons.glyphMap };

export const NEARBY_SEARCHES: NearbySearch[] = [
  { key: 'hospital', label: 'Hospitals', query: 'hospitals near me', icon: 'business-outline' },
  { key: 'clinic', label: 'Clinics', query: 'clinics near me', icon: 'medical-outline' },
  { key: 'pharmacy', label: 'Pharmacies', query: 'pharmacy near me', icon: 'medkit-outline' },
  { key: 'lab', label: 'Diagnostic labs', query: 'diagnostic lab near me', icon: 'flask-outline' },
  { key: 'dentist', label: 'Dentists', query: 'dentist near me', icon: 'happy-outline' },
  { key: 'eye', label: 'Eye care', query: 'eye hospital near me', icon: 'eye-outline' },
];

export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapsDirectionsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

const GOOGLE_DOMAIN = String.raw`google\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})`;
const MAPS_LINK_PATTERN = new RegExp(
  String.raw`^https:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.${GOOGLE_DOMAIN}\/|(?:www\.)?${GOOGLE_DOMAIN}\/maps(?:[\/?]|$))`,
  'i'
);

export function extractMapsLink(text: string): string | null {
  const url = text.match(/https?:\/\/\S+/)?.[0];
  return url && MAPS_LINK_PATTERN.test(url) ? url : null;
}

export function providerMapsUrl(provider: { mapsUrl?: string; address?: string }): string | null {
  if (provider.mapsUrl) return provider.mapsUrl;
  if (provider.address) return mapsDirectionsUrl(provider.address);
  return null;
}

export function dialUrl(phone: string): string {
  const cleaned = phone.trim().replace(/(?!^\+)[^\d]/g, '');
  return `tel:${cleaned}`;
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, '');
  return /^\+?[\d\s\-()]+$/.test(phone.trim()) && digits.length >= 6 && digits.length <= 15;
}
