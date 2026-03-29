/**
 * authService.ts
 *
 * Gestiona el ciclo completo de autenticación con Google Sign-In:
 * - signInWithGoogle(): abre el flujo OAuth 2.0 con PKCE
 * - restoreSession(): intenta recuperar sesión silenciosamente al arrancar
 * - signOut(): limpia tokens y sesión
 *
 * El token de Firebase se guarda en expo-secure-store
 * (Keychain en iOS, EncryptedSharedPreferences en Android).
 */

import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { UserProfile } from '@/types';

WebBrowser.maybeCompleteAuthSession();

const SECURE_KEYS = {
  AUTH_TOKEN: 'parlora_ai_auth_token',
  USER_PROFILE: 'parlora_ai_user_profile',
} as const;

// Configurar el SDK de Google al importar el módulo
GoogleSignin.configure({
  webClientId: Constants.expoConfig?.extra?.GOOGLE_WEB_CLIENT_ID as string,
  androidClientId: Constants.expoConfig?.extra?.GOOGLE_ANDROID_CLIENT_ID as string,
  scopes: ['openid', 'profile', 'email'],
});

// ─── Sign in ─────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<UserProfile> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const userInfo = await GoogleSignin.signIn();

  if (!userInfo.data) {
    throw new Error('GOOGLE_SIGN_IN_CANCELLED');
  }

  const { idToken } = await GoogleSignin.getTokens();
  if (!idToken) throw new Error('NO_ID_TOKEN');

  // Enviar idToken al backend para obtener nuestro propio JWT
  const proxyUrl = Constants.expoConfig?.extra?.DEEPL_PROXY_URL as string;
  const response = await fetch(`${proxyUrl}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) throw new Error('BACKEND_AUTH_FAILED');

  const { token } = await response.json() as { token: string };

  const profile: UserProfile = {
    uid: userInfo.data.user.id,
    email: userInfo.data.user.email,
    displayName: userInfo.data.user.name ?? userInfo.data.user.email,
    photoURL: userInfo.data.user.photo ?? null,
    authProvider: 'google',
  };

  // Guardar en almacenamiento seguro
  await SecureStore.setItemAsync(SECURE_KEYS.AUTH_TOKEN, token);
  await SecureStore.setItemAsync(SECURE_KEYS.USER_PROFILE, JSON.stringify(profile));

  return profile;
}

// ─── Restaurar sesión ─────────────────────────────────────────────

export async function restoreSession(): Promise<{
  profile: UserProfile;
  token: string;
} | null> {
  try {
    const token = await SecureStore.getItemAsync(SECURE_KEYS.AUTH_TOKEN);
    const profileJson = await SecureStore.getItemAsync(SECURE_KEYS.USER_PROFILE);

    if (!token || !profileJson) return null;

    // Verificar que el token sigue siendo válido
    const proxyUrl = Constants.expoConfig?.extra?.DEEPL_PROXY_URL as string;
    const response = await fetch(`${proxyUrl}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      // Token expirado → intentar renovar silenciosamente
      return await renewSession(token);
    }

    return { profile: JSON.parse(profileJson) as UserProfile, token };
  } catch {
    return null;
  }
}

async function renewSession(expiredToken: string): Promise<{
  profile: UserProfile;
  token: string;
} | null> {
  try {
    // El SDK de Google renueva el accessToken silenciosamente
    await GoogleSignin.signInSilently();
    const { idToken } = await GoogleSignin.getTokens();
    if (!idToken) return null;

    const proxyUrl = Constants.expoConfig?.extra?.DEEPL_PROXY_URL as string;
    const response = await fetch(`${proxyUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) return null;

    const { token } = await response.json() as { token: string };
    await SecureStore.setItemAsync(SECURE_KEYS.AUTH_TOKEN, token);

    const profileJson = await SecureStore.getItemAsync(SECURE_KEYS.USER_PROFILE);
    if (!profileJson) return null;

    return { profile: JSON.parse(profileJson) as UserProfile, token };
  } catch {
    return null;
  }
}

// ─── Sign out ─────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await Promise.allSettled([
    GoogleSignin.signOut(),
    SecureStore.deleteItemAsync(SECURE_KEYS.AUTH_TOKEN),
    SecureStore.deleteItemAsync(SECURE_KEYS.USER_PROFILE),
  ]);
}

// ─── Obtener token actual ─────────────────────────────────────────

export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_KEYS.AUTH_TOKEN);
}
