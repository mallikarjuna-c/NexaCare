import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { RECORD_TYPE_LABELS } from '../types/healthRecords';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'RecordDetail'>;

export default function RecordDetailScreen({ route }: Props) {
  const { record } = route.params;

  return (
    <View style={styles.screen}>
      <View style={styles.iconCircle}>
        <Ionicons name="document-text-outline" size={32} color={colors.blue} />
      </View>

      <Text style={styles.typeLabel}>{RECORD_TYPE_LABELS[record.type]}</Text>
      <Text style={[typography.display, styles.value]}>{record.value}</Text>
      <Text style={styles.date}>{record.date}</Text>

      {record.providerName && (
        <View style={styles.providerRow}>
          <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.providerText}>{record.providerName}</Text>
        </View>
      )}

      {record.attachmentUri && (
        <View style={styles.attachmentCard}>
          {record.attachmentType === 'image' ? (
            <Image source={{ uri: record.attachmentUri }} style={styles.attachmentImage} resizeMode="cover" />
          ) : (
            <View style={styles.attachmentFileRow}>
              <Ionicons name="document-outline" size={22} color={colors.blue} />
              <Text style={styles.attachmentFileName} numberOfLines={1}>{record.attachmentName}</Text>
            </View>
          )}
        </View>
      )}

      {record.notes ? (
        <View style={styles.notesCard}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{record.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.badge.blueBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  typeLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { textAlign: 'center', marginTop: spacing.xs },
  date: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  providerText: { fontSize: 13, color: colors.textSecondary },
  attachmentCard: {
    width: '100%', backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, overflow: 'hidden',
  },
  attachmentImage: { width: '100%', height: 200, borderRadius: 12 },
  attachmentFileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attachmentFileName: { flex: 1, fontSize: 14, color: colors.textPrimary },
  notesCard: {
    width: '100%', backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  notesLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.xs },
  notesText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
});