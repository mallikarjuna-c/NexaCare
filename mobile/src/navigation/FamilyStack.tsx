import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FamilyScreen from '../screens/FamilyScreen';
import AddFamilyMemberScreen from '../screens/AddFamilyMemberScreen';
import MedicalInfoScreen from '../screens/MedicalInfoScreen';

export type FamilyStackParamList = {
  FamilyMain: undefined;
  AddFamilyMember: { memberId?: string } | undefined;
  FamilyMedicalInfo: { profileId?: string } | undefined;
};

const Stack = createNativeStackNavigator<FamilyStackParamList>();

export default function FamilyStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="FamilyMain" component={FamilyScreen} options={{ title: 'Family' }} />
      <Stack.Screen name="AddFamilyMember" component={AddFamilyMemberScreen} options={{ title: 'Add Family Member' }} />
      <Stack.Screen name="FamilyMedicalInfo" component={MedicalInfoScreen} options={{ title: 'Medical ID' }} />
    </Stack.Navigator>
  );
}
