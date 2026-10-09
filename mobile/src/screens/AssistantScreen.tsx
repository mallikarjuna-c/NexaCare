import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator, Alert, Animated,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabs';
import { useAuth } from '../context/AuthContext';
import FormattedMessage from '../components/FormattedMessage';
import {
  askAssistant, buildHealthContext, clearChatHistory, getChatHistory, getShareHealthData,
  saveChatHistory, setShareHealthData, AssistantError,
} from '../services/assistantService';
import { ASSISTANT_SUGGESTIONS, formatChatTime, looksLikeEmergency, type ChatMessage } from '../types/assistant';
import { formatCalendarDate } from '../types/followUps';
import { colors, spacing } from '../theme/theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Assistant'>;

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const SUGGESTION_TINTS = [
  { bg: colors.badge.orangeBg, fg: colors.badge.orangeIcon },
  { bg: colors.badge.purpleBg, fg: colors.badge.purpleIcon },
  { bg: colors.badge.blueBg, fg: colors.badge.blueIcon },
  { bg: colors.badge.greenBg, fg: colors.badge.greenIcon },
];

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatCalendarDate(d);
}

function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.stagger(
        160,
        dots.map((v) =>
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ])
        )
      )
    );
    animation.start();
    return () => animation.stop();
  }, [dots]);
  return (
    <View style={styles.dots}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={[styles.typingDot, { opacity: v }]} />
      ))}
    </View>
  );
}

