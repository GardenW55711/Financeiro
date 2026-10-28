import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Chip, Empty, IconButton, Loading, MonthNav, Notice, RowDivider, Screen, Title } from '../components/ui';
import { C } from '../theme';
import { TabParamList, useNav } from '../navigation';
import { Account, accountLabel, listAccounts, listCategories, listTransactions, parseTags, Tx } from '../db';
import { Category } from '../lib/categories';
import { longDate, monthEnd, monthStart, todayYmd, ymOf, YM } from '../lib/dates';
import { brl, normalize } from '../lib/format';

export default function TransactionsScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<TabParamList, 'Lancamentos'>>();
  const [ym, setYm] = useState<YM>(() => ymOf(todayYmd()));
  const [cat, setCat] = useState<string | null>(null);
  const [acc, setAcc] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Quando outra tela manda um filtro (ex.: tocou numa categoria no Início)
  useEffect(() => {
    const p = route.params;
    if (!p) return;
    if (p.ym) setYm(ymOf(`${p.ym}-01`));
    setCat(p.categoryId ?? null);
    setAcc(p.accountId ?? null);
  }, [route.params]);

  const load = useCallback(async () => {
    const [t, c, a] = await Promise.all([
      listTransactions({ from: monthStart(ym), to: monthEnd(ym) }), listCategories(), listAccounts(),
    ]);
    setTxs(t);
    setCats(c);
    setAccounts(a);
  }, [ym]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const filtered = useMemo(() => {
    if (!txs) return [];
    const q = normalize(search);
    return txs.filter((t) => {
      if (acc && t.account_id !== acc) return false;
      if (cat === 'none' && (t.category_id || t.type !== 'DEBIT')) return false;
      if (cat && cat !== 'none' && t.category_id !== cat) return false;
      if (q) {
        const hay = normalize(`${t.description} ${t.display_name ?? ''} ${t.note ?? ''} ${parseTags(t.tags).join(' ')} ${catById.get(t.category_id ?? '')?.name ?? ''}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [txs, search, cat, acc, catById]);

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    filtered.forEach((t) => map.set(t.date, [...(map.get(t.date) || []), t]));
    return Array.from(map.entries());
  }, [filtered]);

  if (!txs) return <Loading />;

  const noneCount = txs.filter((t) => t.type === 'DEBIT' && !t.category_id).length;
  const usedCats = cats.filter((c) => txs.some((t) => t.category_id === c.id));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Title>Lançamentos</Title>
        <IconButton name="add" label="Adicionar gasto manual" filled onPress={() => nav.navigate('Detalhe', {})} />
      </View>
      <MonthNav ym={ym} onChange={setYm} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14 }}>
        <Ionicons name="search" size={18} color={C.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome, tag ou observação"
          placeholderTextColor={C.faint}
          accessibilityLabel="Buscar lançamentos"
          style={{ flex: 1, fontSize: 15, color: C.ink, minHeight: 44 }}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
        <Chip label="Todos" active={!cat && !acc} onPress={() => { setCat(null); setAcc(null); }} />
        {noneCount > 0 ? <Chip label={`Sem categoria · ${noneCount}`} dashed active={cat === 'none'} onPress={() => setCat(cat === 'none' ? null : 'none')} /> : null}
        {accounts.map((a) => (
          <Chip key={a.id} label={accountLabel(a)} active={acc === a.id} onPress={() => setAcc(acc === a.id ? null : a.id)} />
        ))}
        {usedCats.map((c) => (
          <Chip key={c.id} label={c.name} color={c.color} active={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />
        ))}
      </ScrollView>

      {noneCount > 0 && cat !== 'none' ? (
        <Notice title={`${noneCount} gasto(s) sem categoria`} text="Toque para ver só esses e classificar." onPress={() => setCat('none')} />
      ) : null}

      {groups.length === 0 ? <Empty text={txs.length ? 'Nada encontrado com esses filtros.' : 'Nenhum lançamento neste mês. Sincronize no Início ou adicione um gasto no botão +.'} /> : null}

      {groups.map(([date, list]) => {
        const out = list.filter((t) => t.type === 'DEBIT').reduce((a, t) => a + Math.abs(t.amount), 0);
        return (
          <View key={date} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink2 }}>{longDate(date)}</Text>
              {out ? <Text style={{ fontSize: 13, fontWeight: '600', color: C.muted }}>− {brl(out)}</Text> : null}
            </View>
            <Card pad={false}>
              {list.map((t, i) => {
                const c = t.category_id ? catById.get(t.category_id) : undefined;
                const a = t.account_id ? accById.get(t.account_id) : undefined;
                const tags = parseTags(t.tags);
                const isIn = t.type === 'CREDIT';
                const none = !c && !isIn;
                return (
                  <View key={t.id}>
                    {i > 0 ? <RowDivider /> : null}
                    <Pressable onPress={() => nav.navigate('Detalhe', { id: t.id })} style={{ flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' }}>
                      <View style={{
                        width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isIn ? C.greenSoft : none ? C.warnSoft : `${c?.color ?? C.faint}22`,
                        borderWidth: none ? 1.5 : 0, borderStyle: 'dashed', borderColor: C.warn,
                      }}>
                        <Text style={{ fontWeight: '800', fontSize: 15, color: isIn ? C.greenDark : none ? C.warnDark : c?.color ?? C.ink }}>
                          {isIn ? '+' : (c?.name ?? '?').charAt(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{t.display_name || t.description}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: none ? C.warnDark : C.ink2 }}>
                            {isIn ? 'Entrada' : c?.name ?? 'Sem categoria'}
                          </Text>
                          {tags.map((tg) => (
                            <Text key={tg} style={{ fontSize: 11, fontWeight: '700', color: C.ink2, backgroundColor: C.track, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9 }}>{tg}</Text>
                          ))}
                          <Text style={{ fontSize: 12, color: C.muted }}>{a ? accountLabel(a) : 'Manual'}</Text>
                          {t.total_installments && t.total_installments > 1 ? (
                            <Text style={{ fontSize: 11, color: C.muted }}>Parcela {t.installment_number}/{t.total_installments}</Text>
                          ) : null}
                        </View>
                        {t.note ? <Text style={{ fontSize: 12, color: C.ink2, fontStyle: 'italic' }}>“{t.note}”</Text> : null}
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: isIn ? C.green : C.ink }}>
                        {isIn ? '+ ' : '− '}{brl(Math.abs(t.amount))}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
