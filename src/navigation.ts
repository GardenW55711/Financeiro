import type { NavigatorScreenParams } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TabParamList = {
  Inicio: undefined;
  Lancamentos: { categoryId?: string; accountId?: string; ym?: string } | undefined;
  ContasFixas: undefined;
  Calendario: undefined;
  Ajustes: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Detalhe: { id?: string };
  ContaFixa: { id?: number };
  Bancos: undefined;
};

export function useNav() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}
