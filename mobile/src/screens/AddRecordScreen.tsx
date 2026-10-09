import { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useFamily } from '../context/FamilyContext';
import ProfileBanner from '../components/ProfileBanner';
import { addRecord, getRecordById, updateRecord } from '../services/healthRecordsService';
import {
  RECORD_TYPE_LABELS, DOCUMENT_TYPES, formatRecordDate, type HealthRecordType, type AttachmentType,
} from '../types/healthRecords';
import { parseLocalISODate, toLocalISODate } from '../types/expenses';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'AddRecord'>;

const TYPE_OPTIONS = Object.keys(RECORD_TYPE_LABELS) as HealthRecordType[];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayISO() {
  return toLocalISODate(new Date());
}

export default function AddRecordScreen({ navigation, route }: Props) {
  const { activeProfile } = useFamily();
  const editingId = route.params?.recordId;
  const [isLoadingExisting, setIsLoadingExisting] = useState(!!editingId);
  const [type, setType] = useState<HealthRecordType>(route.params?.initialType ?? 'blood_pressure');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [providerName, setProviderName] = useState('');
  const [attachmentUri, setAttachmentUri] = useState<string | undefined>();
  const [attachmentName, setAttachmentName] = useState<string | undefined>();
  const [attachmentType, setAttachmentType] = useState<AttachmentType | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDocumentType = DOCUMENT_TYPES.includes(type);
  const hasValidDate = ISO_DATE.test(date);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editingId ? 'Edit Record' : 'Add Record' });
  }, [navigation, editingId]);

  useEffect(() => {
    if (!activeProfile || !editingId) return;
    getRecordById(activeProfile.id, editingId)
      .then((existing) => {
        if (!existing) {
          Alert.alert('Not found', 'This record no longer exists.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          return;
        }
        setType(existing.type);
        setValue(existing.value);
        setDate(existing.date);
        setNotes(existing.notes ?? '');
        setProviderName(existing.providerName ?? '');
        setAttachmentUri(existing.attachmentUri);
        setAttachmentName(existing.attachmentName);
        setAttachmentType(existing.attachmentType);
      })
      .catch(() => Alert.alert('Something went wrong', "We couldn't load this record."))
      .finally(() => setIsLoadingExisting(false));
  }, [activeProfile, editingId, navigation]);

  const pickerDate = hasValidDate ? parseLocalISODate(date) : new Date();

  const openDatePicker = () => {
    DateTimePickerAndroid.open({
      value: pickerDate,
      mode: 'date',
      maximumDate: new Date(),
      onValueChange: (_event, selected) => setDate(toLocalISODate(selected)),
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setAttachmentUri(asset.uri);
    setAttachmentName(asset.name);
    setAttachmentType(asset.mimeType?.includes('pdf') ? 'pdf' : 'image');
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to attach a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setAttachmentUri(asset.uri);
    setAttachmentName(asset.fileName ?? 'Photo');
    setAttachmentType('image');
  };

  const removeAttachment = () => {
    setAttachmentUri(undefined);
    setAttachmentName(undefined);
    setAttachmentType(undefined);
  };

  const handleSave = async () => {
    if (!activeProfile) return;
    if (!value.trim() || !date.trim()) {
      Alert.alert('Missing info', isDocumentType ? 'Please enter a title and date.' : 'Please enter both a value and a date.');
      return;
    }

    const input = {
      type,
      value: value.trim(),
      date: date.trim(),
      notes: notes.trim() || undefined,
      providerName: isDocumentType && providerName.trim() ? providerName.trim() : undefined,
      attachmentUri: isDocumentType ? attachmentUri : undefined,
      attachmentName: isDocumentType ? attachmentName : undefined,
      attachmentType: isDocumentType ? attachmentType : undefined,
    };

    setIsSubmitting(true);
    try {
      if (editingId) await updateRecord(activeProfile.id, editingId, input);
      else await addRecord(activeProfile.id, input);
      navigation.goBack();
    } catch {
      Alert.alert('Something went wrong', 'Could not save this record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingExisting) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ProfileBanner what="records" switchable={false} style={styles.banner} />
        <Text style={typography.heading}>{editingId ? 'Edit Health Record' : 'Add Health Record'}</Text>
        <Text style={[typography.body, styles.subtitle]}>Record type</Text>

        <View style={styles.typeGrid}>
          {TYPE_OPTIONS.map((t) => (
            <Pressable
              key={t}
              style={[styles.typeChip, type === t && styles.typeChipActive]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                {RECORD_TYPE_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>{isDocumentType ? 'Title' : 'Value'}</Text>
        <TextInput
          style={styles.input}
          placeholder={isDocumentType ? 'e.g. "Blood Test Report - Sept 2026"' : 'e.g. "120/80", "72 bpm", "68 kg"'}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={setValue}
        />

        {isDocumentType && (
          <>
            <Text style={styles.fieldLabel}>Doctor / Lab / Pharmacy (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Dr. Sharma, Apollo Diagnostics"
              placeholderTextColor={colors.textSecondary}
              value={providerName}
              onChangeText={setProviderName}
            />
          </>
        )}

        <Text style={styles.fieldLabel}>Date</Text>
        {Platform.OS === 'android' ? (
          <Pressable style={({ pressed }) => [styles.dateButton, pressed && styles.ctaPressed]} onPress={openDatePicker}>
            <Ionicons name="calendar-outline" size={18} color={colors.blue} />
            <Text style={styles.dateButtonText}>{formatRecordDate(date)}</Text>
          </Pressable>
        ) : (
          <View style={styles.iosPickerWrap}>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="compact"
              maximumDate={new Date()}
              onValueChange={(_event, selected) => setDate(toLocalISODate(selected))}
            />
          </View>
        )}
        {!hasValidDate && (
          <Text style={styles.hintText}>Saved as “{date}”. Pick a date from the calendar to fix it.</Text>
        )}

        {isDocumentType && (
          <>
            <Text style={styles.fieldLabel}>Attachment (optional)</Text>
            {attachmentUri ? (
              <View style={styles.attachmentPreview}>
                {attachmentType === 'image' ? (
                  <Image source={{ uri: attachmentUri }} style={styles.attachmentThumb} />
                ) : (
                  <View style={styles.attachmentIconBox}>
                    <Ionicons name="document-outline" size={22} color={colors.blue} />
                  </View>
                )}
                <Text style={styles.attachmentName} numberOfLines={1}>{attachmentName}</Text>
                <Pressable onPress={removeAttachment} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.attachmentButtonsRow}>
                <Pressable style={styles.attachmentButton} onPress={pickDocument}>
                  <Ionicons name="document-attach-outline" size={18} color={colors.blue} />
                  <Text style={styles.attachmentButtonText}>Attach File</Text>
                </Pressable>
                <Pressable style={styles.attachmentButton} onPress={pickPhoto}>
                  <Ionicons name="camera-outline" size={18} color={colors.blue} />
                  <Text style={styles.attachmentButtonText}>Attach Photo</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Any additional context..."
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, isSubmitting && styles.ctaDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
          <Text style={typography.button}>{isSubmitting ? 'Saving...' : editingId ? 'Save Changes' : 'Save Record'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  centered: { alignItems: 'center', justifyContent: 'center' },
  banner: { marginBottom: spacing.md },
  dateButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.surface,
  },
  dateButtonText: { fontSize: 15, color: colors.textPrimary },
  iosPickerWrap: { alignItems: 'flex-start' },
  hintText: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.sm },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  typeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  typeChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  typeChipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  typeChipTextActive: { color: '#FFFFFF' },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },

  attachmentButtonsRow: { flexDirection: 'row', gap: spacing.sm },
  attachmentButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  attachmentButtonText: { fontSize: 13, fontWeight: '600', color: colors.blue },

  attachmentPreview: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  attachmentThumb: { width: 40, height: 40, borderRadius: 8 },
  attachmentIconBox: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: colors.badge.blueBg,
    alignItems: 'center', justifyContent: 'center',
  },
  attachmentName: { flex: 1, fontSize: 13, color: colors.textPrimary },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.xl,
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.6 },
});