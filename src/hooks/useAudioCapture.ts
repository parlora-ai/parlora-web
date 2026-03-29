/**
 * useAudioCapture hook
 *
 * Gestiona el reconocimiento de voz en tiempo real para un speaker (A o B).
 * Usa react-native-voice para STT (motor nativo del SO).
 * Dispara onPartialResult con texto parcial y onFinalResult al detectar silencio.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import Voice, {
  SpeechResultsEvent,
  SpeechPartialResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import { LanguageCode } from '@/types';
import { AUDIO_CONFIG } from '@/constants/languages';

// Mapeo de nuestros códigos al locale que espera Voice
const VOICE_LOCALE: Record<string, string> = {
  ES: 'es-ES',
  EN: 'en-US',
  FR: 'fr-FR',
  DE: 'de-DE',
  IT: 'it-IT',
  PT: 'pt-PT',
  ZH: 'zh-CN',
  JA: 'ja-JP',
  AR: 'ar-SA',
  auto: 'es-ES', // fallback mientras detectamos
};

interface UseAudioCaptureOptions {
  speaker: 'A' | 'B';
  inputLang: LanguageCode;
  enabled: boolean;
  onPartialResult: (text: string, confidence: number) => void;
  onFinalResult: (text: string) => void;
  onError?: (error: string) => void;
}

export function useAudioCapture({
  speaker,
  inputLang,
  enabled,
  onPartialResult,
  onFinalResult,
  onError,
}: UseAudioCaptureOptions) {
  const [isListening, setIsListening] = useState(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPartialRef = useRef<string>('');
  const isActiveRef = useRef(false);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(
    (text: string) => {
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        // 800ms de silencio → frase completa
        if (text.trim()) {
          onFinalResult(text.trim());
          lastPartialRef.current = '';
        }
      }, AUDIO_CONFIG.SILENCE_THRESHOLD_MS);
    },
    [clearSilenceTimer, onFinalResult],
  );

  const startListening = useCallback(async () => {
    if (isActiveRef.current) return;
    try {
      const locale = VOICE_LOCALE[inputLang] ?? 'es-ES';
      await Voice.start(locale);
      isActiveRef.current = true;
      setIsListening(true);
    } catch (e) {
      onError?.(`STT start error: ${String(e)}`);
    }
  }, [inputLang, onError]);

  const stopListening = useCallback(async () => {
    clearSilenceTimer();
    if (!isActiveRef.current) return;
    try {
      await Voice.stop();
    } catch {
      // ignorar si ya está parado
    }
    isActiveRef.current = false;
    setIsListening(false);
  }, [clearSilenceTimer]);

  // Configurar listeners de Voice al montar
  useEffect(() => {
    const onPartial = (e: SpeechPartialResultsEvent) => {
      const text = e.value?.[0] ?? '';
      if (!text) return;

      lastPartialRef.current = text;
      // Estimamos confianza basándonos en longitud (heurística simple)
      // En producción se puede usar el campo confidence si el SO lo provee
      const confidence = Math.min(text.length / 50, 1);

      onPartialResult(text, confidence);

      // Si la confianza es alta, lanzar traducción anticipada
      if (confidence >= AUDIO_CONFIG.STT_CONFIDENCE_THRESHOLD) {
        resetSilenceTimer(text);
      }
    };

    const onResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0] ?? '';
      if (!text) return;
      clearSilenceTimer();
      onFinalResult(text.trim());
      lastPartialRef.current = '';

      // Reiniciar escucha continua
      if (isActiveRef.current) {
        setTimeout(() => startListening(), 100);
      }
    };

    const onError = (e: SpeechErrorEvent) => {
      const msg = e.error?.message ?? 'STT error';
      // Reiniciar automáticamente en errores transitorios
      if (isActiveRef.current) {
        setTimeout(() => startListening(), 500);
      }
    };

    Voice.onSpeechPartialResults = onPartial;
    Voice.onSpeechResults = onResults;
    Voice.onSpeechError = onError;

    return () => {
      Voice.onSpeechPartialResults = null;
      Voice.onSpeechResults = null;
      Voice.onSpeechError = null;
    };
  }, [onPartialResult, onFinalResult, clearSilenceTimer, resetSilenceTimer, startListening]);

  // Iniciar/parar según `enabled`
  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [enabled, startListening, stopListening]);

  return { isListening, startListening, stopListening };
}
