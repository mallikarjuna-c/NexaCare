import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ComingSoonScreen from '../screens/ComingSoonScreen';
import HealthRecordsScreen from '../screens/HealthRecordsScreen';
import AddRecordScreen from '../screens/AddRecordScreen';
import RecordDetailScreen from '../screens/RecordDetailScreen';
import type { Ionicons } from '@expo/vector-icons';
import type { HealthRecord, HealthRecordType } from '../types/healthRecords';

export type HomeStackParamList = {
  HomeMain: undefined;
  ComingSoon: { title: string; icon: keyof typeof Ionicons.glyphMap };
  HealthRecords: undefined;
  AddRecord: { initialType?: HealthRecordType } | undefined;
  RecordDetail: { record: HealthRecord };
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
    </Stack.Navigator>
  );
}