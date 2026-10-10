import { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';

import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import MainTabs, { type MainTabParamList } from './MainTabs';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import {
  collectPresentedNotifications,
  recordNotification,
  recordOpenedNotification,
  syncBadge,
} from '../services/notificationInboxService';
import {
  handleReminderAction,
  migrateLegacyDailyReminders,
  rescheduleReminders,
} from '../services/reminderScheduler';
import { registerForPush, watchPushToken } from '../services/pushService';
import type { NotificationPayload } from '../types/notifications';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const navigationRef = createNavigationContainerRef<MainTabParamList>();

const SOS_SHORTCUT_ID = 'sos';

function AuthNavigator() {
  return (
    <AuthStack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = useAuth();
  const [isNavReady, setIsNavReady] = useState(false);
  const [pendingSos, setPendingSos] = useState(false);
  const [pendingNotification, setPendingNotification] = useState<NotificationPayload | null>(null);
  const { activeProfile, selectProfile } = useFamily();

  useEffect(() => {
    QuickActions.setItems([
      {
        id: SOS_SHORTCUT_ID,
        title: 'SOS',
        subtitle: 'Alert trusted contacts',
        icon: Platform.OS === 'ios' ? 'symbol:sos' : 'shortcut_sos',
      },
    ]).catch(() => {});
  }, []);

  useQuickActionCallback((action) => {
    if (action.id === SOS_SHORTCUT_ID) setPendingSos(true);
  });

  useEffect(() => {
    if (!pendingSos || !isNavReady || !user || !navigationRef.isReady()) return;
    navigationRef.navigate('HomeTab', { screen: 'Sos', initial: false });
    setPendingSos(false);
  }, [pendingSos, isNavReady, user]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const refreshBadge = () => syncBadge(userId);
    let lastReschedule = 0;
    const reschedule = (force = false) => {
      if (!force && Date.now() - lastReschedule < 60_000) return;
      lastReschedule = Date.now();
      rescheduleReminders(userId).catch(() => {});
    };
    const open = async (response: Notifications.NotificationResponse) => {
      try {
        const handledAction = await handleReminderAction(userId, response);
        const payload = await recordOpenedNotification(userId, response);
        if (handledAction) reschedule(true);
        else setPendingNotification(payload);
        await refreshBadge();
      } catch {}
    };
    const collect = () => collectPresentedNotifications(userId).then(refreshBadge).catch(() => {});

    migrateLegacyDailyReminders(userId)
      .catch(() => {})
      .then(() => reschedule(true));
    registerForPush().catch(() => {});
    const stopWatchingToken = watchPushToken();

    const received = Notifications.addNotificationReceivedListener((notification) => {
      recordNotification(userId, notification).then(refreshBadge).catch(() => {});
    });
    const responses = Notifications.addNotificationResponseReceivedListener(open);
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        open(response);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => {});
    collect();
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      collect();
      reschedule();
    });

    return () => {
      received.remove();
      responses.remove();
      appState.remove();
      stopWatchingToken();
    };
  }, [userId]);

  useEffect(() => {
    if (!pendingNotification || !isNavReady || !user || !navigationRef.isReady()) return;
    const { route, profileId } = pendingNotification;
    if (profileId && profileId !== activeProfile?.id) selectProfile(profileId).catch(() => {});
    if (!route || route.screen === 'Notifications') {
      navigationRef.navigate('HomeTab', { screen: 'Notifications', initial: false });
    } else if (route.screen === 'Family') {
      navigationRef.navigate('Family', { screen: 'FamilyMain' });
    } else if (route.screen === 'HelpRequest') {
      navigationRef.navigate('HomeTab', { screen: 'HelpRequest', params: route.params, initial: false });
    } else if (route.screen === 'FollowUpDetail') {
      navigationRef.navigate('HomeTab', { screen: 'FollowUpDetail', params: route.params, initial: false });
    } else {
      navigationRef.navigate('HomeTab', { screen: route.screen, initial: false });
    }
    setPendingNotification(null);
  }, [pendingNotification, isNavReady, user, activeProfile?.id, selectProfile]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={() => setIsNavReady(true)}>
      {user ? <MainTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
