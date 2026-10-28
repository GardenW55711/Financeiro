import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Chip, Field, Label, Loading, PrimaryButton, Screen, Segmented, TextButton, s as ui } from '../components/ui';
import { C } from '../theme';
import { RootStackParamList, useNav } from '../navigation';
import { Account, accountLabel, deleteBill, getBill, listAccounts, listCategories, saveBill } from '../db';
import { Category } from '../lib/categories';
import { moneyInput, parseMoney } from '../lib/format';

export default function BillEditScreen() {
  const nav = useNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ContaFixa'>>();
  const [loaded, setLoaded] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [cards, setCards] = useState<Account[]>([]);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [variable, setVariable] = useState<'fixo' | 'varia'>('fixo');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [cycle, setCycle] = useState<'c5' | 'c20'>('c20');
  const [keyword, setKeyword] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [c, accs] = await Promise.all([listCategories(), listAccounts()]);
      setCats(c.filter((x) => !x.excluded || x.id === 'fatura'));
      setCards(accs.filter((a) => a.type === 'CREDIT'));
      if (params?.id) {
        const b = await getBill(params.id);
        if (b) {
          setName(b.name);
          setCategoryId(b.category_id);
          setVariable(b.variable ? 'varia' : 'fixo');
          setAmount(moneyInput(b.amount));
          setDueDay(String(b.due_day));
          setCycle(b.cycle);
          setKeyword(b.keyword);
          setAccountId(b.account_id);
        }
      }
      setLoaded(true);
    })();
  }, [params?.id]);

  if (!loaded) return <Loading />;

  const save = async () => {
    const day = Number(dueDay);
    const v = amount.trim() ? parseMoney(amount) : 0;
    if (!name.trim()) return Alert.alert('Faltou o nome', 'Dê um nome para a conta, por exemplo “Aluguel”.');
    if (!Number.isInteger(day) || day < 1 || day > 31) return Alert.alert('Dia inválido', 'O vencimento precisa ser um dia de 1 a 31.');
    if (!accountId && (!Number.isFinite(v) || v < 0)) return Alert.alert('Valor inválido', 'Digite um valor como 900,00.');
    await saveBill({
      id: params?.id,
      name: name.trim(),
      category_id: categoryId,
      amount: Number.isFinite(v) ? v : 0,
      variable: variable === 'varia' ? 1 : 0,
      due_day: day,
      cycle,
      keyword: keyword.trim(),
      account_id: accountId,
    });
    nav.goBack();
  };

  const remove = () => {
    if (!params?.id) return;
    Alert.alert('Excluir conta fixa?', 'O histórico de lançamentos não é apagado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await deleteBill(params.id!); nav.goBack(); } },
    ]);
  };

  return (
    <Screen edges={['bottom']}>
      <Text style={ui.title}>{params?.id ? 'Editar conta fixa' : 'Nova conta fixa'}</Text>
      <Field label="Nome da conta" value={name} onChangeText={setName} placeholder="Ex.: Aluguel, Internet, Celular" />

      <View style={{ gap: 10 }}>
        <Label>Categoria</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cats.map((c) => (
            <Chip key={c.id} label={c.name} color={c.color} active={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
          ))}
        </View>
      </View>

      {cards.length ? (
        <View style={{ gap: 10 }}>
          <Label right="opcional">É a fatura de um cartão?</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Não" active={!accountId} onPress={() => setAccountId(null)} />
            {cards.map((a) => (
              <Chip key={a.id} label={`${a.bank_name ?? ''} ${accountLabel(a)}`.trim()} active={accountId === a.id} onPress={() => setAccountId(a.id)} />
            ))}
          </View>
          {accountId ? <Text style={ui.hint}>O valor passa a ser a fatura atual do cartão, que vem do banco.</Text> : null}
        </View>
      ) : null}

      {!accountId ? (
        <View style={{ gap: 10 }}>
          <Label>Valor</Label>
          <Segmented options={[{ value: 'fixo', label: 'Valor fixo' }, { value: 'varia', label: 'Muda todo mês' }]} value={variable} onChange={setVariable} />
          <Field
            label={variable === 'varia' ? 'Valor aproximado (R$)' : 'Valor (R$)'}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={variable === 'varia' ? 'Ex.: 140,00' : 'Ex.: 900,00'}
            hint={variable === 'varia' ? 'Usado como estimativa no calendário até a conta ser paga.' : undefined}
          />
        </View>
      ) : null}

      <Field label="Dia do vencimento" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" placeholder="Ex.: 10" maxLength={2} style={{ width: 140 }}
        hint="Se o mês for mais curto (ex.: dia 31 em fevereiro), o app usa o último dia do mês." />

      <View style={{ gap: 10 }}>
        <Label>Pago com qual pagamento?</Label>
        <Segmented options={[{ value: 'c5', label: '5º dia útil' }, { value: 'c20', label: 'Dia 20' }]} value={cycle} onChange={setCycle} />
        <Text style={ui.hint}>O valor entra no que você precisa separar quando cair o pagamento {cycle === 'c5' ? 'do 5º dia útil' : 'do dia 20'}.</Text>
      </View>

      <Field label="Como aparece no extrato" optional value={keyword} onChangeText={setKeyword} autoCapitalize="characters"
        placeholder="Ex.: IMOBILIARIA, ENEL, CLARO"
        hint="Quando o app achar esse nome num gasto perto do vencimento, marca a conta como paga sozinho." />

      <PrimaryButton title="Salvar conta" onPress={save} />
      {params?.id ? <TextButton title="Excluir conta fixa" color={C.danger} onPress={remove} /> : null}
    </Screen>
  );
}
