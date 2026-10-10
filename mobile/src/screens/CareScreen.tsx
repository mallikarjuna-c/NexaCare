import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import ProfileBanner from '../components/ProfileBanner';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'CareMain'>;
type IconName = keyof typeof Ionicons.glyphMap;
type Destination =
  | 'HealthRecords' | 'Trends' | 'FollowUps' | 'Reminders' | 'Expenses' | 'Directory'
  | 'Challenges' | 'Emergency' | 'ShareHealthData' | 'Watch' | 'Community' | 'CreateHelpRequest';

type Item = { title: string; subtitle: string; icon: IconName; bg: string; tint: string; to: Destination };
type Section = { title: string; items: Item[] };

const DANGER_TINT = '#FCE1E1';

const SECTIONS: Section[] = [
  {
    title: 'Community',
    items: [
      { title: 'Blood & Help', subtitle: 'Requests near you & donors', icon: 'water-outline', bg: DANGER_TINT, tint: colors.danger, to: 'Community' },
      { title: 'Request Blood', subtitle: 'Alert matching donors now', icon: 'megaphone-outline', bg: DANGER_TINT, tint: colors.danger, to: 'CreateHelpRequest' },
    ],
  },
  {
    title: 'Health',
    items: [
      { title: 'Health Records', subtitle: 'Vitals, reports & prescriptions', icon: 'document-text-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon, to: 'HealthRecords' },
      { title: 'Health Trends', subtitle: 'Charts over 7 and 30 days', icon: 'trending-up-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon, to: 'Trends' },
      { title: 'Smartwatch', subtitle: 'Heart rate, SpO₂, sleep', icon: 'watch-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon, to: 'Watch' },
      { title: 'Share Data', subtitle: 'PDF summary for your doctor', icon: 'share-outline', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon, to: 'ShareHealthData' },
    ],
  },
  {
    title: 'Appointments',
    items: [
      { title: 'Follow-ups', subtitle: 'Appointments, tests & reviews', icon: 'calendar-outline', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon, to: 'FollowUps' },
      { title: 'Reminders', subtitle: 'Upcoming & daily check-ins', icon: 'alarm-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon, to: 'Reminders' },
    ],
  },
  {
    title: 'Costs & places',
    items: [
      { title: 'Medical Expenses', subtitle: 'Bills, medicines & claims', icon: 'wallet-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon, to: 'Expenses' },
      { title: 'Directory', subtitle: 'Doctors, clinics & pharmacies', icon: 'location-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon, to: 'Directory' },
    ],
  },
  {
    title: 'Wellbeing & safety',
    items: [
      { title: 'Challenges', subtitle: 'Steps, hydration & more', icon: 'walk-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon, to: 'Challenges' },
      { title: 'Emergency', subtitle: 'Contacts, Medical ID & helplines', icon: 'alert-circle-outline', bg: DANGER_TINT, tint: colors.danger, to: 'Emergency' },
    ],
  },
];

export default function CareScreen({ navigation }: Props) {
  const open = (to: Destination) => {
    if (to === 'Watch') navigation.getParent()?.navigate('Watch' as never);
    else navigation.navigate(to);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Care</Text>
      <Text style={styles.subtitle}>Everything for looking after your health, in one place.</Text>
      <ProfileBanner what="care" style={styles.banner} />

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionLabel}>{section.title}</Text>
          <View style={styles.grid}>
            {section.items.map((item) => (
              <Pressable
                key={item.to}
                style={({ pressed }) => [
                  styles.card,
                  item.to === 'Emergency' && styles.cardDanger,
                  pressed && styles.pressed,
                ]}
                onPress={() => open(item.to)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.subtitle}`}
              >
                <View style={[styles.icon, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={22} color={item.tint} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  pressed: { opacity: 0.7 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  banner: { marginBottom: spacing.md },

  section: { marginTop: spacing.md },
  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    width: '48.5%', backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 124,
  },
  cardDanger: { borderColor: '#F3C6C6' },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
});
