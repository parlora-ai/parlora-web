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

// Pasos de instalación para STT y TTS
function getInstallStepsStt(langName) {
  return [
    'Abre Ajustes en tu móvil',
    'Ve a Gestión general → Idioma → Entrada de texto',
    'Selecciona "Google Voice Typing" o "Samsung Voice Input"',
    `Busca "${langName}" y descarga el paquete de voz`,
    'Reinicia Parlora AI',
  ];
}

function getInstallStepsTts(langName) {
  return [
    'Abre Ajustes en tu móvil',
    'Ve a Gestión general → Idioma → Texto a voz',
    'Selecciona "Motor de texto a voz de Google"',
    `Toca el engranaje ⚙️ → Instalar datos de voz → Busca "${langName}"`,
    'Descarga el paquete y reinicia Parlora AI',
  ];
}

// Despertar el backend al arrancar (Render duerme tras 15min de inactividad)
async function warmUpBackend() {
  try {
    await fetch(`${BACKEND}/`, { method: 'GET' });
  } catch (e) {}
}

// Caracteres de corte natural (pausas del habla)
const NATURAL_BREAKS = /[.!?,:;]\s+|\s+(y|pero|sin embargo|aunque|porque|que|entonces|además|however|but|and|because|so|then|also)\s+/i;
const MAX_WORDS_BEFORE_FORCE_TRANSLATE = 15;

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

