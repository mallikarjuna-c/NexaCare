import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import LeafAccent from '../components/LeafAccent';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<MainStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <View style={styles.screen}>
      <View style={[styles.leafWrap, styles.leafTopLeft]}>
        <LeafAccent size={150} color={colors.green} rotation={-15} opacity={0.14} />
      </View>
      <View style={[styles.leafWrap, styles.leafBottomRight]}>
        <LeafAccent size={190} color={colors.blueLight} rotation={165} opacity={0.12} />
      </View>

      <View style={styles.content}>
        <Text style={styles.greetingLabel}>Welcome back,</Text>
        <Text style={[typography.display, styles.greetingName]}>
          {firstName} <Text style={{ color: colors.green }}>👋</Text>
        </Text>
        <Text style={[typography.body, styles.subtitle]}>
          Here's a quick look at your NexaCare space.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="person-circle-outline" size={28} color={colors.blue} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>Your Profile</Text>
            <Text style={styles.cardSubtitle}>View your account details</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.placeholderCard}>
          <Ionicons name="construct-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.placeholderText}>
            Health camps, challenges, and more are coming soon.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, position: 'relative', overflow: 'hidden' },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },

  greetingLabel: { fontSize: 15, color: colors.textSecondary },
  greetingName: { textAlign: 'left', marginTop: 2 },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.xl },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.badge.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  placeholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  placeholderText: { flex: 1, fontSize: 13, color: colors.textSecondary },

  leafWrap: { position: 'absolute' },
  leafTopLeft: { top: -30, left: -40 },
  leafBottomRight: { bottom: -40, right: -50 },
});