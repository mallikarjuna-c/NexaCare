import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as authService from '../services/authService';
import { cancelAllRemindersForUser } from '../services/notificationService';
import { restoreFollowUpReminders } from '../services/followUpService';
import { removeFaceScanData } from '../services/legacyDataService';
import type { User, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService.getCurrentUser().then((storedUser) => {
      setUser(storedUser);
      setIsLoading(false);
    });
  }, []);

  // Logout clears this user's reminders from the device; put follow-up reminders back when they sign in.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    restoreFollowUpReminders(userId).catch((e) => console.warn('Could not restore follow-up reminders', e));
    removeFaceScanData(userId).catch(() => {}); // harmless if there's nothing to remove
  }, [userId]);

  const login = async (email: string, password: string) => {
    const loggedInUser = await authService.login(email, password);
    setUser(loggedInUser);
  };

  const signup = async (name: string, email: string, password: string) => {
    const newUser = await authService.signup(name, email, password);
    setUser(newUser);
  };

  const logout = async () => {
    if (user) {
      // Scheduled notifications live on the device, not the account — clear this user's before signing out.
      await cancelAllRemindersForUser(user.id).catch((e) => console.warn('Could not cancel reminders on logout', e));
    }
    await authService.logout();
    setUser(null);
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