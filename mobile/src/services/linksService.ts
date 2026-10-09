import { apiRequest } from './apiClient';
import type { FamilyLink, LinkAccess, LinksOverview, ShareCode } from '../types/family';

type RawLink = { id: string; person: { id: string; name: string; email: string }; status: string; access: string };

function toLink(raw: RawLink): FamilyLink {
  return {
    id: raw.id,
    person: raw.person,
    status: raw.status === 'approved' ? 'approved' : 'pending',
    access: raw.access === 'edit' ? 'edit' : 'view',
  };
}

export async function getLinks(): Promise<LinksOverview> {
  const data = await apiRequest<{ sharing: RawLink[]; viewing: RawLink[] }>('/links');
  return { sharing: data.sharing.map(toLink), viewing: data.viewing.map(toLink) };
}

export async function createShareCode(): Promise<ShareCode> {
  const data = await apiRequest<{ code: string; expires_at: string }>('/links/code', { method: 'POST' });
  return { code: data.code, expiresAt: data.expires_at };
}

export async function requestLink(code: string): Promise<FamilyLink> {
  return toLink(await apiRequest<RawLink>('/links/request', { method: 'POST', body: { code } }));
}

export async function approveLink(linkId: string, access: LinkAccess): Promise<FamilyLink> {
  return toLink(await apiRequest<RawLink>(`/links/${linkId}/approve`, { method: 'POST', body: { access } }));
}

export async function changeLinkAccess(linkId: string, access: LinkAccess): Promise<FamilyLink> {
  return toLink(await apiRequest<RawLink>(`/links/${linkId}`, { method: 'PATCH', body: { access } }));
}

export async function removeLink(linkId: string): Promise<void> {
  await apiRequest(`/links/${linkId}`, { method: 'DELETE' });
}
