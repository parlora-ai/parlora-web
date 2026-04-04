import { registerRootComponent } from 'expo';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView, Platform, PermissionsAndroid, Vibration
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
  { code: 'CS', name: 'Checo',     flag: '🇨🇿', voiceLocale: 'cs-CZ', ttsLocale: 'cs-CZ' },
  { code: 'PL', name: 'Polaco',    flag: '🇵🇱', voiceLocale: 'pl-PL', ttsLocale: 'pl-PL' },
  { code: 'NL', name: 'Holandés',  flag: '🇳🇱', voiceLocale: 'nl-NL', ttsLocale: 'nl-NL' },
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


// ─── TRADUCCIONES DE INTERFAZ ─────────────────────────────────────
const UI_LANGS = {
  ES: {
    chooseMode: 'Elige el modo',
    conversation: 'Conversación',
    convDesc: 'Dos personas se turnan. Cada una pulsa su micrófono mientras habla.',
    conference: 'Modo conferencia',
    confDesc: 'El móvil escucha al ponente y tú recibes la traducción casi simultánea.',
    chooseLanguage: 'Elige el idioma de cada persona',
    personA: 'Persona A',
    personB: 'Persona B',
    language: 'Idioma',
    startSession: 'Iniciar sesión →',
    startConference: 'Iniciar conferencia →',
    back: '‹ Volver',
    active: 'Sesión activa',
    paused: 'Pausado',
    translating: 'Traduciendo...',
    transcribing: 'Transcribiendo...',
    liveTranscript: 'Transcripción en vivo',
    liveTranslation: 'Traducción en vivo',
    tapToStart: 'Toca Iniciar para empezar',
    holdToSpeak: 'Mantén pulsado 🎙 A o 🎙 B mientras hablas · Suelta para traducir',
    stop: '⏹ Parar',
    start: '▶ Iniciar',
    stopConf: '⏹ Parar conferencia',
    startConf: '▶ Iniciar conferencia',
    speaker: 'Ponente',
    youHear: 'Tú escuchas',
    speed: 'Velocidad:',
    capturing: '🎙 Captando audio del ponente — primera traducción en ~8s',
    activeCapturing: '🎙 Grabando · Traducción continua activa',
    appLang: 'Idioma de la app',
    continueGoogle: 'Continuar con Google',
    useEmail: 'Usar correo electrónico',
    terms: 'Al continuar aceptas los',
    termsLink: 'Términos',
    privacy: 'Privacidad',
    emptyConv: 'Toca Iniciar y mantén pulsado
🎙 A o 🎙 B mientras hablas',
    emptyConf: 'Pon el móvil cerca del ponente
y toca Iniciar conferencia',
    processing: 'Procesando...',
    recording: '🔴 grabando',
  },
  EN: {
    chooseMode: 'Choose mode',
    conversation: 'Conversation',
    convDesc: 'Two people take turns. Each presses their microphone while speaking.',
    conference: 'Conference mode',
    confDesc: 'The phone listens to the speaker and you receive near-simultaneous translation.',
    chooseLanguage: 'Choose each person's language',
    personA: 'Person A',
    personB: 'Person B',
    language: 'Language',
    startSession: 'Start session →',
    startConference: 'Start conference →',
    back: '‹ Back',
    active: 'Session active',
    paused: 'Paused',
    translating: 'Translating...',
    transcribing: 'Transcribing...',
    liveTranscript: 'Live transcript',
    liveTranslation: 'Live translation',
    tapToStart: 'Tap Start to begin',
    holdToSpeak: 'Hold 🎙 A or 🎙 B while speaking · Release to translate',
    stop: '⏹ Stop',
    start: '▶ Start',
    stopConf: '⏹ Stop conference',
    startConf: '▶ Start conference',
    speaker: 'Speaker',
    youHear: 'You hear',
    speed: 'Speed:',
    capturing: '🎙 Capturing speaker audio — first translation in ~8s',
    activeCapturing: '🎙 Recording · Continuous translation active',
    appLang: 'App language',
    continueGoogle: 'Continue with Google',
    useEmail: 'Use email address',
    terms: 'By continuing you accept the',
    termsLink: 'Terms',
    privacy: 'Privacy',
    emptyConv: 'Tap Start and hold
🎙 A or 🎙 B while speaking',
    emptyConf: 'Place phone near speaker
and tap Start conference',
    processing: 'Processing...',
    recording: '🔴 recording',
  },
  DE: {
    chooseMode: 'Modus wählen',
    conversation: 'Gespräch',
    convDesc: 'Zwei Personen wechseln sich ab. Jede drückt ihr Mikrofon beim Sprechen.',
    conference: 'Konferenzmodus',
    confDesc: 'Das Handy hört dem Redner zu und Sie erhalten eine Simultanübersetzung.',
    chooseLanguage: 'Sprache jeder Person wählen',
    personA: 'Person A',
    personB: 'Person B',
    language: 'Sprache',
    startSession: 'Sitzung starten →',
    startConference: 'Konferenz starten →',
    back: '‹ Zurück',
    active: 'Sitzung aktiv',
    paused: 'Pausiert',
    translating: 'Übersetze...',
    transcribing: 'Transkribiere...',
    liveTranscript: 'Live-Transkription',
    liveTranslation: 'Live-Übersetzung',
    tapToStart: 'Start tippen zum Beginnen',
    holdToSpeak: '🎙 A oder 🎙 B gedrückt halten · Loslassen zum Übersetzen',
    stop: '⏹ Stopp',
    start: '▶ Start',
    stopConf: '⏹ Konferenz stoppen',
    startConf: '▶ Konferenz starten',
    speaker: 'Redner',
    youHear: 'Sie hören',
    speed: 'Geschwindigkeit:',
    capturing: '🎙 Audio wird erfasst — erste Übersetzung in ~8s',
    activeCapturing: '🎙 Aufnahme · Kontinuierliche Übersetzung aktiv',
    appLang: 'App-Sprache',
    continueGoogle: 'Mit Google fortfahren',
    useEmail: 'E-Mail-Adresse verwenden',
    terms: 'Mit Fortfahren akzeptieren Sie die',
    termsLink: 'Bedingungen',
    privacy: 'Datenschutz',
    emptyConv: 'Start tippen und
🎙 A oder 🎙 B gedrückt halten',
    emptyConf: 'Handy nah am Redner platzieren
und Konferenz starten tippen',
    processing: 'Verarbeite...',
    recording: '🔴 Aufnahme',
  },
  SK: {
    chooseMode: 'Vyberte režim',
    conversation: 'Konverzácia',
    convDesc: 'Dve osoby sa striedajú. Každá drží mikrofón počas hovoru.',
    conference: 'Konferenčný režim',
    confDesc: 'Telefón počúva rečníka a vy dostávate simultánny preklad.',
    chooseLanguage: 'Vyberte jazyk každej osoby',
    personA: 'Osoba A',
    personB: 'Osoba B',
    language: 'Jazyk',
    startSession: 'Začať reláciu →',
    startConference: 'Začať konferenciu →',
    back: '‹ Späť',
    active: 'Relácia aktívna',
    paused: 'Pozastavené',
    translating: 'Prekladám...',
    transcribing: 'Prepisujem...',
    liveTranscript: 'Živý prepis',
    liveTranslation: 'Živý preklad',
    tapToStart: 'Klepnutím na Štart začnete',
    holdToSpeak: 'Podržte 🎙 A alebo 🎙 B počas hovorenia · Pustite pre preklad',
    stop: '⏹ Zastaviť',
    start: '▶ Štart',
    stopConf: '⏹ Zastaviť konferenciu',
    startConf: '▶ Začať konferenciu',
    speaker: 'Rečník',
    youHear: 'Vy počujete',
    speed: 'Rýchlosť:',
    capturing: '🎙 Zachytávanie zvuku rečníka — prvý preklad o ~8s',
    activeCapturing: '🎙 Nahrávanie · Priebežný preklad aktívny',
    appLang: 'Jazyk aplikácie',
    continueGoogle: 'Pokračovať s Google',
    useEmail: 'Použiť e-mailovú adresu',
    terms: 'Pokračovaním súhlasíte s',
    termsLink: 'Podmienkami',
    privacy: 'Ochranou súkromia',
    emptyConv: 'Klepnite na Štart a podržte
🎙 A alebo 🎙 B počas hovorenia',
    emptyConf: 'Položte telefón blízko rečníka
a klepnite na Začať konferenciu',
    processing: 'Spracovávam...',
    recording: '🔴 nahrávanie',
  },
  FR: {
    chooseMode: 'Choisir le mode',
    conversation: 'Conversation',
    convDesc: 'Deux personnes se relaient. Chacune appuie sur son micro en parlant.',
    conference: 'Mode conférence',
    confDesc: 'Le téléphone écoute le conférencier et vous recevez la traduction en temps réel.',
    chooseLanguage: 'Choisir la langue de chaque personne',
    personA: 'Personne A', personB: 'Personne B', language: 'Langue',
    startSession: 'Démarrer la session →', startConference: 'Démarrer la conférence →',
    back: '‹ Retour', active: 'Session active', paused: 'En pause',
    translating: 'Traduction...', transcribing: 'Transcription...',
    liveTranscript: 'Transcription en direct', liveTranslation: 'Traduction en direct',
    tapToStart: 'Appuyez sur Démarrer pour commencer',
    holdToSpeak: 'Maintenez 🎙 A ou 🎙 B en parlant · Relâchez pour traduire',
    stop: '⏹ Arrêter', start: '▶ Démarrer',
    stopConf: '⏹ Arrêter la conférence', startConf: '▶ Démarrer la conférence',
    speaker: 'Conférencier', youHear: 'Vous entendez', speed: 'Vitesse:',
    capturing: '🎙 Capture audio — première traduction dans ~8s',
    activeCapturing: '🎙 Enregistrement · Traduction continue active',
    appLang: 'Langue de l'app', continueGoogle: 'Continuer avec Google',
    useEmail: 'Utiliser une adresse e-mail', terms: 'En continuant vous acceptez les',
    termsLink: 'Conditions', privacy: 'Confidentialité',
    emptyConv: 'Appuyez sur Démarrer et maintenez
🎙 A ou 🎙 B en parlant',
    emptyConf: 'Placez le téléphone près du conférencier
et appuyez sur Démarrer',
    processing: 'Traitement...', recording: '🔴 enregistrement',
  },
  IT: {
    chooseMode: 'Scegli modalità',
    conversation: 'Conversazione',
    convDesc: 'Due persone si alternano. Ognuna preme il proprio microfono mentre parla.',
    conference: 'Modalità conferenza',
    confDesc: 'Il telefono ascolta il relatore e ricevi la traduzione in tempo reale.',
    chooseLanguage: 'Scegli la lingua di ogni persona',
    personA: 'Persona A', personB: 'Persona B', language: 'Lingua',
    startSession: 'Avvia sessione →', startConference: 'Avvia conferenza →',
    back: '‹ Indietro', active: 'Sessione attiva', paused: 'In pausa',
    translating: 'Traduzione...', transcribing: 'Trascrizione...',
    liveTranscript: 'Trascrizione in tempo reale', liveTranslation: 'Traduzione in tempo reale',
    tapToStart: 'Tocca Avvia per iniziare',
    holdToSpeak: 'Tieni premuto 🎙 A o 🎙 B mentre parli · Rilascia per tradurre',
    stop: '⏹ Ferma', start: '▶ Avvia',
    stopConf: '⏹ Ferma conferenza', startConf: '▶ Avvia conferenza',
    speaker: 'Relatore', youHear: 'Ascolti', speed: 'Velocità:',
    capturing: '🎙 Acquisizione audio — prima traduzione in ~8s',
    activeCapturing: '🎙 Registrazione · Traduzione continua attiva',
    appLang: 'Lingua app', continueGoogle: 'Continua con Google',
    useEmail: 'Usa indirizzo email', terms: 'Continuando accetti i',
    termsLink: 'Termini', privacy: 'Privacy',
    emptyConv: 'Tocca Avvia e tieni premuto
🎙 A o 🎙 B mentre parli',
    emptyConf: 'Posiziona il telefono vicino al relatore
e tocca Avvia conferenza',
    processing: 'Elaborazione...', recording: '🔴 registrazione',
  },
  PT: {
    chooseMode: 'Escolher modo',
    conversation: 'Conversa',
    convDesc: 'Duas pessoas se revezam. Cada uma pressiona seu microfone ao falar.',
    conference: 'Modo conferência',
    confDesc: 'O telefone ouve o palestrante e você recebe a tradução em tempo real.',
    chooseLanguage: 'Escolher o idioma de cada pessoa',
    personA: 'Pessoa A', personB: 'Pessoa B', language: 'Idioma',
    startSession: 'Iniciar sessão →', startConference: 'Iniciar conferência →',
    back: '‹ Voltar', active: 'Sessão ativa', paused: 'Pausado',
    translating: 'Traduzindo...', transcribing: 'Transcrevendo...',
    liveTranscript: 'Transcrição ao vivo', liveTranslation: 'Tradução ao vivo',
    tapToStart: 'Toque em Iniciar para começar',
    holdToSpeak: 'Segure 🎙 A ou 🎙 B ao falar · Solte para traduzir',
    stop: '⏹ Parar', start: '▶ Iniciar',
    stopConf: '⏹ Parar conferência', startConf: '▶ Iniciar conferência',
    speaker: 'Palestrante', youHear: 'Você ouve', speed: 'Velocidade:',
    capturing: '🎙 Capturando áudio — primeira tradução em ~8s',
    activeCapturing: '🎙 Gravando · Tradução contínua ativa',
    appLang: 'Idioma do app', continueGoogle: 'Continuar com Google',
    useEmail: 'Usar endereço de email', terms: 'Ao continuar você aceita os',
    termsLink: 'Termos', privacy: 'Privacidade',
    emptyConv: 'Toque em Iniciar e segure
🎙 A ou 🎙 B ao falar',
    emptyConf: 'Coloque o telefone perto do palestrante
e toque em Iniciar conferência',
    processing: 'Processando...', recording: '🔴 gravando',
  },
  CS: {
    chooseMode: 'Vyberte režim',
    conversation: 'Konverzace',
    convDesc: 'Dvě osoby se střídají. Každá drží mikrofon při mluvení.',
    conference: 'Konferenční režim',
    confDesc: 'Telefon poslouchá řečníka a vy dostáváte simultánní překlad.',
    chooseLanguage: 'Vyberte jazyk každé osoby',
    personA: 'Osoba A', personB: 'Osoba B', language: 'Jazyk',
    startSession: 'Zahájit relaci →', startConference: 'Zahájit konferenci →',
    back: '‹ Zpět', active: 'Relace aktivní', paused: 'Pozastaveno',
    translating: 'Překládám...', transcribing: 'Přepisuji...',
    liveTranscript: 'Živý přepis', liveTranslation: 'Živý překlad',
    tapToStart: 'Klepněte na Start pro začátek',
    holdToSpeak: 'Podržte 🎙 A nebo 🎙 B při mluvení · Pusťte pro překlad',
    stop: '⏹ Zastavit', start: '▶ Start',
    stopConf: '⏹ Zastavit konferenci', startConf: '▶ Zahájit konferenci',
    speaker: 'Řečník', youHear: 'Vy slyšíte', speed: 'Rychlost:',
    capturing: '🎙 Zachycování zvuku — první překlad za ~8s',
    activeCapturing: '🎙 Nahrávání · Průběžný překlad aktivní',
    appLang: 'Jazyk aplikace', continueGoogle: 'Pokračovat s Google',
    useEmail: 'Použít e-mailovou adresu', terms: 'Pokračováním souhlasíte s',
    termsLink: 'Podmínkami', privacy: 'Ochranou soukromí',
    emptyConv: 'Klepněte na Start a podržte
🎙 A nebo 🎙 B při mluvení',
    emptyConf: 'Položte telefon blízko řečníka
a klepněte na Zahájit konferenci',
    processing: 'Zpracovávám...', recording: '🔴 nahrávání',
  },
  PL: {
    chooseMode: 'Wybierz tryb',
    conversation: 'Rozmowa',
    convDesc: 'Dwie osoby na zmianę mówią. Każda przytrzymuje mikrofon podczas mówienia.',
    conference: 'Tryb konferencyjny',
    confDesc: 'Telefon słucha prelegenta i otrzymujesz tłumaczenie w czasie rzeczywistym.',
    chooseLanguage: 'Wybierz język każdej osoby',
    personA: 'Osoba A', personB: 'Osoba B', language: 'Język',
    startSession: 'Rozpocznij sesję →', startConference: 'Rozpocznij konferencję →',
    back: '‹ Wróć', active: 'Sesja aktywna', paused: 'Wstrzymano',
    translating: 'Tłumaczę...', transcribing: 'Transkrybuję...',
    liveTranscript: 'Transkrypcja na żywo', liveTranslation: 'Tłumaczenie na żywo',
    tapToStart: 'Dotknij Start aby rozpocząć',
    holdToSpeak: 'Przytrzymaj 🎙 A lub 🎙 B podczas mówienia · Puść aby przetłumaczyć',
    stop: '⏹ Zatrzymaj', start: '▶ Start',
    stopConf: '⏹ Zatrzymaj konferencję', startConf: '▶ Rozpocznij konferencję',
    speaker: 'Prelegent', youHear: 'Słyszysz', speed: 'Prędkość:',
    capturing: '🎙 Przechwytywanie dźwięku — pierwsze tłumaczenie za ~8s',
    activeCapturing: '🎙 Nagrywanie · Ciągłe tłumaczenie aktywne',
    appLang: 'Język aplikacji', continueGoogle: 'Kontynuuj z Google',
    useEmail: 'Użyj adresu e-mail', terms: 'Kontynuując akceptujesz',
    termsLink: 'Warunki', privacy: 'Prywatność',
    emptyConv: 'Dotknij Start i przytrzymaj
🎙 A lub 🎙 B podczas mówienia',
    emptyConf: 'Połóż telefon blisko prelegenta
i dotknij Rozpocznij konferencję',
    processing: 'Przetwarzam...', recording: '🔴 nagrywanie',
  },
  NL: {
    chooseMode: 'Kies modus',
    conversation: 'Gesprek',
    convDesc: 'Twee personen wisselen af. Elke persoon houdt zijn microfoon ingedrukt tijdens het spreken.',
    conference: 'Conferentiemodus',
    confDesc: 'De telefoon luistert naar de spreker en u ontvangt de vertaling in realtime.',
    chooseLanguage: 'Kies de taal van elke persoon',
    personA: 'Persoon A', personB: 'Persoon B', language: 'Taal',
    startSession: 'Sessie starten →', startConference: 'Conferentie starten →',
    back: '‹ Terug', active: 'Sessie actief', paused: 'Gepauzeerd',
    translating: 'Vertalen...', transcribing: 'Transcriberen...',
    liveTranscript: 'Live transcriptie', liveTranslation: 'Live vertaling',
    tapToStart: 'Tik op Start om te beginnen',
    holdToSpeak: 'Houd 🎙 A of 🎙 B ingedrukt tijdens spreken · Loslaten om te vertalen',
    stop: '⏹ Stoppen', start: '▶ Starten',
    stopConf: '⏹ Conferentie stoppen', startConf: '▶ Conferentie starten',
    speaker: 'Spreker', youHear: 'U hoort', speed: 'Snelheid:',
    capturing: '🎙 Audio vastleggen — eerste vertaling in ~8s',
    activeCapturing: '🎙 Opnemen · Continue vertaling actief',
    appLang: 'App-taal', continueGoogle: 'Doorgaan met Google',
    useEmail: 'E-mailadres gebruiken', terms: 'Door verder te gaan accepteert u de',
    termsLink: 'Voorwaarden', privacy: 'Privacy',
    emptyConv: 'Tik op Start en houd ingedrukt
🎙 A of 🎙 B tijdens spreken',
    emptyConf: 'Leg telefoon dicht bij spreker
en tik op Conferentie starten',
    processing: 'Verwerken...', recording: '🔴 opnemen',
  },
};

