import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PROVIDER_BADGES } from './ProviderRow';
import { getProviders } from '../services/directoryService';
import { PROVIDER_TYPE_LABELS, type Provider } from '../types/directory';
import { colors, spacing } from '../theme/theme';

export type ProviderSelection = { providerId?: string; providerName: string };

type Props = {
  userId: string;
  value: ProviderSelection;
  onChange: (value: ProviderSelection) => void;
  onPick?: (provider: Provider) => void;
  placeholder: string;
};

export default function ProviderPicker({ userId, value, onChange, onPick, placeholder }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');

  const open = async () => {
    setIsOpen(true);
    setQuery('');
    setIsLoading(true);
    setLoadError(false);
    try {
      setProviders(await getProviders(userId));
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const choose = (provider: Provider) => {
    onChange({ providerId: provider.id, providerName: provider.name });
    onPick?.(provider);
    setIsOpen(false);
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? providers.filter((p) => [p.name, p.specialty, PROVIDER_TYPE_LABELS[p.type]].some((f) => f?.toLowerCase().includes(q)))
    : providers;

  return (
    <>
      <View style={[styles.inputRow, value.providerId && styles.inputRowLinked]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value.providerName}
          onChangeText={(text) => onChange({ providerId: undefined, providerName: text })}
        />
        <Pressable
          style={({ pressed }) => [styles.pickButton, pressed && styles.pressed]}
          onPress={open}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Choose from your saved providers"
        >
          <Ionicons name="people-outline" size={18} color={colors.green} />
        </Pressable>
      </View>
      {value.providerId ? (
        <View style={styles.linkedRow}>
          <Ionicons name="link-outline" size={13} color={colors.green} />
          <Text style={styles.linkedText}>Linked to your directory — call & directions available</Text>
          <Pressable onPress={() => onChange({ providerId: undefined, providerName: value.providerName })} hitSlop={8}>
            <Text style={styles.unlinkText}>Unlink</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.hintText}>Tap the people icon to pick from your saved providers.</Text>
      )}

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose provider</Text>
            <Pressable onPress={() => setIsOpen(false)} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          {providers.length > 5 && (
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search your providers"
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
            </View>
          )}

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {isLoading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : loadError ? (
              <Text style={styles.emptyText}>Couldn't load your providers. Close and try again.</Text>
            ) : providers.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="people-outline" size={28} color={colors.textSecondary} />
                <Text style={styles.emptyText}>
                  No saved providers yet. Add your doctors, labs and pharmacies in Healthcare Directory, or just type
                  the name.
                </Text>
              </View>
            ) : visible.length === 0 ? (
              <Text style={styles.emptyText}>No providers match "{query.trim()}".</Text>
            ) : (
              <View style={styles.card}>
                {visible.map((p, i) => {
                  const badge = PROVIDER_BADGES[p.type];
                  const selected = p.id === value.providerId;
                  return (
                    <View key={p.id}>
                      {i > 0 && <View style={styles.divider} />}
                      <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => choose(p)}>
                        <View style={[styles.iconBadge, { backgroundColor: badge.bg }]}>
                          <Ionicons name={badge.icon} size={18} color={badge.tint} />
                        </View>
                        <View style={styles.flexText}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.rowSubtitle} numberOfLines={1}>
                            {p.specialty ? `${p.specialty} · ${PROVIDER_TYPE_LABELS[p.type]}` : PROVIDER_TYPE_LABELS[p.type]}
                          </Text>
                        </View>
                        {selected ? (
                          <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                        ) : p.isFavorite ? (
                          <Ionicons name="star" size={14} color={colors.accent} />
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  flexText: { flex: 1 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface,
    paddingLeft: spacing.md, paddingRight: spacing.xs,
  },
  inputRowLinked: { borderColor: colors.green },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.textPrimary },
  pickButton: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.badge.greenBg,
    alignItems: 'center', justifyContent: 'center',
  },
  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  linkedText: { flex: 1, fontSize: 12, color: colors.green },
  unlinkText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  hintText: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },

  modalScreen: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  modalContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  loader: { marginTop: spacing.xl },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },

  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 38 + spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  iconBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  emptyWrap: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, marginTop: spacing.md },
});
