import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import LeafAccent from '../components/LeafAccent';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert('Missing info', 'Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(name, email, password);
      // AppNavigator switches to the Main stack automatically once `user` is set.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed.';
      Alert.alert('Signup failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.leafWrap, styles.leafTopLeft]}>
        <LeafAccent size={150} color={colors.green} rotation={-15} opacity={0.14} />
      </View>
      <View style={[styles.leafWrap, styles.leafBottomRight]}>
        <LeafAccent size={190} color={colors.blueLight} rotation={165} opacity={0.12} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={styles.flex} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Image
              source={require('../../assets/branding/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={[typography.display, styles.headline]}>
              Create <Text style={{ color: colors.green }}>Account</Text>
            </Text>
            <Text style={[typography.body, styles.subtitle]}>
              Join our community for a healthier tomorrow.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password (min 6 characters)"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={handleSignup}
                disabled={isSubmitting}
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, isSubmitting && styles.ctaDisabled]}
              >
                <Text style={typography.button}>{isSubmitting ? 'Creating account...' : 'Sign Up'}</Text>
                {!isSubmitting && <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />}
              </Pressable>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Pressable onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>Login</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, position: 'relative', overflow: 'hidden' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },

  logo: { width: 110, height: 55, alignSelf: 'center', marginBottom: spacing.lg },

  headline: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl },

  form: { gap: spacing.md },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  inputIcon: { marginRight: 2 },
  input: { flex: 1, fontSize: 15, color: colors.textPrimary },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.green,
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: spacing.sm,
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.6 },

  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { fontSize: 14, color: colors.textSecondary },
  footerLink: { fontSize: 14, fontWeight: '700', color: colors.green },

  leafWrap: { position: 'absolute' },
  leafTopLeft: { top: -30, left: -40 },
  leafBottomRight: { bottom: -40, right: -50 },
});