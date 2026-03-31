import { registerRootComponent } from 'expo';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView, Platform,
  PermissionsAndroid
} from 'react-native';
import Voice from '@react-native-voice/voice';
import * as Speech from 'expo-speech';

// ─── Pedir permiso micrófono ──────────────────────────────────────
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

// ─── Login ────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={s.logoWrap}><Text style={s.logoEmoji}>🌐</Text></View>
        <Text style={s.appName}>Parlora AI</Text>
        <Text style={s.tagline}>Traducción simultánea{'\n'}para conversaciones reales</Text>
        <TouchableOpacity style={s.googleBtn} onPress={onLogin}>
          <Text style={s.googleG}>G</Text>
          <Text style={s.googleBtnText}>Continuar con Google</Text>
        </TouchableOpacity>
        <View style={s.dividerRow}>
          <View style={s.dividerLine} /><Text style={s.dividerText}>o</Text><View style={s.dividerLine} />
        </View>
        <TouchableOpacity style={s.emailBtn} onPress={() => Alert.alert('Próximamente', 'Login con email en la próxima versión.')}>
          <Text style={s.emailBtnText}>Usar correo electrónico</Text>
        </TouchableOpacity>
        <Text style={s.terms}>Al continuar aceptas los <Text style={s.termsLink}>Términos</Text> y la <Text style={s.termsLink}>Privacidad</Text></Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
