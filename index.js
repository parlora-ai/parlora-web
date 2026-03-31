import { registerRootComponent } from 'expo';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView, Platform, PermissionsAndroid
} from 'react-native';
import Voice from '@react-native-voice/voice';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

const LANGUAGES = [
  { code: 'ES', name: 'Español',   flag: '🇪🇸', voiceLocale: 'es-ES', ttsLocale: 'es-ES' },
  { code: 'EN', name: 'Inglés',    flag: '🇬🇧', voiceLocale: 'en-US', ttsLocale: 'en-US' },
  { code: 'FR', name: 'Francés',   flag: '🇫🇷', voiceLocale: 'fr-FR', ttsLocale: 'fr-FR' },
  { code: 'DE', name: 'Alemán',    flag: '🇩🇪', voiceLocale: 'de-DE', ttsLocale: 'de-DE' },
  { code: 'IT', name: 'Italiano',  flag: '🇮🇹', voiceLocale: 'it-IT', ttsLocale: 'it-IT' },
  { code: 'PT', name: 'Portugués', flag: '🇵🇹', voiceLocale: 'pt-PT', ttsLocale: 'pt-PT' },
  { code: 'SK', name: 'Eslovaco',  flag: '🇸🇰', voiceLocale: 'sk-SK', ttsLocale: 'sk-SK' },
];

const BACKEND = 'https://parlora-backend.onrender.com';

async function requestMic() {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      { title: 'Micrófono', message: 'Parlora AI necesita el micrófono.', buttonPositive: 'Permitir' }
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
        <TouchableOpacity style={s.emailBtn} onPress={() => Alert.alert('Próximamente', 'Login con email en la próxima versión.')}>
          <Text style={s.emailBtnText}>Usar correo electrónico</Text>
        </TouchableOpacity>
        <Text style={s.terms}>Al continuar aceptas los <Text style={s.termsLink}>Términos</Text> y la <Text style={s.termsLink}>Privacidad</Text></Text>
      </View>
    </SafeAreaView>
  );
}

