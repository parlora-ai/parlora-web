import { registerRootComponent } from 'expo';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView, Platform,
  PermissionsAndroid, ActivityIndicator
} from 'react-native';
import Voice from '@react-native-voice/voice';
import * as Speech from 'expo-speech';

// ─── Idiomas disponibles ──────────────────────────────────────────
const LANGUAGES = [
  { code: 'ES', name: 'Español', flag: '🇪🇸', voiceLocale: 'es-ES', ttsLocale: 'es-ES' },
  { code: 'EN', name: 'Inglés',  flag: '🇬🇧', voiceLocale: 'en-US', ttsLocale: 'en-US' },
  { code: 'FR', name: 'Francés', flag: '🇫🇷', voiceLocale: 'fr-FR', ttsLocale: 'fr-FR' },
  { code: 'DE', name: 'Alemán',  flag: '🇩🇪', voiceLocale: 'de-DE', ttsLocale: 'de-DE' },
  { code: 'IT', name: 'Italiano',flag: '🇮🇹', voiceLocale: 'it-IT', ttsLocale: 'it-IT' },
  { code: 'PT', name: 'Portugués',flag:'🇵🇹', voiceLocale: 'pt-PT', ttsLocale: 'pt-PT' },
  { code: 'SK', name: 'Eslovaco', flag: '🇸🇰', voiceLocale: 'sk-SK', ttsLocale: 'sk-SK' },
];

const BACKEND = 'https://parlora-backend.onrender.com';

// ─── Solicitar permiso micrófono ──────────────────────────────────
async function requestMic() {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      { title: 'Micrófono', message: 'Parlora AI necesita el micrófono para traducir tu voz.', buttonPositive: 'Permitir' }
    );
    return r === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

// ─── LOGIN ────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.loginContainer}>
        <View style={s.logoWrap}><Text style={s.logoEmoji}>🌐</Text></View>
        <Text style={s.appName}>Parlora AI</Text>
        <Text style={s.tagline}>Traducción simultánea{'\n'}para conversaciones reales</Text>
        <TouchableOpacity style={s.googleBtn} onPress={onLogin}>
          <Text style={s.googleG}>G</Text>
          <Text style={s.googleBtnText}>Continuar con Google</Text>
        </TouchableOpacity>
        <View style={s.dividerRow}>
          <View style={s.dividerLine}/><Text style={s.dividerText}>o</Text><View style={s.dividerLine}/>
        </View>
        <TouchableOpacity style={s.emailBtn} onPress={() => Alert.alert('Próximamente','Login con email en la próxima versión.')}>
          <Text style={s.emailBtnText}>Usar correo electrónico</Text>
        </TouchableOpacity>
        <Text style={s.terms}>Al continuar aceptas los <Text style={s.termsLink}>Términos</Text> y la <Text style={s.termsLink}>Privacidad</Text></Text>
      </View>
    </SafeAreaView>
  );
}

