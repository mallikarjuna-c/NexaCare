import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const FEATURES = [
  { icon: 'heart-pulse', bg: colors.badge.blueBg, tint: colors.badge.blueIcon, label: 'Health\nInsights' },
  { icon: 'account-group', bg: colors.badge.greenBg, tint: colors.badge.greenIcon, label: 'Community\nCamps' },
  { icon: 'run', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon, label: 'Fitness\nChallenges' },
  { icon: 'stethoscope', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon, label: 'Healthcare\nSupport' },
] as const;

export default function WelcomeScreen({ navigation }: Props) {
  const goToLogin = () => navigation.navigate('Login');

  return (
    <View style={styles.screen}>
      <View style={[styles.blob, styles.blobTopLeft]} />
      <View style={[styles.blob, styles.blobTopRight]} />
      <View style={[styles.blob, styles.blobBottomLeft]} />
      <View style={[styles.blob, styles.blobBottomRight]} />

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image
          source={require('../../assets/branding/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={[typography.display, styles.headline]}>
          <Text style={{ color: colors.blue }}>Your Health,</Text>
          {'\n'}
          <Text style={{ color: colors.green }}>Our Community.</Text>
        </Text>

        <Text style={[typography.body, styles.subtitle]}>
          Simple tools to help you stay informed, active, and connected to better care.
        </Text>

        <View style={styles.heroCard}>
          <Image
            source={require('../../assets/branding/Img.png')}
            style={styles.heroImage}
          />
        </View>

        <View style={styles.featuresRow}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureItem}>
              <View style={[styles.featureCircle, { backgroundColor: f.bg }]}>
                <MaterialCommunityIcons name={f.icon} size={24} color={f.tint} />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={goToLogin} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={typography.button}>Get Started</Text>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.footerDivider} />
        <Text style={styles.footerCaption}>Together for a healthier tomorrow.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, position: 'relative', overflow: 'hidden' },
  scrollArea: { flex: 1, backgroundColor: 'transparent' },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    minHeight: '100%',
  },

  logo: {
    width: 120,
    height: 60,
    marginBottom: spacing.md,
    alignSelf: 'center',
  },

  headline: { textAlign: 'center', marginTop: spacing.sm },
  subtitle: { textAlign: 'center', marginTop: spacing.sm, lineHeight: 21, maxWidth: 320 },

  heroCard: {
    width: '100%',
    maxWidth: 350,
    marginTop: spacing.lg,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    alignSelf: 'center',
  },
  heroImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover' as const,
  },

  featuresRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: spacing.xl },
  featureItem: { alignItems: 'center', width: 76 },
  featureCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', marginTop: 6, lineHeight: 14 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.green,
    paddingVertical: 16,
    width: '100%',
    borderRadius: 30,
    marginTop: spacing.xl + spacing.md,
  },
  ctaPressed: { opacity: 0.85 },

  footerDivider: {
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.green,
    marginTop: spacing.lg,
    opacity: 0.5,
  },
  footerCaption: {
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '600',
    color: colors.green,
    letterSpacing: 0.2,
    marginTop: spacing.sm,
  },

  blob: { position: 'absolute', borderRadius: 999 },
  blobTopLeft: {
    width: 180, height: 180,
    top: -60, left: -60,
    backgroundColor: colors.blobLight,
  },
  blobTopRight: {
    width: 140, height: 140,
    top: -30, right: -50,
    backgroundColor: 'rgba(30, 99, 176, 0.08)',
  },
  blobBottomLeft: {
    width: 160, height: 160,
    bottom: -50, left: -60,
    backgroundColor: 'rgba(30, 99, 176, 0.07)',
  },
  blobBottomRight: {
    width: 200, height: 200,
    bottom: -70, right: -70,
    backgroundColor: colors.blobLight,
  },
});