// ─── SETUP ───────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [mode, setMode] = useState(null); // null | 'conversation' | 'conference'
  const [langA, setLangA] = useState('ES');
  const [langB, setLangB] = useState('EN');
  const [confSourceLang, setConfSourceLang] = useState('EN');
  const [confTargetLang, setConfTargetLang] = useState('ES');

  if (!mode) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.modeContainer}>
          <View style={s.logoWrap}><Text style={s.logoEmoji}>🌐</Text></View>
          <Text style={s.setupTitle}>Elige el modo</Text>
          <Text style={s.setupSub}>¿Cómo vas a usar Parlora AI?</Text>

          <TouchableOpacity style={s.modeCard} onPress={() => setMode('conversation')}>
            <Text style={s.modeIcon}>💬</Text>
            <View style={s.modeTextWrap}>
              <Text style={s.modeTitle}>Conversación</Text>
              <Text style={s.modeDesc}>Dos personas se turnan para hablar. Cada una pulsa su micrófono.</Text>
            </View>
            <Text style={s.modeArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.modeCard, s.modeCardConf]} onPress={() => setMode('conference')}>
            <Text style={s.modeIcon}>🎤</Text>
            <View style={s.modeTextWrap}>
              <Text style={[s.modeTitle, { color: '#C4B5FD' }]}>Modo conferencia</Text>
              <Text style={s.modeDesc}>El móvil capta al ponente. Tú escuchas la traducción en tu auricular en tiempo real.</Text>
            </View>
            <Text style={s.modeArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'conversation') {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.setupContainer}>
          <TouchableOpacity onPress={() => setMode(null)} style={s.backBtn}>
            <Text style={s.backBtnText}>‹ Volver</Text>
          </TouchableOpacity>
          <Text style={s.setupTitle}>Conversación</Text>
          <Text style={s.setupSub}>Elige el idioma de cada persona</Text>

          {[
            { side: 'A', lang: langA, setLang: setLangA, color: '#818CF8', activeStyle: s.langChipActiveA },
            { side: 'B', lang: langB, setLang: setLangB, color: '#C4B5FD', activeStyle: s.langChipActiveB },
          ].map(({ side, lang, setLang, color, activeStyle }) => (
            <View key={side} style={s.personCard}>
              <Text style={[s.personLabel, { color }]}>📱 Persona {side}</Text>
              <Text style={s.configSectionLabel}>Idioma</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
                {LANGUAGES.map(l => (
                  <TouchableOpacity key={l.code} style={[s.langChip, lang === l.code && activeStyle]} onPress={() => setLang(l.code)}>
                    <Text style={[s.langChipText, lang === l.code && { color }]}>{l.flag} {l.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}

          <TouchableOpacity style={s.startBtn} onPress={() => onStart({ mode: 'conversation', langA, langB })}>
            <Text style={s.startBtnText}>Iniciar sesión →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Modo conferencia
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.setupContainer}>
        <TouchableOpacity onPress={() => setMode(null)} style={s.backBtn}>
          <Text style={s.backBtnText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.setupTitle}>Modo conferencia</Text>
        <Text style={s.setupSub}>El móvil escucha al ponente y tú recibes la traducción en tu auricular</Text>

        <View style={s.personCard}>
          <Text style={[s.personLabel, { color: '#C4B5FD' }]}>🎤 Idioma del ponente</Text>
          <Text style={s.configSectionLabel}>El ponente habla en...</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
            {LANGUAGES.map(l => (
              <TouchableOpacity key={l.code} style={[s.langChip, confSourceLang === l.code && s.langChipActiveB]} onPress={() => setConfSourceLang(l.code)}>
                <Text style={[s.langChipText, confSourceLang === l.code && { color: '#C4B5FD' }]}>{l.flag} {l.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={s.personCard}>
          <Text style={[s.personLabel, { color: '#818CF8' }]}>🎧 Tu idioma</Text>
          <Text style={s.configSectionLabel}>Quieres escuchar en...</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
            {LANGUAGES.map(l => (
              <TouchableOpacity key={l.code} style={[s.langChip, confTargetLang === l.code && s.langChipActiveA]} onPress={() => setConfTargetLang(l.code)}>
                <Text style={[s.langChipText, confTargetLang === l.code && { color: '#818CF8' }]}>{l.flag} {l.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={s.confTipBox}>
          <Text style={s.confTipText}>💡 Conecta tus auriculares Bluetooth antes de iniciar. Pon el móvil cerca del ponente o micrófono.</Text>
        </View>

        <TouchableOpacity style={[s.startBtn, { backgroundColor: '#7C3AED' }]} onPress={() => onStart({ mode: 'conference', confSourceLang, confTargetLang })}>
          <Text style={s.startBtnText}>Iniciar conferencia →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── CONVERSATION SCREEN ──────────────────────────────────────────
function ConversationScreen({ config, onBack }) {
  const { langA, langB } = config;
  const langAObj = LANGUAGES.find(l => l.code === langA);
  const langBObj = LANGUAGES.find(l => l.code === langB);

  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [partialText, setPartialText] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [status, setStatus] = useState('Pausado');
  const [lastTranslation, setLastTranslation] = useState(null);
  const scrollRef = useRef(null);
  const isActiveRef = useRef(false);
  const activeSpeakerRef = useRef(null);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { activeSpeakerRef.current = activeSpeaker; }, [activeSpeaker]);
  useEffect(() => {
    if (transcript.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  useEffect(() => {
    Voice.onSpeechPartialResults = (e) => setPartialText(e.value?.[0] ?? '');
    Voice.onSpeechResults = async (e) => {
      const text = e.value?.[0] ?? '';
      setPartialText('');
      if (!text.trim()) return;
      const spk = activeSpeakerRef.current;
      if (spk) await doTranslate(text.trim(), spk);
      setActiveSpeaker(null);
    };
    Voice.onSpeechError = () => { setPartialText(''); setActiveSpeaker(null); };
    return () => { Voice.destroy().then(Voice.removeAllListeners); };
  }, [langA, langB]);

  const startVoice = async (speaker) => {
    const locale = speaker === 'A' ? langAObj.voiceLocale : langBObj.voiceLocale;
    try { await Voice.start(locale); } catch (e) { console.log(e); }
  };

  const stopVoice = async () => {
    try { await Voice.stop(); await Voice.destroy(); } catch (e) {}
    setPartialText(''); setActiveSpeaker(null);
  };

  const doTranslate = async (text, speaker) => {
    const srcLang = speaker === 'A' ? langA : langB;
    const tgtLang = speaker === 'A' ? langB : langA;
    const tgtObj  = speaker === 'A' ? langBObj : langAObj;
    setStatus('Traduciendo...');
    try {
      const res = await fetch(`${BACKEND}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source_lang: srcLang, target_lang: tgtLang, engine: 'deepl' }),
      });
      const data = await res.json();
      const translated = data.translatedText ?? '(sin traducción)';
      const line = { id: Date.now().toString(), speaker, original: text, translated,
        srcFlag: speaker === 'A' ? langAObj.flag : langBObj.flag,
        tgtFlag: speaker === 'A' ? langBObj.flag : langAObj.flag, ttsLocale: tgtObj.ttsLocale };
      setTranscript(prev => [...prev.slice(-49), line]);
      setLastTranslation(line);
      Speech.speak(translated, { language: tgtObj.ttsLocale, rate: 0.95 });
      setStatus('Sesión activa');
    } catch { setStatus('Error de red'); setTimeout(() => setStatus('Sesión activa'), 2000); }
  };

  const toggleSession = async () => {
    if (isActive) { await stopVoice(); setIsActive(false); setStatus('Pausado'); Speech.stop(); }
    else {
      const ok = await requestMic();
      if (!ok) { Alert.alert('Permiso denegado', 'Necesitas permitir el micrófono.'); return; }
      setIsActive(true); setStatus('Sesión activa');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backBtnText}>‹ Volver</Text></TouchableOpacity>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>{status}</Text>
        </View>
        <TouchableOpacity style={[s.repeatBtn, !lastTranslation && s.repeatBtnDisabled]} onPress={() => { if (lastTranslation) { Speech.stop(); Speech.speak(lastTranslation.translated, { language: lastTranslation.ttsLocale, rate: 0.9 }); }}} disabled={!lastTranslation}>
          <Text style={s.repeatBtnIcon}>🔁</Text>
        </TouchableOpacity>
      </View>

      <View style={s.personsRow}>
        {[{ side: 'A', langObj: langAObj, color: '#818CF8' }, { side: 'B', langObj: langBObj, color: '#C4B5FD' }].map(({ side, langObj, color }) => (
          <View key={side} style={[s.personInfo, { borderColor: activeSpeaker === side ? color : 'rgba(255,255,255,0.08)' }]}>
            <Text style={s.personInfoIcon}>📱</Text>
            <Text style={[s.personInfoLabel, { color }]}>Persona {side}</Text>
            <Text style={s.personInfoLang}>{langObj.flag} {langObj.name}</Text>
            {activeSpeaker === side && <View style={[s.speakingBadge, { backgroundColor: `${color}22` }]}><Text style={[s.speakingText, { color }]}>hablando</Text></View>}
          </View>
        ))}
      </View>

      {partialText ? <View style={s.partialBox}><Text style={s.partialText}>🎙 {partialText}</Text></View> : null}

      <Text style={s.sectionLabel}>Transcripción en vivo</Text>
      <ScrollView ref={scrollRef} style={s.transcriptBox}>
        {transcript.length === 0 && <Text style={s.emptyText}>Toca Iniciar y mantén pulsado{'\n'}🎙 A o 🎙 B para hablar</Text>}
        {transcript.map(line => (
          <View key={line.id} style={s.transcriptLine}>
            <View style={[s.speakerBadge, { backgroundColor: line.speaker === 'A' ? 'rgba(129,140,248,0.15)' : 'rgba(196,181,253,0.15)' }]}>
              <Text style={[s.speakerText, { color: line.speaker === 'A' ? '#818CF8' : '#C4B5FD' }]}>{line.speaker}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.originalText}>{line.srcFlag} {line.original}</Text>
              <Text style={s.translatedText}>{line.tgtFlag} {line.translated}</Text>
            </View>
            <TouchableOpacity style={s.lineRepeatBtn} onPress={() => { Speech.stop(); Speech.speak(line.translated, { language: line.ttsLocale, rate: 0.9 }); }}>
              <Text style={s.lineRepeatIcon}>🔁</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={s.controls}>
        <TouchableOpacity
          style={[s.micBtn, { borderColor: 'rgba(129,140,248,0.4)', backgroundColor: activeSpeaker === 'A' ? 'rgba(129,140,248,0.3)' : 'rgba(129,140,248,0.1)' }, !isActive && s.micDisabled]}
          onPressIn={async () => { if (!isActive) return; setActiveSpeaker('A'); await startVoice('A'); }}
          onPressOut={stopVoice} disabled={!isActive}
        >
          <Text style={s.micIcon}>🎙</Text>
          <Text style={[s.micLabel, { color: '#818CF8' }]}>A</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.sessionBtn, isActive && s.sessionBtnActive]} onPress={toggleSession}>
          <Text style={s.sessionBtnText}>{isActive ? '⏹ Parar' : '▶ Iniciar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.micBtn, { borderColor: 'rgba(196,181,253,0.4)', backgroundColor: activeSpeaker === 'B' ? 'rgba(196,181,253,0.3)' : 'rgba(196,181,253,0.1)' }, !isActive && s.micDisabled]}
          onPressIn={async () => { if (!isActive) return; setActiveSpeaker('B'); await startVoice('B'); }}
          onPressOut={stopVoice} disabled={!isActive}
        >
          <Text style={s.micIcon}>🎙</Text>
          <Text style={[s.micLabel, { color: '#C4B5FD' }]}>B</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.micHint}>{isActive ? 'Mantén pulsado 🎙 A o 🎙 B mientras hablas' : 'Toca Iniciar para empezar'}</Text>
    </SafeAreaView>
  );
}

// ─── CONFERENCE SCREEN ────────────────────────────────────────────
function ConferenceScreen({ config, onBack }) {
  const { confSourceLang, confTargetLang } = config;
  const srcObj = LANGUAGES.find(l => l.code === confSourceLang);
  const tgtObj = LANGUAGES.find(l => l.code === confTargetLang);

  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [partialText, setPartialText] = useState('');
  const [status, setStatus] = useState('Pausado');
  const [lastTranslation, setLastTranslation] = useState(null);
  const scrollRef = useRef(null);
  const isActiveRef = useRef(false);
  const silenceTimer = useRef(null);
  const lastPartial = useRef('');

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => {
    if (transcript.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  useEffect(() => {
    Voice.onSpeechPartialResults = (e) => {
      const text = e.value?.[0] ?? '';
      setPartialText(text);
      lastPartial.current = text;
      // Reiniciar timer de silencio en cada resultado parcial
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(async () => {
        if (lastPartial.current.trim()) {
          await doTranslate(lastPartial.current.trim());
          lastPartial.current = '';
          setPartialText('');
        }
      }, 1500); // 1.5s de silencio = frase completa
    };

    Voice.onSpeechResults = async (e) => {
      const text = e.value?.[0] ?? '';
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      setPartialText('');
      lastPartial.current = '';
      if (text.trim()) await doTranslate(text.trim());
      // Reiniciar escucha continua
      if (isActiveRef.current) setTimeout(() => startVoice(), 300);
    };

    Voice.onSpeechError = () => {
      setPartialText('');
      if (isActiveRef.current) setTimeout(() => startVoice(), 800);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, [confSourceLang, confTargetLang]);

  const startVoice = async () => {
    try { await Voice.start(srcObj.voiceLocale); setStatus('Escuchando...'); } catch (e) { console.log(e); }
  };

  const stopVoice = async () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    try { await Voice.stop(); await Voice.destroy(); } catch (e) {}
    setPartialText(''); lastPartial.current = '';
  };

  const doTranslate = async (text) => {
    setStatus('Traduciendo...');
    try {
      const res = await fetch(`${BACKEND}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source_lang: confSourceLang, target_lang: confTargetLang, engine: 'deepl' }),
      });
      const data = await res.json();
      const translated = data.translatedText ?? '(sin traducción)';
      const line = { id: Date.now().toString(), original: text, translated, srcFlag: srcObj.flag, tgtFlag: tgtObj.flag, ttsLocale: tgtObj.ttsLocale };
      setTranscript(prev => [...prev.slice(-49), line]);
      setLastTranslation(line);
      // Audio por auricular Bluetooth (configuración por defecto de Android cuando hay auricular conectado)
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, playThroughEarpieceAndroid: false });
      Speech.speak(translated, { language: tgtObj.ttsLocale, rate: 0.95 });
      setStatus('Escuchando...');
    } catch { setStatus('Error de red'); setTimeout(() => { if (isActiveRef.current) setStatus('Escuchando...'); }, 2000); }
  };

  const toggleSession = async () => {
    if (isActive) {
      await stopVoice(); setIsActive(false); setStatus('Pausado'); Speech.stop();
    } else {
      const ok = await requestMic();
      if (!ok) { Alert.alert('Permiso denegado', 'Necesitas permitir el micrófono.'); return; }
      setIsActive(true);
      await startVoice();
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backBtnText}>‹ Volver</Text></TouchableOpacity>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>{status}</Text>
        </View>
        <TouchableOpacity style={[s.repeatBtn, !lastTranslation && s.repeatBtnDisabled]} onPress={() => { if (lastTranslation) { Speech.stop(); Speech.speak(lastTranslation.translated, { language: lastTranslation.ttsLocale, rate: 0.9 }); }}} disabled={!lastTranslation}>
          <Text style={s.repeatBtnIcon}>🔁</Text>
        </TouchableOpacity>
      </View>

      {/* Info conferencia */}
      <View style={s.confInfoRow}>
        <View style={[s.confInfoCard, { borderColor: 'rgba(196,181,253,0.3)' }]}>
          <Text style={s.personInfoIcon}>🎤</Text>
          <Text style={[s.personInfoLabel, { color: '#C4B5FD' }]}>Ponente</Text>
          <Text style={s.personInfoLang}>{srcObj.flag} {srcObj.name}</Text>
        </View>
        <Text style={s.confArrow}>→</Text>
        <View style={[s.confInfoCard, { borderColor: 'rgba(129,140,248,0.3)' }]}>
          <Text style={s.personInfoIcon}>🎧</Text>
          <Text style={[s.personInfoLabel, { color: '#818CF8' }]}>Tú escuchas</Text>
          <Text style={s.personInfoLang}>{tgtObj.flag} {tgtObj.name}</Text>
        </View>
      </View>

      {/* Indicador de escucha */}
      {isActive && (
        <View style={s.listeningIndicator}>
          <View style={[s.listeningDot, { backgroundColor: partialText ? '#EF4444' : '#34C759' }]} />
          <Text style={s.listeningText}>
            {partialText ? 'Detectando voz...' : 'Esperando al ponente...'}
          </Text>
        </View>
      )}

      {partialText ? <View style={s.partialBox}><Text style={s.partialText}>🎙 {partialText}</Text></View> : null}

      <Text style={s.sectionLabel}>Transcripción en vivo</Text>
      <ScrollView ref={scrollRef} style={s.transcriptBox}>
        {transcript.length === 0 && (
          <Text style={s.emptyText}>
            Pon el móvil cerca del ponente{'\n'}y toca Iniciar
          </Text>
        )}
        {transcript.map(line => (
          <View key={line.id} style={s.transcriptLine}>
            <View style={{ flex: 1 }}>
              <Text style={s.originalText}>{line.srcFlag} {line.original}</Text>
              <Text style={s.translatedText}>{line.tgtFlag} {line.translated}</Text>
            </View>
            <TouchableOpacity style={s.lineRepeatBtn} onPress={() => { Speech.stop(); Speech.speak(line.translated, { language: line.ttsLocale, rate: 0.9 }); }}>
              <Text style={s.lineRepeatIcon}>🔁</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={s.controls}>
        <TouchableOpacity style={[s.sessionBtnLarge, isActive && s.sessionBtnActive]} onPress={toggleSession}>
          <Text style={s.sessionBtnText}>{isActive ? '⏹ Parar conferencia' : '▶ Iniciar conferencia'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.micHint}>{isActive ? 'Escucha continua · La traducción llega a tu auricular automáticamente' : 'Conecta tu auricular Bluetooth antes de iniciar'}</Text>
    </SafeAreaView>
  );
}

// ─── APP ──────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState('login');
  const [sessionConfig, setSessionConfig] = useState(null);

  if (screen === 'login') return <LoginScreen onLogin={() => setScreen('setup')} />;
  if (screen === 'setup') return (
    <SetupScreen onStart={(c) => { setSessionConfig(c); setScreen('session'); }} />
  );
  if (screen === 'session') {
    if (sessionConfig.mode === 'conference') {
      return <ConferenceScreen config={sessionConfig} onBack={() => setScreen('setup')} />;
    }
    return <ConversationScreen config={sessionConfig} onBack={() => setScreen('setup')} />;
  }
  return null;
}

// ─── ESTILOS ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D14' },
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
  modeContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(129,140,248,0.3)', borderRadius: 20, padding: 18, width: '100%', marginBottom: 14 },
  modeCardConf: { borderColor: 'rgba(196,181,253,0.3)' },
  modeIcon: { fontSize: 32 },
  modeTextWrap: { flex: 1 },
  modeTitle: { fontSize: 16, fontWeight: '700', color: '#818CF8', marginBottom: 4 },
  modeDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18 },
  modeArrow: { fontSize: 20, color: 'rgba(255,255,255,0.2)' },
  setupContainer: { padding: 20 },
  setupTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  setupSub: { fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 24, lineHeight: 20 },
  personCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 16, marginBottom: 16 },
  personLabel: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  configSectionLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.1, textTransform: 'uppercase', marginBottom: 8 },
  langScroll: { marginBottom: 4 },
  langChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', marginRight: 8, backgroundColor: 'rgba(255,255,255,0.04)' },
  langChipActiveA: { borderColor: '#818CF8', backgroundColor: 'rgba(129,140,248,0.15)' },
  langChipActiveB: { borderColor: '#C4B5FD', backgroundColor: 'rgba(196,181,253,0.15)' },
  langChipText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  confTipBox: { backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 0.5, borderColor: 'rgba(99,102,241,0.2)', borderRadius: 14, padding: 14, marginBottom: 16 },
  confTipText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
  startBtn: { backgroundColor: '#818CF8', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  startBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 15, color: '#818CF8', fontWeight: '500' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  statusBadgeActive: { borderColor: 'rgba(52,199,89,0.3)', backgroundColor: 'rgba(52,199,89,0.08)' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  statusDotActive: { backgroundColor: '#34C759' },
  statusText: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  statusTextActive: { color: '#34C759' },
  repeatBtn: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  repeatBtnDisabled: { opacity: 0.3 },
  repeatBtnIcon: { fontSize: 16 },
  personsRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 10, marginBottom: 10 },
  personInfo: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderRadius: 18, padding: 12, alignItems: 'center' },
  confInfoRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 8, marginBottom: 10, alignItems: 'center' },
  confInfoCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderRadius: 18, padding: 12, alignItems: 'center' },
  confArrow: { fontSize: 20, color: 'rgba(255,255,255,0.2)' },
  personInfoIcon: { fontSize: 22, marginBottom: 4 },
  personInfoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 4 },
  personInfoLang: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  speakingBadge: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  speakingText: { fontSize: 10, fontWeight: '600' },
  listeningIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 10 },
  listeningDot: { width: 8, height: 8, borderRadius: 4 },
  listeningText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  partialBox: { marginHorizontal: 14, marginBottom: 6, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 10, padding: 8 },
  partialText: { fontSize: 12, color: '#818CF8', fontStyle: 'italic' },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.08, marginHorizontal: 14, marginBottom: 6, textTransform: 'uppercase' },
  transcriptBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', marginHorizontal: 14, padding: 10 },
  emptyText: { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 20, lineHeight: 22 },
  transcriptLine: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  speakerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, alignSelf: 'flex-start', marginTop: 2 },
  speakerText: { fontSize: 9, fontWeight: '700' },
  originalText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  translatedText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },
  lineRepeatBtn: { padding: 4, alignSelf: 'center' },
  lineRepeatIcon: { fontSize: 14 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 12 },
  sessionBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' },
  sessionBtnLarge: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' },
  sessionBtnActive: { borderColor: '#34C759', backgroundColor: 'rgba(52,199,89,0.1)' },
  sessionBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
  micBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  micDisabled: { opacity: 0.3 },
  micIcon: { fontSize: 22 },
  micLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  micHint: { fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingHorizontal: 20, paddingBottom: 12 },
});

registerRootComponent(App);