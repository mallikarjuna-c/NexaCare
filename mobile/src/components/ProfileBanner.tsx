import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabs';
import { useFamily } from '../context/FamilyContext';
import ProfileAvatar from './ProfileAvatar';
import ProfileSwitcher from './ProfileSwitcher';
import { possessive } from '../types/family';
import { colors, spacing } from '../theme/theme';

type Props = {
  what: string;
  switchable?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function ProfileBanner({ what, switchable = true, style }: Props) {
  const { profiles, activeProfile } = useFamily();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [open, setOpen] = useState(false);

  if (!activeProfile || profiles.length < 2) return null;
  const index = profiles.findIndex((p) => p.id === activeProfile.id);
  const label = switchable ? `${possessive(activeProfile)} ${what}` : `For ${activeProfile.isSelf ? 'you' : activeProfile.name}`;

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.banner,
          !activeProfile.isSelf && styles.bannerMember,
          pressed && switchable && styles.pressed,
          style,
        ]}
        onPress={switchable ? () => setOpen(true) : undefined}
        disabled={!switchable}
        accessibilityRole={switchable ? 'button' : undefined}
        accessibilityLabel={switchable ? `${label}. Change person` : label}
      >
        <ProfileAvatar name={activeProfile.name} index={index} size={30} />
        <View style={styles.flex}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {!activeProfile.isSelf && <Text style={styles.meta}>{activeProfile.relationLabel}</Text>}
        </View>
        {switchable && (
          <View style={styles.change}>
            <Text style={styles.changeText}>Change</Text>
            <Ionicons name="chevron-down" size={14} color={colors.green} />
          </View>
        )}
      </Pressable>
      {switchable && (
        <ProfileSwitcher visible={open} onClose={() => setOpen(false)} onManage={() => navigation.navigate('Family', { screen: 'FamilyMain' })} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  bannerMember: { borderColor: colors.green, backgroundColor: colors.blobLight },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  changeText: { fontSize: 13, fontWeight: '700', color: colors.green },
});
