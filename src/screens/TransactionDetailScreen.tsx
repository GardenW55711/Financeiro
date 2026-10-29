import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Chip, Field, Label, Loading, PrimaryButton, Screen, Segmented, TextButton, s as ui } from '../components/ui';
import { C } from '../theme';
import { RootStackParamList, useNav } from '../navigation';
import {
  accountLabel, addRuleFrom, allTags, deleteTransaction, getPaySettings, getTransaction, insertManual, listAccounts,
  listCategories, markNotTransfer, parseTags, saveMeta, Tx, updateManual,
} from '../db';
import { guessCategory } from '../lib/categories';
import { REASON_TEXT, TransferReason } from '../lib/transfers';
import { Category } from '../lib/categories';
import { longDate, todayYmd } from '../lib/dates';
import { cycleOf } from '../lib/paydays';
import { brl, moneyInput, parseMoney } from '../lib/format';

export default function TransactionDetailScreen() {
  const nav = useNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Detalhe'>>();
  const isNew = !params?.id;
  const [tx, setTx] = useState<Tx | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [accName, setAccName] = useState('');
  const [autoCycle, setAutoCycle] = useState<'c5' | 'c20'>('c20');

  // campos editáveis
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [note, setNote] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [cycle, setCycle] = useState<'auto' | 'c5' | 'c20'>('auto');
  const [remember, setRemember] = useState(false);
  // só para lançamento manual
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [kind, setKind] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, tg, st] = await Promise.all([listCategories(), allTags(), getPaySettings()]);
      setCats(c);
      setTagOptions(tg);
      if (params?.id) {
        const t = await getTransaction(params.id);
        if (!t) return;
        setTx(t);
        setCategoryId(t.category_id);
        setTags(parseTags(t.tags));
        setNote(t.note ?? '');
        setDisplayName(t.display_name ?? '');
        setCycle(t.cycle_override === 'c5' || t.cycle_override === 'c20' ? t.cycle_override : 'auto');
        setDesc(t.description);
        setAmount(moneyInput(Math.abs(t.amount)));
        setDate(t.date);
        setKind(t.type);
        setAutoCycle(cycleOf(t.date, st).key);
        const accs = await listAccounts();
        const a = accs.find((x) => x.id === t.account_id);
        setAccName(a ? `${a.bank_name ?? ''} · ${accountLabel(a)}` : 'Lançado à mão');
      } else {
        setAutoCycle(cycleOf(todayYmd(), st).key);
      }
    })();
  }, [params?.id]);

  if (!isNew && !tx) return <Loading />;
  const manual = isNew || tx?.source === 'manual';

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const addTag = () => {
    let t = newTag.trim().replace(/\s+/g, '-').toLowerCase();
    if (!t) return;
    if (!t.startsWith('#')) t = `#${t}`;
    if (!tagOptions.includes(t)) setTagOptions([...tagOptions, t]);
    if (!tags.includes(t)) setTags([...tags, t]);
    setNewTag('');
  };

  const save = async () => {
    setSaving(true);
    try {
      let id = tx?.id;
      if (manual) {
        const v = parseMoney(amount);
        if (!desc.trim() || !Number.isFinite(v) || v <= 0) {
          Alert.alert('Faltou informação', 'Preencha a descrição e um valor maior que zero.');
          return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          Alert.alert('Data inválida', 'Use o formato AAAA-MM-DD, por exemplo 2026-10-28.');
          return;
        }
        const signed = kind === 'DEBIT' ? -v : v;
        if (id) await updateManual(id, { date, description: desc.trim(), amount: signed, type: kind });
        else id = await insertManual({ account_id: null, date, description: desc.trim(), amount: signed, type: kind });
      }
      if (!id) return;
      await saveMeta(id, {
        category_id: categoryId,
        tags,
        note: note.trim() || null,
        display_name: displayName.trim() || null,
        cycle_override: cycle === 'auto' ? null : cycle,
      });
      if (remember && tx) {
        const n = await addRuleFrom(tx.description, categoryId, tags);
        if (n > 0) Alert.alert('Regra criada', `Também apliquei em ${n} lançamento(s) parecido(s) que estavam sem categoria.`);
      }
      nav.goBack();
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!tx) return;
    Alert.alert('Apagar lançamento?', 'Isso não pode ser desfeito.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => { await deleteTransaction(tx.id); nav.goBack(); } },
    ]);
  };

  const spendCats = cats;

  return (
    <Screen edges={['bottom']}>
      {manual ? (
        <View style={{ gap: 16 }}>
          <Segmented options={[{ value: 'DEBIT', label: 'Gasto' }, { value: 'CREDIT', label: 'Entrada' }]} value={kind} onChange={setKind} />
          <Field label="Descrição" value={desc} onChangeText={setDesc} placeholder="Ex.: Feira, Uber, Presente" />
          <Field label="Valor (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Ex.: 45,90" />
          <Field label="Data" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" hint="Formato ano-mês-dia, por exemplo 2026-10-28." />
        </View>
      ) : tx ? (
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 4 }}>
          <Text style={{ fontSize: 36, fontWeight: '800', color: tx.type === 'CREDIT' ? C.green : C.ink }}>
            {tx.type === 'CREDIT' ? '+ ' : '− '}{brl(Math.abs(tx.amount))}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink, textAlign: 'center' }}>{tx.description}</Text>
          <Text style={{ fontSize: 13, color: C.muted }}>{longDate(tx.date)} · {accName}</Text>
          {tx.total_installments && tx.total_installments > 1 ? (
            <Text style={{ fontSize: 12, color: C.muted }}>Parcela {tx.installment_number} de {tx.total_installments}</Text>
          ) : null}
          <Text style={{ fontSize: 12, color: C.muted, backgroundColor: C.track, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 4 }}>
            Importado automaticamente via Pluggy
          </Text>
        </View>
      ) : null}

      {!manual && tx ? (
        tx.category_id === 'transferencia' && categoryId === 'transferencia' ? (
          <View style={{ backgroundColor: C.track, borderRadius: 16, padding: 14, gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>⇄ Transferência entre suas contas</Text>
            <Text style={{ fontSize: 12, color: C.ink2, lineHeight: 17 }}>
              Não conta como gasto nem como entrada.
              {tx.transfer_reason && REASON_TEXT[tx.transfer_reason as TransferReason]
                ? ` O app reconheceu porque ${REASON_TEXT[tx.transfer_reason as TransferReason]}.`
                : ''}
            </Text>
            <TextButton
              title="Não é transferência minha"
              color={C.danger}
              onPress={async () => {
                const cat = tx.type === 'DEBIT' ? guessCategory(tx.pluggy_category, tx.description) : null;
                await markNotTransfer(tx.id, cat === 'transferencia' ? null : cat);
                nav.goBack();
              }}
            />
          </View>
        ) : categoryId !== 'transferencia' ? (
          <TextButton title="⇄ Isto é transferência entre minhas contas" color={C.green} onPress={() => setCategoryId('transferencia')} />
        ) : null
      ) : null}

      {!manual ? (
        <Field label="Nome para exibição" optional value={displayName} onChangeText={setDisplayName} placeholder="Ex.: Conserto da bicicleta" />
      ) : null}

      <View style={{ gap: 10 }}>
        <Label right="uma por lançamento · vai para o gráfico">Categoria</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {spendCats.map((c) => (
            <Chip key={c.id} label={c.name} color={c.color} active={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
          ))}
        </View>
        {categoryId && cats.find((c) => c.id === categoryId)?.excluded ? (
          <Text style={ui.hint}>Esta categoria não entra no gráfico de gastos (evita contar o mesmo dinheiro duas vezes).</Text>
        ) : null}
      </View>

      <View style={{ gap: 10 }}>
        <Label right="quantas quiser · para filtrar depois">Tags</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tagOptions.map((t) => <Chip key={t} label={t} active={tags.includes(t)} onPress={() => toggleTag(t)} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={newTag}
            onChangeText={setNewTag}
            onSubmitEditing={addTag}
            placeholder="Nova tag (ex.: viagem)"
            placeholderTextColor={C.faint}
            accessibilityLabel="Nova tag"
            style={[ui.input, { flex: 1 }]}
          />
          <Pressable onPress={addTag} accessibilityRole="button" accessibilityLabel="Adicionar tag" style={[ui.iconBtn, { width: 48, height: 48, borderRadius: 14 }]}>
            <Ionicons name="add" size={22} color={C.ink} />
          </Pressable>
        </View>
      </View>

      <Field label="Observação" value={note} onChangeText={setNote} multiline placeholder="Ex.: Dividido com o João, ele me devolve metade"
        style={{ minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }} />

      <View style={{ gap: 10 }}>
        <Label right={`automático: ${autoCycle === 'c5' ? '5º dia útil' : 'dia 20'}`}>Sai de qual pagamento?</Label>
        <Segmented
          options={[{ value: 'auto', label: 'Pela data' }, { value: 'c5', label: '5º dia útil' }, { value: 'c20', label: 'Dia 20' }]}
          value={cycle}
          onChange={setCycle}
        />
      </View>

      {!manual && tx ? (
        <Pressable onPress={() => setRemember(!remember)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.line }}>
          <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={24} color={C.green} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>Lembrar para os próximos</Text>
            <Text style={ui.hint}>Lançamentos com “{tx.description}” já entram com esta categoria e tags.</Text>
          </View>
        </Pressable>
      ) : null}

      <PrimaryButton title="Salvar" onPress={save} loading={saving} />
      {tx && manual ? <TextButton title="Apagar lançamento" color={C.danger} onPress={remove} /> : null}
    </Screen>
  );
}
