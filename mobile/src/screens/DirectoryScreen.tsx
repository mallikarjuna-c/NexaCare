import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import LeafAccent from '../components/LeafAccent';
import ProviderRow, { openExternal } from '../components/ProviderRow';
import { getProviders } from '../services/directoryService';
import { NEARBY_SEARCHES, PROVIDER_TYPE_LABELS, mapsSearchUrl, type Provider } from '../types/directory';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Directory'>;

const DANGER_TINT = '#FCE1E1';

export default function DirectoryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      setProviders(await getProviders(user.id));
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = query.trim().toLowerCase();
  const visible = q
    ? providers.filter((p) =>
        [p.name, p.specialty, p.address, PROVIDER_TYPE_LABELS[p.type]].some((field) => field?.toLowerCase().includes(q))
      )
    : providers;

  return (
    <View style={styles.screen}>
      <View style={[styles.leafWrap, styles.leafTopRight]} pointerEvents="none">
        <LeafAccent size={150} color={colors.green} rotation={70} opacity={0.08} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Find nearby</Text>
        <Text style={styles.sectionHint}>Opens Google Maps with live results around you.</Text>
        <View style={styles.nearbyGrid}>
          {NEARBY_SEARCHES.map((s) => (
            <Pressable
              key={s.key}
              style={({ pressed }) => [styles.nearbyTile, pressed && styles.pressed]}
              onPress={() => openExternal(mapsSearchUrl(s.query), "Your phone couldn't open Maps.")}
              accessibilityRole="button"
              accessibilityLabel={`Find ${s.label} near me in Maps`}
            >
              <View style={styles.nearbyIcon}>
                <Ionicons name={s.icon} size={20} color={colors.badge.blueIcon} />
              </View>
              <Text style={styles.nearbyLabel} numberOfLines={1}>{s.label}</Text>
              <Ionicons name="open-outline" size={13} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>

        <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
          <View style={styles.flexText}>
            <Text style={styles.sectionLabel}>My providers</Text>
            <Text style={styles.sectionHintTight}>Your doctors, clinics, labs & pharmacies</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate('AddProvider')}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <View style={[styles.stateIcon, { backgroundColor: DANGER_TINT }]}>
              <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
            </View>
            <Text style={styles.stateTitle}>Couldn't load your providers</Text>
            <Pressable
              style={({ pressed }) => [styles.pillButton, styles.stateButton, pressed && styles.pressed]}
              onPress={() => { setIsLoading(true); load(); }}
            >
              <Text style={styles.pillButtonText}>Try again</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : providers.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={[styles.stateIcon, { backgroundColor: colors.badge.greenBg }]}>
              <Ionicons name="people-outline" size={26} color={colors.badge.greenIcon} />
            </View>
            <Text style={styles.stateTitle}>No saved providers yet</Text>
            <Text style={styles.stateBody}>
              Save your doctor, nearest hospital or regular pharmacy to call them or get directions in one tap.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.pillButton, styles.stateButton, pressed && styles.pressed]}
              onPress={() => navigation.navigate('AddProvider')}
            >
              <Text style={styles.pillButtonText}>Add provider</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <>
            {providers.length > 3 && (
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search name, specialty or area"
                  placeholderTextColor={colors.textSecondary}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            )}

            {visible.length === 0 ? (
              <Text style={styles.noResults}>No providers match "{query.trim()}".</Text>
            ) : (
              <View style={styles.card}>
                {visible.map((p, i) => (
                  <View key={p.id}>
                    {i > 0 && <View style={styles.divider} />}
                    <ProviderRow provider={p} onPress={() => navigation.navigate('ProviderDetail', { providerId: p.id })} />
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, position: 'relative', overflow: 'hidden' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },
  loader: { marginTop: spacing.lg },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sectionHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  sectionHintTight: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sectionSpacing: { marginTop: spacing.xl },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },

  nearbyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nearbyTile: {
    width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
  },
  nearbyIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.badge.blueBg,
    alignItems: 'center', justifyContent: 'center',
  },
  nearbyLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary },

  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 20,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md,
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
  noResults: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },

  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 40 + spacing.md },

  emptyCard: {
    alignItems: 'center', padding: spacing.xl, backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  stateIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  stateTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  stateBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, lineHeight: 18 },
  pillButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999,
  },
  pillButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  stateButton: { marginTop: spacing.lg },

  leafWrap: { position: 'absolute' },
  leafTopRight: { top: -40, right: -50 },
});
