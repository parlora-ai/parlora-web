import { registerRootComponent } from 'expo';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView, Platform, PermissionsAndroid, Vibration, Dimensions, Share
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Voice from '@react-native-voice/voice';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as Linking from 'expo-linking';
// QRCode import removed - react-native-qrcode-svg not in dependencies
import Svg, { Rect, Path, Line } from 'react-native-svg';

// ── Mic SVG icon — color follows speaker ──────────────────────────
function MicSvg({ color, size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="8" y="2" width="8" height="12" rx="4" fill={color} />
      <Path d="M5 10a7 7 0 0 0 14 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="9" y1="21" x2="15" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

const LANGUAGES = [
  { code: 'ES', name: 'Español',   flag: '🇪🇸', voiceLocale: 'es-ES', ttsLocale: 'es-ES' },
  { code: 'EN', name: 'English',   flag: '🇬🇧', voiceLocale: 'en-US', ttsLocale: 'en-US' },
  { code: 'FR', name: 'Français',  flag: '🇫🇷', voiceLocale: 'fr-FR', ttsLocale: 'fr-FR' },
  { code: 'DE', name: 'Deutsch',   flag: '🇩🇪', voiceLocale: 'de-DE', ttsLocale: 'de-DE' },
  { code: 'IT', name: 'Italiano',  flag: '🇮🇹', voiceLocale: 'it-IT', ttsLocale: 'it-IT' },
  { code: 'PT', name: 'Português', flag: '🇵🇹', voiceLocale: 'pt-PT', ttsLocale: 'pt-PT' },
  { code: 'SK', name: 'Slovenčina',flag: '🇸🇰', voiceLocale: 'sk-SK', ttsLocale: 'sk-SK' },
  { code: 'CS', name: 'Čeština',   flag: '🇨🇿', voiceLocale: 'cs-CZ', ttsLocale: 'cs-CZ' },
  { code: 'PL', name: 'Polski',    flag: '🇵🇱', voiceLocale: 'pl-PL', ttsLocale: 'pl-PL' },
  { code: 'NL', name: 'Nederlands',flag: '🇳🇱', voiceLocale: 'nl-NL', ttsLocale: 'nl-NL' },
];

const BACKEND = 'https://parlora-backend-7q3m.onrender.com';

async function warmUpDeepL() {
  // Fire a tiny translation to warm up the DeepL connection
  try {
    await fetch(`${BACKEND}/translate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'ok', target_lang: 'EN' }),
    });
  } catch (e) {}
}

async function warmUpBackend() {
  // Returns silently on error — never throws
  try { await fetch(`${BACKEND}/`, { method: 'GET' }); } catch (e) {}
}

const NATURAL_BREAKS = /[.!?,:;]\s+|\s+(y|pero|sin embargo|aunque|porque|que|entonces|además|however|but|and|because|so|then|also)\s+/i;
const MAX_WORDS_BEFORE_FORCE_TRANSLATE = 15;

async function requestMic(t) {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      { title: t.micTitle, message: t.micMessage, buttonPositive: t.micAllow }
    );
    return r === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

function findNaturalBreak(text) {
  const words = text.trim().split(' ');
  if (words.length < 5) return null;
  const match = NATURAL_BREAKS.exec(text);
  if (match && match.index > 20) return match.index + match[0].length;
  if (words.length >= MAX_WORDS_BEFORE_FORCE_TRANSLATE)
    return words.slice(0, MAX_WORDS_BEFORE_FORCE_TRANSLATE).join(' ').length;
  return null;
}

// ─── TRADUCCIONES COMPLETAS ───────────────────────────────────────
const UI_LANGS = {
  ES: {
    // Pantalla selección idioma
    selectLang: "¿En qué idioma quieres usar la app?",
    // Login
    tagline: "Traducción simultánea\npara conversaciones reales",
    continueGoogle: "Continuar con Google",
    useEmail: "Usar correo electrónico",
    terms: "Al continuar aceptas los",
    termsLink: "Términos",
    privacy: "Privacidad",
    comingSoon: "Próximamente",
    emailSoon: "Login con email en la próxima versión.",
    // Setup
    chooseMode: "Elige el modo",
    modeQuestion: "¿Cómo vas a usar Parlora AI?",
    conversation: "Conversación",
    convDesc: "Dos personas se turnan. Cada una pulsa su micrófono mientras habla.",
    conference: "Modo conferencia",
    confDesc: "El móvil escucha al ponente y tú recibes la traducción casi simultánea.",
    chooseLanguage: "Elige el idioma de cada persona",
    personA: "Persona A",
    personB: "Persona B",
    language: "Idioma",
    startSession: "Iniciar sesión →",
    startConference: "Iniciar conferencia →",
    back: "‹ Volver",
    // Hardware conferencia
    hwTitle: "Modo conferencia",
    hwSub: "Para funcionar correctamente necesitas uno de estos setups",
    hwQuestion: "¿Qué hardware tienes disponible?",
    hw1Title: "Móvil cerca del ponente + Auricular",
    hw1Desc: "Pon el móvil cerca del ponente. Tú llevas los auriculares y escuchas la traducción. Recomendado: volumen moderado.",
    hw2Title: "Micrófono externo + Móvil",
    hw2Desc: "Conecta un micrófono externo al móvil apuntado al ponente. La traducción sale por el altavoz. ✅ Mejor calidad, sin bucle de audio.",
    hw3Title: "Sin auriculares — solo el móvil",
    hw3Desc: "La traducción saldrá por el altavoz. El micrófono puede captar la traducción. ⚠️ Calidad limitada, solo para pruebas.",
    speakerLang: "🎤 Idioma del ponente",
    yourLang: "🎧 Tu idioma",
    hwWarning: "⚠️ Sin hardware adecuado la calidad puede ser baja. El micrófono puede captar el audio de la traducción.",
    // Sesión
    active: "Sesión activa",
    paused: "Pausado",
    translating: "Traduciendo...",
    transcribing: "Transcribiendo...",
    liveTranscript: "Transcripción en vivo",
    liveTranslation: "Traducción en vivo",
    tapToStart: "Toca Iniciar para empezar",
    holdToSpeak: "Mantén pulsado 🎙 A o 🎙 B mientras hablas · Suelta para traducir",
    stop: "⏹ Parar",
    start: "▶ Iniciar",
    stopConf: "⏹ Parar conferencia",
    startConf: "▶ Iniciar conferencia",
    speaker: "Ponente",
    youHear: "Tú escuchas",
    speed: "Velocidad:",
    capturing: "🎙 Captando audio del ponente — primera traducción en ~8s",
    activeCapturing: "🎙 Grabando · Traducción continua activa",
    emptyConv: "Toca Iniciar y mantén pulsado\n🎙 A o 🎙 B mientras hablas",
    emptyConf: "Pon el móvil cerca del ponente\ny toca Iniciar conferencia",
    processing: "Procesando...",
    recording: "🔴 grabando",
    errorRetry: "Error — intenta de nuevo",
    chunkHint: "Chunks de 8s · TTS en paralelo · Sin pausas entre traducciones",
    hintAnc: "Pon el móvil cerca del ponente · Lleva los auriculares puestos",
    hintExtmic: "Conecta el micrófono externo y apúntalo al ponente",
    hintRisk: "Pon el móvil cerca del ponente",
    hwRiskWarn: "⚠️ Sin hardware óptimo — la calidad puede ser baja",
    captando: "Captando audio...",
    activo: "Activo",
    chunks: "chunks",
    // Permisos
    micTitle: "Micrófono",
    micMessage: "Parlora AI necesita el micrófono.",
    micAllow: "Permitir",
    micDenied: "Permiso denegado",
    micDeniedMsg: "Necesitas permitir el micrófono.",
    // TTS warning
    ttsTitle: "⚠️ Voz no disponible",
    ttsMsg: (name) => `Tu dispositivo no tiene la voz en ${name} instalada. La traducción se pronunciará en otro idioma.\n\nPuedes continuar igualmente o instalar la voz primero en Ajustes → Gestión general → Idioma → Texto a voz.`,
    installLater: "Instalar después",
    continueAnyway: "Continuar igualmente",
    // STT warning
    understood: "Entendido",
    appLang: "Idioma de la app",
    // STT install steps
    sttStep1: "Abre Ajustes en tu móvil",
    sttStep2: "Ve a Gestión general → Idioma → Entrada de texto",
    sttStep3: 'Selecciona "Google Voice Typing" o "Samsung Voice Input"',
    sttStep4: (n) => `Busca "${n}" y descarga el paquete de voz`,
    sttStep5: "Reinicia Parlora AI",
    ttsStep1: "Abre Ajustes en tu móvil",
    ttsStep2: "Ve a Gestión general → Idioma → Texto a voz",
    ttsStep3: 'Selecciona "Motor de texto a voz de Google"',
    ttsStep4: (n) => `Toca el engranaje ⚙️ → Instalar datos de voz → Busca "${n}"`,
    ttsStep5: "Descarga el paquete y reinicia Parlora AI",
    sttWarnBoth: (n) => `⚠️ ${n} no está disponible`,
    sttWarnBothDesc: (n) => `Tu dispositivo no puede ni escuchar ni pronunciar en ${n}.`,
    sttWarnStt: "⚠️ Reconocimiento de voz no disponible",
    sttWarnSttDesc: (n) => `Tu dispositivo no puede transcribir lo que dices en ${n}. Sin esto, no hay texto que traducir.`,
    sttWarnTts: (n) => `⚠️ Pronunciación incorrecta en ${n}`,
    sttWarnTtsDesc: (n) => `Tu dispositivo no tiene la voz en ${n} instalada. La traducción se pronunciará en otro idioma.`,
    sttLabelStt: "Para el reconocimiento de voz (escuchar):",
    sttLabelTts: "Para la voz sintetizada (pronunciar):",
    sttLabelSttOnly: "Cómo instalar el reconocimiento de voz:",
    sttLabelTtsOnly: "Cómo instalar la voz para pronunciación correcta:",
    grabando: "Sesión activa",
    // Modo conversación en tiempo real
    realtime: "Conversación en tiempo real",
    realtimeDesc: "Dos personas se escuchan y traducen simultáneamente. Requiere auriculares ANC.",
    realtimeSetupTitle: "Conversación en tiempo real",
    youSpeak: "Tú hablas en",
    theySpeak: "Ellos hablan en",
    startRealtime: "Crear sala →",
    ancWarning: "🎧 Se requieren auriculares con cancelación de ruido (ANC) para mejor calidad. Sin ellos, el micrófono puede captar el audio de la traducción.",
    creatingRoom: "Creando sala...",
    roomReady: "Sala lista",
    scanQR: "Pide al otro que escanee este QR",
    roomId: "Código de sala",
    waitingGuest: "Esperando al invitado...",
    shareLink: "Compartir enlace",
    joinRealtime: "Únete a mi sesión de Parlora AI",
    guestJoined: "¡Invitado conectado!",
    peerLeft: "El otro participante ha salido",
    roomClosed: "La sala se ha cerrado",
    roomExpiry: "La sala expira en 5 min de inactividad",
    stopRealtime: "⏹ Terminar sesión",
    startRealtimeSession: "▶ Iniciar",
    realtimeActive: "Traducción simultánea activa",
    realtimeHint: "🎧 Habla normalmente · La traducción llega al otro auricular",
    createRoom: "Crear una sala",
    createRoomDesc: "Genera un código y QR para que la otra persona se una.",
    joinRoom: "Unirse a una sala",
    joinRoomDesc: "Introduce el código de 5 dígitos que te ha compartido el host.",
    enterCodeDesc: "Introduce el código de 5 dígitos del host.",
    joinCodeError: "Introduce el código de 5 dígitos",
    roomNotFound: "Sala no encontrada. Comprueba el código.",
    confirmLangs: "Confirmar idiomas",
    guestLangDesc: "El host ha configurado estos idiomas. Puedes cambiarlos.",
    // Controles conversación
    stopTranslating: "⏹ Dejar de traducir",
    pauseTTS: "⏸ Pausar voz",
    resumeTTS: "▶ Reanudar voz",
  },
  EN: {
    selectLang: "In which language do you want to use the app?",
    tagline: "Simultaneous translation\nfor real conversations",
    continueGoogle: "Continue with Google",
    useEmail: "Use email address",
    terms: "By continuing you accept the",
    termsLink: "Terms",
    privacy: "Privacy",
    comingSoon: "Coming soon",
    emailSoon: "Email login coming in next version.",
    chooseMode: "Choose mode",
    modeQuestion: "How will you use Parlora AI?",
    conversation: "Conversation",
    convDesc: "Two people take turns. Each presses their microphone while speaking.",
    conference: "Conference mode",
    confDesc: "The phone listens to the speaker and you receive near-simultaneous translation.",
    chooseLanguage: "Choose each person's language",
    personA: "Person A",
    personB: "Person B",
    language: "Language",
    startSession: "Start session →",
    startConference: "Start conference →",
    back: "‹ Back",
    hwTitle: "Conference mode",
    hwSub: "For best results you need one of these hardware setups",
    hwQuestion: "What hardware do you have available?",
    hw1Title: "Phone near speaker + Earphones",
    hw1Desc: "Place phone near the speaker. You wear earphones and hear the translation. Recommended: moderate volume.",
    hw2Title: "External microphone + Phone",
    hw2Desc: "Connect an external mic pointed at the speaker. Translation plays through the speaker. ✅ Best quality, no audio loop.",
    hw3Title: "No earphones — phone only",
    hw3Desc: "Translation plays through the speaker. The mic may pick up the translation. ⚠️ Limited quality, for testing only.",
    speakerLang: "🎤 Speaker's language",
    yourLang: "🎧 Your language",
    hwWarning: "⚠️ Without proper hardware quality may be low. The mic may pick up translation audio.",
    active: "Session active",
    paused: "Paused",
    translating: "Translating...",
    transcribing: "Transcribing...",
    liveTranscript: "Live transcript",
    liveTranslation: "Live translation",
    tapToStart: "Tap Start to begin",
    holdToSpeak: "Hold 🎙 A or 🎙 B while speaking · Release to translate",
    stop: "⏹ Stop",
    start: "▶ Start",
    stopConf: "⏹ Stop conference",
    startConf: "▶ Start conference",
    speaker: "Speaker",
    youHear: "You hear",
    speed: "Speed:",
    capturing: "🎙 Capturing speaker audio — first translation in ~8s",
    activeCapturing: "🎙 Recording · Continuous translation active",
    emptyConv: "Tap Start and hold\n🎙 A or 🎙 B while speaking",
    emptyConf: "Place phone near speaker\nand tap Start conference",
    processing: "Processing...",
    recording: "🔴 recording",
    errorRetry: "Error — try again",
    chunkHint: "8s chunks · Parallel TTS · No pauses between translations",
    hintAnc: "Place phone near speaker · Wear your earphones",
    hintExtmic: "Connect external mic and point it at the speaker",
    hintRisk: "Place phone near the speaker",
    hwRiskWarn: "⚠️ Without optimal hardware quality may be low",
    captando: "Capturing audio...",
    activo: "Active",
    chunks: "chunks",
    micTitle: "Microphone",
    micMessage: "Parlora AI needs the microphone.",
    micAllow: "Allow",
    micDenied: "Permission denied",
    micDeniedMsg: "You need to allow microphone access.",
    ttsTitle: "⚠️ Voice not available",
    ttsMsg: (name) => `Your device doesn't have the ${name} voice installed. The translation will be spoken in another language.\n\nYou can continue anyway or install the voice first in Settings → General management → Language → Text-to-speech.`,
    installLater: "Install later",
    continueAnyway: "Continue anyway",
    understood: "Got it",
    appLang: "App language",
    sttStep1: "Open Settings on your phone",
    sttStep2: "Go to General management → Language → Text input",
    sttStep3: 'Select "Google Voice Typing" or manufacturer equivalent',
    sttStep4: (n) => `Find "${n}" and download the voice package`,
    sttStep5: "Restart Parlora AI",
    ttsStep1: "Open Settings on your phone",
    ttsStep2: "Go to General management → Language → Text-to-speech",
    ttsStep3: 'Select "Google Text-to-Speech"',
    ttsStep4: (n) => `Tap the gear ⚙️ → Install voice data → Find "${n}"`,
    ttsStep5: "Download the package and restart Parlora AI",
    sttWarnBoth: (n) => `⚠️ ${n} is not available`,
    sttWarnBothDesc: (n) => `Your device can neither listen nor speak in ${n}.`,
    sttWarnStt: "⚠️ Speech recognition not available",
    sttWarnSttDesc: (n) => `Your device cannot transcribe what you say in ${n}. Without this, there is no text to translate.`,
    sttWarnTts: (n) => `⚠️ Incorrect pronunciation in ${n}`,
    sttWarnTtsDesc: (n) => `Your device doesn't have the ${n} voice installed. Translation will be spoken in another language.`,
    sttLabelStt: "For speech recognition (listening):",
    sttLabelTts: "For synthesized voice (speaking):",
    sttLabelSttOnly: "How to install speech recognition:",
    sttLabelTtsOnly: "How to install the voice for correct pronunciation:",
    grabando: "Session active",
    realtime: "Real-time conversation",
    realtimeDesc: "Two people listen and translate simultaneously. Requires ANC earphones.",
    realtimeSetupTitle: "Real-time conversation",
    youSpeak: "You speak in",
    theySpeak: "They speak in",
    startRealtime: "Create room →",
    ancWarning: "🎧 Noise-cancelling earphones (ANC) are required for best quality. Without them, the mic may pick up translation audio.",
    creatingRoom: "Creating room...",
    roomReady: "Room ready",
    scanQR: "Ask the other person to scan this QR",
    roomId: "Room code",
    waitingGuest: "Waiting for guest...",
    shareLink: "Share link",
    joinRealtime: "Join my Parlora AI session",
    guestJoined: "Guest connected!",
    peerLeft: "The other participant has left",
    roomClosed: "The room has been closed",
    roomExpiry: "Room expires after 5 min of inactivity",
    stopRealtime: "⏹ End session",
    startRealtimeSession: "▶ Start",
    realtimeActive: "Simultaneous translation active",
    realtimeHint: "🎧 Speak naturally · Translation goes to the other earphone",
    createRoom: "Create a room",
    createRoomDesc: "Generate a code and QR for the other person to join.",
    joinRoom: "Join a room",
    joinRoomDesc: "Enter the 5-digit code shared by the host.",
    enterCodeDesc: "Enter the 5-digit code from the host.",
    joinCodeError: "Enter the 5-digit code",
    roomNotFound: "Room not found. Check the code.",
    confirmLangs: "Confirm languages",
    guestLangDesc: "The host set these languages. You can change them.",
    stopTranslating: "⏹ Stop translating",
    pauseTTS: "⏸ Pause voice",
    resumeTTS: "▶ Resume voice",
  },
  DE: {
    selectLang: "In welcher Sprache möchtest du die App verwenden?",
    tagline: "Simultanübersetzung\nfür echte Gespräche",
    continueGoogle: "Mit Google fortfahren",
    useEmail: "E-Mail-Adresse verwenden",
    terms: "Mit Fortfahren akzeptieren Sie die",
    termsLink: "Bedingungen",
    privacy: "Datenschutz",
    comingSoon: "Demnächst",
    emailSoon: "E-Mail-Login kommt in der nächsten Version.",
    chooseMode: "Modus wählen",
    modeQuestion: "Wie möchten Sie Parlora AI verwenden?",
    conversation: "Gespräch",
    convDesc: "Zwei Personen wechseln sich ab. Jede drückt ihr Mikrofon beim Sprechen.",
    conference: "Konferenzmodus",
    confDesc: "Das Handy hört dem Redner zu und Sie erhalten eine Simultanübersetzung.",
    chooseLanguage: "Sprache jeder Person wählen",
    personA: "Person A",
    personB: "Person B",
    language: "Sprache",
    startSession: "Sitzung starten →",
    startConference: "Konferenz starten →",
    back: "‹ Zurück",
    hwTitle: "Konferenzmodus",
    hwSub: "Für beste Ergebnisse benötigen Sie eines dieser Hardware-Setups",
    hwQuestion: "Welche Hardware haben Sie verfügbar?",
    hw1Title: "Handy nah am Redner + Ohrhörer",
    hw1Desc: "Legen Sie das Handy nah an den Redner. Sie tragen Ohrhörer und hören die Übersetzung. Empfohlen: moderate Lautstärke.",
    hw2Title: "Externes Mikrofon + Handy",
    hw2Desc: "Externes Mikrofon auf den Redner richten. Übersetzung kommt über Lautsprecher. ✅ Beste Qualität, kein Audio-Loop.",
    hw3Title: "Ohne Ohrhörer — nur Handy",
    hw3Desc: "Übersetzung kommt über Lautsprecher. Mikrofon kann Übersetzung aufnehmen. ⚠️ Begrenzte Qualität, nur zum Testen.",
    speakerLang: "🎤 Sprache des Redners",
    yourLang: "🎧 Ihre Sprache",
    hwWarning: "⚠️ Ohne geeignete Hardware kann die Qualität gering sein.",
    active: "Sitzung aktiv",
    paused: "Pausiert",
    translating: "Übersetze...",
    transcribing: "Transkribiere...",
    liveTranscript: "Live-Transkription",
    liveTranslation: "Live-Übersetzung",
    tapToStart: "Start tippen zum Beginnen",
    holdToSpeak: "🎙 A oder 🎙 B gedrückt halten · Loslassen zum Übersetzen",
    stop: "⏹ Stopp",
    start: "▶ Start",
    stopConf: "⏹ Konferenz stoppen",
    startConf: "▶ Konferenz starten",
    speaker: "Redner",
    youHear: "Sie hören",
    speed: "Geschwindigkeit:",
    capturing: "🎙 Audio wird erfasst — erste Übersetzung in ~8s",
    activeCapturing: "🎙 Aufnahme · Kontinuierliche Übersetzung aktiv",
    emptyConv: "Start tippen und\n🎙 A oder 🎙 B gedrückt halten",
    emptyConf: "Handy nah am Redner platzieren\nund Konferenz starten tippen",
    processing: "Verarbeite...",
    recording: "🔴 Aufnahme",
    errorRetry: "Fehler — erneut versuchen",
    chunkHint: "8s-Blöcke · Paralleles TTS · Keine Pausen",
    hintAnc: "Handy nah am Redner · Ohrhörer tragen",
    hintExtmic: "Externes Mikrofon anschließen und auf Redner richten",
    hintRisk: "Handy nah am Redner platzieren",
    hwRiskWarn: "⚠️ Ohne optimale Hardware kann die Qualität gering sein",
    captando: "Audio erfassen...",
    activo: "Aktiv",
    chunks: "Blöcke",
    micTitle: "Mikrofon",
    micMessage: "Parlora AI benötigt das Mikrofon.",
    micAllow: "Erlauben",
    micDenied: "Berechtigung verweigert",
    micDeniedMsg: "Sie müssen den Mikrofonzugriff erlauben.",
    ttsTitle: "⚠️ Stimme nicht verfügbar",
    ttsMsg: (name) => `Ihr Gerät hat die ${name}-Stimme nicht installiert. Die Übersetzung wird in einer anderen Sprache gesprochen.`,
    installLater: "Später installieren",
    continueAnyway: "Trotzdem fortfahren",
    understood: "Verstanden",
    appLang: "App-Sprache",
    sttStep1: "Einstellungen öffnen",
    sttStep2: "Zu Allgemeine Verwaltung → Sprache → Texteingabe",
    sttStep3: '"Google Spracheingabe" auswählen',
    sttStep4: (n) => `"${n}" suchen und Sprachpaket herunterladen`,
    sttStep5: "Parlora AI neu starten",
    ttsStep1: "Einstellungen öffnen",
    ttsStep2: "Zu Allgemeine Verwaltung → Sprache → Text-zu-Sprache",
    ttsStep3: '"Google Text-zu-Sprache" auswählen',
    ttsStep4: (n) => `Zahnrad ⚙️ tippen → Sprachdaten installieren → "${n}" suchen`,
    ttsStep5: "Paket herunterladen und Parlora AI neu starten",
    sttWarnBoth: (n) => `⚠️ ${n} ist nicht verfügbar`,
    sttWarnBothDesc: (n) => `Ihr Gerät kann in ${n} weder hören noch sprechen.`,
    sttWarnStt: "⚠️ Spracherkennung nicht verfügbar",
    sttWarnSttDesc: (n) => `Ihr Gerät kann nicht in ${n} transkribieren.`,
    sttWarnTts: (n) => `⚠️ Falsche Aussprache in ${n}`,
    sttWarnTtsDesc: (n) => `Ihr Gerät hat die ${n}-Stimme nicht installiert.`,
    sttLabelStt: "Für Spracherkennung:",
    sttLabelTts: "Für Sprachsynthese:",
    sttLabelSttOnly: "Spracherkennung installieren:",
    sttLabelTtsOnly: "Stimme für korrekte Aussprache installieren:",
    grabando: "Sitzung aktiv",
  },
  SK: {
    selectLang: "V akom jazyku chcete používať aplikáciu?",
    tagline: "Simultánny preklad\npre skutočné rozhovory",
    continueGoogle: "Pokračovať s Google",
    useEmail: "Použiť e-mailovú adresu",
    terms: "Pokračovaním súhlasíte s",
    termsLink: "Podmienkami",
    privacy: "Ochranou súkromia",
    comingSoon: "Čoskoro",
    emailSoon: "Prihlásenie e-mailom v ďalšej verzii.",
    chooseMode: "Vyberte režim",
    modeQuestion: "Ako budete používať Parlora AI?",
    conversation: "Konverzácia",
    convDesc: "Dve osoby sa striedajú. Každá drží mikrofón počas hovoru.",
    conference: "Konferenčný režim",
    confDesc: "Telefón počúva rečníka a vy dostávate simultánny preklad.",
    chooseLanguage: "Vyberte jazyk každej osoby",
    personA: "Osoba A",
    personB: "Osoba B",
    language: "Jazyk",
    startSession: "Začať reláciu →",
    startConference: "Začať konferenciu →",
    back: "‹ Späť",
    hwTitle: "Konferenčný režim",
    hwSub: "Pre správnu funkciu potrebujete jedno z týchto nastavení",
    hwQuestion: "Aký hardware máte k dispozícii?",
    hw1Title: "Mobil blízko rečníka + Slúchadlá",
    hw1Desc: "Položte mobil blízko rečníka. Vy nosíte slúchadlá a počúvate preklad.",
    hw2Title: "Externý mikrofón + Mobil",
    hw2Desc: "Pripojte externý mikrofón namierený na rečníka. Preklad ide cez reproduktor. ✅ Najlepšia kvalita.",
    hw3Title: "Bez slúchadiel — len mobil",
    hw3Desc: "Preklad ide cez reproduktor. Mikrofón môže zachytiť preklad. ⚠️ Obmedzená kvalita.",
    speakerLang: "🎤 Jazyk rečníka",
    yourLang: "🎧 Váš jazyk",
    hwWarning: "⚠️ Bez vhodného hardware môže byť kvalita nízka.",
    active: "Relácia aktívna",
    paused: "Pozastavené",
    translating: "Prekladám...",
    transcribing: "Prepisujem...",
    liveTranscript: "Živý prepis",
    liveTranslation: "Živý preklad",
    tapToStart: "Klepnutím na Štart začnete",
    holdToSpeak: "Podržte 🎙 A alebo 🎙 B počas hovorenia · Pustite pre preklad",
    stop: "⏹ Zastaviť",
    start: "▶ Štart",
    stopConf: "⏹ Zastaviť konferenciu",
    startConf: "▶ Začať konferenciu",
    speaker: "Rečník",
    youHear: "Vy počujete",
    speed: "Rýchlosť:",
    capturing: "🎙 Zachytávanie zvuku rečníka — prvý preklad o ~8s",
    activeCapturing: "🎙 Nahrávanie · Priebežný preklad aktívny",
    emptyConv: "Klepnite na Štart a podržte\n🎙 A alebo 🎙 B počas hovorenia",
    emptyConf: "Položte telefón blízko rečníka\na klepnite na Začať konferenciu",
    processing: "Spracovávam...",
    recording: "🔴 nahrávanie",
    errorRetry: "Chyba — skúste znova",
    chunkHint: "8s bloky · Paralelný TTS · Bez prestávok",
    hintAnc: "Položte mobil blízko rečníka · Noste slúchadlá",
    hintExtmic: "Pripojte externý mikrofón a namierte ho na rečníka",
    hintRisk: "Položte mobil blízko rečníka",
    hwRiskWarn: "⚠️ Bez optimálneho hardware môže byť kvalita nízka",
    captando: "Zachytávanie zvuku...",
    activo: "Aktívny",
    chunks: "bloky",
    micTitle: "Mikrofón",
    micMessage: "Parlora AI potrebuje mikrofón.",
    micAllow: "Povoliť",
    micDenied: "Povolenie zamietnuté",
    micDeniedMsg: "Musíte povoliť prístup k mikrofónu.",
    ttsTitle: "⚠️ Hlas nie je dostupný",
    ttsMsg: (name) => `Vaše zariadenie nemá nainštalovaný hlas pre ${name}. Preklad bude vyslovený v inom jazyku.`,
    installLater: "Nainštalovať neskôr",
    continueAnyway: "Pokračovať tak či onak",
    understood: "Rozumiem",
    appLang: "Jazyk aplikácie",
    sttStep1: "Otvorte Nastavenia",
    sttStep2: "Prejdite na Všeobecná správa → Jazyk → Zadávanie textu",
    sttStep3: 'Vyberte "Google hlasové zadávanie"',
    sttStep4: (n) => `Nájdite "${n}" a stiahnite hlasový balík`,
    sttStep5: "Reštartujte Parlora AI",
    ttsStep1: "Otvorte Nastavenia",
    ttsStep2: "Prejdite na Všeobecná správa → Jazyk → Prevod textu na reč",
    ttsStep3: 'Vyberte "Google prevod textu na reč"',
    ttsStep4: (n) => `Klepnite na ozubené koleso ⚙️ → Inštalovať hlasové dáta → "${n}"`,
    ttsStep5: "Stiahnite balík a reštartujte Parlora AI",
    sttWarnBoth: (n) => `⚠️ ${n} nie je dostupný`,
    sttWarnBothDesc: (n) => `Vaše zariadenie nemôže ani počúvať ani hovoriť v ${n}.`,
    sttWarnStt: "⚠️ Rozpoznávanie reči nie je dostupné",
    sttWarnSttDesc: (n) => `Vaše zariadenie nemôže prepísať čo hovoríte v ${n}.`,
    sttWarnTts: (n) => `⚠️ Nesprávna výslovnosť v ${n}`,
    sttWarnTtsDesc: (n) => `Vaše zariadenie nemá nainštalovaný hlas pre ${n}.`,
    sttLabelStt: "Pre rozpoznávanie reči:",
    sttLabelTts: "Pre syntézu reči:",
    sttLabelSttOnly: "Ako nainštalovať rozpoznávanie reči:",
    sttLabelTtsOnly: "Ako nainštalovať hlas pre správnu výslovnosť:",
    grabando: "Relácia aktívna",
  },
  FR: {
    selectLang: "Dans quelle langue voulez-vous utiliser l'app ?",
    tagline: "Traduction simultanée\npour de vraies conversations",
    continueGoogle: "Continuer avec Google",
    useEmail: "Utiliser une adresse e-mail",
    terms: "En continuant vous acceptez les",
    termsLink: "Conditions",
    privacy: "Confidentialité",
    comingSoon: "Bientôt disponible",
    emailSoon: "Connexion par e-mail dans la prochaine version.",
    chooseMode: "Choisir le mode",
    modeQuestion: "Comment allez-vous utiliser Parlora AI ?",
    conversation: "Conversation",
    convDesc: "Deux personnes se relaient. Chacune appuie sur son micro en parlant.",
    conference: "Mode conférence",
    confDesc: "Le téléphone écoute le conférencier et vous recevez la traduction en temps réel.",
    chooseLanguage: "Choisir la langue de chaque personne",
    personA: "Personne A",
    personB: "Personne B",
    language: "Langue",
    startSession: "Démarrer la session →",
    startConference: "Démarrer la conférence →",
    back: "‹ Retour",
    hwTitle: "Mode conférence",
    hwSub: "Pour un bon fonctionnement, vous avez besoin d'un de ces setups",
    hwQuestion: "Quel matériel avez-vous disponible ?",
    hw1Title: "Téléphone près du conférencier + Écouteurs",
    hw1Desc: "Placez le téléphone près du conférencier. Vous portez des écouteurs et entendez la traduction.",
    hw2Title: "Microphone externe + Téléphone",
    hw2Desc: "Connectez un micro externe pointé vers le conférencier. ✅ Meilleure qualité, sans boucle audio.",
    hw3Title: "Sans écouteurs — téléphone seul",
    hw3Desc: "La traduction sortira par le haut-parleur. ⚠️ Qualité limitée, pour les tests uniquement.",
    speakerLang: "🎤 Langue du conférencier",
    yourLang: "🎧 Votre langue",
    hwWarning: "⚠️ Sans matériel adéquat, la qualité peut être faible.",
    active: "Session active",
    paused: "En pause",
    translating: "Traduction...",
    transcribing: "Transcription...",
    liveTranscript: "Transcription en direct",
    liveTranslation: "Traduction en direct",
    tapToStart: "Appuyez sur Démarrer pour commencer",
    holdToSpeak: "Maintenez 🎙 A ou 🎙 B en parlant · Relâchez pour traduire",
    stop: "⏹ Arrêter",
    start: "▶ Démarrer",
    stopConf: "⏹ Arrêter la conférence",
    startConf: "▶ Démarrer la conférence",
    speaker: "Conférencier",
    youHear: "Vous entendez",
    speed: "Vitesse :",
    capturing: "🎙 Capture audio — première traduction dans ~8s",
    activeCapturing: "🎙 Enregistrement · Traduction continue active",
    emptyConv: "Appuyez sur Démarrer et maintenez\n🎙 A ou 🎙 B en parlant",
    emptyConf: "Placez le téléphone près du conférencier\net appuyez sur Démarrer",
    processing: "Traitement...",
    recording: "🔴 enregistrement",
    errorRetry: "Erreur — réessayez",
    chunkHint: "Blocs de 8s · TTS parallèle · Sans pauses",
    hintAnc: "Téléphone près du conférencier · Portez vos écouteurs",
    hintExtmic: "Connectez le micro externe et pointez-le vers le conférencier",
    hintRisk: "Placez le téléphone près du conférencier",
    hwRiskWarn: "⚠️ Sans matériel optimal, la qualité peut être faible",
    captando: "Capture audio...",
    activo: "Actif",
    chunks: "blocs",
    micTitle: "Microphone",
    micMessage: "Parlora AI a besoin du microphone.",
    micAllow: "Autoriser",
    micDenied: "Permission refusée",
    micDeniedMsg: "Vous devez autoriser l'accès au microphone.",
    ttsTitle: "⚠️ Voix non disponible",
    ttsMsg: (name) => `Votre appareil n'a pas la voix ${name} installée. La traduction sera prononcée dans une autre langue.`,
    installLater: "Installer plus tard",
    continueAnyway: "Continuer quand même",
    understood: "Compris",
    appLang: "Langue de l'app",
    sttStep1: "Ouvrez les Paramètres",
    sttStep2: "Allez dans Gestion générale → Langue → Saisie de texte",
    sttStep3: 'Sélectionnez "Google Voice Typing"',
    sttStep4: (n) => `Recherchez "${n}" et téléchargez le pack vocal`,
    sttStep5: "Redémarrez Parlora AI",
    ttsStep1: "Ouvrez les Paramètres",
    ttsStep2: "Allez dans Gestion générale → Langue → Synthèse vocale",
    ttsStep3: 'Sélectionnez "Google Synthèse vocale"',
    ttsStep4: (n) => `Appuyez sur l'engrenage ⚙️ → Installer les données vocales → "${n}"`,
    ttsStep5: "Téléchargez le pack et redémarrez Parlora AI",
    sttWarnBoth: (n) => `⚠️ ${n} n'est pas disponible`,
    sttWarnBothDesc: (n) => `Votre appareil ne peut ni écouter ni parler en ${n}.`,
    sttWarnStt: "⚠️ Reconnaissance vocale non disponible",
    sttWarnSttDesc: (n) => `Votre appareil ne peut pas transcrire ce que vous dites en ${n}.`,
    sttWarnTts: (n) => `⚠️ Prononciation incorrecte en ${n}`,
    sttWarnTtsDesc: (n) => `Votre appareil n'a pas la voix ${n} installée.`,
    sttLabelStt: "Pour la reconnaissance vocale :",
    sttLabelTts: "Pour la voix synthétisée :",
    sttLabelSttOnly: "Comment installer la reconnaissance vocale :",
    sttLabelTtsOnly: "Comment installer la voix pour une prononciation correcte :",
    grabando: "Session active",
  },
  IT: {
    selectLang: "In quale lingua vuoi usare l'app?",
    tagline: "Traduzione simultanea\nper conversazioni reali",
    continueGoogle: "Continua con Google",
    useEmail: "Usa indirizzo email",
    terms: "Continuando accetti i",
    termsLink: "Termini",
    privacy: "Privacy",
    comingSoon: "Prossimamente",
    emailSoon: "Login con email nella prossima versione.",
    chooseMode: "Scegli modalità",
    modeQuestion: "Come utilizzerai Parlora AI?",
    conversation: "Conversazione",
    convDesc: "Due persone si alternano. Ognuna preme il proprio microfono mentre parla.",
    conference: "Modalità conferenza",
    confDesc: "Il telefono ascolta il relatore e ricevi la traduzione in tempo reale.",
    chooseLanguage: "Scegli la lingua di ogni persona",
    personA: "Persona A",
    personB: "Persona B",
    language: "Lingua",
    startSession: "Avvia sessione →",
    startConference: "Avvia conferenza →",
    back: "‹ Indietro",
    hwTitle: "Modalità conferenza",
    hwSub: "Per funzionare correttamente hai bisogno di uno di questi setup",
    hwQuestion: "Quale hardware hai disponibile?",
    hw1Title: "Telefono vicino al relatore + Auricolari",
    hw1Desc: "Metti il telefono vicino al relatore. Indossi gli auricolari e ascolti la traduzione.",
    hw2Title: "Microfono esterno + Telefono",
    hw2Desc: "Connetti un microfono esterno puntato al relatore. ✅ Migliore qualità, senza loop audio.",
    hw3Title: "Senza auricolari — solo telefono",
    hw3Desc: "La traduzione uscirà dall'altoparlante. ⚠️ Qualità limitata, solo per test.",
    speakerLang: "🎤 Lingua del relatore",
    yourLang: "🎧 La tua lingua",
    hwWarning: "⚠️ Senza hardware adeguato la qualità può essere bassa.",
    active: "Sessione attiva",
    paused: "In pausa",
    translating: "Traduzione...",
    transcribing: "Trascrizione...",
    liveTranscript: "Trascrizione in tempo reale",
    liveTranslation: "Traduzione in tempo reale",
    tapToStart: "Tocca Avvia per iniziare",
    holdToSpeak: "Tieni premuto 🎙 A o 🎙 B mentre parli · Rilascia per tradurre",
    stop: "⏹ Ferma",
    start: "▶ Avvia",
    stopConf: "⏹ Ferma conferenza",
    startConf: "▶ Avvia conferenza",
    speaker: "Relatore",
    youHear: "Ascolti",
    speed: "Velocità:",
    capturing: "🎙 Acquisizione audio — prima traduzione in ~8s",
    activeCapturing: "🎙 Registrazione · Traduzione continua attiva",
    emptyConv: "Tocca Avvia e tieni premuto\n🎙 A o 🎙 B mentre parli",
    emptyConf: "Posiziona il telefono vicino al relatore\ne tocca Avvia conferenza",
    processing: "Elaborazione...",
    recording: "🔴 registrazione",
    errorRetry: "Errore — riprova",
    chunkHint: "Blocchi da 8s · TTS parallelo · Senza pause",
    hintAnc: "Telefono vicino al relatore · Indossa gli auricolari",
    hintExtmic: "Connetti il microfono esterno e puntalo al relatore",
    hintRisk: "Posiziona il telefono vicino al relatore",
    hwRiskWarn: "⚠️ Senza hardware ottimale la qualità può essere bassa",
    captando: "Acquisizione audio...",
    activo: "Attivo",
    chunks: "blocchi",
    micTitle: "Microfono",
    micMessage: "Parlora AI ha bisogno del microfono.",
    micAllow: "Consenti",
    micDenied: "Autorizzazione negata",
    micDeniedMsg: "Devi consentire l'accesso al microfono.",
    ttsTitle: "⚠️ Voce non disponibile",
    ttsMsg: (name) => `Il tuo dispositivo non ha la voce ${name} installata. La traduzione sarà pronunciata in un'altra lingua.`,
    installLater: "Installa dopo",
    continueAnyway: "Continua comunque",
    understood: "Capito",
    appLang: "Lingua app",
    sttStep1: "Apri Impostazioni",
    sttStep2: "Vai a Gestione generale → Lingua → Input testo",
    sttStep3: 'Seleziona "Google Voice Typing"',
    sttStep4: (n) => `Cerca "${n}" e scarica il pacchetto vocale`,
    sttStep5: "Riavvia Parlora AI",
    ttsStep1: "Apri Impostazioni",
    ttsStep2: "Vai a Gestione generale → Lingua → Sintesi vocale",
    ttsStep3: 'Seleziona "Google Text-to-Speech"',
    ttsStep4: (n) => `Tocca l'ingranaggio ⚙️ → Installa dati vocali → "${n}"`,
    ttsStep5: "Scarica il pacchetto e riavvia Parlora AI",
    sttWarnBoth: (n) => `⚠️ ${n} non è disponibile`,
    sttWarnBothDesc: (n) => `Il tuo dispositivo non può né ascoltare né parlare in ${n}.`,
    sttWarnStt: "⚠️ Riconoscimento vocale non disponibile",
    sttWarnSttDesc: (n) => `Il tuo dispositivo non può trascrivere in ${n}.`,
    sttWarnTts: (n) => `⚠️ Pronuncia non corretta in ${n}`,
    sttWarnTtsDesc: (n) => `Il tuo dispositivo non ha la voce ${n} installata.`,
    sttLabelStt: "Per il riconoscimento vocale:",
    sttLabelTts: "Per la voce sintetizzata:",
    sttLabelSttOnly: "Come installare il riconoscimento vocale:",
    sttLabelTtsOnly: "Come installare la voce per la pronuncia corretta:",
    grabando: "Sessione attiva",
  },
  PT: {
    selectLang: "Em que idioma quer usar o app?",
    tagline: "Tradução simultânea\npara conversas reais",
    continueGoogle: "Continuar com Google",
    useEmail: "Usar endereço de email",
    terms: "Ao continuar você aceita os",
    termsLink: "Termos",
    privacy: "Privacidade",
    comingSoon: "Em breve",
    emailSoon: "Login por email na próxima versão.",
    chooseMode: "Escolher modo",
    modeQuestion: "Como vai usar o Parlora AI?",
    conversation: "Conversa",
    convDesc: "Duas pessoas se revezam. Cada uma pressiona seu microfone ao falar.",
    conference: "Modo conferência",
    confDesc: "O telefone ouve o palestrante e você recebe a tradução em tempo real.",
    chooseLanguage: "Escolher o idioma de cada pessoa",
    personA: "Pessoa A",
    personB: "Pessoa B",
    language: "Idioma",
    startSession: "Iniciar sessão →",
    startConference: "Iniciar conferência →",
    back: "‹ Voltar",
    hwTitle: "Modo conferência",
    hwSub: "Para funcionar corretamente você precisa de um destes setups",
    hwQuestion: "Qual hardware você tem disponível?",
    hw1Title: "Telefone perto do palestrante + Fones",
    hw1Desc: "Coloque o telefone perto do palestrante. Você usa fones e ouve a tradução.",
    hw2Title: "Microfone externo + Telefone",
    hw2Desc: "Conecte um microfone externo apontado para o palestrante. ✅ Melhor qualidade.",
    hw3Title: "Sem fones — apenas telefone",
    hw3Desc: "A tradução sairá pelo alto-falante. ⚠️ Qualidade limitada, apenas para testes.",
    speakerLang: "🎤 Idioma do palestrante",
    yourLang: "🎧 Seu idioma",
    hwWarning: "⚠️ Sem hardware adequado a qualidade pode ser baixa.",
    active: "Sessão ativa",
    paused: "Pausado",
    translating: "Traduzindo...",
    transcribing: "Transcrevendo...",
    liveTranscript: "Transcrição ao vivo",
    liveTranslation: "Tradução ao vivo",
    tapToStart: "Toque em Iniciar para começar",
    holdToSpeak: "Segure 🎙 A ou 🎙 B ao falar · Solte para traduzir",
    stop: "⏹ Parar",
    start: "▶ Iniciar",
    stopConf: "⏹ Parar conferência",
    startConf: "▶ Iniciar conferência",
    speaker: "Palestrante",
    youHear: "Você ouve",
    speed: "Velocidade:",
    capturing: "🎙 Capturando áudio — primeira tradução em ~8s",
    activeCapturing: "🎙 Gravando · Tradução contínua ativa",
    emptyConv: "Toque em Iniciar e segure\n🎙 A ou 🎙 B ao falar",
    emptyConf: "Coloque o telefone perto do palestrante\ne toque em Iniciar conferência",
    processing: "Processando...",
    recording: "🔴 gravando",
    errorRetry: "Erro — tente novamente",
    chunkHint: "Blocos de 8s · TTS paralelo · Sem pausas",
    hintAnc: "Coloque o telefone perto do palestrante · Use os fones",
    hintExtmic: "Conecte o microfone externo e aponte para o palestrante",
    hintRisk: "Coloque o telefone perto do palestrante",
    hwRiskWarn: "⚠️ Sem hardware ideal a qualidade pode ser baixa",
    captando: "Capturando áudio...",
    activo: "Ativo",
    chunks: "blocos",
    micTitle: "Microfone",
    micMessage: "Parlora AI precisa do microfone.",
    micAllow: "Permitir",
    micDenied: "Permissão negada",
    micDeniedMsg: "Você precisa permitir o acesso ao microfone.",
    ttsTitle: "⚠️ Voz não disponível",
    ttsMsg: (name) => `Seu dispositivo não tem a voz em ${name} instalada. A tradução será falada em outro idioma.`,
    installLater: "Instalar depois",
    continueAnyway: "Continuar mesmo assim",
    understood: "Entendido",
    appLang: "Idioma do app",
    sttStep1: "Abra Configurações",
    sttStep2: "Vá para Gerenciamento geral → Idioma → Entrada de texto",
    sttStep3: 'Selecione "Google Voice Typing"',
    sttStep4: (n) => `Encontre "${n}" e baixe o pacote de voz`,
    sttStep5: "Reinicie o Parlora AI",
    ttsStep1: "Abra Configurações",
    ttsStep2: "Vá para Gerenciamento geral → Idioma → Texto para fala",
    ttsStep3: 'Selecione "Google Text-to-Speech"',
    ttsStep4: (n) => `Toque na engrenagem ⚙️ → Instalar dados de voz → "${n}"`,
    ttsStep5: "Baixe o pacote e reinicie o Parlora AI",
    sttWarnBoth: (n) => `⚠️ ${n} não está disponível`,
    sttWarnBothDesc: (n) => `Seu dispositivo não pode ouvir nem falar em ${n}.`,
    sttWarnStt: "⚠️ Reconhecimento de voz não disponível",
    sttWarnSttDesc: (n) => `Seu dispositivo não pode transcrever em ${n}.`,
    sttWarnTts: (n) => `⚠️ Pronúncia incorreta em ${n}`,
    sttWarnTtsDesc: (n) => `Seu dispositivo não tem a voz ${n} instalada.`,
    sttLabelStt: "Para reconhecimento de voz:",
    sttLabelTts: "Para voz sintetizada:",
    sttLabelSttOnly: "Como instalar o reconhecimento de voz:",
    sttLabelTtsOnly: "Como instalar a voz para pronúncia correta:",
    grabando: "Sessão ativa",
  },
  CS: {
    selectLang: "V jakém jazyce chcete používat aplikaci?",
    tagline: "Simultánní překlad\npro skutečné rozhovory",
    continueGoogle: "Pokračovat s Google",
    useEmail: "Použít e-mailovou adresu",
    terms: "Pokračováním souhlasíte s",
    termsLink: "Podmínkami",
    privacy: "Ochranou soukromí",
    comingSoon: "Brzy",
    emailSoon: "Přihlášení e-mailem v příští verzi.",
    chooseMode: "Vyberte režim",
    modeQuestion: "Jak budete používat Parlora AI?",
    conversation: "Konverzace",
    convDesc: "Dvě osoby se střídají. Každá drží mikrofon při mluvení.",
    conference: "Konferenční režim",
    confDesc: "Telefon poslouchá řečníka a vy dostáváte simultánní překlad.",
    chooseLanguage: "Vyberte jazyk každé osoby",
    personA: "Osoba A",
    personB: "Osoba B",
    language: "Jazyk",
    startSession: "Zahájit relaci →",
    startConference: "Zahájit konferenci →",
    back: "‹ Zpět",
    hwTitle: "Konferenční režim",
    hwSub: "Pro správnou funkci potřebujete jedno z těchto nastavení",
    hwQuestion: "Jaký hardware máte k dispozici?",
    hw1Title: "Mobil blízko řečníka + Sluchátka",
    hw1Desc: "Položte mobil blízko řečníka. Nosíte sluchátka a slyšíte překlad.",
    hw2Title: "Externí mikrofon + Mobil",
    hw2Desc: "Připojte externí mikrofon namířený na řečníka. ✅ Nejlepší kvalita.",
    hw3Title: "Bez sluchátek — jen mobil",
    hw3Desc: "Překlad půjde přes reproduktor. ⚠️ Omezená kvalita.",
    speakerLang: "🎤 Jazyk řečníka",
    yourLang: "🎧 Váš jazyk",
    hwWarning: "⚠️ Bez vhodného hardware může být kvalita nízká.",
    active: "Relace aktivní",
    paused: "Pozastaveno",
    translating: "Překládám...",
    transcribing: "Přepisuji...",
    liveTranscript: "Živý přepis",
    liveTranslation: "Živý překlad",
    tapToStart: "Klepněte na Start pro začátek",
    holdToSpeak: "Podržte 🎙 A nebo 🎙 B při mluvení · Pusťte pro překlad",
    stop: "⏹ Zastavit",
    start: "▶ Start",
    stopConf: "⏹ Zastavit konferenci",
    startConf: "▶ Zahájit konferenci",
    speaker: "Řečník",
    youHear: "Vy slyšíte",
    speed: "Rychlost:",
    capturing: "🎙 Zachycování zvuku — první překlad za ~8s",
    activeCapturing: "🎙 Nahrávání · Průběžný překlad aktivní",
    emptyConv: "Klepněte na Start a podržte\n🎙 A nebo 🎙 B při mluvení",
    emptyConf: "Položte telefon blízko řečníka\na klepněte na Zahájit konferenci",
    processing: "Zpracovávám...",
    recording: "🔴 nahrávání",
    errorRetry: "Chyba — zkuste znovu",
    chunkHint: "8s bloky · Paralelní TTS · Bez přestávek",
    hintAnc: "Mobil blízko řečníka · Noste sluchátka",
    hintExtmic: "Připojte externí mikrofon a namiřte ho na řečníka",
    hintRisk: "Položte mobil blízko řečníka",
    hwRiskWarn: "⚠️ Bez optimálního hardware může být kvalita nízká",
    captando: "Zachycování zvuku...",
    activo: "Aktivní",
    chunks: "bloky",
    micTitle: "Mikrofon",
    micMessage: "Parlora AI potřebuje mikrofon.",
    micAllow: "Povolit",
    micDenied: "Oprávnění zamítnuto",
    micDeniedMsg: "Musíte povolit přístup k mikrofonu.",
    ttsTitle: "⚠️ Hlas není dostupný",
    ttsMsg: (name) => `Vaše zařízení nemá nainstalovaný hlas pro ${name}. Překlad bude vyslovován v jiném jazyce.`,
    installLater: "Nainstalovat později",
    continueAnyway: "Pokračovat tak jako tak",
    understood: "Rozumím",
    appLang: "Jazyk aplikace",
    sttStep1: "Otevřete Nastavení",
    sttStep2: "Přejděte na Obecná správa → Jazyk → Zadávání textu",
    sttStep3: 'Vyberte "Google hlasové zadávání"',
    sttStep4: (n) => `Najděte "${n}" a stáhněte hlasový balíček`,
    sttStep5: "Restartujte Parlora AI",
    ttsStep1: "Otevřete Nastavení",
    ttsStep2: "Přejděte na Obecná správa → Jazyk → Převod textu na řeč",
    ttsStep3: 'Vyberte "Google převod textu na řeč"',
    ttsStep4: (n) => `Klepněte na ozubené kolo ⚙️ → Instalovat hlasová data → "${n}"`,
    ttsStep5: "Stáhněte balíček a restartujte Parlora AI",
    sttWarnBoth: (n) => `⚠️ ${n} není dostupný`,
    sttWarnBothDesc: (n) => `Vaše zařízení nemůže ani poslouchat ani mluvit v ${n}.`,
    sttWarnStt: "⚠️ Rozpoznávání řeči není dostupné",
    sttWarnSttDesc: (n) => `Vaše zařízení nemůže přepsat co říkáte v ${n}.`,
    sttWarnTts: (n) => `⚠️ Nesprávná výslovnost v ${n}`,
    sttWarnTtsDesc: (n) => `Vaše zařízení nemá nainstalovaný hlas pro ${n}.`,
    sttLabelStt: "Pro rozpoznávání řeči:",
    sttLabelTts: "Pro syntézu řeči:",
    sttLabelSttOnly: "Jak nainstalovat rozpoznávání řeči:",
    sttLabelTtsOnly: "Jak nainstalovat hlas pro správnou výslovnost:",
    grabando: "Relace aktivní",
  },
  PL: {
    selectLang: "W jakim języku chcesz używać aplikacji?",
    tagline: "Tłumaczenie symultaniczne\ndla prawdziwych rozmów",
    continueGoogle: "Kontynuuj z Google",
    useEmail: "Użyj adresu e-mail",
    terms: "Kontynuując akceptujesz",
    termsLink: "Warunki",
    privacy: "Prywatność",
    comingSoon: "Wkrótce",
    emailSoon: "Logowanie e-mailem w następnej wersji.",
    chooseMode: "Wybierz tryb",
    modeQuestion: "Jak będziesz używać Parlora AI?",
    conversation: "Rozmowa",
    convDesc: "Dwie osoby na zmianę mówią. Każda przytrzymuje mikrofon podczas mówienia.",
    conference: "Tryb konferencyjny",
    confDesc: "Telefon słucha prelegenta i otrzymujesz tłumaczenie w czasie rzeczywistym.",
    chooseLanguage: "Wybierz język każdej osoby",
    personA: "Osoba A",
    personB: "Osoba B",
    language: "Język",
    startSession: "Rozpocznij sesję →",
    startConference: "Rozpocznij konferencję →",
    back: "‹ Wróć",
    hwTitle: "Tryb konferencyjny",
    hwSub: "Dla prawidłowego działania potrzebujesz jednego z tych ustawień",
    hwQuestion: "Jaki sprzęt masz dostępny?",
    hw1Title: "Telefon blisko prelegenta + Słuchawki",
    hw1Desc: "Połóż telefon blisko prelegenta. Nosisz słuchawki i słyszysz tłumaczenie.",
    hw2Title: "Zewnętrzny mikrofon + Telefon",
    hw2Desc: "Podłącz zewnętrzny mikrofon skierowany na prelegenta. ✅ Najlepsza jakość.",
    hw3Title: "Bez słuchawek — tylko telefon",
    hw3Desc: "Tłumaczenie będzie przez głośnik. ⚠️ Ograniczona jakość, tylko do testów.",
    speakerLang: "🎤 Język prelegenta",
    yourLang: "🎧 Twój język",
    hwWarning: "⚠️ Bez odpowiedniego sprzętu jakość może być niska.",
    active: "Sesja aktywna",
    paused: "Wstrzymano",
    translating: "Tłumaczę...",
    transcribing: "Transkrybuję...",
    liveTranscript: "Transkrypcja na żywo",
    liveTranslation: "Tłumaczenie na żywo",
    tapToStart: "Dotknij Start aby rozpocząć",
    holdToSpeak: "Przytrzymaj 🎙 A lub 🎙 B podczas mówienia · Puść aby przetłumaczyć",
    stop: "⏹ Zatrzymaj",
    start: "▶ Start",
    stopConf: "⏹ Zatrzymaj konferencję",
    startConf: "▶ Rozpocznij konferencję",
    speaker: "Prelegent",
    youHear: "Słyszysz",
    speed: "Prędkość:",
    capturing: "🎙 Przechwytywanie dźwięku — pierwsze tłumaczenie za ~8s",
    activeCapturing: "🎙 Nagrywanie · Ciągłe tłumaczenie aktywne",
    emptyConv: "Dotknij Start i przytrzymaj\n🎙 A lub 🎙 B podczas mówienia",
    emptyConf: "Połóż telefon blisko prelegenta\ni dotknij Rozpocznij konferencję",
    processing: "Przetwarzam...",
    recording: "🔴 nagrywanie",
    errorRetry: "Błąd — spróbuj ponownie",
    chunkHint: "Bloki 8s · Równoległy TTS · Bez przerw",
    hintAnc: "Połóż telefon blisko prelegenta · Noś słuchawki",
    hintExtmic: "Podłącz zewnętrzny mikrofon i skieruj go na prelegenta",
    hintRisk: "Połóż telefon blisko prelegenta",
    hwRiskWarn: "⚠️ Bez optymalnego sprzętu jakość może być niska",
    captando: "Przechwytywanie dźwięku...",
    activo: "Aktywny",
    chunks: "bloki",
    micTitle: "Mikrofon",
    micMessage: "Parlora AI potrzebuje mikrofonu.",
    micAllow: "Zezwól",
    micDenied: "Odmówiono uprawnień",
    micDeniedMsg: "Musisz zezwolić na dostęp do mikrofonu.",
    ttsTitle: "⚠️ Głos niedostępny",
    ttsMsg: (name) => `Twoje urządzenie nie ma zainstalowanego głosu dla ${name}. Tłumaczenie będzie wypowiadane w innym języku.`,
    installLater: "Zainstaluj później",
    continueAnyway: "Kontynuuj mimo to",
    understood: "Rozumiem",
    appLang: "Język aplikacji",
    sttStep1: "Otwórz Ustawienia",
    sttStep2: "Przejdź do Zarządzanie ogólne → Język → Wprowadzanie tekstu",
    sttStep3: 'Wybierz "Google Voice Typing"',
    sttStep4: (n) => `Znajdź "${n}" i pobierz pakiet głosowy`,
    sttStep5: "Uruchom ponownie Parlora AI",
    ttsStep1: "Otwórz Ustawienia",
    ttsStep2: "Przejdź do Zarządzanie ogólne → Język → Zamiana tekstu na mowę",
    ttsStep3: 'Wybierz "Google Text-to-Speech"',
    ttsStep4: (n) => `Dotknij koła zębatego ⚙️ → Zainstaluj dane głosowe → "${n}"`,
    ttsStep5: "Pobierz pakiet i uruchom ponownie Parlora AI",
    sttWarnBoth: (n) => `⚠️ ${n} nie jest dostępny`,
    sttWarnBothDesc: (n) => `Twoje urządzenie nie może ani słuchać ani mówić w ${n}.`,
    sttWarnStt: "⚠️ Rozpoznawanie mowy niedostępne",
    sttWarnSttDesc: (n) => `Twoje urządzenie nie może transkrybować w ${n}.`,
    sttWarnTts: (n) => `⚠️ Nieprawidłowa wymowa w ${n}`,
    sttWarnTtsDesc: (n) => `Twoje urządzenie nie ma zainstalowanego głosu dla ${n}.`,
    sttLabelStt: "Dla rozpoznawania mowy:",
    sttLabelTts: "Dla syntezy mowy:",
    sttLabelSttOnly: "Jak zainstalować rozpoznawanie mowy:",
    sttLabelTtsOnly: "Jak zainstalować głos dla poprawnej wymowy:",
    grabando: "Sesja aktywna",
  },
  NL: {
    selectLang: "In welke taal wil je de app gebruiken?",
    tagline: "Simultaanvertaling\nvoor echte gesprekken",
    continueGoogle: "Doorgaan met Google",
    useEmail: "E-mailadres gebruiken",
    terms: "Door verder te gaan accepteert u de",
    termsLink: "Voorwaarden",
    privacy: "Privacy",
    comingSoon: "Binnenkort",
    emailSoon: "E-maillogin in de volgende versie.",
    chooseMode: "Kies modus",
    modeQuestion: "Hoe gaat u Parlora AI gebruiken?",
    conversation: "Gesprek",
    convDesc: "Twee personen wisselen af. Elke persoon houdt zijn microfoon ingedrukt tijdens het spreken.",
    conference: "Conferentiemodus",
    confDesc: "De telefoon luistert naar de spreker en u ontvangt de vertaling in realtime.",
    chooseLanguage: "Kies de taal van elke persoon",
    personA: "Persoon A",
    personB: "Persoon B",
    language: "Taal",
    startSession: "Sessie starten →",
    startConference: "Conferentie starten →",
    back: "‹ Terug",
    hwTitle: "Conferentiemodus",
    hwSub: "Voor correct gebruik heeft u een van deze hardware-setups nodig",
    hwQuestion: "Welke hardware heeft u beschikbaar?",
    hw1Title: "Telefoon dicht bij spreker + Oortelefoon",
    hw1Desc: "Leg de telefoon dicht bij de spreker. U draagt oortelefoons en hoort de vertaling.",
    hw2Title: "Externe microfoon + Telefoon",
    hw2Desc: "Sluit een externe microfoon aan gericht op de spreker. ✅ Beste kwaliteit.",
    hw3Title: "Zonder oortelefoon — alleen telefoon",
    hw3Desc: "De vertaling komt via de luidspreker. ⚠️ Beperkte kwaliteit, alleen voor tests.",
    speakerLang: "🎤 Taal van de spreker",
    yourLang: "🎧 Uw taal",
    hwWarning: "⚠️ Zonder geschikte hardware kan de kwaliteit laag zijn.",
    active: "Sessie actief",
    paused: "Gepauzeerd",
    translating: "Vertalen...",
    transcribing: "Transcriberen...",
    liveTranscript: "Live transcriptie",
    liveTranslation: "Live vertaling",
    tapToStart: "Tik op Start om te beginnen",
    holdToSpeak: "Houd 🎙 A of 🎙 B ingedrukt tijdens spreken · Loslaten om te vertalen",
    stop: "⏹ Stoppen",
    start: "▶ Starten",
    stopConf: "⏹ Conferentie stoppen",
    startConf: "▶ Conferentie starten",
    speaker: "Spreker",
    youHear: "U hoort",
    speed: "Snelheid:",
    capturing: "🎙 Audio vastleggen — eerste vertaling in ~8s",
    activeCapturing: "🎙 Opnemen · Continue vertaling actief",
    emptyConv: "Tik op Start en houd ingedrukt\n🎙 A of 🎙 B tijdens spreken",
    emptyConf: "Leg telefoon dicht bij spreker\nen tik op Conferentie starten",
    processing: "Verwerken...",
    recording: "🔴 opnemen",
    errorRetry: "Fout — probeer opnieuw",
    chunkHint: "8s blokken · Parallel TTS · Geen pauzes",
    hintAnc: "Telefoon dicht bij spreker · Draag oortelefoons",
    hintExtmic: "Sluit externe microfoon aan en richt op spreker",
    hintRisk: "Leg telefoon dicht bij de spreker",
    hwRiskWarn: "⚠️ Zonder optimale hardware kan de kwaliteit laag zijn",
    captando: "Audio vastleggen...",
    activo: "Actief",
    chunks: "blokken",
    micTitle: "Microfoon",
    micMessage: "Parlora AI heeft de microfoon nodig.",
    micAllow: "Toestaan",
    micDenied: "Toestemming geweigerd",
    micDeniedMsg: "U moet toegang tot de microfoon toestaan.",
    ttsTitle: "⚠️ Stem niet beschikbaar",
    ttsMsg: (name) => `Uw apparaat heeft de ${name}-stem niet geïnstalleerd. De vertaling wordt in een andere taal uitgesproken.`,
    installLater: "Later installeren",
    continueAnyway: "Toch doorgaan",
    understood: "Begrepen",
    appLang: "App-taal",
    sttStep1: "Open Instellingen",
    sttStep2: "Ga naar Algemeen beheer → Taal → Tekstinvoer",
    sttStep3: 'Selecteer "Google Voice Typing"',
    sttStep4: (n) => `Zoek "${n}" en download het taalpakket`,
    sttStep5: "Herstart Parlora AI",
    ttsStep1: "Open Instellingen",
    ttsStep2: "Ga naar Algemeen beheer → Taal → Tekst-naar-spraak",
    ttsStep3: 'Selecteer "Google Text-to-Speech"',
    ttsStep4: (n) => `Tik op het tandwiel ⚙️ → Spraakgegevens installeren → "${n}"`,
    ttsStep5: "Download het pakket en herstart Parlora AI",
    sttWarnBoth: (n) => `⚠️ ${n} is niet beschikbaar`,
    sttWarnBothDesc: (n) => `Uw apparaat kan in ${n} noch luisteren noch spreken.`,
    sttWarnStt: "⚠️ Spraakherkenning niet beschikbaar",
    sttWarnSttDesc: (n) => `Uw apparaat kan niet transcriberen in ${n}.`,
    sttWarnTts: (n) => `⚠️ Onjuiste uitspraak in ${n}`,
    sttWarnTtsDesc: (n) => `Uw apparaat heeft de ${n}-stem niet geïnstalleerd.`,
    sttLabelStt: "Voor spraakherkenning:",
    sttLabelTts: "Voor spraaksynthese:",
    sttLabelSttOnly: "Hoe spraakherkenning installeren:",
    sttLabelTtsOnly: "Hoe de stem installeren voor correcte uitspraak:",
    grabando: "Sessie actief",
  },
};

const UI_LANG_OPTIONS = [
  { code: 'ES', name: 'Español',    flag: '🇪🇸' },
  { code: 'EN', name: 'English',    flag: '🇬🇧' },
  { code: 'FR', name: 'Français',   flag: '🇫🇷' },
  { code: 'DE', name: 'Deutsch',    flag: '🇩🇪' },
  { code: 'IT', name: 'Italiano',   flag: '🇮🇹' },
  { code: 'PT', name: 'Português',  flag: '🇵🇹' },
  { code: 'SK', name: 'Slovenčina', flag: '🇸🇰' },
  { code: 'CS', name: 'Čeština',    flag: '🇨🇿' },
  { code: 'PL', name: 'Polski',     flag: '🇵🇱' },
  { code: 'NL', name: 'Nederlands', flag: '🇳🇱' },
];

// Helper: build STT/TTS warning object using t strings
function buildWarning(lang, deviceSupport, t) {
  const sup = deviceSupport[lang.code];
  if (!sup || (sup.stt && sup.tts)) return null;
  const n = lang.name;
  if (!sup.stt && !sup.tts) {
    return {
      title: t.sttWarnBoth(n),
      desc: t.sttWarnBothDesc(n),
      sections: [
        { label: t.sttLabelStt, steps: [t.sttStep1, t.sttStep2, t.sttStep3, t.sttStep4(n), t.sttStep5] },
        { label: t.sttLabelTts, steps: [t.ttsStep1, t.ttsStep2, t.ttsStep3, t.ttsStep4(n), t.ttsStep5] },
      ],
    };
  }
  if (!sup.stt) {
    return {
      title: t.sttWarnStt,
      desc: t.sttWarnSttDesc(n),
      sections: [{ label: t.sttLabelSttOnly, steps: [t.sttStep1, t.sttStep2, t.sttStep3, t.sttStep4(n), t.sttStep5] }],
    };
  }
  return {
    title: t.sttWarnTts(n),
    desc: t.sttWarnTtsDesc(n),
    sections: [{ label: t.sttLabelTtsOnly, steps: [t.ttsStep1, t.ttsStep2, t.ttsStep3, t.ttsStep4(n), t.ttsStep5] }],
  };
}

// ─── LANG SELECT SCREEN ───────────────────────────────────────────

// ─── PRIVACY & TERMS ─────────────────────────────────────────────
const PRIVACY_TERMS = {
  ES: {
    privacyTitle: "Política de Privacidad",
    privacyContent: `Última actualización: abril 2025

Parlora AI ("nosotros") se compromete a proteger tu privacidad.

1. DATOS QUE RECOPILAMOS
• Audio temporal: grabamos tu voz solo para transcribirla. El audio se elimina inmediatamente después de la transcripción.
• Idioma de la app: guardamos tu preferencia de idioma localmente en tu dispositivo.
• Idiomas de conversación: guardamos los idiomas seleccionados localmente en tu dispositivo.
No recopilamos nombres, emails ni datos de identificación personal sin tu consentimiento.

2. CÓMO USAMOS TUS DATOS
• El audio se envía a Groq (Whisper) para transcripción y se elimina inmediatamente.
• El texto transcrito se envía a DeepL para traducción.
• Ningún audio ni texto se almacena en nuestros servidores.

3. SERVICIOS DE TERCEROS
• Groq Whisper: transcripción de voz. Política: groq.com/privacy
• DeepL: traducción de texto. Política: deepl.com/privacy

4. TUS DERECHOS
Puedes eliminar todos los datos locales desinstalando la app.

5. CONTACTO
privacy@parlora.ai`,

    termsTitle: "Términos de Uso",
    termsContent: `Última actualización: abril 2025

1. ACEPTACIÓN
Al usar Parlora AI aceptas estos términos.

2. USO PERMITIDO
Parlora AI es una herramienta de traducción para uso personal y profesional legítimo.

3. USO PROHIBIDO
• No uses Parlora AI para actividades ilegales.
• No intentes acceder a sistemas no autorizados.
• No uses el servicio para acosar o dañar a otros.

4. LIMITACIÓN DE RESPONSABILIDAD
Las traducciones son automáticas y pueden contener errores. No nos hacemos responsables de decisiones tomadas basándose en traducciones incorrectas.

5. DISPONIBILIDAD
El servicio puede interrumpirse temporalmente por mantenimiento.

6. CAMBIOS
Podemos actualizar estos términos. Te notificaremos de cambios importantes.

7. CONTACTO
legal@parlora.ai`,
  },
  EN: {
    privacyTitle: "Privacy Policy",
    privacyContent: `Last updated: April 2025

Parlora AI ("we") is committed to protecting your privacy.

1. DATA WE COLLECT
• Temporary audio: we record your voice only to transcribe it. Audio is deleted immediately after transcription.
• App language: we store your language preference locally on your device.
• Conversation languages: we store selected languages locally on your device.
We do not collect names, emails or personal identification data without your consent.

2. HOW WE USE YOUR DATA
• Audio is sent to Groq (Whisper) for transcription and deleted immediately.
• Transcribed text is sent to DeepL for translation.
• No audio or text is stored on our servers.

3. THIRD-PARTY SERVICES
• Groq Whisper: voice transcription. Policy: groq.com/privacy
• DeepL: text translation. Policy: deepl.com/privacy

4. YOUR RIGHTS
You can delete all local data by uninstalling the app.

5. CONTACT
privacy@parlora.ai`,

    termsTitle: "Terms of Use",
    termsContent: `Last updated: April 2025

1. ACCEPTANCE
By using Parlora AI you accept these terms.

2. PERMITTED USE
Parlora AI is a translation tool for legitimate personal and professional use.

3. PROHIBITED USE
• Do not use Parlora AI for illegal activities.
• Do not attempt to access unauthorized systems.
• Do not use the service to harass or harm others.

4. LIMITATION OF LIABILITY
Translations are automatic and may contain errors. We are not responsible for decisions made based on incorrect translations.

5. AVAILABILITY
The service may be temporarily interrupted for maintenance.

6. CHANGES
We may update these terms. We will notify you of important changes.

7. CONTACT
legal@parlora.ai`,
  },
};

// Get privacy/terms in current language (fallback to EN)
function getPrivacyTerms(uiLang) {
  return PRIVACY_TERMS[uiLang] || PRIVACY_TERMS.EN;
}

// ─── ONBOARDING DATA ──────────────────────────────────────────────
function getOnboardingSteps(t) {
  return [
    {
      icon: '🌐',
      title: t.ob1Title || 'Welcome to Parlora AI',
      desc: t.ob1Desc || 'Real-time translation for conversations between people who speak different languages.',
    },
    {
      icon: '💬',
      title: t.ob2Title || 'Conversation mode',
      desc: t.ob2Desc || 'Two people take turns. Hold the mic button while speaking, release to translate. The translation is spoken aloud automatically.',
    },
    {
      icon: '🎤',
      title: t.ob3Title || 'Conference mode',
      desc: t.ob3Desc || 'The phone listens continuously to a speaker and translates in near real-time. Ideal for lectures or presentations.',
    },
    {
      icon: '⚡',
      title: t.ob6Title || 'Real-time conversation',
      desc: t.ob6Desc || 'One person creates a room and shares a QR code. The other scans it from any browser. Both speak continuously — translation plays automatically in earphones (~4s delay). Requires ANC earphones for best quality.',
    },
    {
      icon: '🔁',
      title: t.ob4Title || 'Repeat last translation',
      desc: t.ob4Desc || 'Tap the 🔁 button at any time to replay the last translation.',
    },
    {
      icon: '⚡',
      title: t.ob5Title || 'Ready to start',
      desc: t.ob5Desc || 'Select your languages and start speaking. Parlora AI will do the rest.',
    },
  ];
}

// Add onboarding strings to UI_LANGS ES and EN (others fallback to EN)
// ─── STRINGS ADICIONALES POR IDIOMA ──────────────────────────────
// ES
UI_LANGS.ES.onboardingTitle = 'Guía de uso';
UI_LANGS.ES.onboardingPrev = 'Anterior';
UI_LANGS.ES.micTooltip = 'Mantén aquí para empezar a hablar y traducir';
UI_LANGS.ES.audioInputLabel = 'Micrófono';
UI_LANGS.ES.audioOutputLabel = 'Altavoz';
UI_LANGS.ES.ob1Title = 'Bienvenido a Parlora AI';
UI_LANGS.ES.ob1Desc = 'Traducción en tiempo real para conversaciones entre personas que hablan idiomas diferentes.';
UI_LANGS.ES.ob2Title = 'Modo Conversación';
UI_LANGS.ES.ob2Desc = 'Dos personas se turnan. Mantén pulsado el botón de micrófono mientras hablas, suelta para traducir. La traducción se escucha automáticamente.';
UI_LANGS.ES.ob3Title = 'Modo Conferencia';
UI_LANGS.ES.ob3Desc = 'El móvil escucha continuamente a un ponente y traduce casi en tiempo real. Ideal para charlas o presentaciones.';
UI_LANGS.ES.ob4Title = 'Repetir última traducción';
UI_LANGS.ES.ob4Desc = 'Pulsa el botón 🔁 en cualquier momento para repetir la última traducción.';
UI_LANGS.ES.ob5Title = 'Listo para empezar';
UI_LANGS.ES.ob5Desc = 'Selecciona tus idiomas y empieza a hablar. Parlora AI hará el resto.';
UI_LANGS.ES.ob6Title = 'Conversación en tiempo real';
UI_LANGS.ES.ob6Desc = 'Una persona crea una sala y comparte el QR. La otra lo escanea desde cualquier navegador. Ambos hablan continuamente — la traducción suena automáticamente en los auriculares (~4s de delay). Requiere auriculares ANC para mejor calidad.';
UI_LANGS.ES.onboardingNext = 'Siguiente';
UI_LANGS.ES.onboardingDone = '¡Empezar!';
UI_LANGS.ES.onboardingSkip = 'Saltar';
UI_LANGS.ES.onboardingRepeat = 'Ver tutorial';
UI_LANGS.ES.namePersonA = 'Persona A';
UI_LANGS.ES.namePersonB = 'Persona B';
UI_LANGS.ES.editNames = 'Personalizar nombres';
UI_LANGS.ES.namePlaceholderA = 'Nombre de A';
UI_LANGS.ES.namePlaceholderB = 'Nombre de B';
UI_LANGS.ES.audioInput = 'Entrada de audio';
UI_LANGS.ES.audioOutput = 'Salida de audio';
UI_LANGS.ES.micPhone = '📱 Micrófono del teléfono';
UI_LANGS.ES.micBluetooth = '🎧 Micrófono Bluetooth';
UI_LANGS.ES.outSpeaker = '📢 Altavoz del teléfono';
UI_LANGS.ES.outEarpiece = '📱 Auricular del teléfono';
UI_LANGS.ES.outBluetooth = '🎧 Altavoz/Auricular Bluetooth';
UI_LANGS.ES.audioWarning = '⚠️ Con micrófono del teléfono y altavoz activo, el micrófono puede captar la traducción. Calidad limitada.';
UI_LANGS.ES.seePrivacy = 'Política de Privacidad';
UI_LANGS.ES.seeTerms = 'Términos de Uso';
UI_LANGS.ES.close = 'Cerrar';

// EN
UI_LANGS.EN.onboardingTitle = 'How to use';
UI_LANGS.EN.onboardingPrev = 'Previous';
UI_LANGS.EN.micTooltip = 'Hold here to start speaking and translating';
UI_LANGS.EN.audioInputLabel = 'Microphone';
UI_LANGS.EN.audioOutputLabel = 'Speaker';
UI_LANGS.EN.ob1Title = 'Welcome to Parlora AI';
UI_LANGS.EN.ob1Desc = 'Real-time translation for conversations between people who speak different languages.';
UI_LANGS.EN.ob2Title = 'Conversation mode';
UI_LANGS.EN.ob2Desc = 'Two people take turns. Hold the mic button while speaking, release to translate. The translation is spoken aloud automatically.';
UI_LANGS.EN.ob3Title = 'Conference mode';
UI_LANGS.EN.ob3Desc = 'The phone listens continuously to a speaker and translates in near real-time. Ideal for lectures or presentations.';
UI_LANGS.EN.ob4Title = 'Repeat last translation';
UI_LANGS.EN.ob4Desc = 'Tap the 🔁 button at any time to replay the last translation.';
UI_LANGS.EN.ob5Title = 'Ready to start';
UI_LANGS.EN.ob5Desc = 'Select your languages and start speaking. Parlora AI will do the rest.';
UI_LANGS.EN.ob6Title = 'Real-time conversation';
UI_LANGS.EN.ob6Desc = 'One person creates a room and shares a QR code. The other scans it from any browser. Both speak continuously — translation plays automatically in earphones (~4s delay). Requires ANC earphones for best quality.';
UI_LANGS.EN.onboardingNext = 'Next';
UI_LANGS.EN.onboardingDone = "Let's go!";
UI_LANGS.EN.onboardingSkip = 'Skip';
UI_LANGS.EN.onboardingRepeat = 'View tutorial';
UI_LANGS.EN.namePersonA = 'Person A';
UI_LANGS.EN.namePersonB = 'Person B';
UI_LANGS.EN.editNames = 'Customize names';
UI_LANGS.EN.namePlaceholderA = 'Name of A';
UI_LANGS.EN.namePlaceholderB = 'Name of B';
UI_LANGS.EN.audioInput = 'Audio input';
UI_LANGS.EN.audioOutput = 'Audio output';
UI_LANGS.EN.micPhone = '📱 Phone microphone';
UI_LANGS.EN.micBluetooth = '🎧 Bluetooth microphone';
UI_LANGS.EN.outSpeaker = '📢 Phone speaker';
UI_LANGS.EN.outEarpiece = '📱 Phone earpiece';
UI_LANGS.EN.outBluetooth = '🎧 Bluetooth speaker/earphones';
UI_LANGS.EN.audioWarning = '⚠️ With phone microphone and speaker active, the mic may pick up the translation. Limited quality.';
UI_LANGS.EN.seePrivacy = 'Privacy Policy';
UI_LANGS.EN.seeTerms = 'Terms of Use';
UI_LANGS.EN.close = 'Close';

// DE
UI_LANGS.DE.onboardingTitle = 'Bedienungsanleitung';
UI_LANGS.DE.onboardingPrev = 'Zurück';
UI_LANGS.DE.onboardingNext = 'Weiter';
UI_LANGS.DE.onboardingDone = 'Los geht\'s!';
UI_LANGS.DE.onboardingSkip = 'Überspringen';
UI_LANGS.DE.onboardingRepeat = 'Tutorial ansehen';
UI_LANGS.DE.micTooltip = 'Hier gedrückt halten, um zu sprechen und zu übersetzen';
UI_LANGS.DE.audioInputLabel = 'Mikrofon';
UI_LANGS.DE.audioOutputLabel = 'Lautsprecher';
UI_LANGS.DE.namePersonA = 'Person A';
UI_LANGS.DE.namePersonB = 'Person B';
UI_LANGS.DE.editNames = 'Namen anpassen';
UI_LANGS.DE.namePlaceholderA = 'Name von A';
UI_LANGS.DE.namePlaceholderB = 'Name von B';
UI_LANGS.DE.audioInput = 'Mikrofon';
UI_LANGS.DE.audioOutput = 'Lautsprecher';
UI_LANGS.DE.micPhone = '📱 Telefonmikrofon';
UI_LANGS.DE.micBluetooth = '🎧 Bluetooth-Mikrofon';
UI_LANGS.DE.outSpeaker = '📢 Telefon-Lautsprecher';
UI_LANGS.DE.outEarpiece = '📱 Hörmuschel';
UI_LANGS.DE.outBluetooth = '🎧 Bluetooth-Lautsprecher/Kopfhörer';
UI_LANGS.DE.audioWarning = '⚠️ Mit Telefonmikrofon und Lautsprecher kann das Mikrofon die Übersetzung aufnehmen. Begrenzte Qualität.';
UI_LANGS.DE.seePrivacy = 'Datenschutz';
UI_LANGS.DE.seeTerms = 'Nutzungsbedingungen';
UI_LANGS.DE.close = 'Schließen';
UI_LANGS.DE.ob1Title = 'Willkommen bei Parlora AI';
UI_LANGS.DE.ob1Desc = 'Echtzeit-Übersetzung für Gespräche zwischen Menschen, die verschiedene Sprachen sprechen.';
UI_LANGS.DE.ob2Title = 'Gesprächsmodus';
UI_LANGS.DE.ob2Desc = 'Zwei Personen wechseln sich ab. Mikrofontaste gedrückt halten beim Sprechen, loslassen zum Übersetzen.';
UI_LANGS.DE.ob3Title = 'Konferenzmodus';
UI_LANGS.DE.ob3Desc = 'Das Telefon hört dem Redner kontinuierlich zu und übersetzt nahezu in Echtzeit.';
UI_LANGS.DE.ob4Title = 'Letzte Übersetzung wiederholen';
UI_LANGS.DE.ob4Desc = 'Tippe jederzeit auf 🔁 um die letzte Übersetzung zu wiederholen.';
UI_LANGS.DE.ob5Title = 'Bereit loszulegen';
UI_LANGS.DE.ob5Desc = 'Sprachen auswählen und anfangen zu sprechen. Parlora AI erledigt den Rest.';

// FR
UI_LANGS.FR.onboardingTitle = 'Guide d\'utilisation';
UI_LANGS.FR.onboardingPrev = 'Précédent';
UI_LANGS.FR.onboardingNext = 'Suivant';
UI_LANGS.FR.onboardingDone = 'C\'est parti !';
UI_LANGS.FR.onboardingSkip = 'Passer';
UI_LANGS.FR.onboardingRepeat = 'Voir le tutoriel';
UI_LANGS.FR.micTooltip = 'Maintenez ici pour commencer à parler et traduire';
UI_LANGS.FR.audioInputLabel = 'Microphone';
UI_LANGS.FR.audioOutputLabel = 'Haut-parleur';
UI_LANGS.FR.namePersonA = 'Personne A';
UI_LANGS.FR.namePersonB = 'Personne B';
UI_LANGS.FR.editNames = 'Personnaliser les noms';
UI_LANGS.FR.namePlaceholderA = 'Nom de A';
UI_LANGS.FR.namePlaceholderB = 'Nom de B';
UI_LANGS.FR.audioInput = 'Microphone';
UI_LANGS.FR.audioOutput = 'Haut-parleur';
UI_LANGS.FR.micPhone = '📱 Micro du téléphone';
UI_LANGS.FR.micBluetooth = '🎧 Micro Bluetooth';
UI_LANGS.FR.outSpeaker = '📢 Haut-parleur du téléphone';
UI_LANGS.FR.outEarpiece = '📱 Écouteur du téléphone';
UI_LANGS.FR.outBluetooth = '🎧 Haut-parleur/Écouteurs Bluetooth';
UI_LANGS.FR.audioWarning = '⚠️ Avec le micro et le haut-parleur du téléphone, le micro peut capter la traduction. Qualité limitée.';
UI_LANGS.FR.seePrivacy = 'Confidentialité';
UI_LANGS.FR.seeTerms = 'Conditions d\'utilisation';
UI_LANGS.FR.close = 'Fermer';
UI_LANGS.FR.ob1Title = 'Bienvenue sur Parlora AI';
UI_LANGS.FR.ob1Desc = 'Traduction en temps réel pour les conversations entre personnes parlant des langues différentes.';
UI_LANGS.FR.ob2Title = 'Mode Conversation';
UI_LANGS.FR.ob2Desc = 'Deux personnes se relaient. Maintenez le bouton micro en parlant, relâchez pour traduire.';
UI_LANGS.FR.ob3Title = 'Mode Conférence';
UI_LANGS.FR.ob3Desc = 'Le téléphone écoute continuellement un orateur et traduit en quasi temps réel.';
UI_LANGS.FR.ob4Title = 'Répéter la dernière traduction';
UI_LANGS.FR.ob4Desc = 'Appuyez sur 🔁 à tout moment pour rejouer la dernière traduction.';
UI_LANGS.FR.ob5Title = 'Prêt à démarrer';
UI_LANGS.FR.ob5Desc = 'Sélectionnez vos langues et commencez à parler. Parlora AI fait le reste.';

// IT
UI_LANGS.IT.onboardingTitle = 'Guida all\'uso';
UI_LANGS.IT.onboardingPrev = 'Precedente';
UI_LANGS.IT.onboardingNext = 'Avanti';
UI_LANGS.IT.onboardingDone = 'Iniziamo!';
UI_LANGS.IT.onboardingSkip = 'Salta';
UI_LANGS.IT.onboardingRepeat = 'Vedi tutorial';
UI_LANGS.IT.micTooltip = 'Tieni premuto qui per iniziare a parlare e tradurre';
UI_LANGS.IT.audioInputLabel = 'Microfono';
UI_LANGS.IT.audioOutputLabel = 'Altoparlante';
UI_LANGS.IT.namePersonA = 'Persona A';
UI_LANGS.IT.namePersonB = 'Persona B';
UI_LANGS.IT.editNames = 'Personalizza nomi';
UI_LANGS.IT.namePlaceholderA = 'Nome di A';
UI_LANGS.IT.namePlaceholderB = 'Nome di B';
UI_LANGS.IT.audioInput = 'Microfono';
UI_LANGS.IT.audioOutput = 'Altoparlante';
UI_LANGS.IT.micPhone = '📱 Microfono del telefono';
UI_LANGS.IT.micBluetooth = '🎧 Microfono Bluetooth';
UI_LANGS.IT.outSpeaker = '📢 Altoparlante del telefono';
UI_LANGS.IT.outEarpiece = '📱 Auricolare del telefono';
UI_LANGS.IT.outBluetooth = '🎧 Altoparlante/Auricolare Bluetooth';
UI_LANGS.IT.audioWarning = '⚠️ Con microfono e altoparlante del telefono, il microfono può captare la traduzione. Qualità limitata.';
UI_LANGS.IT.seePrivacy = 'Privacy';
UI_LANGS.IT.seeTerms = 'Termini di utilizzo';
UI_LANGS.IT.close = 'Chiudi';
UI_LANGS.IT.ob1Title = 'Benvenuto su Parlora AI';
UI_LANGS.IT.ob1Desc = 'Traduzione in tempo reale per conversazioni tra persone che parlano lingue diverse.';
UI_LANGS.IT.ob2Title = 'Modalità Conversazione';
UI_LANGS.IT.ob2Desc = 'Due persone si alternano. Tieni premuto il microfono mentre parli, rilascia per tradurre.';
UI_LANGS.IT.ob3Title = 'Modalità Conferenza';
UI_LANGS.IT.ob3Desc = 'Il telefono ascolta continuamente un relatore e traduce quasi in tempo reale.';
UI_LANGS.IT.ob4Title = 'Ripeti ultima traduzione';
UI_LANGS.IT.ob4Desc = 'Tocca 🔁 in qualsiasi momento per riprodurre l\'ultima traduzione.';
UI_LANGS.IT.ob5Title = 'Pronto per iniziare';
UI_LANGS.IT.ob5Desc = 'Seleziona le lingue e inizia a parlare. Parlora AI farà il resto.';

// PT
UI_LANGS.PT.onboardingTitle = 'Guia de uso';
UI_LANGS.PT.onboardingPrev = 'Anterior';
UI_LANGS.PT.onboardingNext = 'Próximo';
UI_LANGS.PT.onboardingDone = 'Vamos lá!';
UI_LANGS.PT.onboardingSkip = 'Pular';
UI_LANGS.PT.onboardingRepeat = 'Ver tutorial';
UI_LANGS.PT.micTooltip = 'Mantenha aqui para começar a falar e traduzir';
UI_LANGS.PT.audioInputLabel = 'Microfone';
UI_LANGS.PT.audioOutputLabel = 'Alto-falante';
UI_LANGS.PT.namePersonA = 'Pessoa A';
UI_LANGS.PT.namePersonB = 'Pessoa B';
UI_LANGS.PT.editNames = 'Personalizar nomes';
UI_LANGS.PT.namePlaceholderA = 'Nome de A';
UI_LANGS.PT.namePlaceholderB = 'Nome de B';
UI_LANGS.PT.audioInput = 'Microfone';
UI_LANGS.PT.audioOutput = 'Alto-falante';
UI_LANGS.PT.micPhone = '📱 Microfone do telefone';
UI_LANGS.PT.micBluetooth = '🎧 Microfone Bluetooth';
UI_LANGS.PT.outSpeaker = '📢 Alto-falante do telefone';
UI_LANGS.PT.outEarpiece = '📱 Auricular do telefone';
UI_LANGS.PT.outBluetooth = '🎧 Alto-falante/Fone Bluetooth';
UI_LANGS.PT.audioWarning = '⚠️ Com microfone e alto-falante do telefone, o microfone pode captar a tradução. Qualidade limitada.';
UI_LANGS.PT.seePrivacy = 'Privacidade';
UI_LANGS.PT.seeTerms = 'Termos de uso';
UI_LANGS.PT.close = 'Fechar';
UI_LANGS.PT.ob1Title = 'Bem-vindo ao Parlora AI';
UI_LANGS.PT.ob1Desc = 'Tradução em tempo real para conversas entre pessoas que falam idiomas diferentes.';
UI_LANGS.PT.ob2Title = 'Modo Conversa';
UI_LANGS.PT.ob2Desc = 'Duas pessoas se revezam. Mantenha o botão do microfone pressionado ao falar, solte para traduzir.';
UI_LANGS.PT.ob3Title = 'Modo Conferência';
UI_LANGS.PT.ob3Desc = 'O telefone ouve continuamente um palestrante e traduz quase em tempo real.';
UI_LANGS.PT.ob4Title = 'Repetir última tradução';
UI_LANGS.PT.ob4Desc = 'Toque em 🔁 a qualquer momento para reproduzir a última tradução.';
UI_LANGS.PT.ob5Title = 'Pronto para começar';
UI_LANGS.PT.ob5Desc = 'Selecione seus idiomas e comece a falar. Parlora AI fará o resto.';

// SK
UI_LANGS.SK.onboardingTitle = 'Návod na použitie';
UI_LANGS.SK.onboardingPrev = 'Predchádzajúce';
UI_LANGS.SK.onboardingNext = 'Ďalej';
UI_LANGS.SK.onboardingDone = 'Začnime!';
UI_LANGS.SK.onboardingSkip = 'Preskočiť';
UI_LANGS.SK.onboardingRepeat = 'Zobraziť návod';
UI_LANGS.SK.micTooltip = 'Podržte tu pre začatie hovoru a prekladu';
UI_LANGS.SK.audioInputLabel = 'Mikrofón';
UI_LANGS.SK.audioOutputLabel = 'Reproduktor';
UI_LANGS.SK.namePersonA = 'Osoba A';
UI_LANGS.SK.namePersonB = 'Osoba B';
UI_LANGS.SK.editNames = 'Upraviť mená';
UI_LANGS.SK.namePlaceholderA = 'Meno A';
UI_LANGS.SK.namePlaceholderB = 'Meno B';
UI_LANGS.SK.audioInput = 'Mikrofón';
UI_LANGS.SK.audioOutput = 'Reproduktor';
UI_LANGS.SK.micPhone = '📱 Mikrofón telefónu';
UI_LANGS.SK.micBluetooth = '🎧 Bluetooth mikrofón';
UI_LANGS.SK.outSpeaker = '📢 Reproduktor telefónu';
UI_LANGS.SK.outEarpiece = '📱 Slúchadlo telefónu';
UI_LANGS.SK.outBluetooth = '🎧 Bluetooth reproduktor/slúchadlá';
UI_LANGS.SK.audioWarning = '⚠️ S mikrofónom a reproduktorom telefónu môže mikrofón zachytiť preklad. Obmedzená kvalita.';
UI_LANGS.SK.seePrivacy = 'Ochrana súkromia';
UI_LANGS.SK.seeTerms = 'Podmienky používania';
UI_LANGS.SK.close = 'Zavrieť';
UI_LANGS.SK.ob1Title = 'Vitajte v Parlora AI';
UI_LANGS.SK.ob1Desc = 'Simultánny preklad pre rozhovory medzi ľuďmi, ktorí hovoria rôznymi jazykmi.';
UI_LANGS.SK.ob2Title = 'Režim konverzácie';
UI_LANGS.SK.ob2Desc = 'Dve osoby sa striedajú. Podržte tlačidlo mikrofónu počas hovoru, pustite pre preklad.';
UI_LANGS.SK.ob3Title = 'Konferenčný režim';
UI_LANGS.SK.ob3Desc = 'Telefón nepretržite počúva rečníka a prekladá takmer v reálnom čase.';
UI_LANGS.SK.ob4Title = 'Zopakovať posledný preklad';
UI_LANGS.SK.ob4Desc = 'Kedykoľvek klepnite na 🔁 pre zopakovanie posledného prekladu.';
UI_LANGS.SK.ob5Title = 'Pripravený začať';
UI_LANGS.SK.ob5Desc = 'Vyberte svoje jazyky a začnite hovoriť. Parlora AI urobí zvyšok.';

// CS
UI_LANGS.CS.onboardingTitle = 'Návod k použití';
UI_LANGS.CS.onboardingPrev = 'Předchozí';
UI_LANGS.CS.onboardingNext = 'Další';
UI_LANGS.CS.onboardingDone = 'Pojďme!';
UI_LANGS.CS.onboardingSkip = 'Přeskočit';
UI_LANGS.CS.onboardingRepeat = 'Zobrazit návod';
UI_LANGS.CS.micTooltip = 'Podržte zde pro zahájení mluvení a překladu';
UI_LANGS.CS.audioInputLabel = 'Mikrofon';
UI_LANGS.CS.audioOutputLabel = 'Reproduktor';
UI_LANGS.CS.namePersonA = 'Osoba A';
UI_LANGS.CS.namePersonB = 'Osoba B';
UI_LANGS.CS.editNames = 'Upravit jména';
UI_LANGS.CS.namePlaceholderA = 'Jméno A';
UI_LANGS.CS.namePlaceholderB = 'Jméno B';
UI_LANGS.CS.audioInput = 'Mikrofon';
UI_LANGS.CS.audioOutput = 'Reproduktor';
UI_LANGS.CS.micPhone = '📱 Mikrofon telefonu';
UI_LANGS.CS.micBluetooth = '🎧 Bluetooth mikrofon';
UI_LANGS.CS.outSpeaker = '📢 Reproduktor telefonu';
UI_LANGS.CS.outEarpiece = '📱 Sluchátko telefonu';
UI_LANGS.CS.outBluetooth = '🎧 Bluetooth reproduktor/sluchátka';
UI_LANGS.CS.audioWarning = '⚠️ S mikrofonem a reproduktorem telefonu může mikrofon zachytit překlad. Omezená kvalita.';
UI_LANGS.CS.seePrivacy = 'Ochrana soukromí';
UI_LANGS.CS.seeTerms = 'Podmínky použití';
UI_LANGS.CS.close = 'Zavřít';
UI_LANGS.CS.ob1Title = 'Vítejte v Parlora AI';
UI_LANGS.CS.ob1Desc = 'Simultánní překlad pro rozhovory mezi lidmi, kteří mluví různými jazyky.';
UI_LANGS.CS.ob2Title = 'Režim konverzace';
UI_LANGS.CS.ob2Desc = 'Dvě osoby se střídají. Podržte tlačítko mikrofonu při mluvení, pusťte pro překlad.';
UI_LANGS.CS.ob3Title = 'Konferenční režim';
UI_LANGS.CS.ob3Desc = 'Telefon nepřetržitě poslouchá řečníka a překládá téměř v reálném čase.';
UI_LANGS.CS.ob4Title = 'Opakovat poslední překlad';
UI_LANGS.CS.ob4Desc = 'Kdykoli klepněte na 🔁 pro opakování posledního překladu.';
UI_LANGS.CS.ob5Title = 'Připraveno začít';
UI_LANGS.CS.ob5Desc = 'Vyberte své jazyky a začněte mluvit. Parlora AI udělá zbytek.';

// PL
UI_LANGS.PL.onboardingTitle = 'Przewodnik użytkownika';
UI_LANGS.PL.onboardingPrev = 'Poprzedni';
UI_LANGS.PL.onboardingNext = 'Następny';
UI_LANGS.PL.onboardingDone = 'Zaczynamy!';
UI_LANGS.PL.onboardingSkip = 'Pomiń';
UI_LANGS.PL.onboardingRepeat = 'Zobacz tutorial';
UI_LANGS.PL.micTooltip = 'Przytrzymaj tutaj, aby zacząć mówić i tłumaczyć';
UI_LANGS.PL.audioInputLabel = 'Mikrofon';
UI_LANGS.PL.audioOutputLabel = 'Głośnik';
UI_LANGS.PL.namePersonA = 'Osoba A';
UI_LANGS.PL.namePersonB = 'Osoba B';
UI_LANGS.PL.editNames = 'Dostosuj nazwy';
UI_LANGS.PL.namePlaceholderA = 'Imię A';
UI_LANGS.PL.namePlaceholderB = 'Imię B';
UI_LANGS.PL.audioInput = 'Mikrofon';
UI_LANGS.PL.audioOutput = 'Głośnik';
UI_LANGS.PL.micPhone = '📱 Mikrofon telefonu';
UI_LANGS.PL.micBluetooth = '🎧 Mikrofon Bluetooth';
UI_LANGS.PL.outSpeaker = '📢 Głośnik telefonu';
UI_LANGS.PL.outEarpiece = '📱 Słuchawka telefonu';
UI_LANGS.PL.outBluetooth = '🎧 Głośnik/Słuchawki Bluetooth';
UI_LANGS.PL.audioWarning = '⚠️ Z mikrofonem i głośnikiem telefonu, mikrofon może wychwycić tłumaczenie. Ograniczona jakość.';
UI_LANGS.PL.seePrivacy = 'Prywatność';
UI_LANGS.PL.seeTerms = 'Warunki użytkowania';
UI_LANGS.PL.close = 'Zamknij';
UI_LANGS.PL.ob1Title = 'Witaj w Parlora AI';
UI_LANGS.PL.ob1Desc = 'Tłumaczenie w czasie rzeczywistym dla rozmów między osobami mówiącymi różnymi językami.';
UI_LANGS.PL.ob2Title = 'Tryb rozmowy';
UI_LANGS.PL.ob2Desc = 'Dwie osoby na zmianę mówią. Przytrzymaj przycisk mikrofonu podczas mówienia, puść aby przetłumaczyć.';
UI_LANGS.PL.ob3Title = 'Tryb konferencyjny';
UI_LANGS.PL.ob3Desc = 'Telefon nieprzerwanie słucha prelegenta i tłumaczy prawie w czasie rzeczywistym.';
UI_LANGS.PL.ob4Title = 'Powtórz ostatnie tłumaczenie';
UI_LANGS.PL.ob4Desc = 'Dotknij 🔁 w dowolnym momencie, aby odtworzyć ostatnie tłumaczenie.';
UI_LANGS.PL.ob5Title = 'Gotowy do rozpoczęcia';
UI_LANGS.PL.ob5Desc = 'Wybierz języki i zacznij mówić. Parlora AI zrobi resztę.';

// NL
UI_LANGS.NL.onboardingTitle = 'Gebruikershandleiding';
UI_LANGS.NL.onboardingPrev = 'Vorige';
UI_LANGS.NL.onboardingNext = 'Volgende';
UI_LANGS.NL.onboardingDone = 'Laten we gaan!';
UI_LANGS.NL.onboardingSkip = 'Overslaan';
UI_LANGS.NL.onboardingRepeat = 'Tutorial bekijken';
UI_LANGS.NL.micTooltip = 'Houd hier ingedrukt om te beginnen met spreken en vertalen';
UI_LANGS.NL.audioInputLabel = 'Microfoon';
UI_LANGS.NL.audioOutputLabel = 'Luidspreker';
UI_LANGS.NL.namePersonA = 'Persoon A';
UI_LANGS.NL.namePersonB = 'Persoon B';
UI_LANGS.NL.editNames = 'Namen aanpassen';
UI_LANGS.NL.namePlaceholderA = 'Naam van A';
UI_LANGS.NL.namePlaceholderB = 'Naam van B';
UI_LANGS.NL.audioInput = 'Microfoon';
UI_LANGS.NL.audioOutput = 'Luidspreker';
UI_LANGS.NL.micPhone = '📱 Telefoommicrofoon';
UI_LANGS.NL.micBluetooth = '🎧 Bluetooth-microfoon';
UI_LANGS.NL.outSpeaker = '📢 Telefoonluidspreker';
UI_LANGS.NL.outEarpiece = '📱 Telefoonoortje';
UI_LANGS.NL.outBluetooth = '🎧 Bluetooth-luidspreker/oordopjes';
UI_LANGS.NL.audioWarning = '⚠️ Met telefoonmicrofoon en luidspreker kan de microfoon de vertaling opvangen. Beperkte kwaliteit.';
UI_LANGS.NL.seePrivacy = 'Privacy';
UI_LANGS.NL.seeTerms = 'Gebruiksvoorwaarden';
UI_LANGS.NL.close = 'Sluiten';
UI_LANGS.NL.ob1Title = 'Welkom bij Parlora AI';
UI_LANGS.NL.ob1Desc = 'Realtime vertaling voor gesprekken tussen mensen die verschillende talen spreken.';
UI_LANGS.NL.ob2Title = 'Gespreksmodus';
UI_LANGS.NL.ob2Desc = 'Twee personen wisselen af. Houd de microfoonknop ingedrukt tijdens het spreken, loslaten om te vertalen.';
UI_LANGS.NL.ob3Title = 'Conferentiemodus';
UI_LANGS.NL.ob3Desc = 'De telefoon luistert continu naar een spreker en vertaalt bijna in realtime.';
UI_LANGS.NL.ob4Title = 'Laatste vertaling herhalen';
UI_LANGS.NL.ob4Desc = 'Tik op 🔁 om de laatste vertaling opnieuw af te spelen.';
UI_LANGS.NL.ob5Title = 'Klaar om te beginnen';
UI_LANGS.NL.ob5Desc = 'Selecteer uw talen en begin te spreken. Parlora AI doet de rest.';

// Realtime strings for all languages (fallback to EN if not translated)
const RT_STRINGS = {
  DE: { realtime: 'Echtzeit-Gespräch', realtimeDesc: 'Zwei Personen hören und übersetzen gleichzeitig. Benötigt ANC-Kopfhörer.', realtimeSetupTitle: 'Echtzeit-Gespräch', youSpeak: 'Sie sprechen in', theySpeak: 'Sie sprechen in', startRealtime: 'Raum erstellen →', ancWarning: '🎧 Geräuschunterdrückende Kopfhörer (ANC) erforderlich. Ohne sie kann das Mikrofon die Übersetzung aufnehmen.', creatingRoom: 'Raum wird erstellt...', roomReady: 'Raum bereit', scanQR: 'Bitten Sie den anderen, diesen QR zu scannen', roomId: 'Raumcode', waitingGuest: 'Warte auf Gast...', guestJoined: 'Gast verbunden!', peerLeft: 'Der andere Teilnehmer hat den Raum verlassen', roomClosed: 'Der Raum wurde geschlossen', roomExpiry: 'Raum läuft nach 5 Min. Inaktivität ab', stopRealtime: '⏹ Sitzung beenden', startRealtimeSession: '▶ Starten', realtimeActive: 'Simultanübersetzung aktiv', realtimeHint: '🎧 Normal sprechen · Übersetzung kommt im anderen Kopfhörer', stopTranslating: '⏹ Übersetzen stoppen', pauseTTS: '⏸ Stimme pausieren', resumeTTS: '▶ Stimme fortsetzen', ob6Title: 'Echtzeit-Gespräch', ob6Desc: 'Eine Person erstellt einen Raum und teilt den QR-Code. Die andere scannt ihn. Beide sprechen kontinuierlich — Übersetzung läuft automatisch im Kopfhörer (~4s Verzögerung). ANC-Kopfhörer empfohlen.' },
  FR: { realtime: 'Conversation en temps réel', realtimeDesc: "Deux personnes s'écoutent et se traduisent simultanément. Nécessite des écouteurs ANC.", realtimeSetupTitle: 'Conversation en temps réel', youSpeak: 'Vous parlez en', theySpeak: 'Ils parlent en', startRealtime: 'Créer la salle →', ancWarning: "🎧 Des écouteurs à réduction de bruit (ANC) sont requis. Sans eux, le micro peut capter la traduction.", creatingRoom: 'Création de la salle...', roomReady: 'Salle prête', scanQR: "Demandez à l'autre de scanner ce QR", roomId: 'Code de la salle', waitingGuest: "En attente de l'invité...", guestJoined: 'Invité connecté !', peerLeft: "L'autre participant est parti", roomClosed: 'La salle a été fermée', roomExpiry: "La salle expire après 5 min d'inactivité", stopRealtime: '⏹ Terminer la session', startRealtimeSession: '▶ Démarrer', realtimeActive: 'Traduction simultanée active', realtimeHint: "🎧 Parlez normalement · La traduction arrive dans l'autre écouteur", stopTranslating: '⏹ Arrêter de traduire', pauseTTS: '⏸ Mettre en pause', resumeTTS: '▶ Reprendre', ob6Title: 'Conversation en temps réel', ob6Desc: "Une personne crée une salle et partage le QR. L'autre le scanne. Les deux parlent en continu — la traduction joue automatiquement dans les écouteurs (~4s). Écouteurs ANC recommandés." },
  IT: { realtime: 'Conversazione in tempo reale', realtimeDesc: 'Due persone si ascoltano e traducono simultaneamente. Richiede auricolari ANC.', realtimeSetupTitle: 'Conversazione in tempo reale', youSpeak: 'Parli in', theySpeak: 'Parlano in', startRealtime: 'Crea stanza →', ancWarning: 'Sono richiesti auricolari con cancellazione del rumore (ANC). Senza di essi, il microfono può captare la traduzione.', creatingRoom: 'Creazione stanza...', roomReady: 'Stanza pronta', scanQR: "Chiedi all'altro di scansionare questo QR", roomId: 'Codice stanza', waitingGuest: "In attesa dell'ospite...", guestJoined: 'Ospite connesso!', peerLeft: "L'altro partecipante ha lasciato", roomClosed: 'La stanza è stata chiusa', roomExpiry: 'La stanza scade dopo 5 min di inattività', stopRealtime: '⏹ Termina sessione', startRealtimeSession: '▶ Avvia', realtimeActive: 'Traduzione simultanea attiva', realtimeHint: "🎧 Parla normalmente · La traduzione arriva nell'altro auricolare", stopTranslating: '⏹ Smetti di tradurre', pauseTTS: '⏸ Pausa voce', resumeTTS: '▶ Riprendi voce', ob6Title: 'Conversazione in tempo reale', ob6Desc: 'Una persona crea una stanza e condivide il QR. L\'altra lo scansiona. Entrambi parlano continuamente — la traduzione suona automaticamente negli auricolari (~4s). Auricolari ANC consigliati.' },
  PT: { realtime: 'Conversa em tempo real', realtimeDesc: 'Duas pessoas se ouvem e traduzem simultaneamente. Requer fones ANC.', realtimeSetupTitle: 'Conversa em tempo real', youSpeak: 'Você fala em', theySpeak: 'Eles falam em', startRealtime: 'Criar sala →', ancWarning: '🎧 Fones com cancelamento de ruído (ANC) são necessários. Sem eles, o microfone pode captar a tradução.', creatingRoom: 'Criando sala...', roomReady: 'Sala pronta', scanQR: 'Peça ao outro para escanear este QR', roomId: 'Código da sala', waitingGuest: 'Aguardando convidado...', guestJoined: 'Convidado conectado!', peerLeft: 'O outro participante saiu', roomClosed: 'A sala foi encerrada', roomExpiry: 'A sala expira após 5 min de inatividade', stopRealtime: '⏹ Encerrar sessão', startRealtimeSession: '▶ Iniciar', realtimeActive: 'Tradução simultânea ativa', realtimeHint: '🎧 Fale normalmente · A tradução chega no outro fone', stopTranslating: '⏹ Parar tradução', pauseTTS: '⏸ Pausar voz', resumeTTS: '▶ Retomar voz', ob6Title: 'Conversa em tempo real', ob6Desc: 'Uma pessoa cria uma sala e compartilha o QR. A outra escaneia. Ambas falam continuamente — a tradução toca automaticamente nos fones (~4s). Fones ANC recomendados.' },
  SK: { realtime: 'Konverzácia v reálnom čase', realtimeDesc: 'Dve osoby sa počúvajú a prekladajú súčasne. Vyžaduje ANC slúchadlá.', realtimeSetupTitle: 'Konverzácia v reálnom čase', youSpeak: 'Hovoríte v', theySpeak: 'Hovoria v', startRealtime: 'Vytvoriť miestnosť →', ancWarning: '🎧 Vyžadujú sa slúchadlá s potlačením hluku (ANC). Bez nich môže mikrofón zachytiť preklad.', creatingRoom: 'Vytváranie miestnosti...', roomReady: 'Miestnosť pripravená', scanQR: 'Požiadajte druhého, aby naskenoval tento QR', roomId: 'Kód miestnosti', waitingGuest: 'Čakám na hosťa...', guestJoined: 'Hosť pripojený!', peerLeft: 'Druhý účastník odišiel', roomClosed: 'Miestnosť bola zatvorená', roomExpiry: 'Miestnosť vyprší po 5 min nečinnosti', stopRealtime: '⏹ Ukončiť reláciu', startRealtimeSession: '▶ Štart', realtimeActive: 'Simultánny preklad aktívny', realtimeHint: '🎧 Hovorte normálne · Preklad príde do druhého slúchadla', stopTranslating: '⏹ Zastaviť preklad', pauseTTS: '⏸ Pozastaviť hlas', resumeTTS: '▶ Pokračovať hlas', ob6Title: 'Konverzácia v reálnom čase', ob6Desc: 'Jedna osoba vytvorí miestnosť a zdieľa QR. Druhá ho naskenuje. Obaja hovoria nepretržite — preklad znie automaticky v slúchadlách (~4s). Odporúčajú sa ANC slúchadlá.' },
  CS: { realtime: 'Konverzace v reálném čase', realtimeDesc: 'Dvě osoby se poslouchají a překládají současně. Vyžaduje ANC sluchátka.', realtimeSetupTitle: 'Konverzace v reálném čase', youSpeak: 'Mluvíte v', theySpeak: 'Mluví v', startRealtime: 'Vytvořit místnost →', ancWarning: '🎧 Vyžadují se sluchátka s potlačením hluku (ANC). Bez nich může mikrofon zachytit překlad.', creatingRoom: 'Vytváření místnosti...', roomReady: 'Místnost připravena', scanQR: 'Požádejte druhého, aby naskenoval tento QR', roomId: 'Kód místnosti', waitingGuest: 'Čekám na hosta...', guestJoined: 'Host připojen!', peerLeft: 'Druhý účastník odešel', roomClosed: 'Místnost byla uzavřena', roomExpiry: 'Místnost vyprší po 5 min nečinnosti', stopRealtime: '⏹ Ukončit relaci', startRealtimeSession: '▶ Start', realtimeActive: 'Simultánní překlad aktivní', realtimeHint: '🎧 Mluvte normálně · Překlad přijde do druhého sluchátka', stopTranslating: '⏹ Zastavit překlad', pauseTTS: '⏸ Pozastavit hlas', resumeTTS: '▶ Pokračovat hlas', ob6Title: 'Konverzace v reálném čase', ob6Desc: 'Jedna osoba vytvoří místnost a sdílí QR. Druhá ho naskenuje. Obě mluví průběžně — překlad zní automaticky ve sluchátkách (~4s). Doporučují se ANC sluchátka.' },
  PL: { realtime: 'Rozmowa w czasie rzeczywistym', realtimeDesc: 'Dwie osoby słuchają się i tłumaczą jednocześnie. Wymaga słuchawek ANC.', realtimeSetupTitle: 'Rozmowa w czasie rzeczywistym', youSpeak: 'Mówisz w', theySpeak: 'Mówią w', startRealtime: 'Utwórz pokój →', ancWarning: '🎧 Wymagane są słuchawki z redukcją szumów (ANC). Bez nich mikrofon może wychwycić tłumaczenie.', creatingRoom: 'Tworzenie pokoju...', roomReady: 'Pokój gotowy', scanQR: 'Poproś drugą osobę o zeskanowanie tego QR', roomId: 'Kod pokoju', waitingGuest: 'Oczekiwanie na gościa...', guestJoined: 'Gość połączony!', peerLeft: 'Drugi uczestnik opuścił sesję', roomClosed: 'Pokój został zamknięty', roomExpiry: 'Pokój wygasa po 5 min braku aktywności', stopRealtime: '⏹ Zakończ sesję', startRealtimeSession: '▶ Start', realtimeActive: 'Tłumaczenie symultaniczne aktywne', realtimeHint: '🎧 Mów normalnie · Tłumaczenie trafia do drugiej słuchawki', stopTranslating: '⏹ Zatrzymaj tłumaczenie', pauseTTS: '⏸ Wstrzymaj głos', resumeTTS: '▶ Wznów głos', ob6Title: 'Rozmowa w czasie rzeczywistym', ob6Desc: 'Jedna osoba tworzy pokój i udostępnia QR. Druga go skanuje. Obie mówią nieprzerwanie — tłumaczenie gra automatycznie w słuchawkach (~4s). Zalecane słuchawki ANC.' },
  NL: { realtime: 'Realtimegesprek', realtimeDesc: 'Twee personen luisteren en vertalen tegelijkertijd. Vereist ANC-oordopjes.', realtimeSetupTitle: 'Realtimegesprek', youSpeak: 'U spreekt in', theySpeak: 'Zij spreken in', startRealtime: 'Kamer aanmaken →', ancWarning: '🎧 Ruisonderdrukkende oordopjes (ANC) zijn vereist. Zonder deze kan de microfoon de vertaling oppikken.', creatingRoom: 'Kamer aanmaken...', roomReady: 'Kamer gereed', scanQR: 'Vraag de ander om deze QR te scannen', roomId: 'Kamercode', waitingGuest: 'Wachten op gast...', guestJoined: 'Gast verbonden!', peerLeft: 'De andere deelnemer heeft de sessie verlaten', roomClosed: 'De kamer is gesloten', roomExpiry: 'Kamer verloopt na 5 min inactiviteit', stopRealtime: '⏹ Sessie beëindigen', startRealtimeSession: '▶ Starten', realtimeActive: 'Simultaanvertaling actief', realtimeHint: '🎧 Spreek normaal · De vertaling komt in het andere oortje', stopTranslating: '⏹ Stoppen met vertalen', pauseTTS: '⏸ Stem pauzeren', resumeTTS: '▶ Stem hervatten', ob6Title: 'Realtimegesprek', ob6Desc: 'Één persoon maakt een kamer en deelt de QR. De ander scant hem. Beide spreken continu — vertaling speelt automatisch in oordopjes (~4s). ANC-oordopjes aanbevolen.' },
};

Object.entries(RT_STRINGS).forEach(([code, strings]) => {
  Object.assign(UI_LANGS[code], strings);
});

// ─── ONBOARDING SCREEN ────────────────────────────────────────────
// SVG diagram for conversation mode step
function ConvDiagramSVG() {
  return (
    <View style={{ width: '100%', alignItems: 'center', marginVertical: 16 }}>
      <View style={s.convDiagram}>
        {/* Person A side */}
        <View style={s.convDiagramSide}>
          <View style={[s.convDiagramMic, { borderColor: '#818CF8', backgroundColor: 'rgba(129,140,248,0.15)' }]}>
            <Text style={s.convDiagramMicIcon}>🎙</Text>
            <Text style={[s.convDiagramMicLabel, { color: '#818CF8' }]}>A</Text>
          </View>
          <View style={s.convDiagramArrow}>
            <Text style={s.convDiagramArrowText}>← </Text>
            <Text style={s.convDiagramArrowLabel}>mantén pulsado</Text>
          </View>
        </View>

        {/* Center */}
        <View style={s.convDiagramCenter}>
          <Text style={s.convDiagramCenterIcon}>🌐</Text>
          <Text style={s.convDiagramCenterLabel}>Parlora AI</Text>
        </View>

        {/* Person B side */}
        <View style={s.convDiagramSide}>
          <View style={[s.convDiagramMic, { borderColor: '#C4B5FD', backgroundColor: 'rgba(196,181,253,0.15)' }]}>
            <Text style={s.convDiagramMicIcon}>🎙</Text>
            <Text style={[s.convDiagramMicLabel, { color: '#C4B5FD' }]}>B</Text>
          </View>
          <View style={s.convDiagramArrow}>
            <Text style={s.convDiagramArrowText}> →</Text>
            <Text style={s.convDiagramArrowLabel}>mantén pulsado</Text>
          </View>
        </View>
      </View>
      <View style={s.convDiagramFlow}>
        <Text style={s.convDiagramFlowText}>🎤 habla → 📝 transcribe → 🌐 traduce → 🔊 escucha</Text>
      </View>
    </View>
  );
}

function OnboardingScreen({ t, onDone }) {
  const [step, setStep] = useState(0);
  const scrollRef = useRef(null);
  const pageWidth = useRef(0);
  const steps = getOnboardingSteps(t);
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  const goTo = (i) => {
    setStep(i);
    if (pageWidth.current > 0) {
      scrollRef.current?.scrollTo({ x: i * pageWidth.current, animated: true });
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.onboardingWrapper}>
        {/* Header */}
        <View style={s.onboardingHeader}>
          <Text style={s.onboardingHeaderTitle}>{t.onboardingTitle || 'How to use'}</Text>
          <TouchableOpacity style={s.onboardingSkip} onPress={onDone}>
            <Text style={s.onboardingSkipText}>{t.onboardingSkip}</Text>
          </TouchableOpacity>
        </View>

        {/* Swipeable content */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => { pageWidth.current = e.nativeEvent.layout.width; }}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
            setStep(idx);
          }}
          style={{ flex: 1 }}
        >
          {steps.map((item, i) => (
            <View key={i} style={s.onboardingPage}>
              <Text style={s.onboardingIcon}>{item.icon}</Text>
              <Text style={s.onboardingTitle}>{item.title}</Text>
              <Text style={s.onboardingDesc}>{item.desc}</Text>
              {/* Show diagram on conversation step (step 1) */}
              {i === 1 && <ConvDiagramSVG />}
            </View>
          ))}
        </ScrollView>

        {/* Dots */}
        <View style={s.onboardingDots}>
          {steps.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)}>
              <View style={[s.onboardingDot, i === step && s.onboardingDotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        <View style={s.onboardingBtnRow}>
          {!isFirst ? (
            <TouchableOpacity style={s.onboardingPrevBtn} onPress={() => goTo(step - 1)}>
              <Text style={s.onboardingPrevText}>{t.onboardingPrev || 'Previous'}</Text>
            </TouchableOpacity>
          ) : <View style={{ flex: 1 }} />}

          <TouchableOpacity
            style={s.onboardingNextBtn}
            onPress={() => isLast ? onDone() : goTo(step + 1)}
          >
            <Text style={s.onboardingNextText}>{isLast ? t.onboardingDone : t.onboardingNext}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── LEGAL SCREEN ─────────────────────────────────────────────────
function LegalScreen({ type, uiLang, onClose }) {
  const pt = getPrivacyTerms(uiLang);
  const title = type === 'privacy' ? pt.privacyTitle : pt.termsTitle;
  const content = type === 'privacy' ? pt.privacyContent : pt.termsContent;
  const t = UI_LANGS[uiLang] || UI_LANGS.EN;
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.legalHeader}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <Text style={s.backBtnText}>{t.back || '‹ Back'}</Text>
        </TouchableOpacity>
        <Text style={s.legalTitle}>{title}</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView style={s.legalScroll} contentContainerStyle={{ padding: 20 }}>
        <Text style={s.legalContent}>{content}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}


// ─── LANG SELECT SCREEN ───────────────────────────────────────────
function LangSelectScreen({ onSelect }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.langSelectContainer}>
        <View style={s.logoWrap}><Text style={s.logoEmoji}>🌐</Text></View>
        <Text style={s.appName}>Parlora AI</Text>
        <Text style={s.langSelectTitle}>Choose your language</Text>
        <ScrollView style={{ width: '100%' }} contentContainerStyle={s.langSelectList}>
          {UI_LANG_OPTIONS.map(l => (
            <TouchableOpacity key={l.code} style={s.langSelectItem} onPress={() => onSelect(l.code)}>
              <Text style={s.langSelectFlag}>{l.flag}</Text>
              <Text style={s.langSelectName}>{l.name}</Text>
              <Text style={s.langSelectArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────
function LoginScreen({ onLogin, t, uiLang, setUiLang, onShowPrivacy, onShowTerms }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.loginContainer}>
        <View style={s.logoWrap}><Text style={s.logoEmoji}>🌐</Text></View>
        <Text style={s.appName}>Parlora AI</Text>
        <Text style={s.tagline}>{t.tagline}</Text>
        <TouchableOpacity style={s.googleBtn} onPress={() => { warmUpBackend(); onLogin(); }}>
          <Text style={s.googleG}>G</Text>
          <Text style={s.googleBtnText}>{t.continueGoogle}</Text>
        </TouchableOpacity>
        <View style={s.dividerRow}>
          <View style={s.dividerLine}/><Text style={s.dividerText}>o</Text><View style={s.dividerLine}/>
        </View>
        <TouchableOpacity style={s.emailBtn} onPress={() => Alert.alert(t.comingSoon, t.emailSoon)}>
          <Text style={s.emailBtnText}>{t.useEmail}</Text>
        </TouchableOpacity>
        <Text style={s.terms}>
          {t.terms}{' '}
          <Text style={s.termsLink} onPress={onShowTerms}>{t.termsLink}</Text>
          {' · '}
          <Text style={s.termsLink} onPress={onShowPrivacy}>{t.privacy}</Text>
        </Text>
        <TouchableOpacity style={s.changeLangBtn} onPress={() => setUiLang(null)}>
          <Text style={s.changeLangText}>{UI_LANG_OPTIONS.find(l => l.code === uiLang)?.flag} {t.appLang}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── SETUP ───────────────────────────────────────────────────────
function SetupScreen({ onStart, t, setUiLang, uiLang, onShowOnboarding, pendingRoomId, onClearPendingRoom }) {
  const [mode, setMode] = useState(null);
  const [langA, setLangA] = useState('ES');
  const [langB, setLangB] = useState('EN');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [editingNames, setEditingNames] = useState(false);
  const [confSourceLang, setConfSourceLang] = useState('EN');
  const [confTargetLang, setConfTargetLang] = useState('ES');
  const [audioInput, setAudioInput] = useState('phone');
  const [audioOutput, setAudioOutput] = useState('speaker');
  const [sttWarning, setSttWarning] = useState(null);
  const [deviceSupport, setDeviceSupport] = useState({});
  // Realtime role/join states — must be at top level (no hooks inside conditionals)
  const [rtRole, setRtRole] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [rtCreating, setRtCreating] = useState(false);
  const [rtCreateError, setRtCreateError] = useState('');

  // Handle deep link: auto-navigate to guest join if pendingRoomId
  useEffect(() => {
    if (pendingRoomId) {
      setMode('realtime');
      setRtRole('guest');
      setJoinCode(pendingRoomId);
    }
  }, [pendingRoomId]);

  // Load saved preferences
  useEffect(() => {
    async function loadPrefs() {
      try {
        const saved = await AsyncStorage.getItem('parlora_conv_prefs');
        if (saved) {
          const p = JSON.parse(saved);
          if (p.langA) setLangA(p.langA);
          if (p.langB) setLangB(p.langB);
          if (p.nameA) setNameA(p.nameA);
          if (p.nameB) setNameB(p.nameB);
        }
        const savedConf = await AsyncStorage.getItem('parlora_conf_prefs');
        if (savedConf) {
          const p = JSON.parse(savedConf);
          if (p.confSourceLang) setConfSourceLang(p.confSourceLang);
          if (p.confTargetLang) setConfTargetLang(p.confTargetLang);
          if (p.audioInput) setAudioInput(p.audioInput);
          if (p.audioOutput) setAudioOutput(p.audioOutput);
        }
      } catch (e) {}
    }
    loadPrefs();
  }, []);

  useEffect(() => {
    async function checkDeviceSupport() {
      const support = {};
      let sttLocales = [];
      try {
        const locales = await Voice.getSupportedLocales();
        sttLocales = (locales || []).map(l => l.toLowerCase());
      } catch (e) {
        sttLocales = ['es-es', 'en-us', 'fr-fr', 'de-de', 'it-it', 'pt-pt'];
      }
      let ttsLocales = [];
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        ttsLocales = (voices || []).map(v => (v.language || '').toLowerCase());
      } catch (e) {
        ttsLocales = ['es-es', 'en-us', 'fr-fr', 'de-de', 'it-it', 'pt-pt'];
      }
      for (const lang of LANGUAGES) {
        const voiceBase = lang.voiceLocale.toLowerCase();
        const ttsBase = lang.ttsLocale.toLowerCase();
        const langBase = lang.code.toLowerCase();
        const sttOk = sttLocales.length === 0 ||
          sttLocales.some(l => l.startsWith(langBase) || l === voiceBase || l.startsWith(voiceBase.slice(0,2)));
        const ttsOk = ttsLocales.length === 0 ||
          ttsLocales.some(l => l.startsWith(langBase) || l === ttsBase || l.startsWith(ttsBase.slice(0,2)));
        support[lang.code] = { stt: sttOk, tts: ttsOk };
      }
      setDeviceSupport(support);
    }
    checkDeviceSupport();
  }, []);

  const saveConvPrefs = async (la, lb, na, nb) => {
    try { await AsyncStorage.setItem('parlora_conv_prefs', JSON.stringify({ langA: la, langB: lb, nameA: na, nameB: nb })); } catch (e) {}
  };

  const saveConfPrefs = async (src, tgt, inp, out) => {
    try { await AsyncStorage.setItem('parlora_conf_prefs', JSON.stringify({ confSourceLang: src, confTargetLang: tgt, audioInput: inp, audioOutput: out })); } catch (e) {}
  };

  const displayNameA = nameA || t.namePersonA;
  const displayNameB = nameB || t.namePersonB;

  const showAudioWarning = audioInput === 'phone' && audioOutput === 'speaker';

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
                <Text style={s.sttModalBtnText}>{t.understood}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={s.modeContainer}>
          <View style={s.logoWrap}><Text style={s.logoEmoji}>🌐</Text></View>
          <Text style={s.setupTitle}>{t.chooseMode}</Text>
          <Text style={s.setupSub}>{t.modeQuestion}</Text>
          <TouchableOpacity style={s.modeCard} onPress={() => setMode('conversation')}>
            <Text style={s.modeIcon}>💬</Text>
            <View style={s.modeTextWrap}>
              <Text style={s.modeTitle}>{t.conversation}</Text>
              <Text style={s.modeDesc}>{t.convDesc}</Text>
            </View>
            <Text style={s.modeArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.modeCard, s.modeCardConf]} onPress={() => setMode('conference')}>
            <Text style={s.modeIcon}>🎤</Text>
            <View style={s.modeTextWrap}>
              <Text style={[s.modeTitle, { color: '#C4B5FD' }]}>{t.conference}</Text>
              <Text style={s.modeDesc}>{t.confDesc}</Text>
            </View>
            <Text style={s.modeArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.modeCard, { borderColor: 'rgba(52,199,89,0.3)' }]} onPress={() => setMode('realtime')}>
            <Text style={s.modeIcon}>⚡</Text>
            <View style={s.modeTextWrap}>
              <Text style={[s.modeTitle, { color: '#34C759' }]}>{t.realtime}</Text>
              <Text style={s.modeDesc}>{t.realtimeDesc}</Text>
            </View>
            <Text style={s.modeArrow}>›</Text>
          </TouchableOpacity>
          <View style={s.modeFooter}>
            <TouchableOpacity style={s.changeLangBtn} onPress={() => setUiLang(null)}>
              <Text style={s.changeLangText}>{UI_LANG_OPTIONS.find(l => l.code === uiLang)?.flag} {t.appLang}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.helpBtn} onPress={onShowOnboarding}>
              <Text style={s.helpBtnText}>?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'conversation') {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.setupContainer}>
          <View style={s.setupHeaderRow}>
            <TouchableOpacity onPress={() => setMode(null)} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
            <TouchableOpacity style={s.helpBtn} onPress={onShowOnboarding}><Text style={s.helpBtnText}>?</Text></TouchableOpacity>
          </View>
          <Text style={s.setupTitle}>{t.conversation}</Text>
          <Text style={s.setupSub}>{t.chooseLanguage}</Text>

          {[
            { side: 'A', lang: langA, setLang: (v) => { setLangA(v); saveConvPrefs(v, langB, nameA, nameB); }, color: '#818CF8', activeStyle: s.langChipActiveA, name: nameA, setName: (v) => { setNameA(v); saveConvPrefs(langA, langB, v, nameB); } },
            { side: 'B', lang: langB, setLang: (v) => { setLangB(v); saveConvPrefs(langA, v, nameA, nameB); }, color: '#C4B5FD', activeStyle: s.langChipActiveB, name: nameB, setName: (v) => { setNameB(v); saveConvPrefs(langA, langB, nameA, v); } },
          ].map(({ side, lang, setLang, color, activeStyle, name, setName }) => (
            <View key={side} style={s.personCard}>
              <View style={s.personCardHeader}>
                <Text style={[s.personLabel, { color }]}>📱 {side === 'A' ? displayNameA : displayNameB}</Text>
                <TouchableOpacity onPress={() => setEditingNames(!editingNames)} style={s.editNameBtn}>
                  <Text style={s.editNameBtnText}>✏️</Text>
                </TouchableOpacity>
              </View>
              {editingNames && (
                <View style={s.nameInputRow}>
                  <View style={[s.nameInput, { borderColor: color }]}>
                    <Text
                      style={s.nameInputText}
                      suppressHighlighting={false}
                    >{side === 'A' ? (nameA || '') : (nameB || '')}</Text>
                  </View>
                </View>
              )}
              <Text style={s.configSectionLabel}>{t.language}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
                {LANGUAGES.map(l => {
                  const warn = buildWarning(l, deviceSupport, t);
                  return (
                    <TouchableOpacity
                      key={l.code}
                      style={[s.langChip, lang === l.code && activeStyle, warn && s.langChipWarning]}
                      onPress={() => { setLang(l.code); if (warn) setSttWarning(warn); }}
                    >
                      <Text style={[s.langChipText, lang === l.code && { color }]}>
                        {l.flag} {l.name}{warn ? ' ⚠️' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ))}

          <TouchableOpacity style={s.startBtn} onPress={() => {
            saveConvPrefs(langA, langB, nameA, nameB);
            onStart({ mode: 'conversation', langA, langB, nameA: displayNameA, nameB: displayNameB });
          }}>
            <Text style={s.startBtnText}>{t.startSession}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Realtime setup
  if (mode === 'realtime') {
    const handleJoinRoom = async () => {
      const code = joinCode.trim().toUpperCase();
      if (code.length !== 5) { setJoinError(t.joinCodeError || 'Enter the 5-digit code'); return; }
      setJoiningRoom(true);
      setJoinError('');
      try {
        await warmUpBackend();
        const res = await fetch(`https://parlora-backend-7q3m.onrender.com/room/${code}`);
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        if (onClearPendingRoom) onClearPendingRoom();
        onStart({ mode: 'realtime-guest', roomId: code, myLang: data.langGuest, theirLang: data.langHost });
      } catch (e) {
        setJoinError(t.roomNotFound || 'Room not found. Check the code.');
      } finally { setJoiningRoom(false); }
    };

    // Role selection
    if (!rtRole) {
      return (
        <SafeAreaView style={s.safe}>
          <View style={s.setupHeaderRow2}>
            <TouchableOpacity onPress={() => setMode(null)} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
            <TouchableOpacity style={s.helpBtn} onPress={onShowOnboarding}><Text style={s.helpBtnText}>?</Text></TouchableOpacity>
          </View>
          <View style={s.modeContainer}>
            <Text style={s.setupTitle}>{t.realtimeSetupTitle}</Text>
            <Text style={s.setupSub}>{t.ancWarning}</Text>
            <TouchableOpacity style={[s.modeCard, { borderColor: 'rgba(52,199,89,0.4)' }]} onPress={() => setRtRole('host')}>
              <Text style={s.modeIcon}>📡</Text>
              <View style={s.modeTextWrap}>
                <Text style={[s.modeTitle, { color: '#34C759' }]}>{t.createRoom || 'Create a room'}</Text>
                <Text style={s.modeDesc}>{t.createRoomDesc || 'Generate a code and QR for the other person to join.'}</Text>
              </View>
              <Text style={s.modeArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeCard, { borderColor: 'rgba(129,140,248,0.4)' }]} onPress={() => setRtRole('guest')}>
              <Text style={s.modeIcon}>🔗</Text>
              <View style={s.modeTextWrap}>
                <Text style={[s.modeTitle, { color: '#818CF8' }]}>{t.joinRoom || 'Join a room'}</Text>
                <Text style={s.modeDesc}>{t.joinRoomDesc || 'Enter the 5-digit code shared by the other person.'}</Text>
              </View>
              <Text style={s.modeArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    // Guest — enter code
    if (rtRole === 'guest') {
      return (
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.setupContainer}>
            <View style={s.setupHeaderRow}>
              <TouchableOpacity onPress={() => { setRtRole(null); setJoinCode(''); setJoinError(''); }} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
              <TouchableOpacity style={s.helpBtn} onPress={onShowOnboarding}><Text style={s.helpBtnText}>?</Text></TouchableOpacity>
            </View>
            <Text style={s.setupTitle}>{t.joinRoom || 'Join a room'}</Text>
            <Text style={s.setupSub}>{t.enterCodeDesc || 'Enter the 5-digit code from the host.'}</Text>

            {/* Code input — 5 digit boxes */}
            <View style={s.codeInputRow}>
              {[0,1,2,3,4].map(i => (
                <View key={i} style={[s.codeBox, joinCode.length > i && s.codeBoxFilled]}>
                  <Text style={s.codeBoxText}>{joinCode[i] || ''}</Text>
                </View>
              ))}
            </View>

            {/* Numpad */}
            <View style={s.numpad}>
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
                <TouchableOpacity key={i} style={[s.numpadKey, key === '' && { opacity: 0 }]}
                  disabled={key === ''}
                  onPress={() => {
                    if (key === '⌫') { setJoinCode(prev => prev.slice(0,-1)); setJoinError(''); }
                    else if (joinCode.length < 5) { setJoinCode(prev => prev + key); setJoinError(''); }
                  }}>
                  <Text style={s.numpadKeyText}>{key}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {joinError ? <Text style={s.joinError}>{joinError}</Text> : null}

            <TouchableOpacity
              style={[s.startBtn, { backgroundColor: '#818CF8', opacity: joinCode.length === 5 ? 1 : 0.4 }]}
              disabled={joinCode.length !== 5 || joiningRoom}
              onPress={handleJoinRoom}>
              <Text style={s.startBtnText}>{joiningRoom ? '...' : (t.joinRoom || 'Join room')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      );
    }

    // Host — choose languages
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.setupContainer}>
          <View style={s.setupHeaderRow}>
            <TouchableOpacity onPress={() => setRtRole(null)} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
            <TouchableOpacity style={s.helpBtn} onPress={onShowOnboarding}><Text style={s.helpBtnText}>?</Text></TouchableOpacity>
          </View>
          <Text style={s.setupTitle}>{t.realtimeSetupTitle}</Text>

          <View style={s.warningBox}>
            <Text style={s.warningText}>{t.ancWarning}</Text>
          </View>

          <View style={s.personCard}>
            <Text style={[s.personLabel, { color: '#34C759' }]}>{t.youSpeak}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
              {LANGUAGES.map(l => (
                <TouchableOpacity key={l.code}
                  style={[s.langChip, confSourceLang === l.code && { borderColor: '#34C759', backgroundColor: 'rgba(52,199,89,0.15)' }]}
                  onPress={() => { setConfSourceLang(l.code); saveConfPrefs(l.code, confTargetLang, audioInput, audioOutput); }}>
                  <Text style={[s.langChipText, confSourceLang === l.code && { color: '#34C759' }]}>{l.flag} {l.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={s.personCard}>
            <Text style={[s.personLabel, { color: '#818CF8' }]}>{t.theySpeak}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
              {LANGUAGES.map(l => (
                <TouchableOpacity key={l.code}
                  style={[s.langChip, confTargetLang === l.code && s.langChipActiveA]}
                  onPress={() => { setConfTargetLang(l.code); saveConfPrefs(confSourceLang, l.code, audioInput, audioOutput); }}>
                  <Text style={[s.langChipText, confTargetLang === l.code && { color: '#818CF8' }]}>{l.flag} {l.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Text style={[s.setupSub, { color: 'rgba(255,255,255,0.25)', fontSize: 12, marginBottom: 8 }]}>{t.roomExpiry}</Text>
          {rtCreateError ? <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{rtCreateError}</Text> : null}

          <TouchableOpacity style={[s.startBtn, { backgroundColor: rtCreating ? 'rgba(52,199,89,0.4)' : '#34C759' }]}
            disabled={rtCreating}
            onPress={async () => {
              setRtCreating(true);
              setRtCreateError('');
              try {
                await warmUpBackend();
                const xhr = await new Promise((resolve, reject) => {
                  const x = new XMLHttpRequest();
                  x.open('POST', 'https://parlora-backend-7q3m.onrender.com/room/create');
                  x.setRequestHeader('Content-Type', 'application/json');
                  x.timeout = 15000;
                  x.onload = () => resolve(x);
                  x.onerror = () => reject(new Error('Network error'));
                  x.ontimeout = () => reject(new Error('Timeout'));
                  x.send(JSON.stringify({ langHost: confSourceLang, langGuest: confTargetLang }));
                });
                const data = JSON.parse(xhr.responseText);
                if (!data.roomId) throw new Error('No roomId');
                onStart({ mode: 'realtime', myLang: confSourceLang, theirLang: confTargetLang, roomId: data.roomId });
              } catch (e) {
                setRtCreateError(e.message);
              } finally {
                setRtCreating(false);
              }
            }}>
            <Text style={s.startBtnText}>{rtCreating ? (t.creatingRoom || 'Creating...') : t.startRealtime}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Conference
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.setupContainer}>
        <View style={s.setupHeaderRow}>
          <TouchableOpacity onPress={() => setMode(null)} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
          <TouchableOpacity style={s.helpBtn} onPress={onShowOnboarding}><Text style={s.helpBtnText}>?</Text></TouchableOpacity>
        </View>
        <Text style={s.setupTitle}>{t.hwTitle}</Text>

        {/* Idiomas */}
        <View style={s.personCard}>
          <Text style={[s.personLabel, { color: '#C4B5FD' }]}>{t.speakerLang}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
            {LANGUAGES.map(l => (
              <TouchableOpacity key={l.code} style={[s.langChip, confSourceLang === l.code && s.langChipActiveB]}
                onPress={() => { setConfSourceLang(l.code); saveConfPrefs(l.code, confTargetLang, audioInput, audioOutput); }}>
                <Text style={[s.langChipText, confSourceLang === l.code && { color: '#C4B5FD' }]}>{l.flag} {l.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={s.personCard}>
          <Text style={[s.personLabel, { color: '#818CF8' }]}>{t.yourLang}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.langScroll}>
            {LANGUAGES.map(l => (
              <TouchableOpacity key={l.code} style={[s.langChip, confTargetLang === l.code && s.langChipActiveA]}
                onPress={() => { setConfTargetLang(l.code); saveConfPrefs(confSourceLang, l.code, audioInput, audioOutput); }}>
                <Text style={[s.langChipText, confTargetLang === l.code && { color: '#818CF8' }]}>{l.flag} {l.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Audio Input */}
        <View style={s.personCard}>
          <Text style={[s.personLabel, { color: '#fff' }]}>{t.audioInputLabel || t.audioInput}</Text>
          {[
            { key: 'phone', label: t.micPhone },
            { key: 'bluetooth', label: t.micBluetooth },
          ].map(opt => (
            <TouchableOpacity key={opt.key} style={s.audioOptionRow}
              onPress={() => { setAudioInput(opt.key); saveConfPrefs(confSourceLang, confTargetLang, opt.key, audioOutput); }}>
              <View style={[s.audioRadio, audioInput === opt.key && s.audioRadioActive]}>
                {audioInput === opt.key && <View style={s.audioRadioDot} />}
              </View>
              <Text style={s.audioOptionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Audio Output */}
        <View style={s.personCard}>
          <Text style={[s.personLabel, { color: '#fff' }]}>{t.audioOutputLabel || t.audioOutput}</Text>
          {[
            { key: 'speaker', label: t.outSpeaker },
            { key: 'bluetooth', label: t.outBluetooth },
          ].map(opt => (
            <TouchableOpacity key={opt.key} style={s.audioOptionRow}
              onPress={() => { setAudioOutput(opt.key); saveConfPrefs(confSourceLang, confTargetLang, audioInput, opt.key); }}>
              <View style={[s.audioRadio, audioOutput === opt.key && s.audioRadioActive]}>
                {audioOutput === opt.key && <View style={s.audioRadioDot} />}
              </View>
              <Text style={s.audioOptionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {showAudioWarning && (
          <View style={s.warningBox}>
            <Text style={s.warningText}>{t.audioWarning}</Text>
          </View>
        )}

        <TouchableOpacity style={[s.startBtn, { backgroundColor: '#7C3AED' }]}
          onPress={() => {
            saveConfPrefs(confSourceLang, confTargetLang, audioInput, audioOutput);
            onStart({ mode: 'conference', confSourceLang, confTargetLang, audioInput, audioOutput });
          }}>
          <Text style={s.startBtnText}>{t.startConference}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── CONVERSATION SCREEN ──────────────────────────────────────────
function ConversationScreen({ config, onBack, t, onShowOnboarding }) {
  const { langA, langB, nameA, nameB } = config;
  const langAObj = LANGUAGES.find(l => l.code === langA) || LANGUAGES[0];
  const langBObj = LANGUAGES.find(l => l.code === langB) || LANGUAGES[1];

  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [status, setStatus] = useState(t.paused);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [lastTranslation, setLastTranslation] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const scrollRef = useRef(null);
  const isActiveRef = useRef(false);
  const recordingRef = useRef(null);
  const lastSpeakerRef = useRef('A'); // tracks last speaker for pro
  const lastContextRef = useRef('');
  const lastTranscribedRef = useRef('');

  // Show tooltip on first use
  useEffect(() => {
    async function checkFirstUse() {
      try {
        const done = await AsyncStorage.getItem('parlora_conv_used');
        if (!done) setShowTooltip(true);
      } catch (e) {}
    }
    checkFirstUse();
  }, []);

  const dismissTooltip = async () => {
    setShowTooltip(false);
    try { await AsyncStorage.setItem('parlora_conv_used', '1'); } catch (e) {}
  };

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => {
    if (transcript.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  const startRecording = async (speaker) => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false, staysActiveInBackground: false,
      });
      const { recording } = await Audio.Recording.createAsync({
        android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        ios: { extension: '.m4a', outputFormat: Audio.IOSOutputFormat.MPEG4AAC, audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        isMeteringEnabled: false,
      });
      recordingRef.current = recording;
      setActiveSpeaker(speaker);
      lastSpeakerRef.current = speaker;
      setIsRecording(true);
      Vibration.vibrate(50);
    } catch (e) { console.log('Start recording error:', e); }
  };

  const stopRecordingAndTranslate = async () => {
    if (!recordingRef.current) return;
    const speaker = activeSpeaker;
    setIsRecording(false); setActiveSpeaker(null);
    setIsProcessing(true); setStatus(t.transcribing);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri || !speaker) { setIsProcessing(false); setStatus(t.grabando); return; }

      const srcLang = speaker === 'A' ? langA : langB;
      const tgtLang = speaker === 'A' ? langB : langA;
      const srcLangObj = speaker === 'A' ? langAObj : langBObj;
      const tgtLangObj = speaker === 'A' ? langBObj : langAObj;

      const formData = new FormData();
      formData.append('audio', { uri, type: 'audio/m4a', name: 'conv.m4a' });
      formData.append('language', srcLangObj.voiceLocale.slice(0, 2));

      const transcribeRes = await fetch(`${BACKEND}/transcribe`, {
        method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { text = '' } = await transcribeRes.json();
      if (!text.trim()) { setIsProcessing(false); setStatus(t.grabando); return; }

      // [FIX: Hallucination] filter short/repetitive transcriptions
      const trimmedConv = text.trim();
      const wordCountConv = trimmedConv.split(/\s+/).filter(w => w.length > 1).length;
      if (wordCountConv < 2) { setIsProcessing(false); setStatus(t.grabando); return; }
      if (lastTranscribedRef.current) {
        const prevConv = lastTranscribedRef.current.toLowerCase();
        const currConv = trimmedConv.toLowerCase();
        if (currConv === prevConv || (prevConv.length > 10 && (currConv.includes(prevConv) || prevConv.includes(currConv)))) {
          setIsProcessing(false); setStatus(t.grabando); return;
        }
      }
      lastTranscribedRef.current = trimmedConv;

      setStatus(t.translating);
      const translateRes = await fetch(`${BACKEND}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmedConv, target_lang: tgtLang, context: lastContextRef.current || undefined }),
      });
      const { translatedText = '' } = await translateRes.json();
      if (!translatedText) { setIsProcessing(false); setStatus(t.grabando); return; }
      lastContextRef.current = trimmedConv.split(' ').slice(-5).join(' ');

      const line = {
        id: Date.now().toString(), speaker,
        original: trimmedConv, translated: translatedText,
        srcFlag: srcLangObj.flag, tgtFlag: tgtLangObj.flag,
        ttsLocale: tgtLangObj.ttsLocale,
        speakerName: speaker === 'A' ? nameA : nameB,
      };
      setTranscript(prev => [...prev.slice(-49), line]);
      setLastTranslation(line);
      setIsSpeaking(true);
      Speech.speak(translatedText, {
        language: tgtLangObj.ttsLocale,
        rate: 0.95,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
      setStatus(t.grabando);
    } catch (e) {
      console.log('Process error:', e);
      setStatus(t.errorRetry);
      setTimeout(() => setStatus(t.grabando), 2000);
    } finally { setIsProcessing(false); }
  };

  const toggleSession = async () => {
    if (isActive) {
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch (e) {}
        recordingRef.current = null;
      }
      setIsActive(false); setStatus(t.paused); Speech.stop();
      setIsRecording(false); setIsProcessing(false); setActiveSpeaker(null); setIsSpeaking(false); setTtsPaused(false);
    } else {
      const ok = await requestMic(t);
      if (!ok) { Alert.alert(t.micDenied, t.micDeniedMsg); return; }
      warmUpBackend();
      setIsActive(true); setStatus(t.grabando);
    }
  };

  const handlePressIn = async (speaker) => { if (isProcessing || isSpeaking) return; await startRecording(speaker); };
  const handlePressOut = async () => { await stopRecordingAndTranslate(); };

  // Auto-request mic and pre-warm on mount
  useEffect(() => {
    warmUpDeepL(); // pre-warm DeepL for faster first translation
    (async () => {
      const ok = await requestMic(t);
      if (!ok) return;
      warmUpBackend();
      setIsActive(true); setStatus(t.grabando);
    })();
  }, []);

  const handleBack = () => { Speech.stop(); onBack(); };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>{status}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={s.helpBtn} onPress={onShowOnboarding}>
            <Text style={s.helpBtnText}>?</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat bubbles */}
      <ScrollView ref={scrollRef} style={s.chatBox} contentContainerStyle={s.chatContent}>
        {transcript.length === 0 && (
          <Text style={s.emptyText}>{t.emptyConv}</Text>
        )}
        {transcript.map(line => {
          const isA = line.speaker === 'A';
          return (
            <View key={line.id} style={[s.bubbleRow, isA ? s.bubbleRowA : s.bubbleRowB]}>
              {/* Avatar */}
              <View style={[s.bubbleAvatar, { backgroundColor: isA ? 'rgba(129,140,248,0.2)' : 'rgba(196,181,253,0.2)' }]}>
                <Text style={s.bubbleAvatarText}>{(line.speakerName || (isA ? nameA : nameB) || (isA ? 'A' : 'B')).charAt(0).toUpperCase()}</Text>
              </View>
              <View style={[s.bubble, isA ? s.bubbleA : s.bubbleB]}>
                <Text style={[s.bubbleName, { color: isA ? '#818CF8' : '#C4B5FD' }]}>
                  {line.speakerName || (isA ? nameA : nameB)}
                </Text>
                <Text style={s.bubbleOriginal}>{line.srcFlag} {line.original}</Text>
                <View style={s.bubbleDivider} />
                <Text style={s.bubbleTranslated}>{line.tgtFlag} {line.translated}</Text>
                <TouchableOpacity style={s.bubbleRepeat} onPress={() => { Speech.stop(); Speech.speak(line.translated, { language: line.ttsLocale, rate: 0.9 }); }}>
                  <Text style={s.bubbleRepeatIcon}>🔁</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        {isProcessing && (
          <View style={[s.bubbleRow, lastSpeakerRef.current === 'B' ? s.bubbleRowB : s.bubbleRowA]}>
            <View style={[s.bubbleAvatar, { backgroundColor: lastSpeakerRef.current === 'B' ? 'rgba(196,181,253,0.1)' : 'rgba(129,140,248,0.1)' }]}>
              <Text style={s.bubbleAvatarText}>⏳</Text>
            </View>
            <View style={[s.bubble, lastSpeakerRef.current === 'B' ? s.bubbleB : s.bubbleA, { opacity: 0.6 }]}>
              <Text style={s.bubbleTranslated}>{status}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* First-use tooltip overlay */}
      {showTooltip && (
        <TouchableOpacity style={s.tooltipOverlay} onPress={dismissTooltip} activeOpacity={1}>
          <View style={s.tooltipLeft}>
            <View style={s.tooltipBubble}>
              <Text style={s.tooltipText}>{t.micTooltip || 'Hold here to speak and translate'}</Text>
              <View style={s.tooltipArrowDown} />
            </View>
          </View>
          <View style={s.tooltipRight}>
            <View style={s.tooltipBubble}>
              <Text style={s.tooltipText}>{t.micTooltip || 'Hold here to speak and translate'}</Text>
              <View style={s.tooltipArrowDown} />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* TTS controls — only visible while speaking */}
      {isSpeaking && (
        <View style={s.ttsControlsWrap}>
          <View style={s.ttsControlsRow}>
            <TouchableOpacity
              style={s.ttsBtn}
              onPress={() => {
                if (ttsPaused) {
                  Speech.resume ? Speech.resume() : Speech.speak(lastTranslation?.translated || '', { language: lastTranslation?.ttsLocale, rate: 0.95 });
                  setTtsPaused(false);
                } else {
                  Speech.pause ? Speech.pause() : null;
                  setTtsPaused(true);
                }
              }}>
              <Text style={s.ttsBtnIcon}>{ttsPaused ? '▶' : '⏸'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.ttsBtn, { borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.1)' }]}
              onPress={() => { Speech.stop(); setIsSpeaking(false); setTtsPaused(false); }}>
              <Text style={[s.ttsBtnIcon, { color: '#EF4444' }]}>⏹</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Hint above mics with arrow */}
      {!isSpeaking && (
        <View style={s.micHintAbove}>
          <Text style={s.micHintAboveText}>
            {isProcessing ? t.processing : t.holdToSpeak}
          </Text>
          <Text style={s.micHintArrow}>↓</Text>
        </View>
      )}

      {/* Mics — bigger, no Start/Stop button between them */}
      <View style={s.convControlsRow}>
        <TouchableOpacity
          style={[s.micBtnXL, { borderColor: activeSpeaker === 'A' ? '#818CF8' : 'rgba(129,140,248,0.3)', backgroundColor: activeSpeaker === 'A' ? 'rgba(129,140,248,0.25)' : 'rgba(129,140,248,0.08)' }, (isProcessing || isSpeaking) && s.micDisabled]}
          onPressIn={() => handlePressIn('A')} onPressOut={handlePressOut} disabled={isProcessing || isSpeaking}>
          <MicSvg color={activeSpeaker === 'A' ? '#FFFFFF' : '#818CF8'} size={Math.round(Dimensions.get('window').width * 0.09)} />
          <Text style={[s.micLabelXL, { color: '#818CF8' }]}>{nameA}</Text>
          <View style={s.micFlagsRow}>
            <Text style={s.micFlagText}>{langAObj.flag}</Text>
            <Text style={s.micFlagArrow}>→</Text>
            <Text style={s.micFlagText}>{langBObj.flag}</Text>
          </View>
          {activeSpeaker === 'A' && <View style={s.recordingDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.micBtnXL, { borderColor: activeSpeaker === 'B' ? '#C4B5FD' : 'rgba(196,181,253,0.3)', backgroundColor: activeSpeaker === 'B' ? 'rgba(196,181,253,0.25)' : 'rgba(196,181,253,0.08)' }, (isProcessing || isSpeaking) && s.micDisabled]}
          onPressIn={() => handlePressIn('B')} onPressOut={handlePressOut} disabled={isProcessing || isSpeaking}>
          <MicSvg color={activeSpeaker === 'B' ? '#FFFFFF' : '#C4B5FD'} size={Math.round(Dimensions.get('window').width * 0.09)} />
          <Text style={[s.micLabelXL, { color: '#C4B5FD' }]}>{nameB}</Text>
          <View style={s.micFlagsRow}>
            <Text style={s.micFlagText}>{langBObj.flag}</Text>
            <Text style={s.micFlagArrow}>→</Text>
            <Text style={s.micFlagText}>{langAObj.flag}</Text>
          </View>
          {activeSpeaker === 'B' && <View style={s.recordingDot} />}
        </TouchableOpacity>
      </View>
      {isSpeaking && <Text style={s.micHint}>{'🔊 ' + (t.translating || 'Translating...')}</Text>}
    </SafeAreaView>
  );
}

function ConferenceScreen({ config, onBack, t, onShowOnboarding }) {
  const { confSourceLang, confTargetLang, audioOutput: confAudioOutput } = config;
  const confHardware = confAudioOutput === 'bluetooth' ? 'anc' : confAudioOutput === 'earpiece' ? 'anc' : 'risk';
  const srcObj = LANGUAGES.find(l => l.code === confSourceLang) || LANGUAGES[0];
  const tgtObj = LANGUAGES.find(l => l.code === confTargetLang) || LANGUAGES[1];

  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [status, setStatus] = useState(t.paused);
  const [lastTranslation, setLastTranslation] = useState(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const ttsSpeedRef = useRef(1.0);
  const [recordingLevel, setRecordingLevel] = useState(0);
  const scrollRef = useRef(null);
  const isActiveRef = useRef(false);
  const lastContextRef = useRef('');
  const chunkCountRef = useRef(0);
  const meteringIntervalRef = useRef(null);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { chunkCountRef.current = chunkCount; }, [chunkCount]);
  useEffect(() => {
    if (transcript.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  const extractPauses = (meteringHistory) => {
    const SILENCE_DB = -40, MIN_PAUSE_MS = 500;
    const pauses = [];
    let silenceStart = null;
    const totalDuration = meteringHistory.length > 0 ? meteringHistory[meteringHistory.length - 1].time : 8000;
    for (const { time, db } of meteringHistory) {
      if (db < SILENCE_DB) { if (!silenceStart) silenceStart = time; }
      else if (silenceStart !== null) {
        const duration = time - silenceStart;
        if (duration >= MIN_PAUSE_MS) pauses.push({ position: silenceStart / totalDuration, durationMs: Math.min(duration * 0.5, 800) });
        silenceStart = null;
      }
    }
    return pauses;
  };

  const speakTranslation = (translated, ttsLocale, pauses) => {
    const cleaned = translated.replace(/[.]{3,}/g, ' ').replace(/[ \t]+/g, ' ').trim();
    const finalRate = Math.max(0.5, Math.min(1.5, ttsSpeedRef.current));
    // Route audio to correct output
    const useEarpiece = confAudioOutput === 'earpiece';
    Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, playThroughEarpieceAndroid: useEarpiece, staysActiveInBackground: false }).catch(() => {});
    if (pauses.length === 0) { Speech.speak(cleaned, { language: ttsLocale, rate: finalRate }); return; }
    const words = cleaned.split(' ');
    const segments = [];
    let lastWordIdx = 0;
    for (const pause of pauses) {
      const wordIdx = Math.floor(pause.position * words.length);
      if (wordIdx > lastWordIdx) {
        segments.push({ text: words.slice(lastWordIdx, wordIdx).join(' '), pauseAfterMs: pause.durationMs });
        lastWordIdx = wordIdx;
      }
    }
    if (lastWordIdx < words.length) segments.push({ text: words.slice(lastWordIdx).join(' '), pauseAfterMs: 0 });
    let delay = 0;
    for (const seg of segments) {
      if (!seg.text.trim()) continue;
      setTimeout(() => { if (isActiveRef.current) Speech.speak(seg.text, { language: ttsLocale, rate: finalRate }); }, delay);
      delay += (seg.text.split(' ').length * (380 / finalRate)) + seg.pauseAfterMs;
    }
  };

  const recordChunk = async () => {
    if (!isActiveRef.current) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false, staysActiveInBackground: false,
      });
      const { recording } = await Audio.Recording.createAsync({
        android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        ios: { extension: '.m4a', outputFormat: Audio.IOSOutputFormat.MPEG4AAC, audioQuality: Audio.IOSAudioQuality.MEDIUM, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        isMeteringEnabled: true,
      });
      const meteringHistory = [];
      const startTime = Date.now();
      meteringIntervalRef.current = setInterval(async () => {
        if (!isActiveRef.current) return;
        try {
          const st = await recording.getStatusAsync();
          if (!st.isRecording) return;
          const db = st.metering ?? -160;
          meteringHistory.push({ time: Date.now() - startTime, db });
          setRecordingLevel(Math.max(0, Math.min(100, (db + 60) * 2)));
        } catch (e) {}
      }, 100);
      await new Promise(resolve => setTimeout(resolve, 8000));
      clearInterval(meteringIntervalRef.current);
      setRecordingLevel(0);
      if (!isActiveRef.current) { try { await recording.stopAndUnloadAsync(); } catch (e) {} return; }
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (isActiveRef.current) setTimeout(() => recordChunk(), 0);
      if (uri) processChunk(uri, meteringHistory);
    } catch (e) {
      console.log('Record error:', e.message);
      if (isActiveRef.current) setTimeout(() => recordChunk(), 500);
    }
  };

  const processChunk = async (uri, meteringHistory) => {
    try {
      const n = chunkCountRef.current + 1;
      setChunkCount(n); chunkCountRef.current = n;
      const formData = new FormData();
      formData.append('audio', { uri, type: 'audio/m4a', name: 'chunk.m4a' });
      formData.append('language', srcObj.voiceLocale.slice(0, 2));
      const transcribeRes = await fetch(`${BACKEND}/transcribe`, {
        method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { text = '' } = await transcribeRes.json();
      if (!text.trim()) return;
      const translateRes = await fetch(`${BACKEND}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), target_lang: confTargetLang, context: lastContextRef.current || undefined }),
      });
      const { translatedText = '' } = await translateRes.json();
      if (!translatedText) return;
      lastContextRef.current = text.trim().split(' ').slice(-5).join(' ');
      const line = { id: Date.now().toString(), original: text.trim(), translated: translatedText, srcFlag: srcObj.flag, tgtFlag: tgtObj.flag, ttsLocale: tgtObj.ttsLocale };
      setTranscript(prev => [...prev.slice(-49), line]);
      setLastTranslation(line);
      setStatus(t.active);
      speakTranslation(translatedText, tgtObj.ttsLocale, extractPauses(meteringHistory));
    } catch (e) { console.log('Process error:', e.message); }
  };

  const toggleSession = async () => {
    if (isActive) {
      clearInterval(meteringIntervalRef.current);
      setIsActive(false); setStatus(t.paused);
      setRecordingLevel(0); Speech.stop();
      lastContextRef.current = ''; setChunkCount(0); chunkCountRef.current = 0;
    } else {
      const ok = await requestMic(t);
      if (!ok) { Alert.alert(t.micDenied, t.micDeniedMsg); return; }
      const ttsVoices = await Speech.getAvailableVoicesAsync().catch(() => []);
      const ttsOk = ttsVoices.length === 0 ||
        ttsVoices.some(v => (v.language || '').toLowerCase().startsWith(confTargetLang.toLowerCase().slice(0,2)));
      if (!ttsOk) {
        Alert.alert(t.ttsTitle, t.ttsMsg(tgtObj.name), [
          { text: t.installLater, onPress: () => {} },
          { text: t.continueAnyway, onPress: () => {
            warmUpBackend(); warmUpDeepL(); setIsActive(true); setStatus(t.captando);
            setChunkCount(0); chunkCountRef.current = 0; recordChunk();
          }},
        ]);
        return;
      }
      warmUpBackend(); warmUpDeepL(); setIsActive(true); setStatus(t.captando);
      setChunkCount(0); chunkCountRef.current = 0; recordChunk();
    }
  };

  const AudioLevelBar = () => (
    <View style={s.audioLevelContainer}>
      <View style={[s.audioLevelBar, { width: `${recordingLevel}%`, opacity: isActive ? 1 : 0 }]} />
    </View>
  );

  const handleBackConf = () => { Speech.stop(); clearInterval(meteringIntervalRef.current); onBack(); };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleBackConf} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>
            {isActive ? (chunkCount === 0 ? t.captando : `${t.activo} · ${chunkCount} ${t.chunks}`) : t.paused}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={s.helpBtn} onPress={onShowOnboarding}>
            <Text style={s.helpBtnText}>?</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.repeatBtn, !lastTranslation && s.repeatBtnDisabled]}
            onPress={() => { if (lastTranslation) { Speech.stop(); Speech.speak(lastTranslation.translated, { language: lastTranslation.ttsLocale, rate: ttsSpeedRef.current }); }}}
            disabled={!lastTranslation}>
            <Text style={s.repeatBtnIcon}>🔁</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.confInfoRow}>
        <View style={[s.confInfoCard, { borderColor: 'rgba(196,181,253,0.3)' }]}>
          <Text style={s.personInfoIcon}>🎤</Text>
          <Text style={[s.personInfoLabel, { color: '#C4B5FD' }]}>{t.speaker}</Text>
          <Text style={s.personInfoLang}>{srcObj.flag} {srcObj.name}</Text>
        </View>
        <View style={s.confArrowWrap}>
          <Text style={s.confArrow}>→</Text>
          <Text style={s.confDelay}>~8s</Text>
        </View>
        <View style={[s.confInfoCard, { borderColor: 'rgba(129,140,248,0.3)' }]}>
          <Text style={s.personInfoIcon}>{confHardware === 'extmic' ? '🎙️' : '📱'}</Text>
          <Text style={[s.personInfoLabel, { color: '#818CF8' }]}>{t.youHear}</Text>
          <Text style={s.personInfoLang}>{tgtObj.flag} {tgtObj.name}</Text>
        </View>
      </View>

      {isActive && (
        <View style={s.recordingIndicator}>
          <View style={[s.recordingDot, { backgroundColor: chunkCount === 0 ? '#EF4444' : '#34C759' }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.recordingText}>{chunkCount === 0 ? t.capturing : t.activeCapturing}</Text>
            <AudioLevelBar />
          </View>
        </View>
      )}

      <View style={s.speedSelector}>
        <Text style={s.speedLabel}>{t.speed}</Text>
        {[{val:0.5,label:'0.5x'},{val:0.75,label:'0.75x'},{val:1.0,label:'1x'},{val:1.25,label:'1.25x'},{val:1.5,label:'1.5x'}].map(opt => (
          <TouchableOpacity key={opt.val} style={[s.speedBtn, ttsSpeed === opt.val && s.speedBtnActive]}
            onPress={() => { setTtsSpeed(opt.val); ttsSpeedRef.current = opt.val; }}>
            <Text style={[s.speedBtnText, ttsSpeed === opt.val && s.speedBtnTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {confHardware === 'risk' && (
        <View style={[s.warningBox, { marginHorizontal: 14, marginBottom: 8 }]}>
          <Text style={s.warningText}>{t.hwRiskWarn}</Text>
        </View>
      )}

      <Text style={s.sectionLabel}>{t.liveTranslation}</Text>
      <ScrollView ref={scrollRef} style={s.transcriptBox}>
        {transcript.length === 0 && <Text style={s.emptyText}>{t.emptyConf}</Text>}
        {transcript.map(line => (
          <View key={line.id} style={s.transcriptLine}>
            <View style={{ flex: 1 }}>
              <Text style={s.originalText}>{line.srcFlag} {line.original}</Text>
              <Text style={s.translatedText}>{line.tgtFlag} {line.translated}</Text>
            </View>
            <TouchableOpacity style={s.lineRepeatBtn} onPress={() => { Speech.stop(); Speech.speak(line.translated, { language: line.ttsLocale, rate: ttsSpeedRef.current }); }}>
              <Text style={s.lineRepeatIcon}>🔁</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={s.controls}>
        <TouchableOpacity style={[s.sessionBtnLarge, isActive && s.sessionBtnActive]} onPress={toggleSession}>
          <Text style={s.sessionBtnText}>{isActive ? t.stopConf : t.startConf}</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.micHint}>
        {isActive ? t.chunkHint
          : confHardware === 'anc' ? t.hintAnc
          : confHardware === 'extmic' ? t.hintExtmic
          : t.hintRisk}
      </Text>
    </SafeAreaView>
  );
}


// ─── REALTIME SCREEN ─────────────────────────────────────────────
function RealtimeScreen({ config, onBack, t }) {
  const { myLang, theirLang, roomId: initialRoomId } = config;
  const myLangObj = LANGUAGES.find(l => l.code === myLang) || LANGUAGES[0];
  const theirLangObj = LANGUAGES.find(l => l.code === theirLang) || LANGUAGES[1];

  const BACKEND_URL = 'https://parlora-backend-7q3m.onrender.com';
  const WEB_URL = 'https://parlora-backend-7q3m.onrender.com/join';

  // roomId comes from SetupScreen (already created before navigation)
  const [phase, setPhase] = useState(initialRoomId ? 'qr' : 'creating');
  const [roomId, setRoomId] = useState(initialRoomId || null);
  const [guestConnected, setGuestConnected] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [lastTranslation, setLastTranslation] = useState(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [recordingLevel, setRecordingLevel] = useState(0);
  const [status, setStatus] = useState(t.creatingRoom);
  const [debugLog, setDebugLog] = useState('');

  const wsRef = useRef(null);
  const isActiveRef = useRef(false);
  const chunkCountRef = useRef(0);
  const ttsSpeedRef = useRef(1.0);
  const meteringIntervalRef = useRef(null);
  const scrollRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const roomIdRef = useRef(null);
  // [FIX 2] Echo cancellation: store last TTS text to filter echo
  const lastTtsTextRef = useRef('');
  const lastTtsTimeRef = useRef(0);
  const ttsDurationRef = useRef(0); // [FIX 3] estimated TTS duration in ms
  // [FIX: Hallucination] context for DeepL + last transcription for repetition detection
  const lastContextRef = useRef('');
  const lastTranscribedRef = useRef('');

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { chunkCountRef.current = chunkCount; }, [chunkCount]);
  useEffect(() => {
    if (transcript.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  useEffect(() => {
    if (initialRoomId) {
      // Room already created in SetupScreen - just connect WS
      roomIdRef.current = initialRoomId;
      setStatus(t.waitingGuest);
      connectWS(initialRoomId);
    } else {
      createRoom();
    }
    return () => {
      clearInterval(pingIntervalRef.current);
      clearInterval(meteringIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
      Speech.stop();
    };
  }, []);

  const createRoom = async (attempt = 1) => {
    try {
      // Small delay on first attempt to let the component/bridge stabilize
      if (attempt === 1) await new Promise(r => setTimeout(r, 500));
      setDebugLog(`Connecting... attempt ${attempt}/3`);
      await warmUpBackend();
      setDebugLog(`XHR /room/create ${myLang}->${theirLang}`);
      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BACKEND_URL}/room/create`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 15000;
        xhr.onload = () => {
          setDebugLog(`XHR status: ${xhr.status}`);
          try {
            const parsed = JSON.parse(xhr.responseText);
            resolve(parsed);
          } catch (e) {
            reject(new Error('JSON parse: ' + xhr.responseText.slice(0,50)));
          }
        };
        xhr.onerror = () => reject(new Error('XHR network error'));
        xhr.ontimeout = () => reject(new Error('XHR timeout 15s'));
        xhr.onabort = () => reject(new Error('XHR aborted'));
        xhr.send(JSON.stringify({ langHost: myLang, langGuest: theirLang }));
      });
      setDebugLog(`XHR done: roomId=${data.roomId}`);
      if (!data.roomId) throw new Error('No roomId: ' + JSON.stringify(data));
      setDebugLog('Room created OK - setting phase...');
      setRoomId(data.roomId);
      roomIdRef.current = data.roomId;
      setStatus(t.waitingGuest);
      setPhase('qr');
      setDebugLog('Phase QR set - WS in 1s...');
      // Delay WS connection to let QR screen render first
      setTimeout(() => {
        try {
          setDebugLog('Connecting WS now...');
          connectWS(data.roomId);
        } catch (wsErr) {
          setDebugLog('WS error: ' + (wsErr.message || wsErr));
        }
      }, 1000);
    } catch (e) {
      console.log(`createRoom attempt ${attempt}:`, e.message);
      if (attempt < 3) {
        setDebugLog(`Retrying ${attempt + 1}/3... (${e.message})`);
        await new Promise(r => setTimeout(r, attempt * 2000));
        return createRoom(attempt + 1);
      }
      const errMsg = `${e.constructor?.name || 'Error'}: ${e.message}`;
      setDebugLog(`FAILED: ${errMsg}`);
      setStatus(`Error: ${errMsg}`);
      // Don't call onBack immediately - show error for 5s so user can read it
      Alert.alert('Error detail', errMsg, [{ text: 'OK', onPress: onBack }]);
    }
  }
  const connectWS = (rid) => {
    try {
    setDebugLog(`WS: creating socket for room ${rid}`);
    const sock = new WebSocket(`wss://parlora-backend-7q3m.onrender.com/ws?roomId=${rid}&role=host`);
    wsRef.current = sock;
    sock.onopen = () => {
      setDebugLog(`6. WS connected ✅`);
      pingIntervalRef.current = setInterval(() => {
        if (sock.readyState === 1) sock.send(JSON.stringify({ type: 'ping' }));
      }, 25000);
    };
    sock.onerror = (e) => { setDebugLog(`❌ WS error: ${e.message || 'unknown'}`); };
    sock.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'peer_joined' && msg.role === 'guest') {
          setGuestConnected(true);
          setStatus(t.guestJoined);
        }
        if (msg.type === 'peer_left') {
          setGuestConnected(false);
          setStatus(t.peerLeft);
          Alert.alert('⚠️', t.peerLeft);
        }
        if (msg.type === 'translation') {
          const line = {
            id: Date.now().toString(), from: 'guest',
            original: msg.original, translated: msg.translated,
            srcFlag: theirLangObj.flag, tgtFlag: myLangObj.flag,
            ttsLocale: myLangObj.ttsLocale,
          };
          setTranscript(prev => [...prev.slice(-49), line]);
          setLastTranslation(line);
          // Always play TTS when guest speaks, regardless of recording state
          lastTtsTextRef.current = msg.translated.toLowerCase();
          lastTtsTimeRef.current = Date.now();
          const wordCount = msg.translated.split(' ').length;
          ttsDurationRef.current = (wordCount * 120) / ttsSpeedRef.current;
          Speech.speak(msg.translated, { language: myLangObj.ttsLocale, rate: ttsSpeedRef.current });
        }
        if (msg.type === 'room_closed') {
          setPhase('ended');
          setStatus(t.roomClosed);
        }
      } catch (err) {}
    };
    sock.onclose = (e) => {
      clearInterval(pingIntervalRef.current);
      if (e.code === 4004) {
        Alert.alert('', t.roomClosed || 'Room closed.');
        onBack();
      }
    };
    } catch (wsConstructErr) {
      setDebugLog('WS constructor crash: ' + wsConstructErr.message);
      Alert.alert('WS Error', wsConstructErr.message);
    }
  };

  const recordChunk = async () => {
    if (!isActiveRef.current) return;
    try {
      // [FIX 3] Prefer Bluetooth mic: allowsRecordingIOS forces iOS to use
      // the Bluetooth headset mic instead of the built-in phone mic.
      // On Android, BluetoothSCO mode is set via preferBluetooth.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1, // DO_NOT_MIX
        interruptionModeAndroid: 1,
      });
      const { recording } = await Audio.Recording.createAsync({
        android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        ios: { extension: '.m4a', outputFormat: Audio.IOSOutputFormat.MPEG4AAC, audioQuality: Audio.IOSAudioQuality.MEDIUM, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        isMeteringEnabled: true,
      });

      // [FIX 1] VAD: track peak metering level during chunk
      let peakLevel = -160;
      meteringIntervalRef.current = setInterval(async () => {
        if (!isActiveRef.current) return;
        try {
          const st = await recording.getStatusAsync();
          if (!st.isRecording) return;
          const db = st.metering ?? -160;
          if (db > peakLevel) peakLevel = db;
          setRecordingLevel(Math.max(0, Math.min(100, (db + 60) * 2)));
        } catch (e) {}
      }, 100);

      await new Promise(resolve => setTimeout(resolve, 6000)); // [FIX 1] 6s chunks
      clearInterval(meteringIntervalRef.current);
      setRecordingLevel(0);
      if (!isActiveRef.current) { try { await recording.stopAndUnloadAsync(); } catch (e) {} return; }
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (isActiveRef.current) setTimeout(() => recordChunk(), 0);

      // [FIX 1] VAD: only process if peak level above threshold (-35 dB)
      // TTS playing through earphones typically doesn't reach this level
      // on the microphone. Human voice is typically > -30 dB.
      const VAD_THRESHOLD = -30;
      const MIN_ACTIVE_FRAMES = 5; // at least 500ms of voice in 6s chunk
      if (peakLevel < VAD_THRESHOLD || activeFrames < MIN_ACTIVE_FRAMES) {
        console.log('[VAD] Chunk skipped - peak:', peakLevel, 'dB, frames:', activeFrames);
        return;
      }
      if (uri) processChunk(uri);
    } catch (e) {
      console.log('RT record error:', e.message);
      if (isActiveRef.current) setTimeout(() => recordChunk(), 500);
    }
  };

  const processChunk = async (uri) => {
    try {
      const formData = new FormData();
      formData.append('audio', { uri, type: 'audio/m4a', name: 'rt.m4a' });
      formData.append('language', myLangObj.voiceLocale.slice(0, 2));
      // [FIX 4] Send last context as prompt to Whisper for better accuracy
      if (lastContextRef.current) formData.append('prompt', lastContextRef.current);
      const transcribeRes = await fetch(`${BACKEND_URL}/transcribe-realtime`, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } });
      const { text = '' } = await transcribeRes.json();
      if (!text.trim()) return;

      // [FIX 2] Echo cancellation: skip if transcription matches recent TTS output
      // Checks if > 40% of words in transcription came from our TTS
      const transcribed = text.trim().toLowerCase();
      const timeSinceTts = Date.now() - lastTtsTimeRef.current;
      if (lastTtsTextRef.current && timeSinceTts < 8000) {
        const ttsWords = lastTtsTextRef.current.split(/\s+/).filter(w => w.length > 3);
        const transWords = transcribed.split(/\s+/);
        const matches = transWords.filter(w => ttsWords.some(tw => tw.includes(w) || w.includes(tw)));
        const echoRatio = ttsWords.length > 0 ? matches.length / ttsWords.length : 0;
        if (echoRatio > 0.4) {
          console.log('[ECHO] Skipped echo, ratio:', echoRatio.toFixed(2), text.trim());
          return;
        }
      }

      // [FIX: Hallucination] filter short/noise/repetitive transcriptions
      const trimmed = text.trim();
      const wordCount = trimmed.split(/\s+/).filter(w => w.length > 1).length;
      if (wordCount < 2) return; // too short, likely noise
      // Skip if identical or very similar to last transcription (Whisper repetition)
      if (lastTranscribedRef.current) {
        const prev = lastTranscribedRef.current.toLowerCase();
        const curr = trimmed.toLowerCase();
        if (curr === prev || (prev.length > 10 && (curr.includes(prev) || prev.includes(curr)))) {
          console.log('[HALLUC] Skipped repetition:', trimmed);
          return;
        }
      }
      lastTranscribedRef.current = trimmed;

      // [FIX 3] Post-TTS cooldown: skip chunk that started right after TTS ended
      const msSinceTts = Date.now() - lastTtsTimeRef.current;
      const ttsCooldown = ttsDurationRef.current + 1500; // TTS duration + 1.5s buffer
      if (msSinceTts < ttsCooldown && msSinceTts > 0) {
        console.log('[COOLDOWN] Skipped chunk', msSinceTts, 'ms after TTS (cooldown:', ttsCooldown, 'ms)');
        return;
      }

      const relayRes = await fetch(`${BACKEND_URL}/room/relay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: roomIdRef.current, role: 'host', text: trimmed, context: lastContextRef.current || undefined }),
      });
      const { translatedText = '' } = await relayRes.json();
      if (!translatedText) return;
      lastContextRef.current = trimmed.split(' ').slice(-5).join(' ');
      const n = chunkCountRef.current + 1;
      setChunkCount(n); chunkCountRef.current = n;
      const line = { id: Date.now().toString(), from: 'host', original: text.trim(), translated: translatedText, srcFlag: myLangObj.flag, tgtFlag: theirLangObj.flag, ttsLocale: theirLangObj.ttsLocale };
      setTranscript(prev => [...prev.slice(-49), line]);
      setLastTranslation(line);
    } catch (e) { console.log('RT process error:', e.message); }
  };

  const toggleSession = async () => {
    if (isActive) {
      clearInterval(meteringIntervalRef.current);
      setIsActive(false); setRecordingLevel(0); Speech.stop();
      setStatus(t.guestJoined);
    } else {
      const ok = await requestMic(t);
      if (!ok) return;
      setIsActive(true); setStatus(t.realtimeActive);
      recordChunk();
    }
  };

  const handleLeave = () => {
    clearInterval(meteringIntervalRef.current);
    clearInterval(pingIntervalRef.current);
    if (wsRef.current) wsRef.current.close();
    Speech.stop();
    onBack();
  };

  const deepLinkUrl = roomId ? `parlora://room/${roomId}` : '';
  const guestUrl = deepLinkUrl;

  if (phase === 'creating') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={handleLeave} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
          <View style={s.statusBadge}>
            <View style={s.statusDot} />
            <Text style={s.statusText}>{t.creatingRoom || 'Creating room...'}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Text style={{ fontSize: 40 }}>⚡</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{t.creatingRoom || 'Creating room...'}</Text>
          {debugLog ? <Text style={{ color: '#34C759', fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>{debugLog}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'qr') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={handleLeave} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
          <View style={[s.statusBadge, guestConnected && s.statusBadgeActive]}>
            <View style={[s.statusDot, guestConnected && s.statusDotActive]} />
            <Text style={[s.statusText, guestConnected && s.statusTextActive]}>{status}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
          <Text style={[s.setupTitle, { textAlign: 'center' }]}>{t.realtimeSetupTitle}</Text>
          <Text style={[s.setupSub, { textAlign: 'center', marginBottom: 24 }]}>{t.scanQR}</Text>
          <View style={[s.personCard, { alignItems: 'center', padding: 24 }]}>
            {/* Código de sala */}
            <Text style={s.configSectionLabel}>{t.roomId}</Text>
            <Text style={{ fontSize: 40, fontWeight: '700', color: '#34C759', letterSpacing: 8, marginBottom: 16 }}>{roomId}</Text>

            {/* Enlace para compartir */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(52,199,89,0.1)', borderWidth: 0.5, borderColor: 'rgba(52,199,89,0.3)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, marginBottom: 8 }}
              onPress={() => Share.share({ message: `${t.joinRealtime || 'Join my Parlora AI session'}: ${WEB_URL}/${roomId}`, url: `${WEB_URL}/${roomId}` })}
            >
              <Text style={{ fontSize: 16 }}>🔗</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#34C759' }}>{t.shareLink || 'Share link'}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginBottom: 4 }}>
              {WEB_URL}/{roomId}
            </Text>
          </View>
          <View style={[s.confInfoRow, { width: '100%' }]}>
            <View style={[s.confInfoCard, { borderColor: 'rgba(52,199,89,0.3)' }]}>
              <Text style={s.personInfoIcon}>🎙</Text>
              <Text style={[s.personInfoLabel, { color: '#34C759' }]}>{t.youSpeak}</Text>
              <Text style={s.personInfoLang}>{myLangObj.flag} {myLangObj.name}</Text>
            </View>
            <View style={s.confArrowWrap}><Text style={s.confArrow}>⇄</Text><Text style={s.confDelay}>~4s</Text></View>
            <View style={[s.confInfoCard, { borderColor: 'rgba(129,140,248,0.3)' }]}>
              <Text style={s.personInfoIcon}>🎧</Text>
              <Text style={[s.personInfoLabel, { color: '#818CF8' }]}>{t.theySpeak}</Text>
              <Text style={s.personInfoLang}>{theirLangObj.flag} {theirLangObj.name}</Text>
            </View>
          </View>
          <Text style={[s.micHint, { marginBottom: 16 }]}>{t.roomExpiry}</Text>
          {guestConnected && (
            <TouchableOpacity style={[s.startBtn, { backgroundColor: '#34C759', width: '100%' }]} onPress={() => { setPhase('active'); toggleSession(); }}>
              <Text style={s.startBtnText}>{t.startRealtimeSession}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleLeave} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>{status}</Text>
        </View>
        <TouchableOpacity style={[s.repeatBtn, !lastTranslation && s.repeatBtnDisabled]}
          onPress={() => { if (lastTranslation) { Speech.stop(); Speech.speak(lastTranslation.translated, { language: lastTranslation.ttsLocale, rate: ttsSpeedRef.current }); }}}
          disabled={!lastTranslation}>
          <Text style={s.repeatBtnIcon}>🔁</Text>
        </TouchableOpacity>
      </View>
      <View style={s.confInfoRow}>
        <View style={[s.confInfoCard, { borderColor: 'rgba(52,199,89,0.3)' }]}>
          <Text style={s.personInfoIcon}>🎙</Text>
          <Text style={[s.personInfoLabel, { color: '#34C759' }]}>{t.youSpeak}</Text>
          <Text style={s.personInfoLang}>{myLangObj.flag} {myLangObj.name}</Text>
        </View>
        <View style={s.confArrowWrap}><Text style={s.confArrow}>⇄</Text><Text style={s.confDelay}>~4s</Text></View>
        <View style={[s.confInfoCard, { borderColor: 'rgba(129,140,248,0.3)' }]}>
          <Text style={s.personInfoIcon}>🎧</Text>
          <Text style={[s.personInfoLabel, { color: '#818CF8' }]}>{t.theySpeak}</Text>
          <Text style={s.personInfoLang}>{theirLangObj.flag} {theirLangObj.name}</Text>
        </View>
      </View>
      {isActive && (
        <View style={s.recordingIndicator}>
          <View style={[s.recordingDot, { backgroundColor: '#34C759' }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.recordingText}>{t.realtimeActive} · {chunkCount} chunks</Text>
            <View style={s.audioLevelContainer}>
              <View style={[s.audioLevelBar, { width: `${recordingLevel}%`, backgroundColor: '#34C759' }]} />
            </View>
          </View>
        </View>
      )}
      <View style={s.speedSelector}>
        <Text style={s.speedLabel}>{t.speed}</Text>
        {[{val:0.5,label:'0.5x'},{val:0.75,label:'0.75x'},{val:1.0,label:'1x'},{val:1.25,label:'1.25x'},{val:1.5,label:'1.5x'}].map(opt => (
          <TouchableOpacity key={opt.val} style={[s.speedBtn, ttsSpeed === opt.val && s.speedBtnActive]}
            onPress={() => { setTtsSpeed(opt.val); ttsSpeedRef.current = opt.val; }}>
            <Text style={[s.speedBtnText, ttsSpeed === opt.val && s.speedBtnTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.sectionLabel}>{t.liveTranslation}</Text>
      <ScrollView ref={scrollRef} style={s.chatBox} contentContainerStyle={s.chatContent}>
        {transcript.length === 0 && <Text style={s.emptyText}>{t.realtimeHint}</Text>}
        {transcript.map(line => {
          const isHost = line.from === 'host';
          const name = isHost ? (t.youSpeak || 'You') : (t.theySpeak || 'Them');
          return (
            <View key={line.id} style={[s.bubbleRow, isHost ? s.bubbleRowA : s.bubbleRowB]}>
              <View style={[s.bubbleAvatar, { backgroundColor: isHost ? 'rgba(52,199,89,0.2)' : 'rgba(129,140,248,0.2)' }]}>
                <Text style={s.bubbleAvatarText}>{isHost ? '🎙' : '🎧'}</Text>
              </View>
              <View style={[s.bubble, isHost ? { backgroundColor: 'rgba(52,199,89,0.12)', borderBottomLeftRadius: 4 } : { backgroundColor: 'rgba(129,140,248,0.15)', borderBottomRightRadius: 4 }]}>
                <Text style={[s.bubbleName, { color: isHost ? '#34C759' : '#818CF8' }]}>{name}</Text>
                <Text style={s.bubbleOriginal}>{line.srcFlag} {line.original}</Text>
                <View style={s.bubbleDivider} />
                <Text style={s.bubbleTranslated}>{line.tgtFlag} {line.translated}</Text>
                <TouchableOpacity style={s.bubbleRepeat} onPress={() => { Speech.stop(); Speech.speak(line.translated, { language: line.ttsLocale, rate: ttsSpeedRef.current }); }}>
                  <Text style={s.bubbleRepeatIcon}>🔁</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={s.controls}>
        <TouchableOpacity style={[s.sessionBtnLarge, isActive && s.sessionBtnActive]} onPress={toggleSession}>
          <Text style={s.sessionBtnText}>{isActive ? t.stopRealtime : t.startRealtimeSession}</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.micHint}>{t.realtimeHint}</Text>
    </SafeAreaView>
  );
}


// ─── APP ──────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState('loading');
  const [sessionConfig, setSessionConfig] = useState(null);
  const [uiLang, setUiLang] = useState(null);
  const [legalScreen, setLegalScreen] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState(null);

  // Handle deep links: parlora://room/XXXXX
  useEffect(() => {
    const handleUrl = (url) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      if (parsed.scheme === 'parlora' && parsed.hostname === 'room') {
        const roomId = parsed.path?.replace(/^\//, '') || parsed.queryParams?.id || parsed.queryParams?.room;
        if (roomId) setPendingRoomId(roomId);
      }
    };
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    async function init() {
      try {
        // Load saved language
        const savedLang = await AsyncStorage.getItem('parlora_ui_lang');
        if (savedLang && UI_LANGS[savedLang]) {
          setUiLang(savedLang);
          // Check if first time
          const onboardingDone = await AsyncStorage.getItem('parlora_onboarding_done');
          if (!onboardingDone) {
            setScreen('onboarding');
          } else {
            setScreen('login');
          }
        } else {
          setScreen('langSelect');
        }
      } catch (e) {
        setScreen('langSelect');
      }
    }
    init();
  }, []);

  const handleSelectLang = async (code) => {
    try { await AsyncStorage.setItem('parlora_ui_lang', code); } catch (e) {}
    setUiLang(code);
    // Check if onboarding done
    try {
      const done = await AsyncStorage.getItem('parlora_onboarding_done');
      setScreen(done ? 'login' : 'onboarding');
    } catch (e) {
      setScreen('onboarding');
    }
  };

  const handleOnboardingDone = async () => {
    try { await AsyncStorage.setItem('parlora_onboarding_done', '1'); } catch (e) {}
    setShowOnboarding(false);
    setScreen('login');
  };

  const handleChangeLang = async () => {
    try { await AsyncStorage.removeItem('parlora_ui_lang'); } catch (e) {}
    setUiLang(null);
    setScreen('langSelect');
  };

  const t = uiLang ? (UI_LANGS[uiLang] || UI_LANGS.ES) : UI_LANGS.ES;

  // Legal overlay
  if (legalScreen) {
    return <LegalScreen type={legalScreen} uiLang={uiLang || 'EN'} onClose={() => setLegalScreen(null)} />;
  }

  // Onboarding overlay (repeat tutorial)
  if (showOnboarding) {
    return <OnboardingScreen t={t} onDone={() => setShowOnboarding(false)} />;
  }

  if (screen === 'loading') return null;
  if (screen === 'onboarding') return <OnboardingScreen t={t} onDone={handleOnboardingDone} />;
  if (screen === 'langSelect' || !uiLang) return <LangSelectScreen onSelect={handleSelectLang} />;
  if (screen === 'login') return (
    <LoginScreen
      onLogin={() => setScreen('setup')}
      t={t} uiLang={uiLang}
      setUiLang={handleChangeLang}
      onShowPrivacy={() => setLegalScreen('privacy')}
      onShowTerms={() => setLegalScreen('terms')}
    />
  );
  if (screen === 'setup') return (
    <SetupScreen
      onStart={(c) => { setSessionConfig(c); setScreen('session'); }}
      t={t} uiLang={uiLang}
      setUiLang={handleChangeLang}
      onShowOnboarding={() => setShowOnboarding(true)}
      pendingRoomId={pendingRoomId}
      onClearPendingRoom={() => setPendingRoomId(null)}
    />
  );
  if (screen === 'session') {
    if (sessionConfig.mode === 'conference') return <ConferenceScreen config={sessionConfig} onBack={() => setScreen('setup')} t={t} onShowOnboarding={() => setShowOnboarding(true)} />;
    if (sessionConfig.mode === 'realtime') return <RealtimeScreen config={sessionConfig} onBack={() => setScreen('setup')} t={t} />;
    if (sessionConfig.mode === 'realtime-guest') return <RealtimeGuestScreen config={sessionConfig} onBack={() => setScreen('setup')} t={t} />;
    return <ConversationScreen config={sessionConfig} onBack={() => setScreen('setup')} t={t} onShowOnboarding={() => setShowOnboarding(true)} />;
  }
  return null;
}


// ─── ESTILOS ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D14' },
  // Lang select
  langSelectContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  langSelectTitle: { fontSize: 16, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 28, lineHeight: 24 },
  langSelectList: { width: '100%', paddingBottom: 20 },
  langSelectItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, marginBottom: 10 },
  langSelectFlag: { fontSize: 28, marginRight: 14 },
  langSelectName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff' },
  langSelectArrow: { fontSize: 20, color: 'rgba(255,255,255,0.2)' },
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
  terms: { fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 18, marginTop: 20 },
  termsLink: { color: 'rgba(99,102,241,0.7)' },
  changeLangBtn: { marginTop: 20, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  changeLangText: { fontSize: 13, color: 'rgba(255,255,255,0.35)' },
  // Onboarding
  onboardingContainer: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 32, paddingTop: 60 },
  onboardingSkip: { position: 'absolute', top: 20, right: 24 },
  onboardingSkipText: { fontSize: 14, color: 'rgba(255,255,255,0.3)' },
  onboardingContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  onboardingIcon: { fontSize: 72, marginBottom: 32 },
  onboardingTitle: { fontSize: 26, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 16 },
  onboardingDesc: { fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 24 },
  onboardingDots: { flexDirection: 'row', gap: 8, marginBottom: 32, justifyContent: 'center', alignSelf: 'center' },
  onboardingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  onboardingDotActive: { backgroundColor: '#818CF8', width: 24 },
  onboardingNextBtn: { backgroundColor: '#818CF8', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48, alignItems: 'center' },
  onboardingNextText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // Legal
  legalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  legalTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  legalScroll: { flex: 1 },
  legalContent: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 22 },
  // Mode select
  modeContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(129,140,248,0.3)', borderRadius: 20, padding: 18, width: '100%', marginBottom: 14 },
  modeCardConf: { borderColor: 'rgba(196,181,253,0.3)' },
  modeIcon: { fontSize: 32 },
  modeTextWrap: { flex: 1 },
  modeTitle: { fontSize: 16, fontWeight: '700', color: '#818CF8', marginBottom: 4 },
  modeDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18 },
  modeArrow: { fontSize: 20, color: 'rgba(255,255,255,0.2)' },
  modeFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  helpBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(129,140,248,0.15)', borderWidth: 0.5, borderColor: '#818CF8', alignItems: 'center', justifyContent: 'center' },
  helpBtnText: { fontSize: 16, fontWeight: '700', color: '#818CF8' },
  // Setup
  setupContainer: { padding: 20 },
  setupHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  setupTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  setupSub: { fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 24, lineHeight: 20 },
  personCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 16, marginBottom: 16 },
  personCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  personLabel: { fontSize: 16, fontWeight: '700' },
  editNameBtn: { padding: 4 },
  editNameBtnText: { fontSize: 16 },
  nameInputRow: { marginBottom: 12 },
  nameInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  nameInputText: { fontSize: 14, color: '#fff' },
  configSectionLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.1, textTransform: 'uppercase', marginBottom: 8 },
  langScroll: { marginBottom: 4 },
  langChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', marginRight: 8, backgroundColor: 'rgba(255,255,255,0.04)' },
  langChipActiveA: { borderColor: '#818CF8', backgroundColor: 'rgba(129,140,248,0.15)' },
  langChipActiveB: { borderColor: '#C4B5FD', backgroundColor: 'rgba(196,181,253,0.15)' },
  langChipText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  langChipWarning: { borderColor: 'rgba(239,159,39,0.4)', backgroundColor: 'rgba(239,159,39,0.08)' },
  // Audio options
  audioOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  audioRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  audioRadioActive: { borderColor: '#818CF8' },
  audioRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#818CF8' },
  audioOptionText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  warningBox: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 14, padding: 14, marginBottom: 16 },
  warningText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
  startBtn: { backgroundColor: '#818CF8', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  startBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // Session header
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
  // Chat bubbles
  chatBox: { flex: 1, marginHorizontal: 10 },
  chatContent: { paddingVertical: 10, paddingHorizontal: 4 },
  bubbleRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  bubbleRowA: { flexDirection: 'row' },
  bubbleRowB: { flexDirection: 'row-reverse' },
  bubbleAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  bubbleAvatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  bubble: { maxWidth: '75%', borderRadius: 18, padding: 12 },
  bubbleA: { backgroundColor: 'rgba(129,140,248,0.15)', borderBottomLeftRadius: 4 },
  bubbleB: { backgroundColor: 'rgba(196,181,253,0.15)', borderBottomRightRadius: 4 },
  bubbleName: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bubbleOriginal: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  bubbleDivider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 6 },
  bubbleTranslated: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', lineHeight: 18 },
  bubbleRepeat: { alignSelf: 'flex-end', marginTop: 6 },
  bubbleRepeatIcon: { fontSize: 12 },
  // Mic controls conversation
  convControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 8, paddingHorizontal: 14 },
  micBtnLarge: { flex: 1, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, gap: 2 },
  micRecordingDot: { fontSize: 10, marginTop: 2 },
  // Persons (conference)
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
  partialBox: { marginHorizontal: 14, marginBottom: 6, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 10, padding: 8 },
  partialText: { fontSize: 12, color: '#818CF8', fontStyle: 'italic' },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.08, marginHorizontal: 14, marginBottom: 6, textTransform: 'uppercase' },
  transcriptBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', marginHorizontal: 14, padding: 10 },
  emptyText: { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 40, lineHeight: 22 },
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
  speedSelector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 8, gap: 6 },
  speedLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginRight: 4 },
  speedBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  speedBtnActive: { borderColor: '#818CF8', backgroundColor: 'rgba(129,140,248,0.15)' },
  speedBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  speedBtnTextActive: { color: '#818CF8' },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10 },
  recordingDot: { width: 10, height: 10, borderRadius: 5 },
  recordingText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  audioLevelContainer: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  audioLevelBar: { height: 3, backgroundColor: '#818CF8', borderRadius: 2 },
  // STT modal
  sttModalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, justifyContent: 'center', alignItems: 'center', padding: 20 },
  sttModal: { backgroundColor: '#1A1A2E', borderRadius: 20, padding: 24, width: '100%', borderWidth: 0.5, borderColor: 'rgba(239,159,39,0.4)' },
  sttModalTitle: { fontSize: 18, fontWeight: '700', color: '#EF9F27', marginBottom: 12 },
  sttModalDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20, marginBottom: 14 },
  sttModalStep: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 22, marginBottom: 4 },
  sttModalSectionLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 6, marginTop: 4 },
  sttModalBtn: { backgroundColor: '#818CF8', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  sttModalBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // Onboarding new styles
  onboardingWrapper: { flex: 1 },
  onboardingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  onboardingHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  onboardingPage: { width: Dimensions.get('window').width, alignItems: 'center', justifyContent: 'center', padding: 32 },
  onboardingBtnRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingBottom: 32 },
  onboardingPrevBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' },
  onboardingPrevText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  // Conversation diagram
  convDiagram: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  convDiagramSide: { alignItems: 'center', flex: 1 },
  convDiagramMic: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, marginBottom: 6 },
  convDiagramMicIcon: { fontSize: 20 },
  convDiagramMicLabel: { fontSize: 12, fontWeight: '700' },
  convDiagramArrow: { alignItems: 'center' },
  convDiagramArrowText: { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  convDiagramArrowLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
  convDiagramCenter: { alignItems: 'center', paddingHorizontal: 8 },
  convDiagramCenterIcon: { fontSize: 28 },
  convDiagramCenterLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  convDiagramFlow: { marginTop: 10, backgroundColor: 'rgba(129,140,248,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  convDiagramFlowText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  // Mic flags
  micFlags: { fontSize: 12, marginTop: 2, opacity: 0.8 },
  // XL mic buttons (conversation mode)
  micBtnXL: { flex: 1, height: 110, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, gap: 3 },
  micIconXL: { fontSize: 32 },
  micLabelXL: { fontSize: 13, fontWeight: '700' },
  micFlagsRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  micFlagText: { fontSize: 16 },
  micFlagArrow: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  // Hint above mics
  micHintAbove: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 6 },
  micHintAboveText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  micHintArrow: { fontSize: 18, color: 'rgba(255,255,255,0.2)', marginTop: 2 },
  // Numpad & code input
  setupHeaderRow2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  codeInputRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginVertical: 24 },
  codeBox: { width: 52, height: 64, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  codeBoxFilled: { borderColor: '#818CF8', backgroundColor: 'rgba(129,140,248,0.15)' },
  codeBoxText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 24, paddingHorizontal: 20 },
  numpadKey: { width: 80, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  numpadKeyText: { fontSize: 24, fontWeight: '600', color: '#fff' },
  joinError: { fontSize: 13, color: '#EF4444', textAlign: 'center', marginBottom: 12 },
  // TTS controls
  ttsControlsWrap: { paddingHorizontal: 14, paddingBottom: 6, gap: 6 },
  ttsControlsRow: { flexDirection: 'row', gap: 10 },
  ttsBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(129,140,248,0.4)', backgroundColor: 'rgba(129,140,248,0.1)' },
  ttsBtnIcon: { fontSize: 20, color: '#818CF8' },
  ttsStopBtn: { paddingVertical: 11, borderRadius: 12, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' },
  ttsStopBtnText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  // Tooltip overlay
  tooltipOverlay: { position: 'absolute', bottom: 90, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 50 },
  tooltipLeft: { flex: 1, alignItems: 'flex-start' },
  tooltipRight: { flex: 1, alignItems: 'flex-end' },
  tooltipBubble: { backgroundColor: '#818CF8', borderRadius: 12, padding: 10, maxWidth: 140, alignItems: 'center' },
  tooltipText: { fontSize: 11, color: '#fff', fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  tooltipArrowDown: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#818CF8', marginTop: 4 },
});

registerRootComponent(App);
// ─── REALTIME GUEST SCREEN ───────────────────────────────────────
function RealtimeGuestScreen({ config, onBack, t }) {
  const { roomId, myLang, theirLang } = config;
  const myLangObj = LANGUAGES.find(l => l.code === myLang) || LANGUAGES[0];
  const theirLangObj = LANGUAGES.find(l => l.code === theirLang) || LANGUAGES[1];

  const BACKEND_URL = 'https://parlora-backend-7q3m.onrender.com';

  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [lastTranslation, setLastTranslation] = useState(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [recordingLevel, setRecordingLevel] = useState(0);
  const [status, setStatus] = useState(t.creatingRoom || 'Connecting...');
  const [hostConnected, setHostConnected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const isActiveRef = useRef(false);
  const chunkCountRef = useRef(0);
  const ttsSpeedRef = useRef(1.0);
  const meteringIntervalRef = useRef(null);
  const scrollRef = useRef(null);
  const pingIntervalRef = useRef(null);
  // [FIX 2] Echo cancellation refs
  const lastTtsTextRef = useRef('');
  const lastTtsTimeRef = useRef(0);
  const ttsDurationRef = useRef(0); // [FIX 3] estimated TTS duration
  // [FIX: Hallucination] context + repetition detection
  const lastContextRef = useRef('');
  const lastTranscribedRef = useRef('');

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { chunkCountRef.current = chunkCount; }, [chunkCount]);
  useEffect(() => {
    if (transcript.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  useEffect(() => {
    connectWS();
    return () => {
      clearInterval(pingIntervalRef.current);
      clearInterval(meteringIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
      Speech.stop();
    };
  }, []);

  const connectWS = () => {
    setStatus(t.creatingRoom || 'Connecting...');
    const sock = new WebSocket(`wss://parlora-backend-7q3m.onrender.com/ws?roomId=${roomId}&role=guest`);
    wsRef.current = sock;
    sock.onopen = () => {
      setWsConnected(true);
      pingIntervalRef.current = setInterval(() => {
        if (sock.readyState === 1) sock.send(JSON.stringify({ type: 'ping' }));
      }, 25000);
      setStatus(t.waitingGuest || 'Waiting for host...');
    };
    sock.onerror = () => { setStatus(t.errorRetry || 'Connection error'); };
    sock.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'connected') {
          // Backend confirms connection — check if host already in room
          if (msg.role === 'guest') {
            setStatus(t.waitingGuest || 'Waiting for host...');
          }
          // If host was already connected before guest joined
          if (msg.hasHost) {
            setHostConnected(true);
            setStatus(t.guestJoined || 'Host connected!');
          }
        }
        if (msg.type === 'peer_joined' && msg.role === 'host') {
          setHostConnected(true);
          setStatus(t.guestJoined || 'Host connected!');
        }
        if (msg.type === 'peer_left' && msg.role === 'host') {
          setHostConnected(false);
          setStatus(t.peerLeft || 'Host disconnected');
          Alert.alert('⚠️', t.peerLeft || 'Host left the session');
        }
        if (msg.type === 'translation') {
          const line = {
            id: Date.now().toString(), from: 'host',
            original: msg.original, translated: msg.translated,
            srcFlag: theirLangObj.flag, tgtFlag: myLangObj.flag,
            ttsLocale: myLangObj.ttsLocale,
          };
          setTranscript(prev => [...prev.slice(-49), line]);
          setLastTranslation(line);
          // Always play TTS when host speaks
          lastTtsTextRef.current = msg.translated.toLowerCase();
          lastTtsTimeRef.current = Date.now();
          const wordCount = msg.translated.split(' ').length;
          ttsDurationRef.current = (wordCount * 120) / ttsSpeedRef.current;
          Speech.speak(msg.translated, { language: myLangObj.ttsLocale, rate: ttsSpeedRef.current });
        }
        if (msg.type === 'room_closed') {
          setStatus(t.roomClosed || 'Room closed');
          Alert.alert('', t.roomClosed || 'Session ended');
          onBack();
        }
      } catch (err) {}
    };
    sock.onclose = (e) => {
      clearInterval(pingIntervalRef.current);
      if (e.code === 4004) {
        Alert.alert('', t.roomNotFound || 'Room not found or expired.');
        onBack();
      }
    };
    sock.onerror = () => setStatus(t.errorRetry || 'Connection error');
  };

  const recordChunk = async () => {
    if (!isActiveRef.current) return;
    try {
      // [FIX 3] Prefer Bluetooth mic
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
      const { recording } = await Audio.Recording.createAsync({
        android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        ios: { extension: '.m4a', outputFormat: Audio.IOSOutputFormat.MPEG4AAC, audioQuality: Audio.IOSAudioQuality.MEDIUM, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        isMeteringEnabled: true,
      });
      // [FIX 1+6] VAD: track peak level AND active voice frames
      let peakLevel = -160;
      let activeFrames = 0;
      meteringIntervalRef.current = setInterval(async () => {
        if (!isActiveRef.current) return;
        try {
          const st = await recording.getStatusAsync();
          if (!st.isRecording) return;
          const db = st.metering ?? -160;
          if (db > peakLevel) peakLevel = db;
          if (db > -30) activeFrames++; // count frames with voice
          setRecordingLevel(Math.max(0, Math.min(100, (db + 60) * 2)));
        } catch (e) {}
      }, 100);
      await new Promise(resolve => setTimeout(resolve, 6000)); // [FIX 1] 6s chunks
      clearInterval(meteringIntervalRef.current);
      setRecordingLevel(0);
      if (!isActiveRef.current) { try { await recording.stopAndUnloadAsync(); } catch (e) {} return; }
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (isActiveRef.current) setTimeout(() => recordChunk(), 0);
      // [FIX 1] VAD: skip silent chunks
      const VAD_THRESHOLD = -30;
      const MIN_ACTIVE_FRAMES = 5;
      if (peakLevel < VAD_THRESHOLD || activeFrames < MIN_ACTIVE_FRAMES) {
        console.log('[VAD] Guest chunk skipped - peak:', peakLevel, 'dB, frames:', activeFrames);
        return;
      }
      if (uri) processChunk(uri);
    } catch (e) {
      console.log('RT guest record error:', e.message);
      if (isActiveRef.current) setTimeout(() => recordChunk(), 500);
    }
  };

  const processChunk = async (uri) => {
    try {
      const formData = new FormData();
      formData.append('audio', { uri, type: 'audio/m4a', name: 'rt.m4a' });
      formData.append('language', myLangObj.voiceLocale.slice(0, 2));
      // [FIX 4] Send last context as prompt to Whisper for better accuracy
      if (lastContextRef.current) formData.append('prompt', lastContextRef.current);
      const transcribeRes = await fetch(`${BACKEND_URL}/transcribe-realtime`, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } });
      const { text = '' } = await transcribeRes.json();
      if (!text.trim()) return;

      // [FIX 2] Echo cancellation: skip if transcription matches recent TTS output
      // Checks if > 40% of words in transcription came from our TTS
      const transcribed = text.trim().toLowerCase();
      const timeSinceTts = Date.now() - lastTtsTimeRef.current;
      if (lastTtsTextRef.current && timeSinceTts < 8000) {
        const ttsWords = lastTtsTextRef.current.split(/\s+/).filter(w => w.length > 3);
        const transWords = transcribed.split(/\s+/);
        const matches = transWords.filter(w => ttsWords.some(tw => tw.includes(w) || w.includes(tw)));
        const echoRatio = ttsWords.length > 0 ? matches.length / ttsWords.length : 0;
        if (echoRatio > 0.4) {
          console.log('[ECHO] Skipped echo, ratio:', echoRatio.toFixed(2), text.trim());
          return;
        }
      }

      // [FIX 3] Post-TTS cooldown
      const msSinceTtsG = Date.now() - lastTtsTimeRef.current;
      const ttsCooldownG = ttsDurationRef.current + 1500;
      if (msSinceTtsG < ttsCooldownG && msSinceTtsG > 0) {
        console.log('[COOLDOWN] Guest skipped', msSinceTtsG, 'ms after TTS');
        return;
      }

      // [FIX: Hallucination] filter short/repetitive transcriptions
      const trimmedG = text.trim();
      const wordCountG = trimmedG.split(/\s+/).filter(w => w.length > 1).length;
      if (wordCountG < 2) return;
      if (lastTranscribedRef.current) {
        const prevG = lastTranscribedRef.current.toLowerCase();
        const currG = trimmedG.toLowerCase();
        if (currG === prevG || (prevG.length > 10 && (currG.includes(prevG) || prevG.includes(currG)))) {
          return;
        }
      }
      lastTranscribedRef.current = trimmedG;

      const relayRes = await fetch(`${BACKEND_URL}/room/relay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, role: 'guest', text: trimmedG, context: lastContextRef.current || undefined }),
      });
      const { translatedText = '' } = await relayRes.json();
      if (!translatedText) return;
      lastContextRef.current = trimmedG.split(' ').slice(-5).join(' ');
      const n = chunkCountRef.current + 1;
      setChunkCount(n); chunkCountRef.current = n;
      const line = { id: Date.now().toString(), from: 'guest', original: trimmedG, translated: translatedText, srcFlag: myLangObj.flag, tgtFlag: theirLangObj.flag, ttsLocale: theirLangObj.ttsLocale };
      setTranscript(prev => [...prev.slice(-49), line]);
      setLastTranslation(line);
    } catch (e) { console.log('RT guest process error:', e.message); }
  };

  const toggleSession = async () => {
    if (isActive) {
      clearInterval(meteringIntervalRef.current);
      setIsActive(false); setRecordingLevel(0); Speech.stop();
      setStatus(t.guestJoined || 'Connected');
    } else {
      const ok = await requestMic(t);
      if (!ok) return;
      setIsActive(true); setStatus(t.realtimeActive || 'Active');
      recordChunk();
    }
  };

  const handleLeave = () => {
    clearInterval(meteringIntervalRef.current);
    clearInterval(pingIntervalRef.current);
    if (wsRef.current) wsRef.current.close();
    Speech.stop();
    onBack();
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleLeave} style={s.backBtn}><Text style={s.backBtnText}>{t.back}</Text></TouchableOpacity>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>{status}</Text>
        </View>
        <TouchableOpacity style={[s.repeatBtn, !lastTranslation && s.repeatBtnDisabled]}
          onPress={() => { if (lastTranslation) { Speech.stop(); Speech.speak(lastTranslation.translated, { language: lastTranslation.ttsLocale, rate: ttsSpeedRef.current }); }}}
          disabled={!lastTranslation}>
          <Text style={s.repeatBtnIcon}>🔁</Text>
        </TouchableOpacity>
      </View>

      <View style={s.confInfoRow}>
        <View style={[s.confInfoCard, { borderColor: 'rgba(52,199,89,0.3)' }]}>
          <Text style={s.personInfoIcon}>🎙</Text>
          <Text style={[s.personInfoLabel, { color: '#34C759' }]}>{t.youSpeak}</Text>
          <Text style={s.personInfoLang}>{myLangObj.flag} {myLangObj.name}</Text>
        </View>
        <View style={s.confArrowWrap}><Text style={s.confArrow}>⇄</Text><Text style={s.confDelay}>~4s</Text></View>
        <View style={[s.confInfoCard, { borderColor: 'rgba(129,140,248,0.3)' }]}>
          <Text style={s.personInfoIcon}>🎧</Text>
          <Text style={[s.personInfoLabel, { color: '#818CF8' }]}>{t.theySpeak}</Text>
          <Text style={s.personInfoLang}>{theirLangObj.flag} {theirLangObj.name}</Text>
        </View>
      </View>

      {isActive && (
        <View style={s.recordingIndicator}>
          <View style={[s.recordingDot, { backgroundColor: '#34C759' }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.recordingText}>{t.realtimeActive} · {chunkCount} chunks</Text>
            <View style={s.audioLevelContainer}>
              <View style={[s.audioLevelBar, { width: `${recordingLevel}%`, backgroundColor: '#34C759' }]} />
            </View>
          </View>
        </View>
      )}

      <View style={s.speedSelector}>
        <Text style={s.speedLabel}>{t.speed}</Text>
        {[{val:0.5,label:'0.5x'},{val:0.75,label:'0.75x'},{val:1.0,label:'1x'},{val:1.25,label:'1.25x'},{val:1.5,label:'1.5x'}].map(opt => (
          <TouchableOpacity key={opt.val} style={[s.speedBtn, ttsSpeed === opt.val && s.speedBtnActive]}
            onPress={() => { setTtsSpeed(opt.val); ttsSpeedRef.current = opt.val; }}>
            <Text style={[s.speedBtnText, ttsSpeed === opt.val && s.speedBtnTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionLabel}>{t.liveTranslation}</Text>
      <ScrollView ref={scrollRef} style={s.chatBox} contentContainerStyle={s.chatContent}>
        {transcript.length === 0 && <Text style={s.emptyText}>{t.realtimeHint}</Text>}
        {transcript.map(line => {
          const isMe = line.from === 'guest';
          return (
            <View key={line.id} style={[s.bubbleRow, isMe ? s.bubbleRowA : s.bubbleRowB]}>
              <View style={[s.bubbleAvatar, { backgroundColor: isMe ? 'rgba(52,199,89,0.2)' : 'rgba(129,140,248,0.2)' }]}>
                <Text style={s.bubbleAvatarText}>{isMe ? '🎙' : '🎧'}</Text>
              </View>
              <View style={[s.bubble, isMe ? { backgroundColor: 'rgba(52,199,89,0.12)', borderBottomLeftRadius: 4 } : { backgroundColor: 'rgba(129,140,248,0.15)', borderBottomRightRadius: 4 }]}>
                <Text style={[s.bubbleName, { color: isMe ? '#34C759' : '#818CF8' }]}>{isMe ? (t.youSpeak || 'You') : (t.theySpeak || 'Them')}</Text>
                <Text style={s.bubbleOriginal}>{line.srcFlag} {line.original}</Text>
                <View style={s.bubbleDivider} />
                <Text style={s.bubbleTranslated}>{line.tgtFlag} {line.translated}</Text>
                <TouchableOpacity style={s.bubbleRepeat} onPress={() => { Speech.stop(); Speech.speak(line.translated, { language: line.ttsLocale, rate: ttsSpeedRef.current }); }}>
                  <Text style={s.bubbleRepeatIcon}>🔁</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={s.controls}>
        <TouchableOpacity style={[s.sessionBtnLarge, isActive && s.sessionBtnActive, !hostConnected && { opacity: 0.4 }]}
          onPress={toggleSession} disabled={!hostConnected}>
          <Text style={s.sessionBtnText}>{isActive ? t.stopRealtime : t.startRealtimeSession}</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.micHint}>{hostConnected ? t.realtimeHint : (t.waitingGuest || 'Waiting for host...')}</Text>
    </SafeAreaView>
  );
}