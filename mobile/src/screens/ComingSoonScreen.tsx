import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LeafAccent from '../components/LeafAccent';
import { colors, typography, spacing } from '../theme/theme';

type Props = {
  route: { params: { title: string; icon: keyof typeof Ionicons.glyphMap } };
};

export default function ComingSoonScreen({ route }: Props) {
  const { title, icon } = route.params;

  return (
    <View style={styles.screen}>
      <View style={[styles.leafWrap, styles.leafBottomRight]}>
        <LeafAccent size={190} color={colors.blueLight} rotation={165} opacity={0.12} />
      </View>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={40} color={colors.blue} />
        </View>
        <Text style={[typography.heading, styles.title]}>{title}</Text>
        <Text style={[typography.body, styles.subtitle]}>
          This feature is being built in an upcoming module. Check back soon.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, position: 'relative', overflow: 'hidden' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.badge.blueBg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: spacing.sm },
  leafWrap: { position: 'absolute' },
  leafBottomRight: { bottom: -40, right: -50 },
});