import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_API_URL, getApiUrl, normalizeApiUrl, setApiUrl } from '../services/apiClient';
import { colors, typography, spacing } from '../theme/theme';

type Status = { tone: 'good' | 'bad'; text: string } | null;

export default function ServerSettings() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(DEFAULT_API_URL);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    getApiUrl().then(setCurrent).catch(() => {});
  }, []);

  const show = () => {
    setValue(current);
    setStatus(null);
    setOpen(true);
  };

  const save = async () => {
    const url = normalizeApiUrl(value);
    if (!url) {
      setStatus({ tone: 'bad', text: 'Enter an address like 192.168.1.5 or http://192.168.1.5:8010' });
      return;
    }
    setIsChecking(true);
    setStatus(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(`${url}/health`, { signal: controller.signal });
      if (!response.ok) throw new Error('bad status');
      await setApiUrl(url);
      setCurrent(url);
      setOpen(false);
    } catch {
      setStatus({ tone: 'bad', text: `Couldn’t reach ${url}. Check the PC is on the same Wi-Fi and Docker is running.` });
    } finally {
      clearTimeout(timer);
      setIsChecking(false);
    }
  };

  const reset = async () => {
    await setApiUrl(DEFAULT_API_URL);
    setCurrent(DEFAULT_API_URL);
    setOpen(false);
  };

  return (
    <>
      <Pressable onPress={show} hitSlop={8} style={styles.trigger}>
        <Ionicons name="server-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.triggerText} numberOfLines={1}>
          Server: {current.replace(/^https?:\/\//, '')}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>NexaCare server</Text>
            <Text style={styles.sub}>
              Phones connected to the PC by USB or Wireless debugging use localhost. Other phones on the same Wi-Fi use the
              PC’s Wi-Fi address, for example 192.168.1.5.
            </Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="192.168.1.5"
              placeholderTextColor={colors.textSecondary}
            />
            {status && <Text style={[styles.status, status.tone === 'bad' && styles.statusBad]}>{status.text}</Text>}
            <Pressable
              style={({ pressed }) => [styles.cta, (pressed || isChecking) && styles.pressed]}
              onPress={save}
              disabled={isChecking}
            >
              {isChecking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={typography.button}>Test & save</Text>
                  <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>
            {current !== DEFAULT_API_URL && (
              <Pressable onPress={reset} hitSlop={8} style={styles.reset}>
                <Text style={styles.resetText}>Use localhost again</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: spacing.lg },
  triggerText: { fontSize: 12, color: colors.textSecondary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 19 },
  input: {
    marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, backgroundColor: colors.background,
  },
  status: { fontSize: 12, color: colors.green, marginTop: spacing.sm },
  statusBad: { color: colors.danger },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.lg, minHeight: 56,
  },
  pressed: { opacity: 0.8 },
  reset: { alignItems: 'center', marginTop: spacing.md },
  resetText: { fontSize: 13, fontWeight: '700', color: colors.green },
});
