/**
 * TranslationService
 *
 * Orden de resolución:
 *  1. Caché SQLite (0ms, sin red)
 *  2. DeepL API via proxy backend (primario)
 *  3. Google Cloud Translation via proxy backend (fallback)
 *  4. Error visible en UI
 *
 * Las claves de API NUNCA están en la app.
 * Toda llamada va al proxy backend que las tiene en secreto.
 */

import * as SQLite from 'expo-sqlite';
import Constants from 'expo-constants';
import { LanguageCode, TranslationResult, TranslationEngine } from '@/types';
import { AUDIO_CONFIG } from '@/constants/languages';

// ─── Base de datos de caché ──────────────────────────────────────
let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('parlora_ai_cache.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS translation_cache (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      src_lang    TEXT NOT NULL,
      dst_lang    TEXT NOT NULL,
      src_text    TEXT NOT NULL,
      dst_text    TEXT NOT NULL,
      engine      TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      accessed_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_key
      ON translation_cache (src_lang, dst_lang, src_text);
    CREATE INDEX IF NOT EXISTS idx_accessed
      ON translation_cache (accessed_at);
  `);
  return db;
}

async function getCached(
  srcLang: string,
  dstLang: string,
  srcText: string,
): Promise<string | null> {
  const database = await getDb();
  const now = Date.now();
  const cutoff = now - AUDIO_CONFIG.CACHE_TTL_MS;

  const row = await database.getFirstAsync<{ dst_text: string; id: number }>(
    `SELECT id, dst_text FROM translation_cache
     WHERE src_lang = ? AND dst_lang = ? AND src_text = ? AND created_at > ?`,
    [srcLang, dstLang, srcText, cutoff],
  );

  if (row) {
    // Actualizar accessed_at para LRU
    await database.runAsync(
      `UPDATE translation_cache SET accessed_at = ? WHERE id = ?`,
      [now, row.id],
    );
    return row.dst_text;
  }
  return null;
}

async function saveCache(
  srcLang: string,
  dstLang: string,
  srcText: string,
  dstText: string,
  engine: TranslationEngine,
): Promise<void> {
  const database = await getDb();
  const now = Date.now();

  // Insertar o reemplazar
  await database.runAsync(
    `INSERT OR REPLACE INTO translation_cache
     (src_lang, dst_lang, src_text, dst_text, engine, created_at, accessed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [srcLang, dstLang, srcText, dstText, engine, now, now],
  );

  // LRU eviction: si superamos el límite, eliminar los menos usados
  const count = await database.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM translation_cache`,
  );
  if (count && count.n > AUDIO_CONFIG.MAX_CACHE_ENTRIES) {
    const toDelete = count.n - AUDIO_CONFIG.MAX_CACHE_ENTRIES;
    await database.runAsync(
      `DELETE FROM translation_cache WHERE id IN (
         SELECT id FROM translation_cache ORDER BY accessed_at ASC LIMIT ?
       )`,
      [toDelete],
    );
  }
}

// ─── Llamadas al proxy backend ────────────────────────────────────
const PROXY_URL = Constants.expoConfig?.extra?.DEEPL_PROXY_URL as string;

interface ProxyTranslateParams {
  text: string;
  sourceLang: string;
  targetLang: string;
  engine: 'deepl' | 'google';
  authToken: string;
}

async function callProxy(
  params: ProxyTranslateParams,
  signal: AbortSignal,
): Promise<{ translatedText: string; detectedLang?: string }> {
  const response = await fetch(`${PROXY_URL}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.authToken}`,
    },
    body: JSON.stringify({
      text: params.text,
      source_lang: params.sourceLang === 'auto' ? null : params.sourceLang,
      target_lang: params.targetLang,
      engine: params.engine,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Proxy error: ${response.status}`);
  }

  return response.json();
}

// ─── API pública ─────────────────────────────────────────────────

/**
 * Traduce un texto con el pipeline completo:
 * caché → DeepL → Google → error
 */
export async function translate(params: {
  text: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  authToken: string;
  signal?: AbortSignal;
}): Promise<TranslationResult> {
  const { text, sourceLang, targetLang, authToken, signal } = params;
  const trimmed = text.trim();

  if (!trimmed) {
    return { translatedText: '', engine: 'cache', latencyMs: 0 };
  }

  const srcKey = sourceLang === 'auto' ? 'auto' : sourceLang;
  const dstKey = targetLang;

  // 1. Caché
  const t0 = Date.now();
  const cached = await getCached(srcKey, dstKey, trimmed);
  if (cached) {
    return { translatedText: cached, engine: 'cache', latencyMs: Date.now() - t0 };
  }

  // Controlador de aborto con timeout de 2s
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUDIO_CONFIG.TRANSLATION_TIMEOUT_MS);
  const combinedSignal = signal ?? controller.signal;

  // 2. DeepL (primario)
  try {
    const t1 = Date.now();
    const result = await callProxy(
      { text: trimmed, sourceLang, targetLang, engine: 'deepl', authToken },
      combinedSignal,
    );
    clearTimeout(timeoutId);

    await saveCache(srcKey, dstKey, trimmed, result.translatedText, 'deepl');
    return {
      translatedText: result.translatedText,
      engine: 'deepl',
      latencyMs: Date.now() - t1,
      detectedSourceLang: result.detectedLang as LanguageCode | undefined,
    };
  } catch (deeplError) {
    // Si fue un abort externo, propagar
    if ((deeplError as Error).name === 'AbortError' && signal?.aborted) {
      throw deeplError;
    }

    // 3. Google Cloud Translation (fallback)
    try {
      const t2 = Date.now();
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(
        () => fallbackController.abort(),
        AUDIO_CONFIG.TRANSLATION_TIMEOUT_MS,
      );

      const result = await callProxy(
        { text: trimmed, sourceLang, targetLang, engine: 'google', authToken },
        fallbackController.signal,
      );
      clearTimeout(fallbackTimeout);

      await saveCache(srcKey, dstKey, trimmed, result.translatedText, 'google');
      return {
        translatedText: result.translatedText,
        engine: 'google',
        latencyMs: Date.now() - t2,
        detectedSourceLang: result.detectedLang as LanguageCode | undefined,
      };
    } catch {
      // 4. Sin traducción disponible
      throw new Error('TRANSLATION_UNAVAILABLE');
    }
  }
}

/** Eliminar caché completa */
export async function clearTranslationCache(): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM translation_cache`);
}

/** Estadísticas de caché para mostrar en Ajustes */
export async function getCacheStats(): Promise<{ entries: number; oldestMs: number }> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ n: number; oldest: number }>(
    `SELECT COUNT(*) as n, MIN(created_at) as oldest FROM translation_cache`,
  );
  return { entries: row?.n ?? 0, oldestMs: row?.oldest ?? 0 };
}
