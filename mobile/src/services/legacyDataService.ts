import AsyncStorage from '@react-native-async-storage/async-storage';

const REMOVED_FACE_SCAN_PREFIXES = ['nexacare_scan_consent_', 'nexacare_scan_profile_', 'nexacare_scan_results_'];

export async function removeFaceScanData(userId: string): Promise<void> {
  await AsyncStorage.multiRemove(REMOVED_FACE_SCAN_PREFIXES.map((prefix) => `${prefix}${userId}`));
}
