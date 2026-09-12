import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import HomeStackNavigator from './HomeStack';
import ComingSoonScreen from '../screens/ComingSoonScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme/theme';

export type MainTabParamList = {
  HomeTab: undefined;
  Scan: undefined;
  Assistant: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function ScanTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.scanButton, focused && styles.scanButtonActive]}>
      <Ionicons name="camera-outline" size={26} color="#FFFFFF" />
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ComingSoonScreen}
        initialParams={{ title: 'Wellness Scan', icon: 'camera-outline' }}
        options={{ title: '', tabBarIcon: ({ focused }) => <ScanTabIcon focused={focused} /> }}
      />
      <Tab.Screen
        name="Assistant"
        component={ComingSoonScreen}
        initialParams={{ title: 'Health Assistant', icon: 'chatbubbles-outline' }}
        options={{
          title: 'Assistant',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
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
  tabBar: { height: 64, paddingBottom: 8, paddingTop: 8, backgroundColor: colors.surface, borderTopColor: colors.border },
  scanButton: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  scanButtonActive: { backgroundColor: colors.blue },
});