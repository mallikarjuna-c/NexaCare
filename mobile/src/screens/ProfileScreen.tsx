import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabs';
import { useAuth } from '../context/AuthContext';
import LeafAccent from '../components/LeafAccent';
import { colors, typography, spacing } from '../theme/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  // Screens like Share Health Data live in the Home tab's stack; initial:false keeps Home underneath for Back.
  const openInHome = (screen: 'ShareHealthData' | 'Emergency') =>
    navigation.navigate('HomeTab', { screen, initial: false });
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const handleLogout = () => {
    Alert.alert('Log out?', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.leafWrap, styles.leafTopLeft]}>
        <LeafAccent size={150} color={colors.green} rotation={-15} opacity={0.14} />
      </View>
      <View style={[styles.leafWrap, styles.leafBottomRight]}>
        <LeafAccent size={190} color={colors.blueLight} rotation={165} opacity={0.12} />
      </View>

      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <Text style={[typography.display, styles.name]}>{user?.name}</Text>
        <Text style={[typography.body, styles.email]}>{user?.email}</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.infoText}>{user?.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.infoText}>NexaCare Member</Text>
          </View>
        </View>

        <View style={[styles.infoCard, styles.actionsCard]}>
          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.logoutPressed]}
            onPress={() => openInHome('ShareHealthData')}
          >
            <Ionicons name="share-outline" size={20} color={colors.green} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Share health data</Text>
              <Text style={styles.actionSub}>Send a PDF summary to your doctor</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.logoutPressed]}
            onPress={() => openInHome('Emergency')}
          >
            <Ionicons name="medkit-outline" size={20} color={colors.danger} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Medical ID & emergency contacts</Text>
              <Text style={styles.actionSub}>Keep your SOS information up to date</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutPressed]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, position: 'relative', overflow: 'hidden' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl },

  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#FFFFFF' },

  name: { textAlign: 'center' },
  email: { textAlign: 'center', marginTop: 2, marginBottom: spacing.xl },

  infoCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  infoText: { fontSize: 14, color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.border },
  actionsCard: { marginTop: spacing.md, paddingVertical: spacing.xs },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  actionTextWrap: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  actionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 30,
    paddingVertical: 14,
    width: '100%',
    marginTop: spacing.xl,
  },
  logoutPressed: { opacity: 0.7 },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.danger },

  leafWrap: { position: 'absolute' },
  leafTopLeft: { top: -30, left: -40 },
  leafBottomRight: { bottom: -40, right: -50 },
});