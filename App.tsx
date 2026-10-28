import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from './src/db';
import { C } from './src/theme';
import { Loading } from './src/components/ui';
import type { RootStackParamList, TabParamList } from './src/navigation';
import HomeScreen from './src/screens/HomeScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import TransactionDetailScreen from './src/screens/TransactionDetailScreen';
import BillsScreen from './src/screens/BillsScreen';
import BillEditScreen from './src/screens/BillEditScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AccountsScreen from './src/screens/AccountsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import InvestmentsScreen from './src/screens/InvestmentsScreen';
import AssetScreen from './src/screens/AssetScreen';
import GuideScreen from './src/screens/GuideScreen';
import CalculatorsScreen from './src/screens/CalculatorsScreen';
import InvestmentEditScreen from './src/screens/InvestmentEditScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, primary: C.green, card: '#fff', text: C.ink } };

const ICONS: Record<keyof TabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Inicio: ['home', 'home-outline'],
  Carteira: ['pie-chart', 'pie-chart-outline'],
  Lancamentos: ['list', 'list-outline'],
  ContasFixas: ['receipt', 'receipt-outline'],
  Calendario: ['calendar', 'calendar-outline'],
  Ajustes: ['options', 'options-outline'],
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="Carteira" component={InvestmentsScreen} options={{ title: 'Carteira' }} />
      <Tab.Screen name="Lancamentos" component={TransactionsScreen} options={{ title: 'Lançamentos' }} />
      <Tab.Screen name="ContasFixas" component={BillsScreen} options={{ title: 'Contas fixas' }} />
      <Tab.Screen name="Calendario" component={CalendarScreen} options={{ title: 'Calendário' }} />
      <Tab.Screen name="Ajustes" component={SettingsScreen} options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb().then(() => setReady(true)).catch((e) => setError(String(e?.message ?? e)));
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>Não consegui abrir os dados do app</Text>
        <Text style={{ marginTop: 8, color: C.muted, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }
  if (!ready) return <Loading />;

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={theme}>
        <StatusBar style="dark" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: C.bg },
            headerShadowVisible: false,
            headerTintColor: C.green,
            headerTitleStyle: { color: C.ink, fontWeight: '800' },
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Detalhe" component={TransactionDetailScreen} options={{ title: 'Lançamento' }} />
          <Stack.Screen name="ContaFixa" component={BillEditScreen} options={{ title: 'Conta fixa' }} />
          <Stack.Screen name="Bancos" component={AccountsScreen} options={{ title: 'Bancos e cartões' }} />
          <Stack.Screen name="Ativo" component={AssetScreen} options={{ title: 'Investimento' }} />
          <Stack.Screen name="Guia" component={GuideScreen} options={{ title: 'Guia de análise' }} />
          <Stack.Screen name="Calculadoras" component={CalculatorsScreen} options={{ title: 'Calculadoras' }} />
          <Stack.Screen name="Investimento" component={InvestmentEditScreen} options={{ title: 'Novo investimento' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
