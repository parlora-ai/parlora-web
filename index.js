import { registerRootComponent } from 'expo';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView, PermissionsAndroid, Platform
} from 'react-native';
import Voice from '@react-native-voice/voice';

// ─── Solicitar permiso de micrófono ──────────────────────────────
async function requestMicPermission() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Parlora AI necesita el micrófono',
        message: 'Para traducir tu voz en tiempo real necesitamos acceso al micrófono.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Cancelar',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

// ─── Pantalla de Login ────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={s.logoWrap}>
          <Text style={s.logoEmoji}>🌐</Text>
        </View>
        <Text style={s.appName}>Parlora AI</Text>
        <Text style={s.tagline}>Traducción simultánea{'\n'}para conversaciones reales</Text>

        <TouchableOpacity style={s.googleBtn} onPress={onLogin} activeOpacity={0.85}>
          <Text style={s.googleG}>G</Text>
          <Text style={s.googleBtnText}>Continuar con Google</Text>
        </TouchableOpacity>

        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>o</Text>
          <View style={s.dividerLine} />
        </View>

        <TouchableOpacity
          style={s.emailBtn}
          onPress={() => Alert.alert('Próximamente', 'Login con email en la próxima versión.')}
        >
          <Text style={s.emailBtnText}>Usar correo electrónico</Text>
        </TouchableOpacity>

        <Text style={s.terms}>
          Al continuar aceptas los <Text style={s.termsLink}>Términos de servicio</Text>
          {' '}y la <Text style={s.termsLink}>Política de privacidad</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────
