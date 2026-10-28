// Lançar ou editar um investimento à mão (para o que o banco não compartilha).
import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Chip, Field, Label, PrimaryButton, Screen, s as ui } from '../components/ui';
import { C } from '../theme';
import { RootStackParamList, useNav } from '../navigation';
import { getInvestment, saveManualInvestment } from '../db';
import { getQuote } from '../market';
import { Investment } from '../lib/investments';
import { moneyInput, parseMoney } from '../lib/format';
import { todayYmd } from '../lib/dates';

type Kind = 'acao' | 'fii' | 'etf' | 'rf' | 'fundo' | 'prev' | 'outro';
const KINDS: { id: Kind; label: string; type: string; subtype: string | null }[] = [
  { id: 'acao', label: 'Ação', type: 'EQUITY', subtype: 'STOCK' },
  { id: 'fii', label: 'FII', type: 'EQUITY', subtype: 'REAL_ESTATE_FUND' },
  { id: 'etf', label: 'ETF', type: 'ETF', subtype: null },
  { id: 'rf', label: 'Renda fixa', type: 'FIXED_INCOME', subtype: null },
  { id: 'fundo', label: 'Fundo', type: 'MUTUAL_FUND', subtype: null },
  { id: 'prev', label: 'Previdência', type: 'SECURITY', subtype: 'RETIREMENT' },
  { id: 'outro', label: 'Outro', type: 'OTHER', subtype: null },
];
const RF_SUBTYPES = [['CDB', 'CDB'], ['LCI', 'LCI'], ['LCA', 'LCA'], ['TREASURY', 'Tesouro'], ['DEBENTURES', 'Debênture'], ['CRI', 'CRI'], ['CRA', 'CRA']];
const INDEXES = [['CDI', '% do CDI'], ['IPCA', 'IPCA +'], ['PRE', 'Prefixado'], ['SELIC', 'Selic']];