async function callTranslate(text, srcLang, tgtLang) {
  const res = await fetch(`${BACKEND}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source_lang: srcLang, target_lang: tgtLang, engine: 'deepl' }),
  });
  const data = await res.json();
  return data.translatedText ?? '(sin traducción)';
}

// Detectar si hay un punto de corte natural en el texto
function findNaturalBreak(text) {
  const words = text.trim().split(' ');
  if (words.length < 5) return null; // mínimo 5 palabras antes de cortar

  const match = NATURAL_BREAKS.exec(text);
  if (match && match.index > 20) { // al menos 20 chars antes del corte
    return match.index + match[0].length;
  }

  // Forzar corte por palabras si supera el máximo
  if (words.length >= MAX_WORDS_BEFORE_FORCE_TRANSLATE) {
    // Cortar en la última palabra completa
    return words.slice(0, MAX_WORDS_BEFORE_FORCE_TRANSLATE).join(' ').length;
  }

  return null;
}

// ─── LOGIN ────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.loginContainer}>
        <View style={s.logoWrap}><Text style={s.logoEmoji}>🌐</Text></View>
        <Text style={s.appName}>Parlora AI</Text>
        <Text style={s.tagline}>Traducción simultánea{'\n'}para conversaciones reales</Text>
        <TouchableOpacity style={s.googleBtn} onPress={() => { warmUpBackend(); onLogin(); }}>
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
  const [mode, setMode] = useState(null);
  const [langA, setLangA] = useState('ES');
  const [langB, setLangB] = useState('EN');
  const [confSourceLang, setConfSourceLang] = useState('EN');
  const [confTargetLang, setConfTargetLang] = useState('ES');
  const [confHardware, setConfHardware] = useState(null);
  const [sttWarning, setSttWarning] = useState(null);
  // deviceSupport: { [langCode]: { stt: bool, tts: bool } }
  const [deviceSupport, setDeviceSupport] = useState({});
  const [checkingSupport, setCheckingSupport] = useState(true);

  // Comprobar soporte del dispositivo al montar
  useEffect(() => {
    async function checkDeviceSupport() {
      const support = {};

      // Comprobar STT — obtener locales disponibles
      let sttLocales = [];
      try {
        const locales = await Voice.getSupportedLocales();
        sttLocales = (locales || []).map(l => l.toLowerCase());
      } catch (e) {
        // Si falla, asumir que soporta los básicos
        sttLocales = ['es-es', 'en-us', 'fr-fr', 'de-de', 'it-it', 'pt-pt'];
      }

      // Comprobar TTS — obtener voces disponibles
      let ttsLocales = [];
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        ttsLocales = (voices || []).map(v => (v.language || '').toLowerCase());
      } catch (e) {
        ttsLocales = ['es-es', 'en-us', 'fr-fr', 'de-de', 'it-it', 'pt-pt'];
      }

      // Evaluar cada idioma de Parlora AI
      for (const lang of LANGUAGES) {
        const voiceBase = lang.voiceLocale.toLowerCase();
        const ttsBase = lang.ttsLocale.toLowerCase();
        const langBase = lang.code.toLowerCase();

        const sttOk = sttLocales.length === 0 || // si no devuelve nada asumir OK
          sttLocales.some(l => l.startsWith(langBase) || l === voiceBase || l.startsWith(voiceBase.slice(0,2)));

        const ttsOk = ttsLocales.length === 0 ||
          ttsLocales.some(l => l.startsWith(langBase) || l === ttsBase || l.startsWith(ttsBase.slice(0,2)));

        support[lang.code] = { stt: sttOk, tts: ttsOk };
      }

      setDeviceSupport(support);
      setCheckingSupport(false);
    }
    checkDeviceSupport();
  }, []);

  // Generar aviso según qué falta (STT, TTS o ambos)
  function getWarning(lang) {
    const sup = deviceSupport[lang.code];
    if (!sup || (sup.stt && sup.tts)) return null;

    if (!sup.stt && !sup.tts) {
      return {
        title: `⚠️ ${lang.name} no está disponible`,
        desc: `Tu dispositivo no puede ni escuchar ni pronunciar en ${lang.name}.`,
        sections: [
          { label: 'Para el reconocimiento de voz (escuchar):', steps: getInstallStepsStt(lang.name) },
          { label: 'Para la voz sintetizada (pronunciar):', steps: getInstallStepsTts(lang.name) },
        ],
      };
    }
    if (!sup.stt) {
      return {
        title: `⚠️ Reconocimiento de voz no disponible`,
        desc: `Tu dispositivo no puede transcribir lo que dices en ${lang.name}. Sin esto, no hay texto que traducir.`,
        sections: [{ label: 'Cómo instalar el reconocimiento de voz:', steps: getInstallStepsStt(lang.name) }],
      };
    }
    if (!sup.tts) {
      return {
        title: `⚠️ Voz sintetizada no disponible`,
        desc: `Tu dispositivo no tiene la voz en ${lang.name} instalada. La pronunciación de las traducciones puede sonar incorrecta o en otro idioma.`,
        sections: [{ label: 'Cómo instalar la voz:', steps: getInstallStepsTts(lang.name) }],
      };
    }
    return null;
  }

  if (!mode) {
    return (
      <SafeAreaView style={s.safe}>
        {sttWarning && (
          <View style={s.sttModalOverlay}>
            <View style={s.sttModal}>
              <Text style={s.sttModalTitle}>{sttWarning.title}</Text>
              <Text style={s.sttModalDesc}>{sttWarning.desc}</Text>
              {sttWarning.sections.map((section, si) => (
                <View key={si} style={{ marginBottom: 12 }}>
                  <Text style={s.sttModalSectionLabel}>{section.label}</Text>
                  {section.steps.map((step, i) => (
                    <Text key={i} style={s.sttModalStep}>{i + 1}. {step}</Text>
                  ))}
                </View>
              ))}
              <TouchableOpacity style={s.sttModalBtn} onPress={() => setSttWarning(null)}>
                <Text style={s.sttModalBtnText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={s.modeContainer}>
          <View style={s.logoWrap}><Text style={s.logoEmoji}>🌐</Text></View>
          <Text style={s.setupTitle}>Elige el modo</Text>
          <Text style={s.setupSub}>¿Cómo vas a usar Parlora AI?</Text>
          <TouchableOpacity style={s.modeCard} onPress={() => setMode('conversation')}>
            <Text style={s.modeIcon}>💬</Text>
            <View style={s.modeTextWrap}>
              <Text style={s.modeTitle}>Conversación</Text>
              <Text style={s.modeDesc}>Dos personas se turnan. Cada una pulsa su micrófono mientras habla.</Text>
            </View>
            <Text style={s.modeArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.modeCard, s.modeCardConf]} onPress={() => setMode('conference')}>
            <Text style={s.modeIcon}>🎤</Text>
            <View style={s.modeTextWrap}>
              <Text style={[s.modeTitle, { color: '#C4B5FD' }]}>Modo conferencia</Text>
              <Text style={s.modeDesc}>El móvil escucha al ponente y tú recibes la traducción casi simultánea.</Text>
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
          <TouchableOpacity onPress={() => setMode(null)} style={s.backBtn}><Text style={s.backBtnText}>‹ Volver</Text></TouchableOpacity>
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
                  <TouchableOpacity
                    key={l.code}
                    style={[s.langChip, lang === l.code && activeStyle, getWarning(l) && s.langChipWarning]}
                    onPress={() => {
                      setLang(l.code);
                      const warning = getWarning(l);
                      if (warning) setSttWarning(warning);
                    }}
                  >
                    <Text style={[s.langChipText, lang === l.code && { color }]}>
                      {l.flag} {l.name}{getWarning(l) ? ' ⚠️' : ''}
                    </Text>
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

  // Conferencia
  if (!confHardware) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.setupContainer}>
          <TouchableOpacity onPress={() => setMode(null)} style={s.backBtn}><Text style={s.backBtnText}>‹ Volver</Text></TouchableOpacity>
          <Text style={s.setupTitle}>Modo conferencia</Text>
          <Text style={s.setupSub}>Para funcionar correctamente necesitas uno de estos setups de hardware</Text>

          <View style={s.warningBox}>
            <Text style={s.warningTitle}>⚠️ Requisito de hardware</Text>
            <Text style={s.warningText}>Sin el hardware adecuado, el micrófono captará la traducción y creará un bucle. Elige tu setup:</Text>
          </View>

          <TouchableOpacity style={s.hardwareCard} onPress={() => setConfHardware('anc')}>
            <Text style={s.hardwareIcon}>🎧</Text>
            <View style={s.modeTextWrap}>
              <Text style={s.hardwareTitle}>Auriculares con cancelación de ruido activa (ANC)</Text>
              <Text style={s.hardwareDesc}>AirPods Pro, Sony WH-1000XM5, Bose QC45... El ANC evita que el micrófono capte el audio del auricular.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.hardwareCard} onPress={() => setConfHardware('extmic')}>
            <Text style={s.hardwareIcon}>🎙️</Text>
            <View style={s.modeTextWrap}>
              <Text style={s.hardwareTitle}>Micrófono externo</Text>
              <Text style={s.hardwareDesc}>Conecta un micrófono externo al móvil y apúntalo al ponente. La traducción sale por el altavoz en otra dirección.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[s.hardwareCard, { borderColor: 'rgba(255,100,100,0.3)', backgroundColor: 'rgba(255,100,100,0.05)' }]} onPress={() => setConfHardware('risk')}>
            <Text style={s.hardwareIcon}>⚠️</Text>
            <View style={s.modeTextWrap}>
              <Text style={[s.hardwareTitle, { color: '#F0997B' }]}>Continuar sin hardware adecuado</Text>
              <Text style={s.hardwareDesc}>La traducción puede no ser correcta. El micrófono puede captar el audio de la traducción.</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.setupContainer}>
        <TouchableOpacity onPress={() => setConfHardware(null)} style={s.backBtn}><Text style={s.backBtnText}>‹ Volver</Text></TouchableOpacity>
        <Text style={s.setupTitle}>Modo conferencia</Text>
        <Text style={s.setupSub}>
          {confHardware === 'anc' ? '🎧 Auriculares ANC detectados' :
           confHardware === 'extmic' ? '🎙️ Micrófono externo' : '⚠️ Sin hardware óptimo'}
        </Text>

        <View style={s.personCard}>
          <Text style={[s.personLabel, { color: '#C4B5FD' }]}>🎤 Idioma del ponente</Text>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
            {LANGUAGES.map(l => (
              <TouchableOpacity key={l.code} style={[s.langChip, confTargetLang === l.code && s.langChipActiveA]} onPress={() => setConfTargetLang(l.code)}>
                <Text style={[s.langChipText, confTargetLang === l.code && { color: '#818CF8' }]}>{l.flag} {l.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {confHardware === 'risk' && (
          <View style={s.warningBox}>
            <Text style={s.warningText}>⚠️ Sin hardware adecuado la calidad puede ser baja. El micrófono puede captar el audio de la traducción.</Text>
          </View>
        )}

        <TouchableOpacity style={[s.startBtn, { backgroundColor: '#7C3AED' }]}
          onPress={() => onStart({ mode: 'conference', confSourceLang, confTargetLang, confHardware })}>
          <Text style={s.startBtnText}>Iniciar conferencia →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── CONVERSATION SCREEN ──────────────────────────────────────────
// Lógica: pulsar → STT acumula TODO → soltar → traducir de golpe
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
  const accumulatedTextRef = useRef(''); // acumula TODO el texto mientras pulsas
  const finalTextRef = useRef('');       // texto final confirmado por onSpeechResults
  const isTranslatingRef = useRef(false);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { activeSpeakerRef.current = activeSpeaker; }, [activeSpeaker]);
  useEffect(() => {
    if (transcript.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  useEffect(() => {
    Voice.onSpeechPartialResults = (e) => {
      const text = e.value?.[0] ?? '';
      setPartialText(text);
      accumulatedTextRef.current = text; // siempre guardar el último parcial
    };

    Voice.onSpeechResults = (e) => {
      // Resultado final del STT — guardar en finalTextRef (más completo que el parcial)
      const text = e.value?.[0] ?? '';
      if (text) {
        finalTextRef.current = text;
        accumulatedTextRef.current = text;
        setPartialText(text);
      }
    };

    Voice.onSpeechError = () => {
      // Error es normal al parar — usamos el acumulado
    };

    return () => { Voice.destroy().then(Voice.removeAllListeners); };
  }, []);

  const startVoice = async (speaker) => {
    accumulatedTextRef.current = '';
    setPartialText('');
    const locale = speaker === 'A' ? langAObj.voiceLocale : langBObj.voiceLocale;
    try { await Voice.start(locale); } catch (e) { console.log(e); }
  };

  const stopVoiceAndTranslate = async () => {
    // 1. Parar STT y esperar 400ms para que llegue onSpeechResults con texto completo
    try { await Voice.stop(); } catch (e) {}
    await new Promise(resolve => setTimeout(resolve, 400));

    // 2. Usar el texto final si llegó, o el acumulado parcial
    const text = (finalTextRef.current || accumulatedTextRef.current).trim();
    const speaker = activeSpeakerRef.current;

    setPartialText('');
    accumulatedTextRef.current = '';
    finalTextRef.current = '';
    setActiveSpeaker(null);

    if (!text || !speaker || isTranslatingRef.current) return;

    // 3. Traducir
    isTranslatingRef.current = true;
    setStatus('Traduciendo...');
    const srcLang = speaker === 'A' ? langA : langB;
    const tgtLang = speaker === 'A' ? langB : langA;
    const tgtObj  = speaker === 'A' ? langBObj : langAObj;

    try {
      const translated = await callTranslate(text, srcLang, tgtLang);
      const line = {
        id: Date.now().toString(), speaker, original: text, translated,
        srcFlag: speaker === 'A' ? langAObj.flag : langBObj.flag,
        tgtFlag: speaker === 'A' ? langBObj.flag : langAObj.flag,
        ttsLocale: tgtObj.ttsLocale,
      };
      setTranscript(prev => [...prev.slice(-49), line]);
      setLastTranslation(line);
      Speech.speak(translated, { language: tgtObj.ttsLocale, rate: 0.95 });
      setStatus('Sesión activa');
    } catch {
      setStatus('Error de red');
      setTimeout(() => setStatus('Sesión activa'), 2000);
    } finally {
      isTranslatingRef.current = false;
    }
  };

  const toggleSession = async () => {
    if (isActive) {
      setIsActive(false); setStatus('Pausado'); Speech.stop();
      try { await Voice.destroy(); } catch (e) {}
    } else {
      const ok = await requestMic();
      if (!ok) { Alert.alert('Permiso denegado', 'Necesitas permitir el micrófono.'); return; }
      warmUpBackend(); // despertar backend en paralelo, no bloquea
      setIsActive(true); setStatus('Sesión activa');
    }
  };

  const handlePressIn = async (speaker) => {
    if (!isActive) return;
    setActiveSpeaker(speaker);
    await startVoice(speaker);
  };

  const handlePressOut = async () => {
    if (!isActive) return;
    await stopVoiceAndTranslate();
  };

  async function callTranslate(text, srcLang, tgtLang) {
    const res = await fetch(`${BACKEND}/translate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source_lang: srcLang, target_lang: tgtLang, engine: 'deepl' }),
    });
    const data = await res.json();
    return data.translatedText ?? '(sin traducción)';
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backBtnText}>‹ Volver</Text></TouchableOpacity>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>{status}</Text>
        </View>
        <TouchableOpacity style={[s.repeatBtn, !lastTranslation && s.repeatBtnDisabled]}
          onPress={() => { if (lastTranslation) { Speech.stop(); Speech.speak(lastTranslation.translated, { language: lastTranslation.ttsLocale, rate: 0.9 }); }}}
          disabled={!lastTranslation}>
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
          onPressIn={() => handlePressIn('A')} onPressOut={handlePressOut} disabled={!isActive}>
          <Text style={s.micIcon}>🎙</Text>
          <Text style={[s.micLabel, { color: '#818CF8' }]}>A</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.sessionBtn, isActive && s.sessionBtnActive]} onPress={toggleSession}>
          <Text style={s.sessionBtnText}>{isActive ? '⏹ Parar' : '▶ Iniciar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.micBtn, { borderColor: 'rgba(196,181,253,0.4)', backgroundColor: activeSpeaker === 'B' ? 'rgba(196,181,253,0.3)' : 'rgba(196,181,253,0.1)' }, !isActive && s.micDisabled]}
          onPressIn={() => handlePressIn('B')} onPressOut={handlePressOut} disabled={!isActive}>
          <Text style={s.micIcon}>🎙</Text>
          <Text style={[s.micLabel, { color: '#C4B5FD' }]}>B</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.micHint}>{isActive ? 'Mantén pulsado 🎙 A o 🎙 B mientras hablas · Suelta para traducir' : 'Toca Iniciar para empezar'}</Text>
    </SafeAreaView>
  );
}

