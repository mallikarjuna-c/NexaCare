import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getActiveProfileId, getFamilyMembers, setActiveProfileId } from '../services/familyService';
import { getLinks } from '../services/linksService';
import {
  linkedProfile,
  memberProfile,
  selfProfile,
  type FamilyMember,
  type LinksOverview,
  type Profile,
} from '../types/family';

type FamilyContextType = {
  members: FamilyMember[];
  links: LinksOverview;
  linksError: string | null;
  profiles: Profile[];
  activeProfile: Profile | null;
  isLoading: boolean;
  selectProfile: (profileId: string) => Promise<void>;
  refreshFamily: () => Promise<void>;
};

const EMPTY_LINKS: LinksOverview = { sharing: [], viewing: [] };

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [links, setLinks] = useState<LinksOverview>(EMPTY_LINKS);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const userId = user?.id;

  const refreshFamily = useCallback(async () => {
    if (!userId) return;
    const [list, active] = await Promise.all([getFamilyMembers(userId), getActiveProfileId(userId)]);
    setMembers(list);
    setActiveId(active);
    try {
      setLinks(await getLinks());
      setLinksError(null);
    } catch (error) {
      setLinksError(error instanceof Error ? error.message : 'Could not load linked accounts.');
    }
  }, [userId]);

  useEffect(() => {
    setMembers([]);
    setLinks(EMPTY_LINKS);
    setActiveId(userId ?? null);
    if (!userId) return;
    setIsLoading(true);
    refreshFamily()
      .catch(() => setActiveId(userId))
      .finally(() => setIsLoading(false));
  }, [userId, refreshFamily]);

  const selectProfile = useCallback(
    async (profileId: string) => {
      if (!userId) return;
      setActiveId(profileId);
      await setActiveProfileId(userId, profileId);
    },
    [userId]
  );

  const profiles = useMemo(
    () =>
      user
        ? [
            selfProfile(user),
            ...members.map(memberProfile),
            ...links.viewing.filter((l) => l.status === 'approved').map(linkedProfile),
          ]
        : [],
    [user, members, links]
  );
  const activeProfile = profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;

  return (
    <FamilyContext.Provider
      value={{ members, links, linksError, profiles, activeProfile, isLoading, selectProfile, refreshFamily }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) throw new Error('useFamily must be used within a FamilyProvider');
  return context;
}
