import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isMemberProfileId,
  newMemberId,
  ownerIdOf,
  type FamilyMember,
  type FamilyMemberInput,
} from '../types/family';

const MEMBERS_PREFIX = 'nexacare_family_members_';
const ACTIVE_PREFIX = 'nexacare_active_profile_';

async function readAll(userId: string): Promise<FamilyMember[]> {
  const raw = await AsyncStorage.getItem(`${MEMBERS_PREFIX}${userId}`);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FamilyMember[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(userId: string, members: FamilyMember[]): Promise<void> {
  await AsyncStorage.setItem(`${MEMBERS_PREFIX}${userId}`, JSON.stringify(members));
}

function clean(input: FamilyMemberInput): FamilyMemberInput {
  return {
    name: input.name.trim(),
    relation: input.relation,
    dateOfBirth: input.dateOfBirth || undefined,
    gender: input.gender || undefined,
  };
}

export async function getFamilyMembers(userId: string): Promise<FamilyMember[]> {
  const members = await readAll(userId);
  return members.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getFamilyMember(userId: string, memberId: string): Promise<FamilyMember | null> {
  return (await readAll(userId)).find((m) => m.id === memberId) ?? null;
}

export async function addFamilyMember(userId: string, input: FamilyMemberInput): Promise<FamilyMember> {
  const now = new Date().toISOString();
  const member: FamilyMember = { ...clean(input), id: newMemberId(userId), createdAt: now, updatedAt: now };
  await writeAll(userId, [...(await readAll(userId)), member]);
  return member;
}

export async function updateFamilyMember(userId: string, memberId: string, input: FamilyMemberInput): Promise<FamilyMember> {
  const members = await readAll(userId);
  const existing = members.find((m) => m.id === memberId);
  if (!existing) throw new Error('Family member not found.');
  const updated: FamilyMember = { ...existing, ...clean(input), updatedAt: new Date().toISOString() };
  await writeAll(userId, members.map((m) => (m.id === memberId ? updated : m)));
  return updated;
}

export async function deleteFamilyMemberEntry(userId: string, memberId: string): Promise<void> {
  await writeAll(userId, (await readAll(userId)).filter((m) => m.id !== memberId));
  if ((await getActiveProfileId(userId)) === memberId) await setActiveProfileId(userId, userId);
}

export async function getActiveProfileId(userId: string): Promise<string> {
  return (await AsyncStorage.getItem(`${ACTIVE_PREFIX}${userId}`)) || userId;
}

export async function setActiveProfileId(userId: string, profileId: string): Promise<void> {
  await AsyncStorage.setItem(`${ACTIVE_PREFIX}${userId}`, profileId);
}

export async function getMemberName(profileId: string): Promise<string | null> {
  if (!isMemberProfileId(profileId)) return null;
  const member = await getFamilyMember(ownerIdOf(profileId), profileId);
  return member?.name ?? null;
}
