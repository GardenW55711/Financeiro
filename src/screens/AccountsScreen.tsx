import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bar, Card, Dot, Empty, H2, Loading, MonthNav, RowDivider, Screen } from '../components/ui';
import { C } from '../theme';
import { useNav } from '../navigation';
import { loadMonth, MonthData } from '../data';
import { Account, accountLabel } from '../db';
import BankNameModal from '../components/BankNameModal';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ddmm, shortDate, todayYmd, ymKey, ymOf, YM } from '../lib/dates';
import { groupByCategory, isSpending, sum } from '../lib/analysis';
import { brl, pct } from '../lib/format';

export default function AccountsScreen() {
  const nav = useNav();
  const [ym, setYm] = useState<YM>(() => ymOf(todayYmd()));
  const [data, setData] = useState<MonthData | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const load = useCallback(async () => setData(await loadMonth(ym)), [ym]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <Loading />;
  const inMonth = data.txs.filter((t) => t.date >= data.periods.mes.from && t.date <= data.periods.mes.to);
  const cards = data.accounts.filter((a) => a.type === 'CREDIT');
  const banks = data.accounts.filter((a) => a.type === 'BANK');

  return (
    <Screen edges={['bottom']}>
      <Text style={{ fontSize: 13, color: C.muted, lineHeight: 18 }}>
        Tudo que vem dos bancos conectados, separado por onde saiu. Os gastos do mês abaixo consideram o mês selecionado.
      </Text>
      <MonthNav ym={ym} onChange={setYm} />
      <BankNameModal account={editing} onClose={() => setEditing(null)} onSaved={load} />
      {data.accounts.length === 0 ? <Empty text="Nenhum banco sincronizado ainda. Configure a Pluggy em Ajustes." /> : null}

      {cards.map((a) => {
        const txs = inMonth.filter((t) => t.account_id === a.id && isSpending(t, data.excluded));
        const cats = groupByCategory(txs, data.cats);
        const total = sum(txs);
        const used = a.credit_limit && a.available_limit !== null ? a.credit_limit - (a.available_limit ?? 0) : null;
        return (
          <View key={a.id} style={{ gap: 12 }}>
            <View style={{ backgroundColor: C.teal, borderRadius: 22, padding: 20, gap: 14 }}>
              <Pressable onPress={() => setEditing(a)} accessibilityHint="Trocar o nome do banco" style={{ gap: 2 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.tealSoft }}>
                  {a.bank_name ?? 'Cartão'} · {a.name}  <Ionicons name="pencil" size={12} color={C.tealSoft} />
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>{accountLabel(a)}</Text>
              </Pressable>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 13, color: C.tealSoft, fontWeight: '600' }}>Fatura atual</Text>
                <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff' }}>{brl(Math.abs(a.balance ?? 0))}</Text>
                <Text style={{ fontSize: 12, color: C.tealSoft }}>
                  {a.close_date ? `Fecha ${shortDate(a.close_date)}` : 'Fechamento não informado'}
                  {a.due_date ? ` · vence ${shortDate(a.due_date)}` : ''}
                </Text>
              </View>
              {used !== null && a.credit_limit ? (
                <View style={{ gap: 6 }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: '#fff', width: `${Math.min(100, Math.max(0, pct(used, a.credit_limit)))}%` as `${number}%` }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: C.tealSoft }}>Limite usado {brl(used)}</Text>
                    <Text style={{ fontSize: 12, color: C.tealSoft }}>de {brl(a.credit_limit)}</Text>
                  </View>
                </View>
              ) : null}
            </View>

            <H2>Compras do mês neste cartão · {brl(total)}</H2>
            {cats.length ? (
              <Card pad={false} style={{ paddingVertical: 6 }}>
                {cats.map((c) => (
                  <View key={c.id} style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Dot color={c.color} />
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: C.ink }}>{c.name}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{brl(c.value)}</Text>
                    </View>
                    <View style={{ marginLeft: 20 }}><Bar pct={pct(c.value, total)} color={c.color} /></View>
                  </View>
                ))}
              </Card>
            ) : <Empty text="Nenhuma compra neste cartão no mês." />}
            {txs.length ? (
              <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Lancamentos', params: { accountId: a.id, ym: ymKey(ym) } })} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: C.green, fontWeight: '700' }}>Ver as {txs.length} compras deste cartão ›</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {banks.length ? <H2>Contas correntes</H2> : null}
      {banks.map((a) => {
        const txs = inMonth.filter((t) => t.account_id === a.id);
        const income = txs.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + Math.abs(t.amount), 0);
        const out = txs.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + Math.abs(t.amount), 0);
        return (
          <Card key={a.id} style={{ gap: 14 }}>
            <Pressable onPress={() => setEditing(a)} accessibilityHint="Trocar o nome do banco">
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>
                {a.bank_name ?? 'Banco'} · {accountLabel(a)}  <Ionicons name="pencil" size={13} color={C.faint} />
              </Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{a.name}{a.updated_at ? ` · atualizado ${ddmm(a.updated_at.slice(0, 10))}` : ''}</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat label="Saldo" value={brl(a.balance ?? 0)} />
              <Stat label="Entrou no mês" value={brl(income)} color={C.green} />
              <Stat label="Saiu no mês" value={brl(out)} />
            </View>
            <RowDivider />
            <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Lancamentos', params: { accountId: a.id, ym: ymKey(ym) } })} style={{ minHeight: 40, justifyContent: 'center' }}>
              <Text style={{ color: C.green, fontWeight: '700' }}>Ver lançamentos desta conta ›</Text>
            </Pressable>
          </Card>
        );
      })}
    </Screen>
  );
}

function Stat({ label, value, color = C.ink }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 10, gap: 4 }}>
      <Text style={{ fontSize: 11, color: C.muted, fontWeight: '700' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '800', color }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}
