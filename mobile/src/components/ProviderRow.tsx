import { View, Text, StyleSheet, Pressable, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PROVIDER_TYPE_LABELS, dialUrl, providerMapsUrl, type Provider, type ProviderType,
} from '../types/directory';
import { colors, spacing } from '../theme/theme';

export const PROVIDER_BADGES: Record<ProviderType, { icon: keyof typeof Ionicons.glyphMap; bg: string; tint: string }> = {
  hospital: { icon: 'business-outline', bg: '#FCE1E1', tint: colors.danger },
  clinic: { icon: 'medical-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon },
  doctor: { icon: 'person-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon },
  pharmacy: { icon: 'medkit-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon },
  lab: { icon: 'flask-outline', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon },
  other: { icon: 'location-outline', bg: colors.background, tint: colors.textSecondary },
};

export async function openExternal(url: string, failureMessage: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open', failureMessage);
  }
}

type Props = { provider: Provider; onPress: () => void };

export default function ProviderRow({ provider, onPress }: Props) {
  const badge = PROVIDER_BADGES[provider.type];
  const mapsUrl = providerMapsUrl(provider);
  const subtitle = provider.specialty ? `${provider.specialty} · ${PROVIDER_TYPE_LABELS[provider.type]}` : PROVIDER_TYPE_LABELS[provider.type];

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
      <View style={[styles.iconBadge, { backgroundColor: badge.bg }]}>
        <Ionicons name={badge.icon} size={20} color={badge.tint} />
      </View>

      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{provider.name}</Text>
          {provider.isFavorite && <Ionicons name="star" size={13} color={colors.accent} />}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        {provider.address ? <Text style={styles.address} numberOfLines={1}>{provider.address}</Text> : null}
      </View>

      <View style={styles.actions}>
        {provider.phone && (
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            onPress={(e) => {
              e.stopPropagation();
              openExternal(dialUrl(provider.phone!), "Your phone couldn't open the dialer.");
            }}
            hitSlop={6}
            accessibilityLabel={`Call ${provider.name}`}
          >
            <Ionicons name="call-outline" size={17} color={colors.green} />
          </Pressable>
        )}
        {mapsUrl && (
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            onPress={(e) => {
              e.stopPropagation();
              openExternal(mapsUrl, "Your phone couldn't open Maps.");
            }}
            hitSlop={6}
            accessibilityLabel={`Directions to ${provider.name}`}
          >
            <Ionicons name="navigate-outline" size={17} color={colors.blue} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  pressed: { opacity: 0.7 },
  iconBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  address: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
});