// Idiomas disponibles para la interfaz
const UI_LANG_OPTIONS = [
  { code: 'ES', name: 'Español', flag: '🇪🇸' },
  { code: 'EN', name: 'English', flag: '🇬🇧' },
  { code: 'FR', name: 'Français', flag: '🇫🇷' },
  { code: 'DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'PT', name: 'Português', flag: '🇵🇹' },
  { code: 'SK', name: 'Slovenčina', flag: '🇸🇰' },
  { code: 'CS', name: 'Čeština', flag: '🇨🇿' },
  { code: 'PL', name: 'Polski', flag: '🇵🇱' },
  { code: 'NL', name: 'Nederlands', flag: '🇳🇱' },
];

// ─── LOGIN ────────────────────────────────────────────────────────
function LoginScreen({ onLogin, t, uiLang, setUiLang }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.loginContainer}>
        {/* Selector idioma interfaz */}
        <View style={s.uiLangSelector}>
          {UI_LANG_OPTIONS.map(l => (
            <TouchableOpacity
              key={l.code}
              style={[s.uiLangBtn, uiLang === l.code && s.uiLangBtnActive]}
              onPress={() => setUiLang(l.code)}
            >
              <Text style={s.uiLangBtnText}>{l.flag}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.logoWrap}><Text style={s.logoEmoji}>🌐</Text></View>
        <Text style={s.appName}>Parlora AI</Text>
        <Text style={s.tagline}>Traducción simultánea{'\n'}para conversaciones reales</Text>
        <TouchableOpacity style={s.googleBtn} onPress={() => { warmUpBackend(); onLogin(); }}>
          <Text style={s.googleG}>G</Text>
          <Text style={s.googleBtnText}>{t.continueGoogle}</Text>
        </TouchableOpacity>
        <View style={s.dividerRow}>
          <View style={s.dividerLine}/><Text style={s.dividerText}>o</Text><View style={s.dividerLine}/>
        </View>
        <TouchableOpacity style={s.emailBtn} onPress={() => Alert.alert('Próximamente', 'Login con email en la próxima versión.')}>
          <Text style={s.emailBtnText}>{t.useEmail}</Text>
        </TouchableOpacity>
        <Text style={s.terms}>{t.terms} <Text style={s.termsLink}>{t.termsLink}</Text> y la <Text style={s.termsLink}>{t.privacy}</Text></Text>
      </View>
    </SafeAreaView>
  );
}

// ─── SETUP ───────────────────────────────────────────────────────
function SetupScreen({ onStart, t, uiLang, setUiLang }) {
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
        title: `⚠️ Pronunciación incorrecta en ${lang.name}`,
        desc: `Tu dispositivo no tiene la voz en ${lang.name} instalada. La traducción se pronunciará en otro idioma (posiblemente español o inglés).`,
        sections: [{ label: 'Cómo instalar la voz para pronunciación correcta:', steps: getInstallStepsTts(lang.name) }],
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
          <Text style={s.setupTitle}>{t.chooseMode}</Text>
          <Text style={s.setupSub}>¿Cómo vas a usar Parlora AI?</Text>
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

          <Text style={s.setupSub}>¿Qué hardware tienes disponible?</Text>

          <TouchableOpacity style={s.hardwareCard} onPress={() => setConfHardware('anc')}>
            <Text style={s.hardwareIcon}>📱🎧</Text>
            <View style={s.modeTextWrap}>
              <Text style={s.hardwareTitle}>Móvil cerca del ponente + Auricular</Text>
              <Text style={s.hardwareDesc}>Pon el móvil cerca del ponente. Tú llevas los auriculares y escuchas la traducción. Recomendado: volumen moderado.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.hardwareCard} onPress={() => setConfHardware('extmic')}>
            <Text style={s.hardwareIcon}>🎙️📱</Text>
            <View style={s.modeTextWrap}>
              <Text style={s.hardwareTitle}>Micrófono externo + Móvil</Text>
              <Text style={s.hardwareDesc}>Conecta un micrófono externo al móvil apuntado al ponente. La traducción sale por el altavoz. ✅ Mejor calidad, sin bucle de audio.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[s.hardwareCard, { borderColor: 'rgba(255,100,100,0.3)', backgroundColor: 'rgba(255,100,100,0.05)' }]} onPress={() => setConfHardware('risk')}>
            <Text style={s.hardwareIcon}>⚠️</Text>
            <View style={s.modeTextWrap}>
              <Text style={[s.hardwareTitle, { color: '#F0997B' }]}>Sin auriculares — solo el móvil</Text>
              <Text style={s.hardwareDesc}>La traducción saldrá por el altavoz. El micrófono puede captar la traducción. ⚠️ Calidad limitada, solo para pruebas.</Text>
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
          {confHardware === 'anc' ? '📱🎧 Móvil + Auricular' :
           confHardware === 'extmic' ? '🎙️ Micrófono externo' : '⚠️ Solo móvil'}
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
// Usa expo-av para grabar mientras el botón está pulsado
// Al soltar → Groq transcribe todo el audio → DeepL traduce → TTS
// Sin pérdida por pausas, sin STT nativo
function ConversationScreen({ config, onBack, t }) {
  const { langA, langB } = config;
  const langAObj = LANGUAGES.find(l => l.code === langA);
  const langBObj = LANGUAGES.find(l => l.code === langB);

  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [status, setStatus] = useState('Pausado');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranslation, setLastTranslation] = useState(null);
  const scrollRef = useRef(null);
  const isActiveRef = useRef(false);
  const recordingRef = useRef(null);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => {
    if (transcript.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  const startRecording = async (speaker) => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        isMeteringEnabled: false,
      });

      recordingRef.current = recording;
      setActiveSpeaker(speaker);
      setIsRecording(true);
      // Vibración corta — señal de que el micrófono está activo
      Vibration.vibrate(50);
    } catch (e) {
      console.log('Start recording error:', e);
    }
  };

  const stopRecordingAndTranslate = async () => {
    if (!recordingRef.current) return;
    const speaker = activeSpeaker;

    setIsRecording(false);
    setActiveSpeaker(null);
    setIsProcessing(true);
    setStatus('Transcribiendo...');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri || !speaker) { setIsProcessing(false); setStatus('Sesión activa'); return; }

      // Groq Whisper — transcribir audio completo
      const srcLang = speaker === 'A' ? langA : langB;
      const tgtLang = speaker === 'A' ? langB : langA;
      const srcLangObj = speaker === 'A' ? langAObj : langBObj;
      const tgtLangObj = speaker === 'A' ? langBObj : langAObj;

      const formData = new FormData();
      formData.append('audio', { uri, type: 'audio/m4a', name: 'conv.m4a' });
      formData.append('language', srcLangObj.voiceLocale.slice(0, 2));

      const transcribeRes = await fetch(`${BACKEND}/transcribe`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { text = '' } = await transcribeRes.json();

      if (!text.trim()) {
        setIsProcessing(false);
        setStatus('Sesión activa');
        return;
      }

      setStatus('Traduciendo...');

      // DeepL — traducir
      const translateRes = await fetch(`${BACKEND}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), target_lang: tgtLang }),
      });
      const { translatedText = '' } = await translateRes.json();

      if (!translatedText) { setIsProcessing(false); setStatus('Sesión activa'); return; }

      const line = {
        id: Date.now().toString(), speaker,
        original: text.trim(), translated: translatedText,
        srcFlag: srcLangObj.flag, tgtFlag: tgtLangObj.flag,
        ttsLocale: tgtLangObj.ttsLocale,
      };
      setTranscript(prev => [...prev.slice(-49), line]);
      setLastTranslation(line);
      Speech.speak(translatedText, { language: tgtLangObj.ttsLocale, rate: 0.95 });
      setStatus('Sesión activa');

    } catch (e) {
      console.log('Process error:', e);
      setStatus('Error — intenta de nuevo');
      setTimeout(() => setStatus('Sesión activa'), 2000);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSession = async () => {
    if (isActive) {
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch (e) {}
        recordingRef.current = null;
      }
      setIsActive(false); setStatus('Pausado'); Speech.stop();
      setIsRecording(false); setIsProcessing(false); setActiveSpeaker(null);
    } else {
      const ok = await requestMic();
      if (!ok) { Alert.alert('Permiso denegado', 'Necesitas permitir el micrófono.'); return; }
      warmUpBackend();
      setIsActive(true); setStatus('Sesión activa');
    }
  };

  const handlePressIn = async (speaker) => {
    if (!isActive || isProcessing) return;
    await startRecording(speaker);
  };

  const handlePressOut = async () => {
    if (!isActive) return;
    await stopRecordingAndTranslate();
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

      <View style={s.personsRow}>
        {[{ side: 'A', langObj: langAObj, color: '#818CF8' }, { side: 'B', langObj: langBObj, color: '#C4B5FD' }].map(({ side, langObj, color }) => (
          <View key={side} style={[s.personInfo, { borderColor: activeSpeaker === side ? color : 'rgba(255,255,255,0.08)' }]}>
            <Text style={s.personInfoIcon}>📱</Text>
            <Text style={[s.personInfoLabel, { color }]}>Persona {side}</Text>
            <Text style={s.personInfoLang}>{langObj.flag} {langObj.name}</Text>
            {activeSpeaker === side && (
              <View style={[s.speakingBadge, { backgroundColor: `${color}22` }]}>
                <Text style={[s.speakingText, { color }]}>{isRecording ? '🔴 grabando' : 'procesando...'}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {isProcessing && (
        <View style={s.partialBox}>
          <Text style={s.partialText}>⏳ {status}</Text>
        </View>
      )}

      <Text style={s.sectionLabel}>Transcripción en vivo</Text>
      <ScrollView ref={scrollRef} style={s.transcriptBox}>
        {transcript.length === 0 && (
          <Text style={s.emptyText}>{'Toca Iniciar y mantén pulsado\n🎙 A o 🎙 B mientras hablas'}</Text>
        )}
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
          style={[s.micBtn, {
            borderColor: 'rgba(129,140,248,0.4)',
            backgroundColor: activeSpeaker === 'A' ? 'rgba(129,140,248,0.3)' : 'rgba(129,140,248,0.1)'
          }, (!isActive || isProcessing) && s.micDisabled]}
          onPressIn={() => handlePressIn('A')}
          onPressOut={handlePressOut}
          disabled={!isActive || isProcessing}
        >
          <Text style={s.micIcon}>🎙</Text>
          <Text style={[s.micLabel, { color: '#818CF8' }]}>A</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.sessionBtn, isActive && s.sessionBtnActive]} onPress={toggleSession}>
          <Text style={s.sessionBtnText}>{isActive ? (t ? t.stop : '⏹ Parar') : (t ? t.start : '▶ Iniciar')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.micBtn, {
            borderColor: 'rgba(196,181,253,0.4)',
            backgroundColor: activeSpeaker === 'B' ? 'rgba(196,181,253,0.3)' : 'rgba(196,181,253,0.1)'
          }, (!isActive || isProcessing) && s.micDisabled]}
          onPressIn={() => handlePressIn('B')}
          onPressOut={handlePressOut}
          disabled={!isActive || isProcessing}
        >
          <Text style={s.micIcon}>🎙</Text>
          <Text style={[s.micLabel, { color: '#C4B5FD' }]}>B</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.micHint}>
        {isActive
          ? (isProcessing ? 'Procesando...' : 'Mantén pulsado 🎙 A o 🎙 B mientras hablas · Suelta para traducir')
          : 'Toca Iniciar para empezar'}
      </Text>
    </SafeAreaView>
  );
}

// ─── CONFERENCE SCREEN ────────────────────────────────────────────
// Chunks fijos de 8s — el siguiente empieza inmediatamente al parar el anterior
// TTS habla en paralelo mientras el siguiente chunk ya está grabando
function ConferenceScreen({ config, onBack, t }) {
  const { confSourceLang, confTargetLang, confHardware } = config;
  const srcObj = LANGUAGES.find(l => l.code === confSourceLang);
  const tgtObj = LANGUAGES.find(l => l.code === confTargetLang);

  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [status, setStatus] = useState('Pausado');
  const [lastTranslation, setLastTranslation] = useState(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const ttsSpeedRef = useRef(1.0);
  const [recordingLevel, setRecordingLevel] = useState(0); // 0-100 nivel de audio
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

  // ── Extraer pausas del metering para TTS ─────────────────────
  const extractPauses = (meteringHistory) => {
    const SILENCE_DB = -40;
    const MIN_PAUSE_MS = 500;
    const pauses = [];
    let silenceStart = null;
    const totalDuration = meteringHistory.length > 0
      ? meteringHistory[meteringHistory.length - 1].time : 8000;

    for (const { time, db } of meteringHistory) {
      if (db < SILENCE_DB) {
        if (!silenceStart) silenceStart = time;
      } else if (silenceStart !== null) {
        const duration = time - silenceStart;
        if (duration >= MIN_PAUSE_MS) {
          pauses.push({
            position: silenceStart / totalDuration,
            durationMs: Math.min(duration * 0.5, 800), // pausas más cortas en TTS
          });
        }
        silenceStart = null;
      }
    }
    return pauses;
  };

  // ── TTS con pausas y sin "..." ────────────────────────────────
  const speakTranslation = (translated, ttsLocale, pauses) => {
    const cleaned = translated.replace(/[.]{3,}/g, ' ').replace(/[ 	]+/g, ' ').trim();
    const finalRate = Math.max(0.5, Math.min(1.5, ttsSpeedRef.current));

    if (pauses.length === 0) {
      Speech.speak(cleaned, { language: ttsLocale, rate: finalRate });
      return;
    }

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
    if (lastWordIdx < words.length) {
      segments.push({ text: words.slice(lastWordIdx).join(' '), pauseAfterMs: 0 });
    }

    let delay = 0;
    for (const seg of segments) {
      if (!seg.text.trim()) continue;
      setTimeout(() => {
        if (isActiveRef.current) Speech.speak(seg.text, { language: ttsLocale, rate: finalRate });
      }, delay);
      delay += (seg.text.split(' ').length * (380 / finalRate)) + seg.pauseAfterMs;
    }
  };

  // ── Grabar chunk fijo de 8s ───────────────────────────────────
  const recordChunk = async () => {
    if (!isActiveRef.current) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        isMeteringEnabled: true,
      });

      const meteringHistory = [];
      const startTime = Date.now();

      // Metering visual + guardar historial para pausas
      meteringIntervalRef.current = setInterval(async () => {
        if (!isActiveRef.current) return;
        try {
          const st = await recording.getStatusAsync();
          if (!st.isRecording) return;
          const db = st.metering ?? -160;
          const elapsed = Date.now() - startTime;
          meteringHistory.push({ time: elapsed, db });
          // Nivel visual 0-100
          const level = Math.max(0, Math.min(100, (db + 60) * 2));
          setRecordingLevel(level);
        } catch (e) {}
      }, 100);

      // Esperar exactamente 8s
      await new Promise(resolve => setTimeout(resolve, 8000));

      clearInterval(meteringIntervalRef.current);
      setRecordingLevel(0);

      if (!isActiveRef.current) {
        try { await recording.stopAndUnloadAsync(); } catch (e) {}
        return;
      }

      // Parar y arrancar el siguiente INMEDIATAMENTE en paralelo
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
        method: 'POST', body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { text = '' } = await transcribeRes.json();
      if (!text.trim()) return;

      const translateRes = await fetch(`${BACKEND}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          target_lang: confTargetLang,
          context: lastContextRef.current || undefined,
        }),
      });
      const { translatedText = '' } = await translateRes.json();
      if (!translatedText) return;

      lastContextRef.current = text.trim().split(' ').slice(-5).join(' ');

      const line = {
        id: Date.now().toString(),
        original: text.trim(), translated: translatedText,
        srcFlag: srcObj.flag, tgtFlag: tgtObj.flag,
        ttsLocale: tgtObj.ttsLocale,
      };
      setTranscript(prev => [...prev.slice(-49), line]);
      setLastTranslation(line);
      setStatus('Sesión activa');

      const pauses = extractPauses(meteringHistory);
      speakTranslation(translatedText, tgtObj.ttsLocale, pauses);

    } catch (e) { console.log('Process error:', e.message); }
  };

  const toggleSession = async () => {
    if (isActive) {
      clearInterval(meteringIntervalRef.current);
      setIsActive(false); setStatus('Pausado');
      setRecordingLevel(0); Speech.stop();
      lastContextRef.current = ''; setChunkCount(0); chunkCountRef.current = 0;
    } else {
      const ok = await requestMic();
      if (!ok) { Alert.alert('Permiso denegado', 'Necesitas permitir el micrófono.'); return; }
      // Verificar TTS del idioma destino antes de iniciar
      const ttsVoices = await Speech.getAvailableVoicesAsync().catch(() => []);
      const ttsLangCode = confTargetLang.toLowerCase();
      const ttsOk = ttsVoices.length === 0 || 
        ttsVoices.some(v => (v.language || '').toLowerCase().startsWith(ttsLangCode.slice(0,2)));
      
      if (!ttsOk) {
        Alert.alert(
          '⚠️ Voz no disponible',
          `Tu dispositivo no tiene la voz en ${tgtObj.name} instalada. La traducción se pronunciará en otro idioma.\n\nPuedes continuar igualmente o instalar la voz primero en Ajustes → Gestión general → Idioma → Texto a voz.`,
          [
            { text: 'Instalar después', onPress: () => {} },
            { text: 'Continuar igualmente', onPress: () => {
              warmUpBackend();
              setIsActive(true); setStatus('Grabando...');
              setChunkCount(0); chunkCountRef.current = 0;
              recordChunk();
            }},
          ]
        );
        return;
      }

      warmUpBackend();
      setIsActive(true); setStatus('Grabando...');
      setChunkCount(0); chunkCountRef.current = 0;
      recordChunk();
    }
  };

  // Barra de nivel de audio visual
  const AudioLevelBar = () => (
    <View style={s.audioLevelContainer}>
      <View style={[s.audioLevelBar, { width: `${recordingLevel}%`, opacity: isActive ? 1 : 0 }]} />
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backBtnText}>‹ Volver</Text></TouchableOpacity>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>
            {isActive ? (chunkCount === 0 ? 'Captando audio...' : `Activo · ${chunkCount} chunks`) : 'Pausado'}
          </Text>
        </View>
        <TouchableOpacity style={[s.repeatBtn, !lastTranslation && s.repeatBtnDisabled]}
          onPress={() => { if (lastTranslation) { Speech.stop(); Speech.speak(lastTranslation.translated, { language: lastTranslation.ttsLocale, rate: ttsSpeedRef.current }); }}}
          disabled={!lastTranslation}>
          <Text style={s.repeatBtnIcon}>🔁</Text>
        </TouchableOpacity>
      </View>

      <View style={s.confInfoRow}>
        <View style={[s.confInfoCard, { borderColor: 'rgba(196,181,253,0.3)' }]}>
          <Text style={s.personInfoIcon}>🎤</Text>
          <Text style={[s.personInfoLabel, { color: '#C4B5FD' }]}>{t ? t.speaker : 'Ponente'}</Text>
          <Text style={s.personInfoLang}>{srcObj.flag} {srcObj.name}</Text>
        </View>
        <View style={s.confArrowWrap}>
          <Text style={s.confArrow}>→</Text>
          <Text style={s.confDelay}>~8s</Text>
        </View>
        <View style={[s.confInfoCard, { borderColor: 'rgba(129,140,248,0.3)' }]}>
          <Text style={s.personInfoIcon}>{confHardware === 'extmic' ? '🎙️' : '📱'}</Text>
          <Text style={[s.personInfoLabel, { color: '#818CF8' }]}>{t ? t.youHear : 'Tú escuchas'}</Text>
          <Text style={s.personInfoLang}>{tgtObj.flag} {tgtObj.name}</Text>
        </View>
      </View>

      {/* Indicador de grabación */}
      {isActive && (
        <View style={s.recordingIndicator}>
          <View style={[s.recordingDot, { backgroundColor: chunkCount === 0 ? '#EF4444' : '#34C759' }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.recordingText}>
              {chunkCount === 0
                ? '🎙 Captando audio del ponente — primera traducción en ~8s'
                : '🎙 Grabando · Traducción continua activa'}
            </Text>
            <AudioLevelBar />
          </View>
        </View>
      )}

      {/* Selector velocidad */}
      <View style={s.speedSelector}>
        <Text style={s.speedLabel}>{t ? t.speed : 'Velocidad:'}</Text>
        {[{val: 0.5, label: '0.5x'}, {val: 0.75, label: '0.75x'}, {val: 1.0, label: '1x'}, {val: 1.25, label: '1.25x'}, {val: 1.5, label: '1.5x'}].map(opt => (
          <TouchableOpacity
            key={opt.val}
            style={[s.speedBtn, ttsSpeed === opt.val && s.speedBtnActive]}
            onPress={() => { setTtsSpeed(opt.val); ttsSpeedRef.current = opt.val; }}
          >
            <Text style={[s.speedBtnText, ttsSpeed === opt.val && s.speedBtnTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {confHardware === 'risk' && (
        <View style={[s.warningBox, { marginHorizontal: 14, marginBottom: 8 }]}>
          <Text style={s.warningText}>⚠️ Sin hardware óptimo — la calidad puede ser baja</Text>
        </View>
      )}

      <Text style={s.sectionLabel}>Traducción en vivo</Text>
      <ScrollView ref={scrollRef} style={s.transcriptBox}>
        {transcript.length === 0 && (
          <Text style={s.emptyText}>{'Pon el móvil cerca del ponente\ny toca Iniciar conferencia'}</Text>
        )}
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
          <Text style={s.sessionBtnText}>{isActive ? (t ? t.stopConf : '⏹ Parar conferencia') : (t ? t.startConf : '▶ Iniciar conferencia')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.micHint}>
        {isActive
          ? 'Chunks de 8s · TTS en paralelo · Sin pausas entre traducciones'
          : confHardware === 'anc' ? 'Pon el móvil cerca del ponente · Lleva los auriculares puestos'
          : confHardware === 'extmic' ? 'Conecta el micrófono externo y apúntalo al ponente'
          : 'Pon el móvil cerca del ponente'}
      </Text>
    </SafeAreaView>
  );
}

// ─── APP ──────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState('login');
  const [sessionConfig, setSessionConfig] = useState(null);
  const [uiLang, setUiLang] = useState('ES');
  const t = UI_LANGS[uiLang] || UI_LANGS.ES;

  if (screen === 'login') return <LoginScreen onLogin={() => setScreen('setup')} t={t} uiLang={uiLang} setUiLang={setUiLang} />;
  if (screen === 'setup') return <SetupScreen onStart={(c) => { setSessionConfig(c); setScreen('session'); }} t={t} uiLang={uiLang} setUiLang={setUiLang} />;
  if (screen === 'session') {
    if (sessionConfig.mode === 'conference') return <ConferenceScreen config={sessionConfig} onBack={() => setScreen('setup')} t={t} />;
    return <ConversationScreen config={sessionConfig} onBack={() => setScreen('setup')} t={t} />;
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
  uiLangSelector: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  uiLangBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  uiLangBtnActive: { backgroundColor: 'rgba(129,140,248,0.2)', borderColor: '#818CF8' },
  uiLangBtnText: { fontSize: 18 },
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