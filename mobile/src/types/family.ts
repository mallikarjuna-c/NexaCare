export type FamilyRelation =
  | 'mother'
  | 'father'
  | 'spouse'
  | 'son'
  | 'daughter'
  | 'brother'
  | 'sister'
  | 'grandparent'
  | 'other';

export const FAMILY_RELATION_LABELS: Record<FamilyRelation, string> = {
  mother: 'Mother',
  father: 'Father',
  spouse: 'Spouse',
  son: 'Son',
  daughter: 'Daughter',
  brother: 'Brother',
  sister: 'Sister',
  grandparent: 'Grandparent',
  other: 'Other',
};

export const FAMILY_RELATIONS = Object.keys(FAMILY_RELATION_LABELS) as FamilyRelation[];

export type Gender = 'female' | 'male' | 'other';

export const GENDER_LABELS: Record<Gender, string> = { female: 'Female', male: 'Male', other: 'Other' };

export type FamilyMember = {
  id: string;
  name: string;
  relation: FamilyRelation;
  dateOfBirth?: string;
  gender?: Gender;
  createdAt: string;
  updatedAt: string;
};

export type FamilyMemberInput = Pick<FamilyMember, 'name' | 'relation' | 'dateOfBirth' | 'gender'>;

export type ProfileKind = 'self' | 'member' | 'linked';

export type Profile = {
  id: string;
  name: string;
  relationLabel: string;
  isSelf: boolean;
  age: number | null;
  kind: ProfileKind;
  canEdit: boolean;
  linkId?: string;
};

export type LinkAccess = 'view' | 'edit';

export type FamilyLink = {
  id: string;
  person: { id: string; name: string; email: string };
  status: 'pending' | 'approved';
  access: LinkAccess;
};

export type LinksOverview = { sharing: FamilyLink[]; viewing: FamilyLink[] };

export type ShareCode = { code: string; expiresAt: string };

export const LINK_ACCESS_LABELS: Record<LinkAccess, string> = { view: 'Can view', edit: 'Can view & edit' };

const MEMBER_ID_MARKER = '_fm_';

export function newMemberId(ownerId: string): string {
  return `${ownerId}${MEMBER_ID_MARKER}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

export function isMemberProfileId(profileId: string): boolean {
  return profileId.includes(MEMBER_ID_MARKER);
}

export function ownerIdOf(profileId: string): string {
  const index = profileId.indexOf(MEMBER_ID_MARKER);
  return index === -1 ? profileId : profileId.slice(0, index);
}

export function ageFrom(dateOfBirth: string | undefined, today = new Date()): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function possessive(profile: Pick<Profile, 'name' | 'isSelf'>): string {
  if (profile.isSelf) return 'Your';
  const first = profile.name.trim().split(/\s+/)[0] || profile.name;
  return first.endsWith('s') ? `${first}’` : `${first}’s`;
}

export function selfProfile(user: { id: string; name: string }): Profile {
  return { id: user.id, name: user.name, relationLabel: 'You', isSelf: true, age: null, kind: 'self', canEdit: true };
}

export function memberProfile(member: FamilyMember): Profile {
  return {
    id: member.id,
    name: member.name,
    relationLabel: FAMILY_RELATION_LABELS[member.relation],
    isSelf: false,
    age: ageFrom(member.dateOfBirth),
    kind: 'member',
    canEdit: true,
  };
}

export function linkedProfile(link: FamilyLink): Profile {
  return {
    id: link.person.id,
    name: link.person.name,
    relationLabel: link.access === 'edit' ? 'Linked · can edit' : 'Linked · view only',
    isSelf: false,
    age: null,
    kind: 'linked',
    canEdit: link.access === 'edit',
    linkId: link.id,
  };
}

export function profileSubtitle(profile: Profile): string {
  return [profile.relationLabel, profile.age != null ? `${profile.age} yrs` : null].filter(Boolean).join(' · ');
}