function AssistantAvatar({ size = 28 }: { size?: number }) {
  return (
    <View style={[styles.assistantAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="medkit" size={size * 0.5} color="#FFFFFF" />
    </View>
  );
}

export default function AssistantScreen({ navigation }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [shareData, setShareData] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showEmergency, setShowEmergency] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setIsLoading(true);
    Promise.all([getChatHistory(user.id), getShareHealthData(user.id)])
      .then(([history, share]) => {
        if (cancelled) return;
        setMessages(history);
        setShareData(share);
      })
      .catch(() => !cancelled && setMessages([]))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function send(text: string, base: ChatMessage[] = messages) {
    const trimmed = text.trim();
    if (!user || !trimmed || isSending) return;

    const userMessage: ChatMessage = { id: newId(), role: 'user', text: trimmed, createdAt: new Date().toISOString() };
    const pending = [...base, userMessage];
    setMessages(pending);
    setInput('');
    setErrorText(null);
    setIsSending(true);
    if (looksLikeEmergency(trimmed)) setShowEmergency(true);
    saveChatHistory(user.id, pending).catch(() => {});

    try {
      const context = shareData ? await buildHealthContext(user.id) : null;
      const { reply } = await askAssistant(pending, context);
      const done: ChatMessage[] = [
        ...pending,
        { id: newId(), role: 'assistant', text: reply, createdAt: new Date().toISOString() },
      ];
      setMessages(done);
      await saveChatHistory(user.id, done);
    } catch (error) {
      const failed = pending.map((m) => (m.id === userMessage.id ? { ...m, failed: true } : m));
      setMessages(failed);
      setErrorText(error instanceof AssistantError ? error.message : 'Something went wrong. Please try again.');
      saveChatHistory(user.id, failed).catch(() => {});
    } finally {
      setIsSending(false);
    }
  }

  function retry(message: ChatMessage) {
    send(message.text, messages.filter((m) => m.id !== message.id));
  }

  async function applyShare(on: boolean) {
    if (!user) return;
    setShareData(on);
    try {
      await setShareHealthData(user.id, on);
    } catch {
      setShareData(!on);
      Alert.alert('Couldn’t save', 'Please try again.');
    }
  }

  function toggleShare() {
    if (shareData) {
      applyShare(false);
      return;
    }
    Alert.alert(
      'Use your health data?',
      'Your Medical ID, latest smartwatch readings and latest health records will be sent with each question, so answers can be personal. You can turn this off any time.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Turn on', onPress: () => applyShare(true) },
      ]
    );
  }

  function confirmClear() {
    if (!user) return;
    Alert.alert('Clear conversation?', 'This deletes the chat from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearChatHistory(user.id);
            setMessages([]);
            setErrorText(null);
            setShowEmergency(false);
          } catch {
            Alert.alert('Couldn’t clear', 'Please try again.');
          }
        },
      },
    ]);
  }

  const firstName = user?.name?.split(' ')[0];
  const lastMessage = messages[messages.length - 1];

  function renderMessage({ item, index }: { item: ChatMessage; index: number }) {
    const previous = messages[index - 1];
    const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(item.createdAt).toDateString();
    const mine = item.role === 'user';

    return (
      <View>
        {newDay && (
          <View style={styles.dayChip}>
            <Text style={styles.dayChipText}>{dayLabel(item.createdAt)}</Text>
          </View>
        )}

        {mine ? (
          <View style={styles.userRow}>
            <View style={[styles.userBubble, item.failed && styles.bubbleFailed]}>
              <Text style={styles.userText} selectable>
                {item.text}
              </Text>
            </View>
            {item.failed ? (
              <Pressable onPress={() => retry(item)} disabled={isSending} hitSlop={8} style={styles.metaRow}>
                <Ionicons name="alert-circle" size={13} color={colors.danger} />
                <Text style={styles.failedText}>
                  {item.id === lastMessage?.id && errorText ? errorText : 'Not sent.'}{' '}
                  <Text style={styles.retryText}>Try again</Text>
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.time, styles.timeRight]}>{formatChatTime(item.createdAt)}</Text>
            )}
          </View>
        ) : (
          <View style={styles.assistantRow}>
            <AssistantAvatar />
            <View style={styles.assistantColumn}>
              <Text style={styles.assistantName}>
                NexaCare Assistant <Text style={styles.time}>· {formatChatTime(item.createdAt)}</Text>
              </Text>
              <View style={styles.assistantBubble}>
                <FormattedMessage text={item.text} />
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <AssistantAvatar size={42} />
          <View style={styles.flex}>
            <Text style={styles.title}>Health Assistant</Text>
            <Text style={styles.subtitle}>AI health guide · not a diagnosis</Text>
          </View>
          {messages.length > 0 && (
            <Pressable onPress={confirmClear} hitSlop={8} style={styles.headerButton} accessibilityLabel="Clear conversation">
              <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={toggleShare}
          style={[styles.sharePill, shareData && styles.sharePillOn]}
          accessibilityRole="switch"
          accessibilityState={{ checked: shareData }}
        >
          <Ionicons
            name={shareData ? 'shield-checkmark' : 'shield-outline'}
            size={15}
            color={shareData ? colors.green : colors.textSecondary}
          />
          <Text style={[styles.shareText, shareData && styles.shareTextOn]}>
            {shareData ? 'Using your health data' : 'Personalise with my health data'}
          </Text>
          <View style={[styles.miniSwitch, shareData && styles.miniSwitchOn]}>
            <View style={[styles.miniKnob, shareData && styles.miniKnobOn]} />
          </View>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.listContent, messages.length === 0 && styles.listEmpty]}
          onContentSizeChange={() => {
            if (messages.length) listRef.current?.scrollToEnd({ animated: true });
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AssistantAvatar size={64} />
              <Text style={styles.emptyTitle}>
                Hi{firstName ? ` ${firstName}` : ''}, how can I help today?
              </Text>
              <Text style={styles.emptyText}>
                Ask about symptoms, your readings or healthy habits. I share general health information, not a diagnosis.
              </Text>
              <Text style={styles.tryLabel}>TRY ASKING</Text>
              <View style={styles.grid}>
                {ASSISTANT_SUGGESTIONS.map((s, i) => (
                  <Pressable
                    key={s.title}
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                    onPress={() => send(s.prompt)}
                    disabled={isSending}
                  >
                    <View style={[styles.cardIcon, { backgroundColor: SUGGESTION_TINTS[i % 4].bg }]}>
                      <Ionicons name={s.icon} size={18} color={SUGGESTION_TINTS[i % 4].fg} />
                    </View>
                    <Text style={styles.cardTitle}>{s.title}</Text>
                    <Text style={styles.cardText} numberOfLines={2}>
                      {s.prompt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          ListFooterComponent={
            isSending ? (
              <View style={styles.assistantRow}>
                <AssistantAvatar />
                <View style={styles.assistantColumn}>
                  <Text style={styles.assistantName}>NexaCare Assistant</Text>
                  <View style={[styles.assistantBubble, styles.typingBubble]}>
                    <TypingDots />
                  </View>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {showEmergency && (
        <View style={styles.emergency}>
          <View style={styles.emergencyTop}>
            <View style={styles.emergencyIcon}>
              <Ionicons name="warning" size={16} color={colors.danger} />
            </View>
            <Text style={styles.emergencyTitle}>If this is an emergency, get help now</Text>
            <Pressable onPress={() => setShowEmergency(false)} hitSlop={10} accessibilityLabel="Dismiss">
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.emergencyButtons}>
            <Pressable style={[styles.emergencyButton, styles.callButton]} onPress={() => Linking.openURL('tel:112')}>
              <Ionicons name="call" size={16} color="#FFFFFF" />
              <Text style={styles.callText}>Call 112</Text>
            </Pressable>
            <Pressable
              style={[styles.emergencyButton, styles.sosButton]}
              onPress={() => navigation.navigate('HomeTab', { screen: 'Sos', initial: false })}
            >
              <Text style={styles.sosText}>Open SOS</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.composer}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message Health Assistant…"
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={2000}
            editable={!isLoading}
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || isSending) && styles.sendDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || isSending}
            accessibilityLabel="Send"
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>AI answers can be wrong. In an emergency, call 112.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  headerButton: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sharePill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  sharePillOn: { borderColor: colors.green, backgroundColor: colors.blobLight },
  shareText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  shareTextOn: { color: colors.green },
  miniSwitch: { width: 30, height: 18, borderRadius: 9, backgroundColor: colors.border, padding: 2, justifyContent: 'center' },
  miniSwitchOn: { backgroundColor: colors.green },
  miniKnob: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF' },
  miniKnobOn: { alignSelf: 'flex-end' },

  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },

  dayChip: {
    alignSelf: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 4,
    borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  dayChipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },

  assistantAvatar: { backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingRight: spacing.lg },
  assistantColumn: { flexShrink: 1 },
  assistantName: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginBottom: 4, marginTop: 2 },
  assistantBubble: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, borderTopLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10,
  },
  typingBubble: { alignSelf: 'flex-start', paddingVertical: 14 },
  dots: { flexDirection: 'row', gap: 5 },
  typingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.green },

  userRow: { alignItems: 'flex-end', paddingLeft: spacing.xl + spacing.md },
  userBubble: {
    backgroundColor: colors.green, borderRadius: 18, borderTopRightRadius: 6,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  userText: { fontSize: 15, lineHeight: 22, color: '#FFFFFF' },
  bubbleFailed: { opacity: 0.55 },
  time: { fontSize: 11, fontWeight: '400', color: colors.textSecondary },
  timeRight: { marginTop: 4, marginRight: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  failedText: { flexShrink: 1, fontSize: 12, color: colors.danger, textAlign: 'right' },
  retryText: { fontWeight: '800', textDecorationLine: 'underline' },

  empty: { alignItems: 'center', paddingHorizontal: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, lineHeight: 19 },
  tryLabel: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignSelf: 'stretch' },
  card: {
    width: '48.5%', flexGrow: 1, padding: spacing.md, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  cardPressed: { borderColor: colors.green, backgroundColor: colors.blobLight },
  cardIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm },
  cardText: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },

  emergency: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: colors.danger,
  },
  emergencyTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emergencyIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.badge.orangeBg, alignItems: 'center', justifyContent: 'center' },
  emergencyTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  emergencyButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  emergencyButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 999,
  },
  callButton: { backgroundColor: colors.danger },
  callText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  sosButton: { borderWidth: 1, borderColor: colors.danger },
  sosText: { fontSize: 14, fontWeight: '800', color: colors.danger },

  composer: {
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingLeft: spacing.md, padding: 5, borderRadius: 24,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, maxHeight: 120, fontSize: 15, color: colors.textPrimary, paddingVertical: 8 },
  sendButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
  disclaimer: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: spacing.sm },
});