function MainScreen() {
  const [isActive, setIsActive] = useState(false);
  const [activeTab, setActiveTab] = useState('translate');
  const [transcript, setTranscript] = useState([]);
  const [partialText, setPartialText] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState('A');
  const [translating, setTranslating] = useState(false);

  const langA = { input: 'es-ES', output: 'EN', flag: '🇪🇸', name: 'Español' };
  const langB = { input: 'en-US', output: 'ES', flag: '🇬🇧', name: 'Inglés' };

  // ── Configurar Voice listeners ──
  useEffect(() => {
    Voice.onSpeechPartialResults = (e) => {
      setPartialText(e.value?.[0] ?? '');
    };

    Voice.onSpeechResults = async (e) => {
      const text = e.value?.[0] ?? '';
      if (!text.trim()) return;
      setPartialText('');
      await handleTranslation(text);
    };

    Voice.onSpeechError = (e) => {
      console.log('STT error:', e);
      // Reiniciar automáticamente
      if (isActive) {
        setTimeout(() => startListening(), 500);
      }
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [isActive, activeSpeaker]);

  // ── Llamar a DeepL via backend ──
  const handleTranslation = async (text) => {
    const speaker = activeSpeaker;
    const sourceLang = speaker === 'A' ? 'ES' : 'EN';
    const targetLang = speaker === 'A' ? 'EN' : 'ES';

    setTranslating(true);
    try {
      const response = await fetch('https://parlora-backend.up.railway.app/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          source_lang: sourceLang,
          target_lang: targetLang,
          engine: 'deepl',
        }),
      });

      const data = await response.json();
      const translated = data.translatedText ?? '(sin traducción)';

      setTranscript(prev => [...prev.slice(-49), {
        id: Date.now().toString(),
        speaker,
        original: text,
        translated,
      }]);
    } catch (err) {
      console.log('Translation error:', err);
      setTranscript(prev => [...prev.slice(-49), {
        id: Date.now().toString(),
        speaker,
        original: text,
        translated: '(error de traducción)',
      }]);
    } finally {
      setTranslating(false);
      // Continuar escuchando
      if (isActive) {
        setTimeout(() => startListening(), 300);
      }
    }
  };

  const startListening = async () => {
    try {
      const locale = activeSpeaker === 'A' ? 'es-ES' : 'en-US';
      await Voice.start(locale);
    } catch (e) {
      console.log('Start error:', e);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      await Voice.destroy();
    } catch (e) {
      console.log('Stop error:', e);
    }
    setPartialText('');
  };

  const toggleSession = async () => {
    if (isActive) {
      await stopListening();
      setIsActive(false);
    } else {
      const ok = await requestMicPermission();
      if (!ok) {
        Alert.alert('Permiso denegado', 'Necesitas permitir el acceso al micrófono.');
        return;
      }
      setIsActive(true);
      await startListening();
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.appTitle}>PARLORA AI</Text>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>
            {translating ? 'Traduciendo...' : isActive ? 'Sesión activa' : 'Pausado'}
          </Text>
        </View>
      </View>

      {/* Auriculares */}
      <View style={s.earbudsRow}>
        <TouchableOpacity
          style={[s.earbudCard, { borderColor: activeSpeaker === 'A' ? '#818CF8' : 'rgba(129,140,248,0.2)' }]}
          onPress={() => { if (isActive) { stopListening(); setActiveSpeaker('A'); setTimeout(startListening, 300); } else setActiveSpeaker('A'); }}
        >
          <Text style={[s.earbudLabel, { color: '#818CF8' }]}>
            {activeSpeaker === 'A' && isActive ? '🎙 ' : ''}Auricular A
          </Text>
          <Text style={s.earbudLang}>🇪🇸 Español</Text>
          <Text style={s.earbudArrow}>↓ traduce a</Text>
          <Text style={s.earbudLang}>🇬🇧 Inglés</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.earbudCard, { borderColor: activeSpeaker === 'B' ? '#C4B5FD' : 'rgba(196,181,253,0.2)' }]}
          onPress={() => { if (isActive) { stopListening(); setActiveSpeaker('B'); setTimeout(startListening, 300); } else setActiveSpeaker('B'); }}
        >
          <Text style={[s.earbudLabel, { color: '#C4B5FD' }]}>
            {activeSpeaker === 'B' && isActive ? '🎙 ' : ''}Auricular B
          </Text>
          <Text style={s.earbudLang}>🇬🇧 Inglés</Text>
          <Text style={s.earbudArrow}>↓ traduce a</Text>
          <Text style={s.earbudLang}>🇪🇸 Español</Text>
        </TouchableOpacity>
      </View>

      {/* Texto parcial en tiempo real */}
      {partialText ? (
        <View style={s.partialBox}>
          <Text style={s.partialText}>🎙 {partialText}</Text>
        </View>
      ) : null}

      {/* Transcripción */}
      <Text style={s.sectionLabel}>Transcripción en vivo</Text>
      <ScrollView style={s.transcriptBox}>
        {transcript.length === 0 && (
          <Text style={s.emptyText}>
            Toca el micrófono y habla para ver la traducción aquí
          </Text>
        )}
        {transcript.map(line => (
          <View key={line.id} style={s.transcriptLine}>
            <View style={[s.speakerBadge, {
              backgroundColor: line.speaker === 'A'
                ? 'rgba(129,140,248,0.15)' : 'rgba(196,181,253,0.15)'
            }]}>
              <Text style={[s.speakerText, {
                color: line.speaker === 'A' ? '#818CF8' : '#C4B5FD'
              }]}>{line.speaker}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.originalText}>{line.original}</Text>
              <Text style={s.translatedText}>{line.translated}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Botón micrófono */}
      <View style={s.micArea}>
        <View style={s.speakerSelector}>
          <TouchableOpacity
            style={[s.speakerBtn, activeSpeaker === 'A' && s.speakerBtnActiveA]}
            onPress={() => setActiveSpeaker('A')}
          >
            <Text style={[s.speakerBtnText, activeSpeaker === 'A' && { color: '#818CF8' }]}>A habla</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.speakerBtn, activeSpeaker === 'B' && s.speakerBtnActiveB]}
            onPress={() => setActiveSpeaker('B')}
          >
            <Text style={[s.speakerBtnText, activeSpeaker === 'B' && { color: '#C4B5FD' }]}>B habla</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.micBtn, isActive ? s.micActive : s.micInactive]}
          onPress={toggleSession}
        >
          <Text style={{ fontSize: 28 }}>{isActive ? '⏹' : '🎙'}</Text>
        </TouchableOpacity>
        <Text style={s.micHint}>
          {isActive ? `Escuchando a ${activeSpeaker} · Toca para pausar` : 'Toca para iniciar la traducción'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {[
          { key: 'translate', icon: '🌐', label: 'Traducir' },
          { key: 'earbuds', icon: '🎧', label: 'Auriculares' },
          { key: 'history', icon: '📜', label: 'Historial' },
          { key: 'settings', icon: '⚙️', label: 'Ajustes' },
        ].map(tab => (
          <TouchableOpacity key={tab.key} style={s.tabItem} onPress={() => setActiveTab(tab.key)}>
            <Text style={[s.tabIcon, activeTab === tab.key && s.tabIconActive]}>{tab.icon}</Text>
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ─── App root ─────────────────────────────────────────────────────
function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  return <MainScreen />;
}

// ─── Estilos ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D14' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logoWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(99,102,241,0.15)', borderWidth: 0.5, borderColor: 'rgba(99,102,241,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoEmoji: { fontSize: 36 },
  appName: { fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: -0.5, marginBottom: 8 },
  tagline: { fontSize: 15, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 22, marginBottom: 48 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15, width: '100%', marginBottom: 12 },
  googleG: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginBottom: 12 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  emailBtn: { paddingVertical: 15, width: '100%', alignItems: 'center', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  emailBtnText: { fontSize: 15, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  terms: { fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 18, marginTop: 28 },
  termsLink: { color: 'rgba(99,102,241,0.7)' },
  header: { alignItems: 'center', paddingTop: 12, paddingBottom: 10, gap: 6 },
  appTitle: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.14 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  statusBadgeActive: { borderColor: 'rgba(52,199,89,0.3)', backgroundColor: 'rgba(52,199,89,0.08)' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  statusDotActive: { backgroundColor: '#34C759' },
  statusText: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  statusTextActive: { color: '#34C759' },
  earbudsRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 10, marginBottom: 10 },
  earbudCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderRadius: 18, padding: 12 },
  earbudLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.08, marginBottom: 8, textTransform: 'uppercase' },
  earbudLang: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  earbudArrow: { fontSize: 10, color: 'rgba(255,255,255,0.2)', marginVertical: 3 },
  partialBox: { marginHorizontal: 14, marginBottom: 6, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 10, padding: 8 },
  partialText: { fontSize: 12, color: '#818CF8', fontStyle: 'italic' },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.08, marginHorizontal: 14, marginBottom: 6, textTransform: 'uppercase' },
  transcriptBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', marginHorizontal: 14, padding: 10 },
  emptyText: { fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 20, lineHeight: 18 },
  transcriptLine: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  speakerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, alignSelf: 'flex-start', marginTop: 2 },
  speakerText: { fontSize: 9, fontWeight: '700' },
  originalText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  translatedText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },
  micArea: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  speakerSelector: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  speakerBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  speakerBtnActiveA: { borderColor: '#818CF8', backgroundColor: 'rgba(129,140,248,0.15)' },
  speakerBtnActiveB: { borderColor: '#C4B5FD', backgroundColor: 'rgba(196,181,253,0.15)' },
  speakerBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  micBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  micActive: { backgroundColor: '#EF4444' },
  micInactive: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' },
  micHint: { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: '500' },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(13,13,20,0.97)' },
  tabItem: { alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 20, opacity: 0.3 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.04 },
  tabLabelActive: { color: '#818CF8' },
});

registerRootComponent(App);