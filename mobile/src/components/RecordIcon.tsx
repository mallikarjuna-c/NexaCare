import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HealthRecordType } from '../types/healthRecords';
import { colors } from '../theme/theme';

export const RECORD_BADGES: Record<HealthRecordType, { icon: keyof typeof Ionicons.glyphMap; bg: string; tint: string }> = {
  blood_pressure: { icon: 'pulse-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon },
  heart_rate: { icon: 'heart-outline', bg: '#FCE1E1', tint: colors.danger },
  weight: { icon: 'body-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon },
  blood_glucose: { icon: 'water-outline', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon },
  medical_report: { icon: 'document-text-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon },
  prescription: { icon: 'medkit-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon },
};

export default function RecordIcon({ type, size = 36 }: { type: HealthRecordType; size?: number }) {
  const badge = RECORD_BADGES[type];
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: badge.bg }]}>
      <Ionicons name={badge.icon} size={size * 0.5} color={badge.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
