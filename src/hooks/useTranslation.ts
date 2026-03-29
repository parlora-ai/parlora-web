/**
 * useTranslation hook
 *
 * Gestiona la cola de traducción y expone translate() al componente.
 * Cancela peticiones obsoletas con AbortController.
 */

import { useRef, useState, useCallback } from 'react';
import { translate } from '@/services/translationService';
import { useStore, selectToken } from '@/store';
import { LanguageCode, TranslationResult } from '@/types';

interface TranslationState {
  pending: number;
  lastEngine: string | null;
  error: string | null;
}

export function useTranslation() {
  const token = useStore(selectToken);
  const [state, setState] = useState<TranslationState>({
    pending: 0,
    lastEngine: null,
    error: null,
  });

  // Mapa de controladores activos por speaker (A o B)
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  const translateText = useCallback(
    async (params: {
      text: string;
      sourceLang: LanguageCode;
      targetLang: LanguageCode;
      speaker: string;
    }): Promise<TranslationResult | null> => {
      if (!token) return null;
      if (!params.text.trim()) return null;

      // Cancelar la petición anterior del mismo speaker
      const prev = controllersRef.current.get(params.speaker);
      if (prev) prev.abort();

      const controller = new AbortController();
      controllersRef.current.set(params.speaker, controller);

      setState(s => ({ ...s, pending: s.pending + 1, error: null }));

      try {
        const result = await translate({
          text: params.text,
          sourceLang: params.sourceLang,
          targetLang: params.targetLang,
          authToken: token,
          signal: controller.signal,
        });

        setState(s => ({
          pending: Math.max(0, s.pending - 1),
          lastEngine: result.engine,
          error: null,
        }));

        return result;
      } catch (err) {
        const error = err as Error;
        if (error.name === 'AbortError') return null;

        setState(s => ({
          pending: Math.max(0, s.pending - 1),
          lastEngine: null,
          error:
            error.message === 'TRANSLATION_UNAVAILABLE'
              ? 'Sin traducción disponible'
              : 'Error de red',
        }));
        return null;
      } finally {
        controllersRef.current.delete(params.speaker);
      }
    },
    [token],
  );

  const cancelAll = useCallback(() => {
    controllersRef.current.forEach(c => c.abort());
    controllersRef.current.clear();
    setState(s => ({ ...s, pending: 0 }));
  }, []);

  return {
    translateText,
    cancelAll,
    pending: state.pending,
    lastEngine: state.lastEngine,
    translationError: state.error,
  };
}
