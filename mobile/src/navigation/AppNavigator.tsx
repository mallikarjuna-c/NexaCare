import { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Platform, View } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';

import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import MainTabs, { type MainTabParamList } from './MainTabs';
import { useAuth } from '../context/AuthContext';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

// Lets code outside a screen (the home-screen shortcut) navigate.
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

  // Register the "SOS" app shortcut (long-press the NexaCare icon on the home screen).
  useEffect(() => {
    QuickActions.setItems([
      {
        id: SOS_SHORTCUT_ID,
        title: 'SOS',
        subtitle: 'Alert trusted contacts', // shown on iOS only
        // Android: res/drawable/shortcut_sos.xml (red circle with "!") — see native-assets/ and plugins/.
        icon: Platform.OS === 'ios' ? 'symbol:sos' : 'shortcut_sos',
      },
    ]).catch(() => {}); // unsupported launcher — the in-app SOS button still works
  }, []);

  // Fires for a cold start via the shortcut and when the app is already running.
  useQuickActionCallback((action) => {
    if (action.id === SOS_SHORTCUT_ID) setPendingSos(true);
  });

  // Open SOS once navigation is ready and someone is signed in (SOS needs their trusted contacts).
  // If nobody is signed in, it stays pending and opens right after login.
  useEffect(() => {
    if (!pendingSos || !isNavReady || !user || !navigationRef.isReady()) return;
    navigationRef.navigate('HomeTab', { screen: 'Sos', initial: false }); // initial:false keeps Home underneath
    setPendingSos(false);
  }, [pendingSos, isNavReady, user]);

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
