import type { BloodGroup } from './emergency';

export type HelpKind = 'blood' | 'platelets' | 'plasma';
export type HelpUrgency = 'critical' | 'urgent' | 'planned';
export type HelpStatus = 'open' | 'fulfilled' | 'closed' | 'expired' | 'hidden';

export type DonorProfile = {
  city: string;
  bloodGroup: BloodGroup | null;
  willing: boolean;
  lastDonation: string | null;
  phone: string;
  eligible: boolean;
};

export type DonorInput = {
  city: string;
  bloodGroup: BloodGroup | null;
  willing: boolean;
  lastDonation: string | null;
  phone: string;
};

export type Responder = { name: string; phone: string; bloodGroup: string; respondedAt: string };

export type HelpRequest = {
  id: string;
  kind: HelpKind;
  bloodGroup: BloodGroup;
  units: number;
  urgency: HelpUrgency;
  patientName: string;
  hospital: string;
  city: string;
  contactPhone: string;
  note: string;
  status: HelpStatus;
  createdAt: string;
  expiresAt: string;
  requesterName: string;
  isMine: boolean;
  canDonate: boolean;
  responded: boolean;
  responseCount: number;
  notifiedCount: number;
  responders: Responder[];
};

export type HelpRequestInput = {
  kind: HelpKind;
  bloodGroup: BloodGroup;
  units: number;
  urgency: HelpUrgency;
  patientName: string;
  hospital: string;
  city: string;
  contactPhone: string;
  note: string;
};

export const KIND_LABELS: Record<HelpKind, string> = { blood: 'Blood', platelets: 'Platelets', plasma: 'Plasma' };

export const URGENCY_INFO: Record<HelpUrgency, { label: string; window: string }> = {
  critical: { label: 'Critical', window: 'needed within 24 hours' },
  urgent: { label: 'Urgent', window: 'needed within 3 days' },
  planned: { label: 'Planned', window: 'needed within a week' },
};

export const STATUS_LABELS: Record<HelpStatus, string> = {
  open: 'Open',
  fulfilled: 'Fulfilled',
  closed: 'Closed',
  expired: 'Expired',
  hidden: 'Hidden after reports',
};

export const POPULAR_CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad'];

export const DONATION_GAP_DAYS = 90;

export function nextEligibleDate(lastDonation: string | null): Date | null {
  if (!lastDonation) return null;
  const [y, m, d] = lastDonation.split('-').map(Number);
  const next = new Date(y, m - 1, d + DONATION_GAP_DAYS);
  return next > new Date() ? next : null;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

export function shareText(r: Pick<HelpRequest, 'bloodGroup' | 'kind' | 'units' | 'urgency' | 'hospital' | 'city' | 'patientName' | 'contactPhone'>): string {
  return [
    `🩸 ${r.bloodGroup} ${KIND_LABELS[r.kind].toLowerCase()} needed — ${URGENCY_INFO[r.urgency].label}`,
    `${r.units} unit${r.units > 1 ? 's' : ''} for ${r.patientName}`,
    `${r.hospital}, ${r.city}`,
    `Contact: ${r.contactPhone}`,
    '',
    'Shared from NexaCare. Please forward to anyone who can help.',
  ].join('\n');
}
