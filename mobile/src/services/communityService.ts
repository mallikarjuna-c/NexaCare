import { apiRequest } from './apiClient';
import type { BloodGroup } from '../types/emergency';
import type { DonorInput, DonorProfile, HelpRequest, HelpRequestInput, Responder } from '../types/community';

type RawDonor = { city: string; blood_group: string | null; willing: boolean; last_donation: string | null; phone: string; eligible: boolean };
type RawResponder = { name: string; phone: string; blood_group: string; responded_at: string };
type RawRequest = {
  id: string; kind: HelpRequest['kind']; blood_group: string; units: number; urgency: HelpRequest['urgency'];
  patient_name: string; hospital: string; city: string; contact_phone: string; note: string; status: HelpRequest['status'];
  created_at: string; expires_at: string; requester_name: string; is_mine: boolean; can_donate: boolean;
  responded: boolean; response_count: number; notified_count: number; responders: RawResponder[];
};

function toDonor(raw: RawDonor): DonorProfile {
  return {
    city: raw.city,
    bloodGroup: (raw.blood_group as BloodGroup | null) ?? null,
    willing: raw.willing,
    lastDonation: raw.last_donation,
    phone: raw.phone,
    eligible: raw.eligible,
  };
}

function toResponder(raw: RawResponder): Responder {
  return { name: raw.name, phone: raw.phone, bloodGroup: raw.blood_group, respondedAt: raw.responded_at };
}

function toRequest(raw: RawRequest): HelpRequest {
  return {
    id: raw.id, kind: raw.kind, bloodGroup: raw.blood_group as BloodGroup, units: raw.units, urgency: raw.urgency,
    patientName: raw.patient_name, hospital: raw.hospital, city: raw.city, contactPhone: raw.contact_phone, note: raw.note,
    status: raw.status, createdAt: raw.created_at, expiresAt: raw.expires_at, requesterName: raw.requester_name,
    isMine: raw.is_mine, canDonate: raw.can_donate, responded: raw.responded, responseCount: raw.response_count,
    notifiedCount: raw.notified_count, responders: raw.responders.map(toResponder),
  };
}

export async function getDonorProfile(): Promise<DonorProfile | null> {
  const raw = await apiRequest<RawDonor | null>('/community/donor');
  return raw ? toDonor(raw) : null;
}

export async function saveDonorProfile(input: DonorInput): Promise<DonorProfile> {
  return toDonor(
    await apiRequest<RawDonor>('/community/donor', {
      method: 'PUT',
      body: {
        city: input.city.trim(),
        blood_group: input.bloodGroup,
        willing: input.willing,
        last_donation: input.lastDonation,
        phone: input.phone.trim(),
      },
    })
  );
}

export async function listHelpRequests(scope: 'nearby' | 'mine'): Promise<HelpRequest[]> {
  return (await apiRequest<RawRequest[]>(`/community/requests?scope=${scope}`)).map(toRequest);
}

export async function getHelpRequest(id: string): Promise<HelpRequest> {
  return toRequest(await apiRequest<RawRequest>(`/community/requests/${encodeURIComponent(id)}`));
}

export async function createHelpRequest(input: HelpRequestInput): Promise<HelpRequest> {
  return toRequest(
    await apiRequest<RawRequest>('/community/requests', {
      method: 'POST',
      body: {
        kind: input.kind,
        blood_group: input.bloodGroup,
        units: input.units,
        urgency: input.urgency,
        patient_name: input.patientName.trim(),
        hospital: input.hospital.trim(),
        city: input.city.trim(),
        contact_phone: input.contactPhone.trim(),
        note: input.note.trim(),
      },
    })
  );
}

export async function respondToRequest(id: string): Promise<HelpRequest> {
  return toRequest(await apiRequest<RawRequest>(`/community/requests/${encodeURIComponent(id)}/respond`, { method: 'POST' }));
}

export async function closeHelpRequest(id: string, status: 'fulfilled' | 'closed'): Promise<HelpRequest> {
  return toRequest(
    await apiRequest<RawRequest>(`/community/requests/${encodeURIComponent(id)}/close`, { method: 'POST', body: { status } })
  );
}

export async function reportHelpRequest(id: string, reason: string): Promise<void> {
  await apiRequest(`/community/requests/${encodeURIComponent(id)}/report`, { method: 'POST', body: { reason } });
}

export async function registerDeviceToken(token: string, platform: 'android' | 'ios'): Promise<boolean> {
  const result = await apiRequest<{ ok: boolean; push_enabled: boolean }>('/community/devices', {
    method: 'POST',
    body: { token, platform },
  });
  return result.push_enabled;
}

export async function unregisterDeviceToken(token: string): Promise<void> {
  await apiRequest(`/community/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
}
