import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Chip, Field, H2, Loading, Notice, PrimaryButton, RowDivider, Screen, Segmented, SwitchRow, TextButton, Title, s as ui } from '../components/ui';
import { C } from '../theme';
import {
  addCategory, deleteCategory, deleteRule, getItemIds, getPaySettings, getSetting, listCategories, listRules,
  setItemIds, setPaySettings, wipeAll,
} from '../db';
import { clearCredentials, getClientId, hasSecret, saveCredentials, syncAll } from '../pluggy';
import { Category, CATEGORY_COLORS, DEFAULT_CATEGORIES, Rule } from '../lib/categories';
import { addMonths, shortDate, todayYmd, ymOf } from '../lib/dates';
import { day20Payment, fifthBusinessDay, PaySettings } from '../lib/paydays';
import { checkForUpdate, currentVersion, downloadAndInstall } from '../updater';

export default function SettingsScreen() {
  const [loaded, setLoaded] = useState(false);
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [secretSaved, setSecretSaved] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [pay, setPay] = useState<PaySettings | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [newCat, setNewCat] = useState('');
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [syncing, setSyncing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    const [id, hs, it, ps, cs, rs, w] = await Promise.all([
      getClientId(), hasSecret(), getItemIds(), getPaySettings(), listCategories(), listRules(), getSetting('last_sync_warnings'),
    ]);
    setClientId(id ?? '');
    setSecretSaved(hs);
    setItems(it);
    setPay(ps);
    setCats(cs);
    setRules(rs);
    try { setWarnings(w ? JSON.parse(w) : []); } catch { setWarnings([]); }
    setLoaded(true);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!loaded || !pay) return <Loading />;

  const updatePay = async (p: PaySettings) => {
    setPay(p);
    await setPaySettings(p);
  };

  const saveKeys = async () => {
    if (!clientId.trim()) return Alert.alert('Faltou o Client ID');
    if (!secret.trim() && !secretSaved) return Alert.alert('Faltou o Client Secret');
    await saveCredentials(clientId, secret.trim() || null);
    setSecret('');
    setSecretSaved(true);
    Alert.alert('Chaves salvas', 'Elas ficam guardadas no cofre do celular, só neste aparelho.');
  };

  const addItem = async () => {
    const v = newItem.trim();
    if (!/^[0-9a-f-]{36}$/i.test(v)) return Alert.alert('ID inválido', 'O ID do item tem 36 caracteres, no formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.');
    if (items.includes(v)) return setNewItem('');
    const next = [...items, v];
    setItems(next);
    setNewItem('');
    await setItemIds(next);
  };

  const removeItem = (id: string) => {
    Alert.alert('Remover este banco?', 'Os lançamentos já baixados continuam no app.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { const n = items.filter((x) => x !== id); setItems(n); await setItemIds(n); } },
    ]);
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await syncAll();
      setWarnings(r.warnings);
      Alert.alert('Tudo certo!', `${r.accounts} conta(s) lidas e ${r.newTx} lançamento(s) novo(s).`);
    } catch (e: any) {
      Alert.alert('Não deu para sincronizar', String(e?.message ?? e));
    } finally {
      setSyncing(false);
    }
  };

  const checkUpdate = async () => {
    setChecking(true);
    try {
      const info = await checkForUpdate();
      if (!info) {
        Alert.alert('Tudo em dia', `Você já está na versão mais nova (${currentVersion()}).`);
      } else {
        Alert.alert(`Versão ${info.version} disponível`, 'Quer baixar e instalar agora? Seus dados continuam.', [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Atualizar', onPress: () => downloadAndInstall(info) },
        ]);
      }
    } catch {
      Alert.alert('Sem conexão', 'Não consegui consultar o GitHub agora. Tente de novo mais tarde.');
    } finally {
      setChecking(false);
    }
  };

  const wipe = () => {
    Alert.alert('Apagar todos os dados?', 'Lançamentos, contas fixas, regras e configurações deste aparelho serão apagados. As chaves da Pluggy também.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar tudo', style: 'destructive', onPress: async () => { await wipeAll(); await clearCredentials(); load(); } },
    ]);
  };

  const now = ymOf(todayYmd());
  const next5 = [0, 1].map((i) => shortDate(fifthBusinessDay(addMonths(now, i), pay)));
  const next20 = [0, 1].map((i) => shortDate(day20Payment(addMonths(now, i), pay)));
  const isDefault = (id: string) => DEFAULT_CATEGORIES.some((c) => c.id === id);

  return (
    <Screen>
      <Title>Ajustes</Title>

      <H2>Meus pagamentos</H2>
      <Card style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>5º dia útil</Text>
        <SwitchRow label="Sábado conta como dia útil" value={pay.countSaturday} onChange={(v) => updatePay({ ...pay, countSaturday: v })} />
        <SwitchRow label="Pular feriados nacionais" value={pay.skipHolidays} onChange={(v) => updatePay({ ...pay, skipHolidays: v })} />
        <Text style={ui.hint}>Próximas datas: {next5.join(' · ')}</Text>
      </Card>
      <Card style={{ gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>Dia 20</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>Se cair em fim de semana ou feriado</Text>
        <Segmented
          options={[{ value: 'antecipar', label: 'Antecipa' }, { value: 'adiar', label: 'Adia' }]}
          value={pay.rule20}
          onChange={(v) => updatePay({ ...pay, rule20: v })}
        />
        <Text style={ui.hint}>Próximas datas: {next20.join(' · ')}</Text>
      </Card>

      <H2>Conexão com os bancos (Pluggy)</H2>
      <Notice
        tone="info"
        title="Como conseguir essas informações"
        text="Use o Meu Pluggy (grátis para uso pessoal, até 5 bancos). O passo a passo está no README do projeto no GitHub. Toque para abrir a explicação da Pluggy."
        onPress={() => Linking.openURL('https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use')}
      />
      <Card style={{ gap: 14 }}>
        <Field label="Client ID" value={clientId} onChangeText={setClientId} autoCapitalize="none" autoCorrect={false} placeholder="Cole aqui o Client ID" />
        <Field
          label="Client Secret"
          value={secret}
          onChangeText={setSecret}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={secretSaved ? '•••••••• (já salvo — cole outro para trocar)' : 'Cole aqui o Client Secret'}
          hint="Fica guardado no cofre do celular. Nunca vai para o GitHub nem para outro lugar."
        />
        <PrimaryButton title="Salvar chaves" onPress={saveKeys} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={ui.label}>Bancos conectados (IDs dos itens)</Text>
        {items.length === 0 ? <Text style={ui.hint}>Nenhum ainda. Cole o ID de cada banco que aparece em “Connected Items” no painel da Pluggy.</Text> : null}
        {items.map((id) => (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="business-outline" size={18} color={C.teal} />
            <Text style={{ flex: 1, fontSize: 12, color: C.ink2, fontFamily: 'monospace' }} numberOfLines={1}>{id}</Text>
            <Pressable onPress={() => removeItem(id)} accessibilityRole="button" accessibilityLabel="Remover banco" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={20} color={C.danger} />
            </Pressable>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={newItem}
            onChangeText={setNewItem}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ID do item"
            placeholderTextColor={C.faint}
            accessibilityLabel="ID do item"
            style={[ui.input, { flex: 1 }]}
          />
          <Pressable onPress={addItem} accessibilityRole="button" accessibilityLabel="Adicionar banco" style={[ui.iconBtn, { width: 48, height: 48, borderRadius: 14 }]}>
            <Ionicons name="add" size={22} color={C.ink} />
          </Pressable>
        </View>
        <PrimaryButton title="Testar e sincronizar agora" onPress={sync} loading={syncing} />
      </Card>
      {warnings.map((w) => <Notice key={w} title="Atenção" text={w} />)}

      <H2>Categorias</H2>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cats.map((c) => (
            <Chip
              key={c.id}
              label={c.excluded ? `${c.name} (fora do gráfico)` : c.name}
              color={c.color}
              onPress={() => {
                if (isDefault(c.id)) return Alert.alert(c.name, 'Esta é uma categoria padrão do app.');
                Alert.alert(`Excluir “${c.name}”?`, 'Os lançamentos dela ficam sem categoria.', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Excluir', style: 'destructive', onPress: async () => { await deleteCategory(c.id); load(); } },
                ]);
              }}
            />
          ))}
        </View>
        <RowDivider />
        <Field label="Nova categoria" value={newCat} onChangeText={setNewCat} placeholder="Ex.: Pet, Academia" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {CATEGORY_COLORS.map((col) => (
            <Pressable key={col} onPress={() => setNewColor(col)} accessibilityRole="button" accessibilityLabel={`Cor ${col}`}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: col, borderWidth: newColor === col ? 3 : 0, borderColor: C.ink }} />
          ))}
        </View>
        <PrimaryButton
          title="Adicionar categoria"
          disabled={!newCat.trim()}
          onPress={async () => { await addCategory(newCat.trim(), newColor); setNewCat(''); load(); }}
        />
      </Card>

      <H2>Regras automáticas</H2>
      <Card style={{ gap: 8 }}>
        {rules.length === 0 ? <Text style={ui.hint}>Crie regras marcando “Lembrar para os próximos” ao classificar um lançamento.</Text> : null}
        {rules.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 13, color: C.ink }}>
              “{r.pattern}” → {cats.find((c) => c.id === r.category_id)?.name ?? 'sem categoria'}
            </Text>
            <Pressable onPress={async () => { await deleteRule(r.id); load(); }} accessibilityRole="button" accessibilityLabel="Apagar regra" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close-circle-outline" size={22} color={C.muted} />
            </Pressable>
          </View>
        ))}
      </Card>

      <H2>Sobre o app</H2>
      <Card style={{ gap: 10 }}>
        <Text style={{ fontSize: 14, color: C.ink }}>Financeiro · versão {currentVersion()}</Text>
        <PrimaryButton title="Verificar atualização" onPress={checkUpdate} loading={checking} />
        <Text style={ui.hint}>O app também confere sozinho toda vez que é aberto e mostra um aviso no Início.</Text>
      </Card>

      <H2>Dados</H2>
      <Text style={ui.hint}>Todos os dados ficam só neste celular. Se você desinstalar o app, eles são apagados.</Text>
      <TextButton title="Apagar todos os dados do app" color={C.danger} onPress={wipe} />
    </Screen>
  );
}
