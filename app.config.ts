import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Parlora AI',
  slug: 'parlora-ai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0D0D14',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0D0D14',
    },
    package: 'com.parloraai.app',
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.INTERNET',
    ],
    googleServicesFile: './google-services.json',
  },
  ios: {
    bundleIdentifier: 'com.parloraai.app',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Parlora AI necesita el micrófono para capturar tu voz y traducirla en tiempo real.',
      NSSpeechRecognitionUsageDescription:
        'Parlora AI usa reconocimiento de voz para transcribir lo que dices.',
      NSBluetoothAlwaysUsageDescription:
        'Parlora AI conecta con tus auriculares para enrutar el audio de traducción.',
    },
    googleServicesFile: './GoogleService-Info.plist',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-av',
      { microphonePermission: 'Permitir acceso al micrófono para traducción en tiempo real.' },
    ],
  ],
  extra: {
    DEEPL_PROXY_URL: 'https://parlora-backend.up.railway.app',
    GOOGLE_WEB_CLIENT_ID: '1085428374188-uunn9cgkk2t9oai9u0b5buuuqcdkvhbr.apps.googleusercontent.com',
    GOOGLE_ANDROID_CLIENT_ID: '1085428374188-uunn9cgkk2t9oai9u0b5buuuqcdkvhbr.apps.googleusercontent.com',
  },
});