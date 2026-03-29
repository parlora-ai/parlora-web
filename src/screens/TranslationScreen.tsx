import React, { useCallback, useId } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useStore, selectStatus, selectTranscript, selectProfileA, selectProfileB } from '@/store';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useTranslation } from '@/hooks/useTranslation';
import { useTTS } from '@/hooks/useTTS';
import { TranscriptLine } from '@/types';
import { AUDIO_CONFIG } from '@/constants/languages';

export default function TranslationScreen() {
  const status = useStore(selectStatus);
  const transcript = useStore(selectTranscript);
  const profileA = useStore(selectProfileA);
  const profileB = useStore(selectProfileB);
  const setStatus = useStore(s => s.setStatus);
  const addLine = useStore(s => s.addLine);

  const { translateText } = useTranslation();
  const { speak } = useTTS();

  const isActive = status === 'active';

  // ── Callback cuando STT emite resultado final para el auricular A ──
  const handleFinalA = useCallback(
    async (text: string) => {
      const result = await translateText({
        text,
        sourceLang: profileA.inputLang,
        targetLang: profileA.outputLang,
        speaker: 'A',
      });
      if (!result) return;

      const line: TranscriptLine = {
        id: `A-${Date.now()}`,
        speaker: 'A',
        originalText: text,
        translatedText: result.translatedText,
        detectedLang: result.detectedSourceLang ?? profileA.inputLang,
        timestamp: Date.now(),
      };
      addLine(line);
      await speak(result.translatedText, profileA.outputLang, profileA);
    },
    [profileA, translateText, addLine, speak],
  );

  const handleFinalB = useCallback(
    async (text: string) => {
      const result = await translateText({
        text,
        sourceLang: profileB.inputLang,
        targetLang: profileB.outputLang,
        speaker: 'B',
      });
      if (!result) return;

      const line: TranscriptLine = {
        id: `B-${Date.now()}`,
        speaker: 'B',
        originalText: text,
        translatedText: result.translatedText,
        detectedLang: result.detectedSourceLang ?? profileB.inputLang,
        timestamp: Date.now(),
      };
      addLine(line);
      await speak(result.translatedText, profileB.outputLang, profileB);
    },
    [profileB, translateText, addLine, speak],
  );

  // STT para cada auricular (solo activo cuando la sesión está en marcha)
  const { isListening: listeningA } = useAudioCapture({
    speaker: 'A',
    inputLang: profileA.autoDetect ? 'auto' : profileA.inputLang,
    enabled: isActive,
    onPartialResult: () => {},
    onFinalResult: handleFinalA,
  });

  const { isListening: listeningB } = useAudioCapture({
    speaker: 'B',
    inputLang: profileB.autoDetect ? 'auto' : profileB.inputLang,
    enabled: isActive,
    onPartialResult: () => {},
    onFinalResult: handleFinalB,
  });

  function toggleSession() {
    if (isActive) {
      setStatus('paused');
    } else {
      setStatus('active');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header de estado */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>PARLORA AI</Text>
        <View style={[styles.statusBadge, isActive && styles.statusActive]}>
          <View style={[styles.statusDot, isActive && styles.statusDotActive]} />
          <Text style={[styles.statusText, isActive && styles.statusTextActive]}>
            {isActive ? 'Sesión activa' : 'Pausado'}
          </Text>
        </View>
      </View>

      {/* Tarjetas de auriculares */}
      <View style={styles.earbudsRow}>
        <EarbudCard side="A" label="Auricular A" color="#818CF8" profile={profileA} />
        <EarbudCard side="B" label="Auricular B" color="#C4B5FD" profile={profileB} />
      </View>

      {/* Transcripción en vivo */}
      <View style={styles.transcriptSection}>
        <Text style={styles.sectionLabel}>Transcripción en vivo</Text>
        <ScrollView
          style={styles.transcriptBox}
          contentContainerStyle={{ padding: 12 }}
        >
          {transcript.length === 0 && (
            <Text style={styles.emptyTranscript}>
              Las frases traducidas aparecerán aquí...
            </Text>
          )}
          {transcript.map(line => (
            <TranscriptItem key={line.id} line={line} />
          ))}
        </ScrollView>
      </View>

      {/* Botón de micrófono */}
      <View style={styles.micArea}>
        <TouchableOpacity
          style={[styles.micBtn, isActive ? styles.micActive : styles.micInactive]}
          onPress={toggleSession}
          activeOpacity={0.85}
        >
          <Text style={styles.micIcon}>🎙</Text>
        </TouchableOpacity>
        <Text style={styles.micHint}>
          {isActive
            ? 'Traducción activa · Toca para pausar'
            : 'Toca para iniciar la traducción'}
        </Text>
      </View>

    </SafeAreaView>
  );
}

// ── Componentes locales ──────────────────────────────────────────

interface EarbudCardProps {
  side: 'A' | 'B';
  label: string;
  color: string;
  profile: ReturnType<typeof selectProfileA>;
}

function EarbudCard({ side, label, color, profile }: EarbudCardProps) {
  const { getLanguage } = require('@/constants/languages');
  const inputLang = getLanguage(profile.inputLang);
  const outputLang = getLanguage(profile.outputLang);

  return (
    <View style={[styles.earbudCard, { borderColor: `${color}40` }]}>
      <Text style={[styles.earbudLabel, { color }]}>{label}</Text>
      <Text style={styles.earbudLang}>
        {inputLang.flag} {inputLang.name}
      </Text>
      <Text style={styles.earbudArrow}>↓ traduce a</Text>
      <Text style={styles.earbudLang}>
        {outputLang.flag} {outputLang.name}
      </Text>
      <View style={styles.volRow}>
        <Text style={styles.volLabel}>Vol: {Math.round(profile.volume * 100)}%</Text>
      </View>
    </View>
  );
}

function TranscriptItem({ line }: { line: TranscriptLine }) {
  const color = line.speaker === 'A' ? '#818CF8' : '#C4B5FD';
  const bgColor = line.speaker === 'A' ? 'rgba(99,102,241,0.1)' : 'rgba(167,139,250,0.1)';

  return (
    <View style={styles.transcriptLine}>
      <View style={[styles.speakerBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.speakerBadgeText, { color }]}>{line.speaker}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.originalText}>{line.originalText}</Text>
        <Text style={styles.translatedText}>{line.translatedText}</Text>
      </View>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D14' },
  header: { alignItems: 'center', paddingTop: 16, paddingBottom: 12, gap: 8 },
  appTitle: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.12 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusActive: { borderColor: 'rgba(52,199,89,0.3)', backgroundColor: 'rgba(52,199,89,0.08)' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  statusDotActive: { backgroundColor: '#34C759' },
  statusText: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  statusTextActive: { color: '#34C759' },

  earbudsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  earbudCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderRadius: 20, padding: 14,
  },
  earbudLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.08, marginBottom: 10, textTransform: 'uppercase' },
  earbudLang: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  earbudArrow: { fontSize: 10, color: 'rgba(255,255,255,0.2)', marginVertical: 4 },
  volRow: { marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)' },
  volLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },

  transcriptSection: { flex: 1, paddingHorizontal: 16, marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.08, marginBottom: 8, textTransform: 'uppercase' },
  transcriptBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)' },
  emptyTranscript: { fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 24 },

  transcriptLine: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  speakerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 2 },
  speakerBadgeText: { fontSize: 10, fontWeight: '700' },
  originalText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  translatedText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },

  micArea: { alignItems: 'center', paddingBottom: 24, gap: 10 },
  micBtn: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  micActive: { backgroundColor: '#EF4444' },
  micInactive: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' },
  micIcon: { fontSize: 28 },
  micHint: { fontSize: 12, color: 'rgba(255,255,255,0.25)', fontWeight: '500' },
});
