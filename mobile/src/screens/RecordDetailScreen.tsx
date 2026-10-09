import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useFamily } from '../context/FamilyContext';
import RecordIcon from '../components/RecordIcon';
import { deleteRecord, getRecordById } from '../services/healthRecordsService';
import { RECORD_TYPE_LABELS, formatRecordDate, type HealthRecord } from '../types/healthRecords';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'RecordDetail'>;

export default function RecordDetailScreen({ navigation, route }: Props) {
  const { recordId } = route.params;
  const { activeProfile } = useFamily();
  const profileId = activeProfile?.id;
  const canEdit = activeProfile?.canEdit ?? true;
  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    try {
      setRecord(await getRecordById(profileId, recordId));
    } catch {
      setRecord(null);
    } finally {
      setIsLoading(false);
    }
  }, [profileId, recordId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = () =>
    Alert.alert('Delete record?', 'This permanently removes it from your health records.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!profileId) return;
          setIsDeleting(true);
          try {
            await deleteRecord(profileId, recordId);
            navigation.goBack();
          } catch {
            setIsDeleting(false);
            Alert.alert('Something went wrong', "We couldn't delete this record. Please try again.");
          }
        },
      },
    ]);

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Ionicons name="document-outline" size={32} color={colors.textSecondary} />
        <Text style={styles.missingText}>This record no longer exists.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <RecordIcon type={record.type} size={72} />

      <Text style={styles.typeLabel}>{RECORD_TYPE_LABELS[record.type]}</Text>
      <Text style={[typography.display, styles.value]}>{record.value}</Text>
      <Text style={styles.date}>{formatRecordDate(record.date)}</Text>

      {record.providerName && (
        <View style={styles.providerRow}>
          <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.providerText}>{record.providerName}</Text>
        </View>
      )}

      {record.attachmentUri && activeProfile?.kind === 'linked' && (
        <View style={[styles.attachmentCard, styles.attachmentFileRow]}>
          <Ionicons name="phone-portrait-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.attachmentFileName}>
            The attached file ({record.attachmentName ?? 'document'}) is saved on {activeProfile.name}’s phone.
          </Text>
        </View>
      )}

      {record.attachmentUri && activeProfile?.kind !== 'linked' && (
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

      <View style={styles.actions}>
        {canEdit && (
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate('AddRecord', { recordId: record.id })}
            disabled={isDeleting}
          >
            <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [styles.actionButton, styles.shareButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('ShareHealthData', { recordIds: [record.id] })}
          disabled={isDeleting}
        >
          <Ionicons name="share-outline" size={18} color={colors.green} />
          <Text style={styles.shareButtonText}>Share</Text>
        </Pressable>
      </View>

      {canEdit && (
        <Pressable style={styles.deleteButton} onPress={confirmDelete} disabled={isDeleting} hitSlop={8}>
          {isDeleting ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.deleteText}>Delete record</Text>
            </>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  content: { alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  pressed: { opacity: 0.7 },
  missingText: { fontSize: 14, color: colors.textSecondary },
  typeLabel: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: spacing.md,
  },
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
  actions: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.lg },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border, borderRadius: 30, paddingVertical: 12, backgroundColor: colors.surface,
  },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  shareButton: { borderColor: colors.green },
  shareButtonText: { fontSize: 14, fontWeight: '700', color: colors.green },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginTop: spacing.lg, paddingVertical: spacing.sm, minHeight: 36,
  },
  deleteText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
