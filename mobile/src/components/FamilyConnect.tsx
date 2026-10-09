import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, TextInput, ActivityIndicator, Alert, Share, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFamily } from '../context/FamilyContext';
import { approveLink, changeLinkAccess, createShareCode, removeLink, requestLink } from '../services/linksService';
import { LINK_ACCESS_LABELS, type FamilyLink, type LinkAccess, type ShareCode } from '../types/family';
import { colors, typography, spacing } from '../theme/theme';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.handle} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function FamilyConnect() {
  const { links, linksError, refreshFamily } = useFamily();
  const [shareOpen, setShareOpen] = useState(false);
  const [code, setCode] = useState<ShareCode | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [enterOpen, setEnterOpen] = useState(false);
  const [entered, setEntered] = useState('');
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingRequests = links.sharing.filter((l) => l.status === 'pending');
  const sharingWith = links.sharing.filter((l) => l.status === 'approved');
  const waiting = links.viewing.filter((l) => l.status === 'pending');

  const openShare = async () => {
    setShareOpen(true);
    setCode(null);
    setCodeLoading(true);
    try {
      setCode(await createShareCode());
    } catch (error) {
      setShareOpen(false);
      Alert.alert('Couldn’t create a code', errorText(error));
    } finally {
      setCodeLoading(false);
    }
  };

  const sendCode = async () => {
    if (!entered.trim() || sending) return;
    setSending(true);
    try {
      const link = await requestLink(entered);
      setEnterOpen(false);
      setEntered('');
      await refreshFamily();
      Alert.alert('Request sent', `Ask ${link.person.name} to open NexaCare → Family and approve your request.`);
    } catch (error) {
      Alert.alert('Couldn’t connect', errorText(error));
    } finally {
      setSending(false);
    }
  };

  const run = async (link: FamilyLink, action: () => Promise<unknown>) => {
    setBusyId(link.id);
    try {
      await action();
      await refreshFamily();
    } catch (error) {
      Alert.alert('Something went wrong', errorText(error));
    } finally {
      setBusyId(null);
    }
  };

  const approve = (link: FamilyLink, access: LinkAccess) => run(link, () => approveLink(link.id, access));

  const confirmRemove = (link: FamilyLink, title: string, body: string, action: string) =>
    Alert.alert(title, body, [
      { text: 'Keep', style: 'cancel' },
      { text: action, style: 'destructive', onPress: () => run(link, () => removeLink(link.id)) },
    ]);

  return (
    <View style={styles.wrap}>
      <View style={styles.connectCard}>
        <View style={styles.connectHeader}>
          <View style={styles.connectIcon}>
            <Ionicons name="link-outline" size={20} color={colors.green} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.connectTitle}>Connect family accounts</Text>
            <Text style={styles.connectSub}>
              For family who use NexaCare on their own phone. Their watch data and records appear here once they approve.
            </Text>
          </View>
        </View>
        <View style={styles.connectButtons}>
          <Pressable style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]} onPress={openShare}>
            <Ionicons name="qr-code-outline" size={16} color={colors.green} />
            <Text style={styles.outlineText}>Share my health</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.solidButton, pressed && styles.pressed]} onPress={() => setEnterOpen(true)}>
            <Ionicons name="enter-outline" size={16} color="#FFFFFF" />
            <Text style={styles.solidText}>Enter a code</Text>
          </Pressable>
        </View>
        {linksError && (
          <View style={styles.errorRow}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{linksError}</Text>
          </View>
        )}
      </View>

      {pendingRequests.map((link) => (
        <View key={link.id} style={[styles.itemCard, styles.requestCard]}>
          <Text style={styles.itemTitle}>{link.person.name} wants to see your health data</Text>
          <Text style={styles.itemSub}>{link.person.email}</Text>
          {busyId === link.id ? (
            <ActivityIndicator style={styles.itemBusy} color={colors.primary} />
          ) : (
            <View style={styles.itemButtons}>
              <Pressable style={({ pressed }) => [styles.smallSolid, pressed && styles.pressed]} onPress={() => approve(link, 'view')}>
                <Text style={styles.smallSolidText}>Allow view</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.smallOutline, pressed && styles.pressed]} onPress={() => approve(link, 'edit')}>
                <Text style={styles.smallOutlineText}>View & edit</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.smallGhost, pressed && styles.pressed]}
                onPress={() => run(link, () => removeLink(link.id))}
              >
                <Text style={styles.smallGhostText}>Decline</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      {waiting.map((link) => (
        <View key={link.id} style={styles.itemCard}>
          <View style={styles.itemRow}>
            <Ionicons name="time-outline" size={18} color={colors.badge.orangeIcon} />
            <Text style={[styles.itemTitle, styles.flex]}>Waiting for {link.person.name} to approve</Text>
            <Pressable
              onPress={() => confirmRemove(link, 'Cancel request?', `Your request to ${link.person.name} will be withdrawn.`, 'Cancel request')}
              hitSlop={8}
              disabled={busyId === link.id}
            >
              <Text style={styles.smallGhostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {sharingWith.length > 0 && <Text style={styles.sectionLabel}>Who can see your health</Text>}
      {sharingWith.map((link) => (
        <View key={link.id} style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={styles.flex}>
              <Text style={styles.itemTitle}>{link.person.name}</Text>
              <Text style={styles.itemSub}>{LINK_ACCESS_LABELS[link.access]}</Text>
            </View>
            {busyId === link.id && <ActivityIndicator color={colors.primary} />}
          </View>
          <View style={styles.itemButtons}>
            <Pressable
              style={({ pressed }) => [styles.smallOutline, pressed && styles.pressed]}
              onPress={() => run(link, () => changeLinkAccess(link.id, link.access === 'edit' ? 'view' : 'edit'))}
              disabled={busyId === link.id}
            >
              <Text style={styles.smallOutlineText}>{link.access === 'edit' ? 'Make view only' : 'Allow editing'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.smallGhost, pressed && styles.pressed]}
              onPress={() =>
                confirmRemove(link, `Stop sharing with ${link.person.name}?`, 'They will no longer see your health data.', 'Stop sharing')
              }
              disabled={busyId === link.id}
            >
              <Text style={styles.smallGhostText}>Stop sharing</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Sheet visible={shareOpen} onClose={() => setShareOpen(false)}>
        <Text style={styles.sheetTitle}>Share your health</Text>
        <Text style={styles.sheetSub}>
          Give this code to a family member. They enter it in NexaCare → Family → Enter a code. You choose what they can do
          when you approve.
        </Text>
        {codeLoading || !code ? (
          <ActivityIndicator style={styles.codeLoader} color={colors.primary} />
        ) : (
          <>
            <View style={styles.codeBox}>
              <Text style={styles.codeText} selectable>
                {code.code}
              </Text>
              <Text style={styles.codeExpiry}>Valid for 24 hours · only one code works at a time</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              onPress={() =>
                Share.share({ message: `Connect with me on NexaCare: open Family → Enter a code and type ${code.code}` })
              }
            >
              <Text style={typography.button}>Send code</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>
          </>
        )}
      </Sheet>

      <Sheet visible={enterOpen} onClose={() => setEnterOpen(false)}>
        <Text style={styles.sheetTitle}>Enter a code</Text>
        <Text style={styles.sheetSub}>
          Ask your family member to tap “Share my health” on their phone and read you the code.
        </Text>
        <TextInput
          style={styles.codeInput}
          value={entered}
          onChangeText={setEntered}
          placeholder="NX-XXXXXX"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          autoFocus
        />
        <Pressable
          style={({ pressed }) => [styles.cta, (!entered.trim() || sending) && styles.ctaDisabled, pressed && styles.pressed]}
          onPress={sendCode}
          disabled={!entered.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={typography.button}>Send request</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  wrap: { gap: spacing.md, marginTop: spacing.lg },

  connectCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  connectHeader: { flexDirection: 'row', gap: spacing.md },
  connectIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blobLight, alignItems: 'center', justifyContent: 'center' },
  connectTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  connectSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  connectButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  outlineButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.green,
  },
  outlineText: { fontSize: 13, fontWeight: '700', color: colors.green },
  solidButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 999, backgroundColor: colors.green,
  },
  solidText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  errorText: { flex: 1, fontSize: 12, color: colors.danger },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xs },
  itemCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  requestCard: { borderColor: colors.green, backgroundColor: colors.blobLight },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  itemSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  itemBusy: { marginTop: spacing.md },
  itemButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  smallSolid: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.green },
  smallSolidText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  smallOutline: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.green, backgroundColor: colors.surface },
  smallOutlineText: { fontSize: 13, fontWeight: '700', color: colors.green },
  smallGhost: { paddingHorizontal: spacing.md, paddingVertical: 8 },
  smallGhostText: { fontSize: 13, fontWeight: '700', color: colors.danger },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  sheetSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 19 },
  codeLoader: { marginVertical: spacing.xl },
  codeBox: {
    alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.lg,
    borderRadius: 16, borderWidth: 1, borderColor: colors.green, backgroundColor: colors.blobLight,
  },
  codeText: { fontSize: 32, fontWeight: '800', letterSpacing: 4, color: colors.primaryDark },
  codeExpiry: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  codeInput: {
    marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md,
    paddingVertical: 14, fontSize: 22, fontWeight: '800', letterSpacing: 3, textAlign: 'center', color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.lg, minHeight: 56,
  },
  ctaDisabled: { opacity: 0.5 },
});
