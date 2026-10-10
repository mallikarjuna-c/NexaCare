import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Alert } from 'react-native';
import * as authService from '../services/authService';
import { setSessionExpiredHandler, wakeServer } from '../services/apiClient';
import { cancelAllRemindersForUser } from '../services/notificationService';
import { restoreFollowUpReminders } from '../services/followUpService';
import { removeFaceScanData } from '../services/legacyDataService';
import { getFamilyMembers } from '../services/familyService';
import { setSessionUser } from '../services/profileStore';
import { getMedicalInfo } from '../services/emergencyService';
import { backupPhoneData, restorePhoneData } from '../services/backupService';
import { unregisterPush } from '../services/pushService';
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
    wakeServer();
    authService.getCurrentUser().then((storedUser) => {
      applyUser(storedUser);
      setIsLoading(false);
    });
  }, []);

  const expiringRef = useRef(false);
  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (expiringRef.current) return;
      expiringRef.current = true;
      authService
        .logout()
        .then(() => {
          applyUser(null);
          Alert.alert('Session expired', 'Please log in again to continue.');
        })
        .finally(() => {
          expiringRef.current = false;
        });
    });
    return () => setSessionExpiredHandler(null);
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
    restorePhoneData(userId)
      .catch(() => 0)
      .then(() => backupPhoneData(userId))
      .catch((e) => console.warn('Could not back up phone data', e));
  }, [userId]);

  const startSession = async (next: User) => {
    setSessionUser(next.id);
    await restorePhoneData(next.id).catch((e) => console.warn('Could not restore phone data', e));
    applyUser(next);
  };

  const login = async (email: string, password: string) => {
    await startSession(await authService.login(email, password));
  };

  const signup = async (name: string, email: string, password: string) => {
    await startSession(await authService.signup(name, email, password));
  };

  const logout = async () => {
    if (user) {
      await cancelAllRemindersForUser(user.id).catch((e) => console.warn('Could not cancel reminders on logout', e));
      await unregisterPush().catch(() => {});
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