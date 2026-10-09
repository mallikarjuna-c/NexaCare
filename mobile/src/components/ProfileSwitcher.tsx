import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFamily } from '../context/FamilyContext';
import ProfileAvatar from './ProfileAvatar';
import { profileSubtitle } from '../types/family';
import { colors, spacing } from '../theme/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onManage: () => void;
};

export default function ProfileSwitcher({ visible, onClose, onManage }: Props) {
  const { profiles, activeProfile, selectProfile } = useFamily();
  const insets = useSafeAreaInsets();

  const choose = (id: string) => {
    selectProfile(id).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Whose health are you managing?</Text>
        <Text style={styles.subtitle}>Records, follow-ups and expenses switch to the person you pick.</Text>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {profiles.map((p, index) => {
            const active = p.id === activeProfile?.id;
            return (
              <Pressable
                key={p.id}
                style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.pressed]}
                onPress={() => choose(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <ProfileAvatar name={p.name} index={index} size={42} />
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.meta}>{profileSubtitle(p)}</Text>
                </View>
                <Ionicons
                  name={active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={active ? colors.green : colors.border}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          style={({ pressed }) => [styles.manage, pressed && styles.pressed]}
          onPress={() => {
            onClose();
            onManage();
          }}
        >
          <Ionicons name="people-outline" size={18} color={colors.green} />
          <Text style={styles.manageText}>Manage family members</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.green} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: '75%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  list: { marginTop: spacing.md },
  listContent: { gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  rowActive: { borderColor: colors.green, backgroundColor: colors.blobLight },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  manage: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.md, paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.green,
  },
  manageText: { fontSize: 15, fontWeight: '700', color: colors.green },
});
