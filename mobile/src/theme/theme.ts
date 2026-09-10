export const colors = {
  primaryDark: '#0E3B36',
  primary: '#1F7A6C',
  accent: '#E98A4E',
  background: '#F6F8F7',
  surface: '#FFFFFF',
  textPrimary: '#12201D',
  textSecondary: '#5B6B67',
  border: '#DCE4E1',
  danger: '#C0392B',
  blue: '#007AFF',
  blueLight: '#66B3FF',
  blobLight: '#E6F5F3',
  green: '#1F7A6C',
  badge: {
    blueBg: '#E6F3FF',
    blueIcon: '#007AFF',
    greenBg: '#E6F5F3',
    greenIcon: '#1F7A6C',
    orangeBg: '#FFF2E6',
    orangeIcon: '#E98A4E',
    purpleBg: '#F3E6FF',
    purpleIcon: '#8B5CF6',
  },
};

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, color: colors.textPrimary },
  heading: { fontSize: 20, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.textSecondary },
  button: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};