/** "dd/mm/aaaa" → "aaaa-mm-dd" */
function toYmd(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function toBr(s: string | null): string {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export default function InvestmentEditScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<RootStackParamList, 'Investimento'>>();
  const id = route.params?.id;
  const [kind, setKind] = useState<Kind>('acao');
  const [rfSub, setRfSub] = useState('CDB');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [qty, setQty] = useState('');
  const [avg, setAvg] = useState(''); // preço médio
  const [invested, setInvested] = useState('');
  const [current, setCurrent] = useState('');
  const [bank, setBank] = useState('');
  const [idx, setIdx] = useState('CDI');
  const [rateVal, setRateVal] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    nav.setOptions({ title: id ? 'Editar investimento' : 'Novo investimento' });
    if (!id) return;
    getInvestment(id).then((i) => {
      if (!i) return;
      const k = KINDS.find((k) => k.type === i.type && (k.subtype === i.subtype || !k.subtype)) ?? KINDS[6];
      setKind(i.type === 'FIXED_INCOME' ? 'rf' : i.subtype === 'REAL_ESTATE_FUND' ? 'fii' : k.id);
      if (i.type === 'FIXED_INCOME' && i.subtype) setRfSub(i.subtype);
      setName(i.name);
      setCode(i.code ?? '');
      setQty(i.quantity ? String(i.quantity).replace('.', ',') : '');
      setAvg(i.quantity && i.invested ? moneyInput(i.invested / i.quantity) : '');
      setInvested(moneyInput(i.invested));
      setCurrent(moneyInput(i.balance));
      setBank(i.bank_name ?? '');
      if (i.index_type) setIdx(i.index_type);
      const m = (i.rate ?? '').match(/[\d,.]+/);
      if (m) setRateVal(m[0]);
      setBuyDate(toBr(i.purchase_date));
      setDueDate(toBr(i.due_date));
    });
  }, [id]);

  const listed = kind === 'acao' || kind === 'fii' || kind === 'etf';

  const save = async () => {
    const k = KINDS.find((x) => x.id === kind)!;
    const q = parseMoney(qty);
    const a = parseMoney(avg);
    const inv = listed ? (q > 0 && a > 0 ? q * a : NaN) : parseMoney(invested);
    let cur = parseMoney(current);
    const ticker = code.trim().toUpperCase();
    if (listed && !/^[A-Z]{4}\d{1,2}$/.test(ticker)) return Alert.alert('Código inválido', 'Use o código da bolsa, como ITUB4 ou MXRF11.');
    if (listed && !(q > 0)) return Alert.alert('Informe a quantidade');
    if (!listed && !name.trim()) return Alert.alert('Dê um nome', 'Ex.: CDB Banco Inter 2027');
    setSaving(true);
    try {
      if (listed && !(cur > 0)) {
        // Tenta pegar o preço atual na brapi
        const qt = await getQuote(ticker).catch(() => null);
        if (qt?.price) cur = qt.price * q;
        else if (inv > 0) cur = inv;
      }
      if (!(cur > 0)) cur = inv > 0 ? inv : 0;
      const r = parseMoney(rateVal);
      const rate = !listed && r > 0
        ? idx === 'CDI' ? `${moneyInput(r).replace(',00', '')}% do CDI` : idx === 'IPCA' ? `IPCA + ${moneyInput(r).replace(',00', '')}%` : idx === 'SELIC' ? `Selic + ${moneyInput(r).replace(',00', '')}%` : `${moneyInput(r).replace(',00', '')}% ao ano`
        : null;
      const item: Investment = {
        id: id ?? `manual-${Date.now().toString(36)}`,
        item_id: 'manual',
        bank_name: bank.trim() || null,
        name: listed ? (name.trim() || ticker) : name.trim(),
        type: k.type,
        subtype: kind === 'rf' ? rfSub : k.subtype,
        balance: cur,
        profit: inv > 0 ? cur - inv : null,
        due_date: toYmd(dueDate),
        rate,
        updated_at: new Date().toISOString(),
        code: listed ? ticker : null,
        quantity: listed ? q : null,
        invested: inv > 0 ? inv : null,
        rate_12m: null,
        rate_month: null,
        purchase_date: toYmd(buyDate) ?? (id ? null : todayYmd()),
        issuer: null,
        index_type: listed ? null : idx,
        source: 'manual',
      };
      await saveManualInvestment(item);
      nav.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text style={{ fontSize: 13, color: C.muted, lineHeight: 18 }}>
        Para investimentos que não aparecem pela Pluggy. Eles ficam guardados só neste celular e entram no painel da Carteira.
      </Text>

      <Label>Tipo</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {KINDS.map((k) => <Chip key={k.id} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />)}
      </View>

      {listed ? (
        <>
          <Field label="Código na bolsa" value={code} onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" maxLength={7} placeholder={kind === 'fii' ? 'Ex.: MXRF11' : 'Ex.: ITUB4'} />
          <Field label="Nome" value={name} onChangeText={setName} optional placeholder="Ex.: Itaú Unibanco" />
          <Field label="Quantidade" value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="Ex.: 100" />
          <Field label="Preço médio de compra (R$)" value={avg} onChangeText={setAvg} keyboardType="decimal-pad" placeholder="Ex.: 32,50" hint="Quanto você pagou em média por ação/cota." />
          <Field label="Valor atual total (R$)" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" optional hint="Deixe vazio: com o token da brapi, o app calcula pela cotação do dia." />
        </>
      ) : (
        <>
          {kind === 'rf' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {RF_SUBTYPES.map(([v, l]) => <Chip key={v} label={l} active={rfSub === v} onPress={() => setRfSub(v)} />)}
            </View>
          ) : null}
          <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: CDB Inter liquidez diária" />
          <Field label="Quanto você aplicou (R$)" value={invested} onChangeText={setInvested} keyboardType="decimal-pad" />
          <Field label="Quanto vale hoje (R$)" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" hint="Olhe no app do banco. Se deixar vazio, conta o valor aplicado." />
          <Label>Rendimento</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INDEXES.map(([v, l]) => <Chip key={v} label={l} active={idx === v} onPress={() => setIdx(v)} />)}
          </View>
          <Field label="Taxa" value={rateVal} onChangeText={setRateVal} keyboardType="decimal-pad" optional placeholder={idx === 'CDI' ? 'Ex.: 110 (de 110% do CDI)' : 'Ex.: 6,5'} />
          <Field label="Vencimento" value={dueDate} onChangeText={setDueDate} optional placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" />
        </>
      )}
      <Field label="Data da compra/aplicação" value={buyDate} onChangeText={setBuyDate} optional placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" hint="Usada para estimar o imposto de renda." />
      <Field label="Banco ou corretora" value={bank} onChangeText={setBank} optional placeholder="Ex.: XP, Nubank, Inter" />
      <PrimaryButton title="Salvar" onPress={save} loading={saving} />
      <Text style={[ui.hint, { textAlign: 'center' }]}>Você pode editar ou apagar depois, tocando no investimento.</Text>
    </Screen>
  );
}