// ─── CONFERENCE SCREEN ────────────────────────────────────────────
// Lógica: STT continuo → chunks por pausas naturales o 15 palabras →
//         traducción en PARALELO sin parar STT → TTS simultáneo
function ConferenceScreen({ config, onBack }) {
  const { confSourceLang, confTargetLang, confHardware } = config;
  const srcObj = LANGUAGES.find(l => l.code === confSourceLang);
  const tgtObj = LANGUAGES.find(l => l.code === confTargetLang);

  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [partialText, setPartialText] = useState('');
  const [status, setStatus] = useState('Pausado');
  const [lastTranslation, setLastTranslation] = useState(null);
  const scrollRef = useRef(null);
  const isActiveRef = useRef(false);

  // Buffer de texto pendiente de traducir
  const pendingTextRef = useRef('');       // buffer global acumulado de toda la sesión
  const lastTranslatedRef = useRef('');   // últimas 5 palabras traducidas (contexto)
  const silenceTimerRef = useRef(null);
  const translateTimerRef = useRef(null);
  const lastProcessedLengthRef = useRef(0); // cuánto del buffer ya procesamos

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => {
    if (transcript.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  // ─── Lanzar traducción de un chunk (en paralelo, no bloquea STT) ───
  const translateChunk = async (text) => {
    if (!text.trim() || !isActiveRef.current) return;

    // Añadir contexto de las últimas palabras del chunk anterior
    const context = lastTranslatedRef.current
      ? lastTranslatedRef.current + ' ' + text
      : text;

    // Actualizar contexto para el próximo chunk (últimas 5 palabras)
    const words = text.trim().split(' ');
    lastTranslatedRef.current = words.slice(-5).join(' ');

    try {
      const res = await fetch(`${BACKEND}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: context,
          source_lang: confSourceLang,
          target_lang: confTargetLang,
          engine: 'deepl'
        }),
      });
      const data = await res.json();

      // Si el texto tenía contexto, quitar la parte del contexto del resultado
      let translated = data.translatedText ?? '';
      if (!translated) return;

      const line = {
        id: Date.now().toString(),
        original: text,
        translated,
        srcFlag: srcObj.flag,
        tgtFlag: tgtObj.flag,
        ttsLocale: tgtObj.ttsLocale,
      };

      setTranscript(prev => [...prev.slice(-49), line]);
      setLastTranslation(line);

      // STT continuo — nunca parar aunque hable el TTS
      // El ponente sigue siendo captado aunque haya audio de traducción
      Speech.speak(translated, { language: tgtObj.ttsLocale, rate: 1.0 });
    } catch (e) {
      console.log('Translation error:', e);
    }
  };

  // ─── Procesar buffer acumulado ───
  const processBuffer = () => {
    const buffer = pendingTextRef.current;
    const alreadyProcessed = lastProcessedLengthRef.current;
    const newText = buffer.slice(alreadyProcessed).trim();

    if (!newText) return;

    // Buscar punto de corte natural en el texto NUEVO (no procesado)
    const breakPoint = findNaturalBreak(newText);

    if (breakPoint) {
      const chunk = newText.slice(0, breakPoint).trim();
      lastProcessedLengthRef.current = alreadyProcessed + breakPoint;

      if (chunk) {
        translateChunk(chunk); // en paralelo, no bloquea

        // Reiniciar timer de silencio para el resto
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const remaining = pendingTextRef.current.slice(lastProcessedLengthRef.current).trim();
          if (remaining && isActiveRef.current) {
            lastProcessedLengthRef.current = pendingTextRef.current.length;
            translateChunk(remaining);
          }
        }, 2000);
      }
    } else {
      // Sin corte natural todavía — timer de seguridad por si no hay más texto
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const remaining = pendingTextRef.current.slice(lastProcessedLengthRef.current).trim();
        if (remaining && isActiveRef.current) {
          lastProcessedLengthRef.current = pendingTextRef.current.length;
          translateChunk(remaining);
        }
      }, 2500);
    }
  };

  useEffect(() => {
    Voice.onSpeechPartialResults = (e) => {
      const text = e.value?.[0] ?? '';
      if (!text.trim()) return;
      // Mostrar en pantalla lo que va captando
      if (text.length > pendingTextRef.current.length) {
        pendingTextRef.current = text;
      }
      setPartialText(text);
    };

    Voice.onSpeechResults = async (e) => {
      // Android confirma una frase completa → traducir INMEDIATAMENTE
      const text = e.value?.[0] ?? pendingTextRef.current ?? '';
      setPartialText('');

      if (text.trim()) {
        // Calcular solo el texto NUEVO (no ya traducido)
        const alreadyTranslated = lastProcessedLengthRef.current;
        const newText = text.slice(alreadyTranslated).trim();
        lastProcessedLengthRef.current = text.length;
        pendingTextRef.current = '';

        if (newText) translateChunk(newText); // en paralelo, no bloquea
      }

      // Reiniciar STT inmediatamente para continuar captando
      if (isActiveRef.current) setTimeout(() => startVoice(), 150);
    };

    Voice.onSpeechError = () => {
      setPartialText('');
      // Reiniciar STT tras error
      if (isActiveRef.current) setTimeout(() => startVoice(), 300);
    };

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (translateTimerRef.current) clearTimeout(translateTimerRef.current);
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [confSourceLang, confTargetLang]);

  const startVoice = async () => {
    try {
      // Activar cancelación de eco por software antes de grabar
      // Esto evita que el micrófono capte el audio del altavoz/auricular
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false, // usar altavoz, no auricular interno
        shouldDuckAndroid: true,           // reducir volumen del audio al grabar
        staysActiveInBackground: false,
      });
    } catch (e) { console.log('Audio mode error:', e); }
    try {
      await Voice.destroy();
    } catch (e) {}
    try {
      await Voice.start(srcObj.voiceLocale);
      setStatus('Escuchando...');
    } catch (e) {
      console.log('Voice start error:', e);
      if (isActiveRef.current) setTimeout(() => startVoice(), 500);
    }
  };

  const stopVoice = async () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (translateTimerRef.current) clearTimeout(translateTimerRef.current);
    try { await Voice.stop(); await Voice.destroy(); } catch (e) {}
    setPartialText('');
    pendingTextRef.current = '';
    lastTranslatedRef.current = '';
    lastProcessedLengthRef.current = 0;
  };

  const toggleSession = async () => {
    if (isActive) {
      await stopVoice();
      setIsActive(false); setStatus('Pausado'); Speech.stop();
    } else {
      const ok = await requestMic();
      if (!ok) { Alert.alert('Permiso denegado', 'Necesitas permitir el micrófono.'); return; }
      warmUpBackend(); // despertar backend en paralelo, no bloquea
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
        <TouchableOpacity style={[s.repeatBtn, !lastTranslation && s.repeatBtnDisabled]}
          onPress={() => { if (lastTranslation) { Speech.stop(); Speech.speak(lastTranslation.translated, { language: lastTranslation.ttsLocale, rate: 0.9 }); }}}
          disabled={!lastTranslation}>
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
        <View style={s.confArrowWrap}>
          <Text style={s.confArrow}>→</Text>
          <Text style={s.confDelay}>~1-2s</Text>
        </View>
        <View style={[s.confInfoCard, { borderColor: 'rgba(129,140,248,0.3)' }]}>
          <Text style={s.personInfoIcon}>{confHardware === 'anc' ? '🎧' : confHardware === 'extmic' ? '🎙️' : '📱'}</Text>
          <Text style={[s.personInfoLabel, { color: '#818CF8' }]}>Tú escuchas</Text>
          <Text style={s.personInfoLang}>{tgtObj.flag} {tgtObj.name}</Text>
        </View>
      </View>

      {confHardware === 'risk' && (
        <View style={[s.warningBox, { marginHorizontal: 14, marginBottom: 8 }]}>
          <Text style={s.warningText}>⚠️ Sin hardware óptimo — la calidad puede ser baja</Text>
        </View>
      )}

      {isActive && (
        <View style={s.listeningIndicator}>
          <View style={[s.listeningDot, { backgroundColor: partialText ? '#EF4444' : '#34C759' }]} />
          <Text style={s.listeningText}>{partialText ? 'Detectando voz...' : 'Esperando al ponente...'}</Text>
        </View>
      )}

      {partialText ? <View style={s.partialBox}><Text style={s.partialText} numberOfLines={2}>🎙 {partialText}</Text></View> : null}

      <Text style={s.sectionLabel}>Traducción en vivo</Text>
      <ScrollView ref={scrollRef} style={s.transcriptBox}>
        {transcript.length === 0 && (
          <Text style={s.emptyText}>Pon el móvil cerca del ponente{'\n'}y toca Iniciar conferencia</Text>
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
      <Text style={s.micHint}>
        {isActive
          ? 'STT continuo · Traducción en paralelo sin interrumpir la escucha'
          : confHardware === 'anc' ? 'Conecta tus auriculares ANC antes de iniciar'
          : confHardware === 'extmic' ? 'Conecta el micrófono externo antes de iniciar'
          : 'Calidad limitada sin hardware adecuado'}
      </Text>
    </SafeAreaView>
  );
}

// ─── APP ──────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState('login');
  const [sessionConfig, setSessionConfig] = useState(null);
  if (screen === 'login') return <LoginScreen onLogin={() => setScreen('setup')} />;
  if (screen === 'setup') return <SetupScreen onStart={(c) => { setSessionConfig(c); setScreen('session'); }} />;
  if (screen === 'session') {
    if (sessionConfig.mode === 'conference') return <ConferenceScreen config={sessionConfig} onBack={() => setScreen('setup')} />;
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
  warningBox: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 14, padding: 14, marginBottom: 16 },
  warningTitle: { fontSize: 14, fontWeight: '700', color: '#F0997B', marginBottom: 6 },
  warningText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
  hardwareCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, marginBottom: 12 },
  hardwareIcon: { fontSize: 28 },
  hardwareTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 4 },
  hardwareDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18 },
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
  confArrowWrap: { alignItems: 'center' },
  confArrow: { fontSize: 20, color: 'rgba(255,255,255,0.2)' },
  confDelay: { fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 },
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
  langChipWarning: { borderColor: 'rgba(239,159,39,0.4)', backgroundColor: 'rgba(239,159,39,0.08)' },
  sttModalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, justifyContent: 'center', alignItems: 'center', padding: 20 },
  sttModal: { backgroundColor: '#1A1A2E', borderRadius: 20, padding: 24, width: '100%', borderWidth: 0.5, borderColor: 'rgba(239,159,39,0.4)' },
  sttModalTitle: { fontSize: 18, fontWeight: '700', color: '#EF9F27', marginBottom: 12 },
  sttModalDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20, marginBottom: 14 },
  sttModalStep: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 22, marginBottom: 4 },
  sttModalSectionLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 6, marginTop: 4 },
  sttModalBtn: { backgroundColor: '#818CF8', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  sttModalBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

registerRootComponent(App);