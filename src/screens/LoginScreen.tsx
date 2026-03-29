import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
} from 'react-native';
import { signInWithGoogle } from '@/services/authService';
import { useStore } from '@/store';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const setUser = useStore(s => s.setUser);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const profile = await signInWithGoogle();
      // El token se recupera del SecureStore en authService
      // Aquí simplemente actualizamos el estado global
      const { getAuthToken } = await import('@/services/authService');
      const token = await getAuthToken();
      setUser(profile, token);
    } catch (err) {
      const error = err as Error;
      if (error.message !== 'GOOGLE_SIGN_IN_CANCELLED') {
        Alert.alert(
          'Error al iniciar sesión',
          'No se pudo conectar con Google. Comprueba tu conexión e inténtalo de nuevo.',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>🌐</Text>
        </View>
        <Text style={styles.appName}>Parlora AI</Text>
        <Text style={styles.tagline}>
          Traducción simultánea{'\n'}para conversaciones reales
        </Text>

        <View style={styles.buttonsWrap}>

          {/* Google Sign-In */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#1A1A2E" size="small" />
            ) : (
              <>
                <GoogleLogo />
                <Text style={styles.googleBtnText}>Continuar con Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email (placeholder, implementar en v1.2) */}
          <TouchableOpacity
            style={styles.emailBtn}
            onPress={() => Alert.alert('Próximamente', 'Login con email disponible en la próxima versión.')}
            activeOpacity={0.7}
          >
            <Text style={styles.emailBtnText}>Usar correo electrónico</Text>
          </TouchableOpacity>

        </View>

        <Text style={styles.terms}>
          Al continuar aceptas los{' '}
          <Text style={styles.termsLink}>Términos de servicio</Text>
          {' '}y la{' '}
          <Text style={styles.termsLink}>Política de privacidad</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

function GoogleLogo() {
  return (
    <View style={styles.googleLogo}>
      {/* G de Google en SVG simplificado con View */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#4285F4' }}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0D0D14',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(99,102,241,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 52,
  },
  buttonsWrap: {
    width: '100%',
    gap: 12,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  googleLogo: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
  },
  emailBtn: {
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emailBtnText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  terms: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 32,
  },
  termsLink: {
    color: 'rgba(99,102,241,0.7)',
  },
});
