import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { getFocusedRouteNameFromRoute, type NavigatorScreenParams } from '@react-navigation/native';
import HomeStackNavigator, { type HomeStackParamList } from './HomeStack';
import AssistantScreen from '../screens/AssistantScreen';
import SmartwatchScreen from '../screens/SmartwatchScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/theme';

const TAB_BAR_HEIGHT = 64;

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined; // lets the SOS shortcut open a Home screen directly
  Watch: undefined;
  Assistant: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Raised centre button — opens your smartwatch data.
function WatchTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.centerButton, focused && styles.centerButtonActive]}>
      <Ionicons name="watch-outline" size={26} color="#FFFFFF" />
    </View>
  );
}

export default function MainTabs() {
  // Android draws its 3-button / gesture bar over the app, so lift the tab bar above it.
  const { bottom } = useSafeAreaInsets();
  const tabBarStyle = [styles.tabBar, { height: TAB_BAR_HEIGHT + bottom, paddingBottom: 8 + bottom }];

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={({ route }) => ({
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          // The SOS panel is full-screen: no tab bar to mis-tap in an emergency.
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'Sos' ? { display: 'none' } : tabBarStyle,
        })}
      />
      <Tab.Screen
        name="Watch"
        component={SmartwatchScreen}
        options={{
          title: '',
          tabBarIcon: ({ focused }) => <WatchTabIcon focused={focused} />,
          tabBarAccessibilityLabel: 'Smartwatch data',
        }}
      />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{
          title: 'Assistant',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
          tabBarHideOnKeyboard: true, // keeps the message box right above the keyboard
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: { paddingTop: 8, backgroundColor: colors.surface, borderTopColor: colors.border },
  centerButton: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  centerButtonActive: { backgroundColor: colors.blue },
});