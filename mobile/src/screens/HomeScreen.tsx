import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import LeafAccent from '../components/LeafAccent';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const initials = user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?';

  const goToProfile = () => navigation.getParent()?.navigate('Profile' as never);
  const goToComingSoon = (title: string, icon: keyof typeof Ionicons.glyphMap) =>
    navigation.navigate('ComingSoon', { title, icon });

  return (
    <View style={styles.screen}>
      <View style={[styles.leafWrap, styles.leafTopLeft]}>
        <LeafAccent size={150} color={colors.green} rotation={-15} opacity={0.14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingLabel}>Hello, {firstName} 👋</Text>
            <Text style={styles.greetingSubtitle}>How can we help you today?</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.iconButton}
              onPress={() => goToComingSoon('Notifications', 'notifications-outline')}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
            </Pressable>
            <Pressable style={styles.avatarButton} onPress={goToProfile}>
              <Text style={styles.avatarText}>{initials}</Text>
            </Pressable>
          </View>
        </View>

                <View style={styles.promoRow}>
          <Pressable
            style={({ pressed }) => [styles.promoCard, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('HealthRecords')}
          >
            <View style={[styles.promoIcon, { backgroundColor: colors.badge.greenBg }]}>
              <Ionicons name="document-text-outline" size={22} color={colors.badge.greenIcon} />
            </View>
            <Text style={styles.promoTitle}>Health Records</Text>
            <Text style={styles.promoSubtitle}>Track your vitals & documents</Text>
            <Text style={styles.promoLink}>View Records →</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.promoCard, pressed && styles.cardPressed]}
            onPress={() => goToComingSoon('Challenges', 'walk-outline')}
          >
            <View style={[styles.promoIcon, { backgroundColor: colors.badge.orangeBg }]}>
              <Ionicons name="walk-outline" size={22} color={colors.badge.orangeIcon} />
            </View>
            <Text style={styles.promoTitle}>Challenges</Text>
            <Text style={styles.promoSubtitle}>Join fitness challenges</Text>
            <Text style={styles.promoLink}>Join Now →</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.cardPressed]}
          onPress={() => goToComingSoon('Healthcare Directory', 'location-outline')}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.badge.blueBg }]}>
            <Ionicons name="location-outline" size={22} color={colors.badge.blueIcon} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Healthcare Directory</Text>
            <Text style={styles.rowSubtitle}>Find nearby hospitals, clinics & pharmacies</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.row, styles.rowDanger, pressed && styles.cardPressed]}
          onPress={() => goToComingSoon('Emergency Assistance', 'alert-circle-outline')}
        >
          <View style={[styles.rowIcon, { backgroundColor: '#FCE1E1' }]}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Emergency Assistance</Text>
            <Text style={styles.rowSubtitle}>Request immediate emergency help</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.summaryHeaderRow}>
          <Text style={styles.sectionLabel}>Wellness Summary</Text>
          <Pressable onPress={() => navigation.navigate('HealthRecords')}>
            <Text style={styles.viewAllLink}>View All →</Text>
          </Pressable>
        </View>
        <View style={styles.summaryCard}>
          <Ionicons name="pulse-outline" size={20} color={colors.blue} />
          <Text style={styles.summaryPlaceholder}>
            Your heart-rate and wellness trends will appear here once Wellness Scan is set up.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, position: 'relative', overflow: 'hidden' },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  greetingLabel: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  greetingSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  promoRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  promoCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  promoIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  promoTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  promoSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm },
  promoLink: { fontSize: 12, fontWeight: '700', color: colors.green },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  rowDanger: { borderColor: '#F3C6C6' },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardPressed: { opacity: 0.7 },

  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  viewAllLink: { fontSize: 13, fontWeight: '700', color: colors.green },
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  summaryPlaceholder: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  leafWrap: { position: 'absolute' },
  leafTopLeft: { top: -30, left: -40 },
});