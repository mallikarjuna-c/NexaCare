import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FamilyStackParamList } from '../navigation/FamilyStack';
import { useFamily } from '../context/FamilyContext';
import ProfileAvatar from '../components/ProfileAvatar';
import FamilyConnect from '../components/FamilyConnect';
import { removeLink } from '../services/linksService';
import { profileSubtitle, type Profile } from '../types/family';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<FamilyStackParamList, 'FamilyMain'>;

export default function FamilyScreen({ navigation }: Props) {
  const { profiles, activeProfile, selectProfile, refreshFamily } = useFamily();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      await refreshFamily();
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [refreshFamily]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pullToRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const confirmDisconnect = (p: Profile) =>
    Alert.alert(`Disconnect from ${p.name}?`, 'You will no longer see their health data. They can share a new code later.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          if (!p.linkId) return;
          try {
            await removeLink(p.linkId);
            await refreshFamily();
          } catch (error) {
            Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Please try again.');
          }
        },
      },
    ]);

  const hasMembers = profiles.length > 1;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={pullToRefresh} colors={[colors.green]} />}
    >
      <Text style={styles.intro}>
        Keep health records, follow-ups, Medical ID and expenses for the people you care for. Switch between them any time.
      </Text>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : loadError ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Couldn’t load your family.</Text>
          <Pressable onPress={load} hitSlop={8}>
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {profiles.map((p, index) => {
            const active = p.id === activeProfile?.id;
            return (
              <View key={p.id} style={[styles.card, active && styles.cardActive]}>
                <View style={styles.cardTop}>
                  <ProfileAvatar name={p.name} index={index} size={48} />
                  <View style={styles.flex}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.meta}>{profileSubtitle(p)}</Text>
                  </View>
                  {active && (
                    <View style={styles.activeChip}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                      <Text style={styles.activeChipText}>Managing</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actions}>
                  {!active && (
                    <Pressable
                      style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && styles.pressed]}
                      onPress={() => selectProfile(p.id).catch(() => {})}
                    >
                      <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                      <Text style={styles.actionPrimaryText}>Switch to</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                    onPress={() => navigation.navigate('FamilyMedicalInfo', { profileId: p.id })}
                  >
                    <Ionicons name="medkit-outline" size={16} color={colors.danger} />
                    <Text style={styles.actionText}>Medical ID</Text>
                  </Pressable>
                  {p.kind === 'member' && (
                    <Pressable
                      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                      onPress={() => navigation.navigate('AddFamilyMember', { memberId: p.id })}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                      <Text style={styles.actionText}>Edit</Text>
                    </Pressable>
                  )}
                  {p.kind === 'linked' && (
                    <Pressable
                      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                      onPress={() => confirmDisconnect(p)}
                    >
                      <Ionicons name="unlink-outline" size={16} color={colors.danger} />
                      <Text style={styles.actionText}>Disconnect</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          {!hasMembers && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={30} color={colors.green} />
              </View>
              <Text style={styles.emptyTitle}>No family members yet</Text>
              <Text style={styles.emptyText}>Add a parent, partner or child to look after their health here too.</Text>
            </View>
          )}
        </View>
      )}

      {!isLoading && !loadError && <FamilyConnect />}

      <Text style={styles.ctaHint}>For family who don’t use NexaCare. Their data stays on this phone.</Text>
      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        onPress={() => navigation.navigate('AddFamilyMember')}
      >
        <Text style={typography.button}>Add family member</Text>
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.md },
  link: { fontSize: 13, fontWeight: '700', color: colors.green },
  pressed: { opacity: 0.7 },

  list: { gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cardActive: { borderColor: colors.green },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: 999, backgroundColor: colors.blobLight,
  },
  activeChipText: { fontSize: 11, fontWeight: '800', color: colors.green },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  actionPrimary: { backgroundColor: colors.green, borderColor: colors.green },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  actionPrimaryText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  empty: { alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blobLight,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.md },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 19 },

  ctaHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.sm, minHeight: 56,
  },
  ctaPressed: { opacity: 0.85 },
});
