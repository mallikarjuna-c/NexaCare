import { View, Text, StyleSheet } from 'react-native';
import { initialsOf } from '../types/family';
import { colors } from '../theme/theme';

const TINTS = [
  { bg: colors.green, fg: '#FFFFFF' },
  { bg: colors.badge.blueBg, fg: colors.badge.blueIcon },
  { bg: colors.badge.orangeBg, fg: colors.badge.orangeIcon },
  { bg: colors.badge.purpleBg, fg: colors.badge.purpleIcon },
  { bg: colors.badge.greenBg, fg: colors.badge.greenIcon },
];

export default function ProfileAvatar({ name, index, size = 40 }: { name: string; index: number; size?: number }) {
  const tint = index === 0 ? TINTS[0] : TINTS[1 + ((index - 1) % (TINTS.length - 1))];
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint.bg }]}>
      <Text style={[styles.text, { color: tint.fg, fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '800' },
});
