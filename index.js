import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useStore, selectIsAuthenticated } from '@/store';
import { restoreSession } from '@/services/authService';

// Screens
import LoginScreen from '@/screens/LoginScreen';
import TranslationScreen from '@/screens/TranslationScreen';

// Lazy imports para las otras pantallas (se añadirán en siguientes sprints)
const EarbudsScreen = () => null;
const HistoryScreen = () => null;
const SettingsScreen = () => null;

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(13,13,20,0.97)',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: '#818CF8',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.28)',
        tabBarLabelStyle: { fontSize: 9, fontWeight: '600', letterSpacing: 0.05 },
      }}
    >
      <Tab.Screen
        name="Traducir"
        component={TranslationScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon emoji="🌐" color={color} /> }}
      />
      <Tab.Screen
        name="Auriculares"
        component={EarbudsScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon emoji="🎧" color={color} /> }}
      />
      <Tab.Screen
        name="Historial"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon emoji="📜" color={color} /> }}
      />
      <Tab.Screen
        name="Ajustes"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon emoji="⚙️" color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 18, opacity: color === '#818CF8' ? 1 : 0.4 }}>{emoji}</Text>;
}

export default function App() {
  const isAuthenticated = useStore(selectIsAuthenticated);
  const isLoading = useStore(s => s.isLoading);
  const setUser = useStore(s => s.setUser);
  const setLoading = useStore(s => s.setLoading);

  // Intentar restaurar sesión al arrancar
  useEffect(() => {
    restoreSession().then(session => {
      if (session) {
        setUser(session.profile, session.token);
      }
      setLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#818CF8" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={TabNavigator} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#0D0D14',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
