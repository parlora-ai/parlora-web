// ─── Idiomas ────────────────────────────────────────────────────
export type LanguageCode =
  | 'auto'
  | 'ES'
  | 'EN'
  | 'FR'
  | 'DE'
  | 'IT'
  | 'PT'
  | 'ZH'
  | 'JA'
  | 'AR';

export interface Language {
  code: LanguageCode;
  name: string;
  flag: string;
  deeplCode: string;   // código que usa DeepL (puede diferir, ej. EN-GB)
  googleCode: string;  // código que usa Google Cloud Translation
}

// ─── Auricular ──────────────────────────────────────────────────
export type EarbudSide = 'A' | 'B';

export interface EarbudProfile {
  side: EarbudSide;
  inputLang: LanguageCode;   // idioma que habla el portador
  outputLang: LanguageCode;  // idioma en que escucha la traducción
  volume: number;            // 0.0 – 1.0
  voiceSpeed: number;        // 0.5 (lenta) – 1.5 (rápida), 1.0 = normal
  noiseReduction: boolean;
  whisperMode: boolean;      // volumen reducido para entornos tranquilos
  autoDetect: boolean;       // detectar idioma automáticamente
  connectedDeviceId: string | null;  // ID del dispositivo BLE
  batteryLevel: number | null;       // 0–100 o null si desconocido
}

// ─── Sesión de traducción ────────────────────────────────────────
export type SessionStatus = 'idle' | 'active' | 'paused' | 'error';

export interface TranscriptLine {
  id: string;
  speaker: EarbudSide;
  originalText: string;
  translatedText: string;
  detectedLang: LanguageCode;
  timestamp: number;
}

export interface Session {
  id: string;
  userId: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  langPairA: { input: LanguageCode; output: LanguageCode };
  langPairB: { input: LanguageCode; output: LanguageCode };
  phraseCount: number;
  transcript: TranscriptLine[];
}

// ─── Usuario ─────────────────────────────────────────────────────
export type AuthProvider = 'google' | 'apple' | 'email';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  authProvider: AuthProvider;
}

// ─── Traducción ──────────────────────────────────────────────────
export type TranslationEngine = 'deepl' | 'google' | 'cache' | 'offline';

export interface TranslationResult {
  translatedText: string;
  engine: TranslationEngine;
  latencyMs: number;
  detectedSourceLang?: LanguageCode;
}

// ─── BLE ─────────────────────────────────────────────────────────
export interface BleDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  batteryLevel: number | null;
  isConnected: boolean;
}
