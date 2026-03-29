/**
 * useTTS hook
 *
 * Sintetiza voz y la envía al auricular correspondiente.
 * Expo Speech usa el motor TTS nativo del SO (gratuito).
 */

import { useCallback } from 'react';
import * as Speech from 'expo-speech';
import { EarbudProfile, LanguageCode } from '@/types';

// Mapeo de nuestros códigos al locale de Speech
const TTS_LOCALE: Record<string, string> = {
  ES: 'es-ES',
  EN: 'en-US',
  FR: 'fr-FR',
  DE: 'de-DE',
  IT: 'it-IT',
  PT: 'pt-PT',
  ZH: 'zh-CN',
  JA: 'ja-JP',
  AR: 'ar-SA',
};

export function useTTS() {
  const speak = useCallback(
    async (text: string, targetLang: LanguageCode, profile: EarbudProfile) => {
      if (!text.trim()) return;

      // Parar cualquier habla anterior del mismo canal
      Speech.stop();

      const locale = TTS_LOCALE[targetLang] ?? 'es-ES';

      Speech.speak(text, {
        language: locale,
        rate: profile.voiceSpeed,
        pitch: 1.0,
        volume: profile.whisperMode ? Math.min(profile.volume, 0.4) : profile.volume,
        onError: (error) => {
          console.warn('[TTS] Error:', error);
        },
      });
    },
    [],
  );

  const stop = useCallback(() => {
    Speech.stop();
  }, []);

  return { speak, stop };
}