function MainScreen() {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState('translate');
  const [transcript, setTranscript] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState('A');
  const [partialText, setPartialText] = useState('');
  const [status, setStatus] = useState('Pausado');
  const scrollRef = useRef(null);
  const activeRef = useRef(false);
  const speakerRef = useRef('A');

  useEffect(() => { speakerRef.current = activeSpeaker; }, [activeSpeaker]);
  useEffect(() => { activeRef.current = isActive; }, [isActive]);

  // ── Voice listeners ──
  useEffect(() => {
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);

    Voice.onSpeechPartialResults = (e) => {
      setPartialText(e.value?.[0] ?? '');
    };

    Voice.onSpeechResults = async (e) => {
      const text = e.value?.[0] ?? '';
      setPartialText('');
      if (text.trim()) await doTranslate(text.trim(), speakerRef.current);
      // continuar escuchando
      if (activeRef.current) startVoice();
    };

    Voice.onSpeechError = () => {
      setIsListening(false);
      if (activeRef.current) setTimeout(() => startVoice(), 800);
    };

    return () => { Voice.destroy().then(Voice.removeAllListeners); };
  }, []);

  useEffect(() => {
    if (transcript.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [transcript]);

  const startVoice = async () => {
    try {
      const locale = speakerRef.current === 'A' ? 'es-ES' : 'en-US';
      await Voice.start(locale);
    } catch (e) { console.log('Voice start error:', e); }
  };

  const stopVoice = async () => {
    try { await Voice.stop(); await Voice.destroy(); } catch (e) {}
    setPartialText('');
    setIsListening(false);
  };

  const doTranslate = async (text, speaker) => {
    setStatus('Traduciendo...');
    const sourceLang = speaker === 'A' ? 'ES' : 'EN';
    const targetLang = speaker === 'A' ? 'EN' : 'ES';
    try {
      const res = await fetch('https://parlora-backend.onrender.com/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source_lang: sourceLang, target_lang: targetLang, engine: 'deepl' }),
      });
      const data = await res.json();
      const translated = data.translatedText ?? '(sin traducción)';
      setTranscript(prev => [...prev.slice(-49), { id: Date.now().toString(), speaker, original: text, translated }]);
      Speech.speak(translated, { language: speaker === 'A' ? 'en-US' : 'es-ES', rate: 0.95 });
      setStatus('Sesión activa');
    } catch {
      setStatus('Error de red');
      setTimeout(() => setStatus('Sesión activa'), 2000);
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
      startVoice();
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.appTitle}>PARLORA AI</Text>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>{status}</Text>
        </View>
      </View>

      <View style={s.earbudsRow}>
        {['A','B'].map(side => (
          <TouchableOpacity
            key={side}
            style={[s.earbudCard, { borderColor: activeSpeaker === side ? (side==='A'?'#818CF8':'#C4B5FD') : 'rgba(255,255,255,0.08)' }]}
            onPress={() => { setActiveSpeaker(side); if (isActive) { stopVoice(); setTimeout(startVoice, 300); } }}
          >
            <Text style={[s.earbudLabel, { color: side==='A'?'#818CF8':'#C4B5FD' }]}>
              {activeSpeaker===side && isActive ? '🎙 ' : ''}{`Auricular ${side}`}
            </Text>
            <Text style={s.earbudLang}>{side==='A' ? '🇪🇸 Español' : '🇬🇧 Inglés'}</Text>
            <Text style={s.earbudArrow}>↓ traduce a</Text>
            <Text style={s.earbudLang}>{side==='A' ? '🇬🇧 Inglés' : '🇪🇸 Español'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {partialText ? (
        <View style={s.partialBox}><Text style={s.partialText}>🎙 {partialText}</Text></View>
      ) : null}

      <Text style={s.sectionLabel}>Transcripción en vivo</Text>
      <ScrollView ref={scrollRef} style={s.transcriptBox}>
        {transcript.length === 0 && (
          <Text style={s.emptyText}>Toca el micrófono y habla{'\n'}La traducción aparecerá aquí</Text>
        )}
        {transcript.map(line => (
          <View key={line.id} style={s.transcriptLine}>
            <View style={[s.speakerBadge, { backgroundColor: line.speaker==='A' ? 'rgba(129,140,248,0.15)' : 'rgba(196,181,253,0.15)' }]}>
              <Text style={[s.speakerText, { color: line.speaker==='A'?'#818CF8':'#C4B5FD' }]}>{line.speaker}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.originalText}>{line.original}</Text>
              <Text style={s.translatedText}>{line.translated}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={s.micArea}>
        <View style={s.speakerSelector}>
          {['A','B'].map(side => (
            <TouchableOpacity key={side} style={[s.speakerBtn, activeSpeaker===side && (side==='A'?s.speakerBtnActiveA:s.speakerBtnActiveB)]} onPress={() => setActiveSpeaker(side)}>
              <Text style={[s.speakerBtnText, activeSpeaker===side && { color: side==='A'?'#818CF8':'#C4B5FD' }]}>{side} habla</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[s.micBtn, isActive ? s.micActive : s.micInactive, isListening && s.micListening]} onPress={toggleSession}>
          <Text style={{ fontSize: 28 }}>{isActive ? (isListening ? '⏸' : '🎙') : '🎙'}</Text>
        </TouchableOpacity>
        <Text style={s.micHint}>{isActive ? `Escuchando a ${activeSpeaker} · Toca para pausar` : 'Toca para iniciar'}</Text>
      </View>

      <View style={s.tabBar}>
        {[{key:'translate',icon:'🌐',label:'Traducir'},{key:'earbuds',icon:'🎧',label:'Auriculares'},{key:'history',icon:'📜',label:'Historial'},{key:'settings',icon:'⚙️',label:'Ajustes'}].map(tab => (
          <TouchableOpacity key={tab.key} style={s.tabItem} onPress={() => setActiveTab(tab.key)}>
            <Text style={[s.tabIcon, activeTab===tab.key && s.tabIconActive]}>{tab.icon}</Text>
            <Text style={[s.tabLabel, activeTab===tab.key && s.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  return <MainScreen />;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0D0D14'},
  container:{flex:1,alignItems:'center',justifyContent:'center',padding:32},
  logoWrap:{width:80,height:80,borderRadius:24,backgroundColor:'rgba(99,102,241,0.15)',borderWidth:0.5,borderColor:'rgba(99,102,241,0.3)',alignItems:'center',justifyContent:'center',marginBottom:20},
  logoEmoji:{fontSize:36},
  appName:{fontSize:32,fontWeight:'700',color:'#fff',letterSpacing:-0.5,marginBottom:8},
  tagline:{fontSize:15,color:'rgba(255,255,255,0.35)',textAlign:'center',lineHeight:22,marginBottom:48},
  googleBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'#fff',borderRadius:14,paddingVertical:15,width:'100%',marginBottom:12},
  googleG:{fontSize:18,fontWeight:'700',color:'#4285F4'},
  googleBtnText:{fontSize:16,fontWeight:'600',color:'#1A1A2E'},
  dividerRow:{flexDirection:'row',alignItems:'center',gap:10,width:'100%',marginBottom:12},
  dividerLine:{flex:1,height:0.5,backgroundColor:'rgba(255,255,255,0.1)'},
  dividerText:{fontSize:12,color:'rgba(255,255,255,0.25)'},
  emailBtn:{paddingVertical:15,width:'100%',alignItems:'center',borderRadius:14,borderWidth:0.5,borderColor:'rgba(255,255,255,0.08)'},
  emailBtnText:{fontSize:15,color:'rgba(255,255,255,0.4)',fontWeight:'500'},
  terms:{fontSize:11,color:'rgba(255,255,255,0.2)',textAlign:'center',lineHeight:18,marginTop:28},
  termsLink:{color:'rgba(99,102,241,0.7)'},
  header:{alignItems:'center',paddingTop:12,paddingBottom:10,gap:6},
  appTitle:{fontSize:11,fontWeight:'600',color:'rgba(255,255,255,0.3)',letterSpacing:0.14},
  statusBadge:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:4,borderRadius:20,borderWidth:0.5,borderColor:'rgba(255,255,255,0.1)'},
  statusBadgeActive:{borderColor:'rgba(52,199,89,0.3)',backgroundColor:'rgba(52,199,89,0.08)'},
  statusDot:{width:6,height:6,borderRadius:3,backgroundColor:'rgba(255,255,255,0.3)'},
  statusDotActive:{backgroundColor:'#34C759'},
  statusText:{fontSize:12,fontWeight:'500',color:'rgba(255,255,255,0.4)'},
  statusTextActive:{color:'#34C759'},
  earbudsRow:{flexDirection:'row',paddingHorizontal:14,gap:10,marginBottom:10},
  earbudCard:{flex:1,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:1,borderRadius:18,padding:12},
  earbudLabel:{fontSize:10,fontWeight:'700',letterSpacing:0.08,marginBottom:8,textTransform:'uppercase'},
  earbudLang:{fontSize:12,color:'rgba(255,255,255,0.7)',marginBottom:2},
  earbudArrow:{fontSize:10,color:'rgba(255,255,255,0.2)',marginVertical:3},
  partialBox:{marginHorizontal:14,marginBottom:6,backgroundColor:'rgba(99,102,241,0.1)',borderRadius:10,padding:8},
  partialText:{fontSize:12,color:'#818CF8',fontStyle:'italic'},
  sectionLabel:{fontSize:10,fontWeight:'600',color:'rgba(255,255,255,0.3)',letterSpacing:0.08,marginHorizontal:14,marginBottom:6,textTransform:'uppercase'},
  transcriptBox:{flex:1,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:16,borderWidth:0.5,borderColor:'rgba(255,255,255,0.07)',marginHorizontal:14,padding:10},
  emptyText:{fontSize:12,color:'rgba(255,255,255,0.25)',textAlign:'center',marginTop:20,lineHeight:22},
  transcriptLine:{flexDirection:'row',gap:8,marginBottom:10},
  speakerBadge:{paddingHorizontal:6,paddingVertical:2,borderRadius:5,alignSelf:'flex-start',marginTop:2},
  speakerText:{fontSize:9,fontWeight:'700'},
  originalText:{fontSize:12,color:'rgba(255,255,255,0.7)',marginBottom:2},
  translatedText:{fontSize:11,color:'rgba(255,255,255,0.35)',fontStyle:'italic'},
  micArea:{alignItems:'center',paddingVertical:12,gap:8},
  speakerSelector:{flexDirection:'row',gap:8},
  speakerBtn:{paddingHorizontal:16,paddingVertical:6,borderRadius:20,borderWidth:0.5,borderColor:'rgba(255,255,255,0.1)',backgroundColor:'rgba(255,255,255,0.04)'},
  speakerBtnActiveA:{borderColor:'#818CF8',backgroundColor:'rgba(129,140,248,0.15)'},
  speakerBtnActiveB:{borderColor:'#C4B5FD',backgroundColor:'rgba(196,181,253,0.15)'},
  speakerBtnText:{fontSize:12,color:'rgba(255,255,255,0.4)',fontWeight:'600'},
  micBtn:{width:64,height:64,borderRadius:32,alignItems:'center',justifyContent:'center'},
  micActive:{backgroundColor:'#EF4444'},
  micInactive:{backgroundColor:'rgba(255,255,255,0.08)',borderWidth:0.5,borderColor:'rgba(255,255,255,0.12)'},
  micListening:{backgroundColor:'#818CF8'},
  micHint:{fontSize:11,color:'rgba(255,255,255,0.25)',fontWeight:'500'},
  tabBar:{flexDirection:'row',justifyContent:'space-around',paddingVertical:10,borderTopWidth:0.5,borderTopColor:'rgba(255,255,255,0.06)',backgroundColor:'rgba(13,13,20,0.97)'},
  tabItem:{alignItems:'center',gap:2},
  tabIcon:{fontSize:20,opacity:0.3},
  tabIconActive:{opacity:1},
  tabLabel:{fontSize:9,fontWeight:'600',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:0.04},
  tabLabelActive:{color:'#818CF8'},
});

registerRootComponent(App);