// ─── SETUP ───────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [langA, setLangA] = useState('ES');
  const [langB, setLangB] = useState('EN');
  const [audioA, setAudioA] = useState('mobile');  // 'mobile' | 'earphone'
  const [audioB, setAudioB] = useState('mobile');

  const getLang = (code) => LANGUAGES.find(l => l.code === code);

  // No permitir que ambos sean auricular
  const setAudioAVal = (val) => {
    if (val === 'earphone' && audioB === 'earphone') {
      Alert.alert('No disponible', 'Solo una persona puede usar auriculares. La otra debe usar el móvil.');
      return;
    }
    setAudioA(val);
  };

  const setAudioBVal = (val) => {
    if (val === 'earphone' && audioA === 'earphone') {
      Alert.alert('No disponible', 'Solo una persona puede usar auriculares. La otra debe usar el móvil.');
      return;
    }
    setAudioB(val);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.setupContainer}>
        <Text style={s.setupTitle}>Configurar sesión</Text>
        <Text style={s.setupSub}>Elige el idioma y dispositivo de cada persona</Text>

        {/* Persona A */}
        <View style={s.personCard}>
          <Text style={s.personLabel} >👤 Persona A</Text>

          <Text style={s.configSectionLabel}>Idioma</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
            {LANGUAGES.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[s.langChip, langA === l.code && s.langChipActiveA]}
                onPress={() => setLangA(l.code)}
              >
                <Text style={[s.langChipText, langA === l.code && { color: '#818CF8' }]}>
                  {l.flag} {l.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.configSectionLabel}>Dispositivo</Text>
          <View style={s.audioSelector}>
            <TouchableOpacity
              style={[s.audioBtn, audioA === 'mobile' && s.audioBtnActiveA]}
              onPress={() => setAudioAVal('mobile')}
            >
              <Text style={s.audioBtnIcon}>📱</Text>
              <Text style={[s.audioBtnText, audioA === 'mobile' && { color: '#818CF8' }]}>Móvil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.audioBtn, audioA === 'earphone' && s.audioBtnActiveA]}
              onPress={() => setAudioAVal('earphone')}
            >
              <Text style={s.audioBtnIcon}>🎧</Text>
              <Text style={[s.audioBtnText, audioA === 'earphone' && { color: '#818CF8' }]}>Auricular</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Persona B */}
        <View style={s.personCard}>
          <Text style={s.personLabel}>👤 Persona B</Text>

          <Text style={s.configSectionLabel}>Idioma</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
            {LANGUAGES.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[s.langChip, langB === l.code && s.langChipActiveB]}
                onPress={() => setLangB(l.code)}
              >
                <Text style={[s.langChipText, langB === l.code && { color: '#C4B5FD' }]}>
                  {l.flag} {l.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.configSectionLabel}>Dispositivo</Text>
          <View style={s.audioSelector}>
            <TouchableOpacity
              style={[s.audioBtn, audioB === 'mobile' && s.audioBtnActiveB]}
              onPress={() => setAudioBVal('mobile')}
            >
              <Text style={s.audioBtnIcon}>📱</Text>
              <Text style={[s.audioBtnText, audioB === 'mobile' && { color: '#C4B5FD' }]}>Móvil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.audioBtn, audioB === 'earphone' && s.audioBtnActiveB]}
              onPress={() => setAudioBVal('earphone')}
            >
              <Text style={s.audioBtnIcon}>🎧</Text>
              <Text style={[s.audioBtnText, audioB === 'earphone' && { color: '#C4B5FD' }]}>Auricular</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={s.startBtn}
          onPress={() => onStart({ langA, langB, audioA, audioB })}
        >
          <Text style={s.startBtnText}>Iniciar sesión →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── MAIN TRANSLATION SCREEN ──────────────────────────────────────
