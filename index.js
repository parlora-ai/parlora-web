import { registerRootComponent } from 'expo';
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView
} from 'react-native';

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

function MainScreen() {
  const [isActive, setIsActive] = useState(false);
  const [activeTab, setActiveTab] = useState('translate');
  const [transcript, setTranscript] = useState([
    { id: '1', speaker: 'A', original: 'Hola, ¿cómo estás?', translated: 'Hi, how are you?' },
    { id: '2', speaker: 'B', original: 'I am great, thanks!', translated: '¡Muy bien, gracias!' },
  ]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.appTitle}>PARLORA AI</Text>
        <View style={[s.statusBadge, isActive && s.statusBadgeActive]}>
          <View style={[s.statusDot, isActive && s.statusDotActive]} />
          <Text style={[s.statusText, isActive && s.statusTextActive]}>
            {isActive ? 'Sesión activa' : 'Pausado'}
          </Text>
        </View>
      </View>

      <View style={s.earbudsRow}>
        <View style={[s.earbudCard, { borderColor: 'rgba(129,140,248,0.3)' }]}>
          <Text style={[s.earbudLabel, { color: '#818CF8' }]}>Auricular A</Text>
          <Text style={s.earbudLang}>🇪🇸 Español</Text>
          <Text style={s.earbudArrow}>↓ traduce a</Text>
          <Text style={s.earbudLang}>🇬🇧 Inglés</Text>
          <Text style={s.volText}>Vol: 80%</Text>
        </View>
        <View style={[s.earbudCard, { borderColor: 'rgba(196,181,253,0.3)' }]}>
          <Text style={[s.earbudLabel, { color: '#C4B5FD' }]}>Auricular B</Text>
          <Text style={s.earbudLang}>🇬🇧 Inglés</Text>
          <Text style={s.earbudArrow}>↓ traduce a</Text>
          <Text style={s.earbudLang}>🇪🇸 Español</Text>
          <Text style={s.volText}>Vol: 75%</Text>
        </View>
      </View>

      <Text style={s.sectionLabel}>Transcripción en vivo</Text>
      <ScrollView style={s.transcriptBox}>
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

      <View style={s.micArea}>
        <TouchableOpacity
          style={[s.micBtn, isActive ? s.micActive : s.micInactive]}
          onPress={() => setIsActive(!isActive)}
        >
          <Text style={{ fontSize: 28 }}>🎙</Text>
        </TouchableOpacity>
        <Text style={s.micHint}>
          {isActive ? 'Traducción activa · Toca para pausar' : 'Toca para iniciar'}
        </Text>
      </View>

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

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  return <MainScreen />;
}

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
  earbudsRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 10, marginBottom: 14 },
  earbudCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderRadius: 18, padding: 12 },
  earbudLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.08, marginBottom: 8, textTransform: 'uppercase' },
  earbudLang: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  earbudArrow: { fontSize: 10, color: 'rgba(255,255,255,0.2)', marginVertical: 3 },
  volText: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.08, marginHorizontal: 14, marginBottom: 6, textTransform: 'uppercase' },
  transcriptBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', marginHorizontal: 14, padding: 10 },
  transcriptLine: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  speakerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, alignSelf: 'flex-start', marginTop: 2 },
  speakerText: { fontSize: 9, fontWeight: '700' },
  originalText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  translatedText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },
  micArea: { alignItems: 'center', paddingVertical: 16, gap: 8 },
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