import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as authService from '../services/authService';
import { cancelAllRemindersForUser } from '../services/notificationService';
import { restoreFollowUpReminders } from '../services/followUpService';
import { removeFaceScanData } from '../services/legacyDataService';
import { getFamilyMembers } from '../services/familyService';
import { setSessionUser } from '../services/profileStore';
import { getMedicalInfo } from '../services/emergencyService';
import type { User, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyUser = (next: User | null) => {
    setSessionUser(next?.id ?? null);
    setUser(next);
  };

  useEffect(() => {
    authService.getCurrentUser().then((storedUser) => {
      applyUser(storedUser);
      setIsLoading(false);
    });
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    getFamilyMembers(userId)
      .catch(() => [])
      .then((members) => Promise.all([userId, ...members.map((m) => m.id)].map(restoreFollowUpReminders)))
      .catch((e) => console.warn('Could not restore follow-up reminders', e));
    removeFaceScanData(userId).catch(() => {});
    getMedicalInfo(userId).catch(() => {});
  }, [userId]);

  const login = async (email: string, password: string) => {
    const loggedInUser = await authService.login(email, password);
    applyUser(loggedInUser);
  };

  const signup = async (name: string, email: string, password: string) => {
    const newUser = await authService.signup(name, email, password);
    applyUser(newUser);
  };

  const logout = async () => {
    if (user) {
      await cancelAllRemindersForUser(user.id).catch((e) => console.warn('Could not cancel reminders on logout', e));
    }
    await authService.logout();
    applyUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}