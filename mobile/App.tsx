import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { FamilyProvider } from './src/context/FamilyContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FamilyProvider>
          <AppNavigator />
        </FamilyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