function TranslationScreen({ config, onBack }) {
  const { langA, langB, audioA, audioB } = config;
  const langAObj = LANGUAGES.find(l => l.code === langA);
  const langBObj = LANGUAGES.find(l => l.code === langB);

  const hasEarphone = audioA === 'earphone' || audioB === 'earphone';
  const earphonePerson = audioA === 'earphone' ? 'A' : 'B';
  const mobilePerson = audioA === 'mobile' && audioB === 'mobile' ? null : (earphonePerson === 'A' ? 'B' : 'A');

  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [partialText, setPartialText] = useState('');
  const [status, setStatus] = useState('Pausado');
  const [detectedSpeaker, setDetectedSpeaker] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const scrollRef = useRef(null);
  const isActiveRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const lastTextRef = useRef('');

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  useEffect(() => {
    if (transcript.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [transcript]);

  // ── Voice listeners ──
  useEffect(() => {
    Voice.onSpeechPartialResults = (e) => {
      const text = e.value?.[0] ?? '';
      setPartialText(text);
      lastTextRef.current = text;

      // Detectar idioma por el texto parcial
      if (text.length > 5) {
        const detectedLang = detectLanguage(text, langA, langB);
        setDetectedSpeaker(detectedLang === langA ? 'A' : 'B');
      }

      // Modo auricular: silencio de 800ms para traducir
      if (hasEarphone) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (lastTextRef.current.trim()) {
            const speaker = detectLanguage(lastTextRef.current, langA, langB) === langA ? 'A' : 'B';
            doTranslate(lastTextRef.current.trim(), speaker);
            lastTextRef.current = '';
            setPartialText('');
          }
        }, 800);
      }
    };

    Voice.onSpeechResults = (e) => {
      const text = e.value?.[0] ?? '';
      if (!text.trim()) return;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setPartialText('');

      const speaker = detectLanguage(text, langA, langB) === langA ? 'A' : 'B';
      doTranslate(text.trim(), speaker);

      // Modo auricular: reiniciar escucha automáticamente
      if (hasEarphone && isActiveRef.current) {
        setTimeout(() => startVoice(), 300);
      }
    };

    Voice.onSpeechError = () => {
      if (isActiveRef.current) setTimeout(() => startVoice(), 800);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [langA, langB, hasEarphone]);

  // ── Detectar idioma por contenido ──
  const detectLanguage = (text, langA, langB) => {
    // Caracteres específicos de cada idioma
    const spanishChars = /[áéíóúüñ¿¡]/i;
    const frenchChars = /[àâçèêëîïôùûüÿœæ]/i;
    const germanChars = /[äöüßÄÖÜ]/i;
    const portugueseChars = /[ãõàáéíóúâêôç]/i;
    const italianChars = /[àèéìíîòóùú]/i;
    const slovakChars = /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/i;

    const textLower = text.toLowerCase();

    if (langA === 'ES' || langB === 'ES') {
      if (spanishChars.test(text)) return 'ES';
    }
    if (langA === 'FR' || langB === 'FR') {
      if (frenchChars.test(text)) return 'FR';
    }
    if (langA === 'DE' || langB === 'DE') {
      if (germanChars.test(text)) return 'DE';
    }
    if (langA === 'PT' || langB === 'PT') {
      if (portugueseChars.test(text)) return 'PT';
    }
    if (langA === 'SK' || langB === 'SK') {
      if (slovakChars.test(text)) return 'SK';
    }
    if (langA === 'IT' || langB === 'IT') {
      if (italianChars.test(text)) return 'IT';
    }

    // Si no hay caracteres específicos, mantener el último detectado
    return detectedSpeaker === 'A' ? langA : langB;
  };

  const startVoice = async () => {
    try {
      // En modo auricular usar detección automática, en modo móvil usar langA como inicio
      const locale = langAObj.voiceLocale;
      await Voice.start(locale);
      setStatus('Escuchando...');
    } catch (e) { console.log('Voice start error:', e); }
  };

  const stopVoice = async () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    try { await Voice.stop(); await Voice.destroy(); } catch (e) {}
    setPartialText('');
  };

  // ── Traducir ──
  const doTranslate = async (text, speaker) => {
    const srcLang = speaker === 'A' ? langA : langB;
    const tgtLang = speaker === 'A' ? langB : langA;
    const tgtLangObj = speaker === 'A' ? langBObj : langAObj;

    setIsTranslating(true);
    setStatus('Traduciendo...');

    try {
      const res = await fetch(`${BACKEND}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source_lang: srcLang, target_lang: tgtLang, engine: 'deepl' }),
      });
      const data = await res.json();
      const translated = data.translatedText ?? '(sin traducción)';

      setTranscript(prev => [...prev.slice(-49), {
        id: Date.now().toString(),
        speaker,
        original: text,
        translated,
        srcFlag: speaker === 'A' ? langAObj.flag : langBObj.flag,
        tgtFlag: speaker === 'A' ? langBObj.flag : langAObj.flag,
      }]);

      // Reproducir en el dispositivo correcto
      // Si speaker es A con auricular → traducción sale por móvil (para B)
      // Si speaker es B con auricular → traducción sale por móvil (para A)  
      // Si ambos móvil → sale por altavoz del móvil siempre
      Speech.speak(translated, {
        language: tgtLangObj.ttsLocale,
        rate: 0.95,
      });

      setStatus('Sesión activa');
    } catch {
      setStatus('Error de red');
      setTimeout(() => setStatus(isActiveRef.current ? 'Sesión activa' : 'Pausado'), 2000);
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleSession = async () => {
    if (isActive) {
      await stopVoice();
      setIsActive(false);
      setStatus('Pausado');
      Speech.stop();
    } else {
      const ok = await requestMic();
      if (!ok) { Alert.alert('Permiso denegado', 'Necesitas permitir el micrófono.'); return; }
      setIsActive(true);
      setStatus('Sesión activa');
      if (hasEarphone) {
        // Modo auricular: STT continuo automático
        startVoice();
      }
    }
  };

  // Modo móvil: botón de pulsar para hablar
  const handleMicPressIn = async () => {
    if (!isActive || hasEarphone) return;
    await startVoice();
  };

  const handleMicPressOut = async () => {
    if (!isActive || hasEarphone) return;
    // Silencio de 3 segundos para modo móvil-móvil
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(async () => {
      await stopVoice();
      if (lastTextRef.current.trim()) {
        const speaker = detectLanguage(lastTextRef.current, langA, langB) === langA ? 'A' : 'B';
        doTranslate(lastTextRef.current.trim(), speaker);
        lastTextRef.current = '';
      }
    });
  };

  const modeLabel = hasEarphone
    ? `Persona ${earphonePerson} 🎧 · Persona ${mobilePerson} 📱`
    : '📱 Ambas personas con móvil';

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backBtnText}>‹ Volver</Text>
        </TouchableOpacity>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>
            {isTranslating ? 'Traduciendo...' : status}
          </Text>
        </View>
      </View>

      {/* Info personas */}
      <View style={s.personsRow}>
        <View style={[s.personInfo, { borderColor: 'rgba(129,140,248,0.3)' }]}>
          <Text style={s.personInfoIcon}>{audioA === 'earphone' ? '🎧' : '📱'}</Text>
          <Text style={[s.personInfoLabel, { color: '#818CF8' }]}>Persona A</Text>
          <Text style={s.personInfoLang}>{langAObj.flag} {langAObj.name}</Text>
          {detectedSpeaker === 'A' && isActive && (
            <View style={s.speakingIndicator}>
              <Text style={s.speakingText}>hablando</Text>
            </View>
          )}
        </View>

        <View style={s.personsArrow}>
          <Text style={s.personsArrowText}>⇄</Text>
          <Text style={s.modeLabel}>{modeLabel}</Text>
        </View>

        <View style={[s.personInfo, { borderColor: 'rgba(196,181,253,0.3)' }]}>
          <Text style={s.personInfoIcon}>{audioB === 'earphone' ? '🎧' : '📱'}</Text>
          <Text style={[s.personInfoLabel, { color: '#C4B5FD' }]}>Persona B</Text>
          <Text style={s.personInfoLang}>{langBObj.flag} {langBObj.name}</Text>
          {detectedSpeaker === 'B' && isActive && (
            <View style={[s.speakingIndicator, { backgroundColor: 'rgba(196,181,253,0.15)' }]}>
              <Text style={[s.speakingText, { color: '#C4B5FD' }]}>hablando</Text>
            </View>
          )}
        </View>
      </View>

      {/* Texto parcial */}
      {partialText ? (
        <View style={s.partialBox}>
          <Text style={s.partialText}>🎙 {partialText}</Text>
        </View>
      ) : null}

      {/* Transcripción */}
      <Text style={s.sectionLabel}>Transcripción en vivo</Text>
      <ScrollView ref={scrollRef} style={s.transcriptBox}>
        {transcript.length === 0 && (
          <Text style={s.emptyText}>
            {hasEarphone
              ? `Toca Iniciar — la traducción es automática y continua`
              : `Toca Iniciar y luego mantén pulsado el micrófono para hablar`
            }
          </Text>
        )}
        {transcript.map(line => (
          <View key={line.id} style={s.transcriptLine}>
            <View style={[s.speakerBadge, {
              backgroundColor: line.speaker === 'A' ? 'rgba(129,140,248,0.15)' : 'rgba(196,181,253,0.15)'
            }]}>
              <Text style={[s.speakerText, { color: line.speaker === 'A' ? '#818CF8' : '#C4B5FD' }]}>
                {line.speaker}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.originalText}>{line.srcFlag} {line.original}</Text>
              <Text style={s.translatedText}>{line.tgtFlag} {line.translated}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Controles */}
      <View style={s.controls}>
        {/* Botón iniciar/parar */}
        <TouchableOpacity
          style={[s.sessionBtn, isActive && s.sessionBtnActive]}
          onPress={toggleSession}
        >
          <Text style={s.sessionBtnText}>{isActive ? '⏹ Parar' : '▶ Iniciar'}</Text>
        </TouchableOpacity>

        {/* Micrófono — solo visible en modo ambos móvil */}
        {!hasEarphone && (
          <TouchableOpacity
            style={[s.micBtn, !isActive && s.micDisabled]}
            onPressIn={handleMicPressIn}
            onPressOut={handleMicPressOut}
            disabled={!isActive}
          >
            <Text style={{ fontSize: 26 }}>🎙</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.micHint}>
        {hasEarphone
          ? (isActive ? 'Traducción continua activa · Habla con normalidad' : 'Toca Iniciar para empezar')
          : (isActive ? 'Mantén 🎙 pulsado mientras hablas · Suelta para traducir' : 'Toca Iniciar para empezar')
        }
      </Text>
    </SafeAreaView>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState('login');
  const [sessionConfig, setSessionConfig] = useState(null);

  if (screen === 'login') return <LoginScreen onLogin={() => setScreen('setup')} />;
  if (screen === 'setup') return (
    <SetupScreen onStart={(config) => { setSessionConfig(config); setScreen('translation'); }} />
  );
  return <TranslationScreen config={sessionConfig} onBack={() => setScreen('setup')} />;
}

// ─── ESTILOS ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D14' },

  // Login
  loginContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
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

  // Setup
  setupContainer: { padding: 20 },
  setupTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  setupSub: { fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 24 },
  personCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 16, marginBottom: 16 },
  personLabel: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 14 },
  configSectionLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.1, textTransform: 'uppercase', marginBottom: 8 },
  langScroll: { marginBottom: 14 },
  langChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', marginRight: 8, backgroundColor: 'rgba(255,255,255,0.04)' },
  langChipActiveA: { borderColor: '#818CF8', backgroundColor: 'rgba(129,140,248,0.15)' },
  langChipActiveB: { borderColor: '#C4B5FD', backgroundColor: 'rgba(196,181,253,0.15)' },
  langChipText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  audioSelector: { flexDirection: 'row', gap: 10 },
  audioBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', gap: 4 },
  audioBtnActiveA: { borderColor: '#818CF8', backgroundColor: 'rgba(129,140,248,0.15)' },
  audioBtnActiveB: { borderColor: '#C4B5FD', backgroundColor: 'rgba(196,181,253,0.15)' },
  audioBtnIcon: { fontSize: 24 },
  audioBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  startBtn: { backgroundColor: '#818CF8', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  startBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Translation
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 15, color: '#818CF8', fontWeight: '500' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  statusBadgeActive: { borderColor: 'rgba(52,199,89,0.3)', backgroundColor: 'rgba(52,199,89,0.08)' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  statusDotActive: { backgroundColor: '#34C759' },
  statusText: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  statusTextActive: { color: '#34C759' },

  personsRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 8, marginBottom: 10, alignItems: 'center' },
  personInfo: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderRadius: 18, padding: 12, alignItems: 'center' },
  personInfoIcon: { fontSize: 22, marginBottom: 4 },
  personInfoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 4 },
  personInfoLang: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  speakingIndicator: { marginTop: 6, backgroundColor: 'rgba(129,140,248,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  speakingText: { fontSize: 10, color: '#818CF8', fontWeight: '600' },
  personsArrow: { alignItems: 'center', gap: 4 },
  personsArrowText: { fontSize: 20, color: 'rgba(255,255,255,0.2)' },
  modeLabel: { fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center', maxWidth: 60 },

  partialBox: { marginHorizontal: 14, marginBottom: 6, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 10, padding: 8 },
  partialText: { fontSize: 12, color: '#818CF8', fontStyle: 'italic' },

  sectionLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.08, marginHorizontal: 14, marginBottom: 6, textTransform: 'uppercase' },
  transcriptBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', marginHorizontal: 14, padding: 10 },
  emptyText: { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 20, lineHeight: 22 },
  transcriptLine: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  speakerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, alignSelf: 'flex-start', marginTop: 2 },
  speakerText: { fontSize: 9, fontWeight: '700' },
  originalText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  translatedText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 12 },
  sessionBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' },
  sessionBtnActive: { borderColor: '#34C759', backgroundColor: 'rgba(52,199,89,0.1)' },
  sessionBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
  micBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(99,102,241,0.2)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' },
  micDisabled: { opacity: 0.3 },
  micHint: { fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingHorizontal: 20, paddingBottom: 12 },
});

registerRootComponent(App);