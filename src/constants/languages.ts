import { Language } from '@/types';

export const LANGUAGES: Language[] = [
  { code: 'auto', name: 'Detección automática', flag: '🔍', deeplCode: '', googleCode: '' },
  { code: 'ES',   name: 'Español',    flag: '🇪🇸', deeplCode: 'ES',    googleCode: 'es' },
  { code: 'EN',   name: 'Inglés',     flag: '🇬🇧', deeplCode: 'EN-GB', googleCode: 'en' },
  { code: 'FR',   name: 'Francés',    flag: '🇫🇷', deeplCode: 'FR',    googleCode: 'fr' },
  { code: 'DE',   name: 'Alemán',     flag: '🇩🇪', deeplCode: 'DE',    googleCode: 'de' },
  { code: 'IT',   name: 'Italiano',   flag: '🇮🇹', deeplCode: 'IT',    googleCode: 'it' },
  { code: 'PT',   name: 'Portugués',  flag: '🇵🇹', deeplCode: 'PT-PT', googleCode: 'pt' },
  { code: 'ZH',   name: 'Chino',      flag: '🇨🇳', deeplCode: 'ZH',    googleCode: 'zh' },
  { code: 'JA',   name: 'Japonés',    flag: '🇯🇵', deeplCode: 'JA',    googleCode: 'ja' },
  { code: 'AR',   name: 'Árabe',      flag: '🇸🇦', deeplCode: 'AR',    googleCode: 'ar' },
];

export const LANGUAGE_MAP = new Map(LANGUAGES.map(l => [l.code, l]));

export function getLanguage(code: string): Language {
  return LANGUAGE_MAP.get(code as any) ?? LANGUAGES[0];
}

// Latencia objetivo y configuración del motor de audio
export const AUDIO_CONFIG = {
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
  SILENCE_THRESHOLD_MS: 800,   // ms de silencio para cortar frase
  STT_CONFIDENCE_THRESHOLD: 0.85, // enviar traducción con texto parcial si supera esto
  TRANSLATION_TIMEOUT_MS: 2000,
  MAX_CACHE_ENTRIES: 500,
  CACHE_TTL_MS: 72 * 60 * 60 * 1000, // 72 horas
} as const;

export const DEFAULT_EARBUD_PROFILE = {
  volume: 0.8,
  voiceSpeed: 1.0,
  noiseReduction: true,
  whisperMode: false,
  autoDetect: true,
  connectedDeviceId: null,
  batteryLevel: null,
} as const;
