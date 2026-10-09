import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ComingSoonScreen from '../screens/ComingSoonScreen';
import HealthRecordsScreen from '../screens/HealthRecordsScreen';
import AddRecordScreen from '../screens/AddRecordScreen';
import RecordDetailScreen from '../screens/RecordDetailScreen';
import ChallengesScreen from '../screens/ChallengesScreen';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import FollowUpsScreen from '../screens/FollowUpsScreen';
import AddFollowUpScreen from '../screens/AddFollowUpScreen';
import FollowUpDetailScreen from '../screens/FollowUpDetailScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import DirectoryScreen from '../screens/DirectoryScreen';
import AddProviderScreen from '../screens/AddProviderScreen';
import ProviderDetailScreen from '../screens/ProviderDetailScreen';
import EmergencyScreen from '../screens/EmergencyScreen';
import AddEmergencyContactScreen from '../screens/AddEmergencyContactScreen';
import MedicalInfoScreen from '../screens/MedicalInfoScreen';
import SosScreen from '../screens/SosScreen';
import ShareHealthDataScreen from '../screens/ShareHealthDataScreen';
import TrendsScreen from '../screens/TrendsScreen';
import type { TrendMetric } from '../types/trends';
import type { Ionicons } from '@expo/vector-icons';
import type { HealthRecord, HealthRecordType } from '../types/healthRecords';

export type HomeStackParamList = {
  HomeMain: undefined;
  ComingSoon: { title: string; icon: keyof typeof Ionicons.glyphMap };
  HealthRecords: undefined;
  AddRecord: { initialType?: HealthRecordType } | undefined;
  RecordDetail: { record: HealthRecord };
  Challenges: undefined;
  ChallengeDetail: { challengeId: string };
  Notifications: undefined;
  FollowUps: undefined;
  AddFollowUp: { followUpId?: string; providerId?: string } | undefined; // followUpId = edit; providerId = prefill
  FollowUpDetail: { followUpId: string };
  Expenses: undefined;
  AddExpense: { expenseId?: string; providerId?: string } | undefined; // expenseId = edit; providerId = prefill
  ExpenseDetail: { expenseId: string };
  Directory: undefined;
  AddProvider: { providerId?: string } | undefined; // providerId present = edit mode
  ProviderDetail: { providerId: string };
  Emergency: undefined;
  AddEmergencyContact: { contactId?: string } | undefined; // contactId present = edit mode
  MedicalInfo: undefined;
  Sos: undefined;
  ShareHealthData: { recordIds?: string[] } | undefined; // recordIds = preselected (from "Share this record")
  Trends: { metric?: TrendMetric } | undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ComingSoon" component={ComingSoonScreen} options={({ route }) => ({ title: route.params.title })} />
      <Stack.Screen name="HealthRecords" component={HealthRecordsScreen} options={{ title: 'Health Records' }} />
      <Stack.Screen name="AddRecord" component={AddRecordScreen} options={{ title: 'Add Record' }} />
      <Stack.Screen name="RecordDetail" component={RecordDetailScreen} options={{ title: 'Record Details' }} />
      <Stack.Screen name="Challenges" component={ChallengesScreen} options={{ title: 'Challenges' }} />
      <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} options={{ title: 'Challenge' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="FollowUps" component={FollowUpsScreen} options={{ title: 'Follow-ups' }} />
      <Stack.Screen name="AddFollowUp" component={AddFollowUpScreen} options={{ title: 'Add Follow-up' }} />
      <Stack.Screen name="FollowUpDetail" component={FollowUpDetailScreen} options={{ title: 'Follow-up' }} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Medical Expenses' }} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
      <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: 'Expense' }} />
      <Stack.Screen name="Directory" component={DirectoryScreen} options={{ title: 'Healthcare Directory' }} />
      <Stack.Screen name="AddProvider" component={AddProviderScreen} options={{ title: 'Add Provider' }} />
      <Stack.Screen name="ProviderDetail" component={ProviderDetailScreen} options={{ title: 'Provider' }} />
      <Stack.Screen name="Emergency" component={EmergencyScreen} options={{ title: 'Emergency Assistance' }} />
      <Stack.Screen name="AddEmergencyContact" component={AddEmergencyContactScreen} options={{ title: 'Add Emergency Contact' }} />
      <Stack.Screen name="MedicalInfo" component={MedicalInfoScreen} options={{ title: 'Medical ID' }} />
      <Stack.Screen name="ShareHealthData" component={ShareHealthDataScreen} options={{ title: 'Share Health Data' }} />
      <Stack.Screen name="Trends" component={TrendsScreen} options={{ title: 'Health Trends' }} />
      <Stack.Screen
        name="Sos"
        component={SosScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}