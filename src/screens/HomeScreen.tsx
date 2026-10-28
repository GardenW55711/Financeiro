import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Bar, Card, Dot, Empty, H2, IconButton, LinkText, Loading, MonthNav, Notice, Pill, pw, RowDivider, Screen, Segmented } from '../components/ui';
import { C } from '../theme';
import UpdateBanner from '../components/UpdateBanner';
import MoneyToday from '../components/MoneyToday';
import { useNav } from '../navigation';
import { billsForMonth, loadMonth, MonthData } from '../data';
import { accountLabel, getPaySettings, getSetting } from '../db';
import { syncAll } from '../pluggy';
import { addMonths, ddmm, shortDate, todayYmd, ymKey, ymOf, YM } from '../lib/dates';
import { cycleOf, PeriodKey } from '../lib/paydays';
import { groupByCategory, inPeriod, isSpending, sum } from '../lib/analysis';
import { brl, pct } from '../lib/format';

export default function HomeScreen() {
  const nav = useNav();
  const [ym, setYm] = useState<YM>(() => ymOf(todayYmd()));
  const [period, setPeriod] = useState<PeriodKey>('mes');
  const [initDone, setInitDone] = useState(false);
  const [data, setData] = useState<MonthData | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    let target = ym;
    if (!initDone) {
      // Abre já no ciclo de pagamento em que estamos hoje
      const st = await getPaySettings();
      const c = cycleOf(todayYmd(), st);
      target = c.ym;
      setYm(c.ym);
      setPeriod(c.key);
      setInitDone(true);
    }
    setData(await loadMonth(target));
    setLastSync(await getSetting('last_sync_at'));
  }, [ym, initDone]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doSync = async () => {
    setSyncing(true);
    try {
      const r = await syncAll();
      const extra = r.warnings.length ? `\n\n${r.warnings.join('\n')}` : '';
      Alert.alert('Sincronizado', `${r.accounts} conta(s) lidas, ${r.newTx} lançamento(s) novo(s), ${r.investments} investimento(s).${extra}`);
      await load();
    } catch (e: any) {
      Alert.alert('Não deu para sincronizar', String(e?.message ?? e));
    } finally {
      setSyncing(false);
    }
  };

  const view = useMemo(() => {
    if (!data) return null;
    const prevYm = addMonths(ym, -1);
    const spend = data.txs.filter((t) => isSpending(t, data.excluded));
    const cur = spend.filter((t) => inPeriod(t, period, ym, data.periods, data.settings));
    const prev = spend.filter((t) => inPeriod(t, period, prevYm, data.prevPeriods, data.settings));
    const total = sum(cur);
    const prevTotal = sum(prev);
    const cats = groupByCategory(cur, data.cats);
    const byAcc = new Map<string, number>();
    cur.forEach((t) => byAcc.set(t.account_id ?? 'manual', (byAcc.get(t.account_id ?? 'manual') || 0) + Math.abs(t.amount)));
    const accounts = Array.from(byAcc.entries()).map(([id, v]) => {
      const a = data.accounts.find((x) => x.id === id);
      return {
        id,
        value: v,
        name: a ? `${a.bank_name ?? ''} · ${accountLabel(a)}`.replace(/^ · /, '') : 'Lançados à mão',
        icon: (a?.type === 'CREDIT' ? 'card-outline' : a ? 'business-outline' : 'create-outline') as keyof typeof Ionicons.glyphMap,
      };
    }).sort((a, b) => b.value - a.value);
    const bills = billsForMonth(data, ym).filter((b) => period === 'mes' || b.cycle === period);
    const uncategorized = data.txs.filter((t) => t.type === 'DEBIT' && !t.category_id && t.date >= data.periods.mes.from && t.date <= data.periods.mes.to).length;
    const range = period === 'mes' ? data.periods.mes : data.periods[period];
    return { total, prevTotal, cats, accounts, bills, uncategorized, range };
  }, [data, period, ym]);

  if (!data || !view) return <Loading />;

  const diff = view.prevTotal ? ((view.total - view.prevTotal) / view.prevTotal) * 100 : null;
  const paidCount = view.bills.filter((b) => b.status.paid).length;
  const rangeLabel = period === 'mes'
    ? `Mês todo: ${ddmm(view.range.from)} a ${ddmm(view.range.to)}`
    : `Ciclo do pagamento ${period === 'c5' ? 'do 5º dia útil' : 'do dia 20'}: ${shortDate(view.range.from)} a ${shortDate(view.range.to)}`;
  const noData = data.accounts.length === 0 && data.txs.length === 0;

  return (
    <Screen refreshing={syncing} onRefresh={doSync}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ fontSize: 14, color: C.muted, fontWeight: '600' }}>Financeiro</Text>
          <Text style={{ fontSize: 12, color: C.muted }}>
            {lastSync ? `Sincronizado em ${new Date(lastSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Ainda não sincronizado'}
          </Text>
        </View>
        <IconButton name="refresh" label="Buscar dados dos bancos" onPress={doSync} />
      </View>

      <UpdateBanner />

      {noData ? (
        <Notice
          title="Conecte seus bancos"
          text="Vá em Ajustes, cole as chaves da Pluggy e os IDs dos bancos do Meu Pluggy. Depois puxe a tela para baixo para sincronizar."
          onPress={() => nav.navigate('Tabs', { screen: 'Ajustes' })}
        />
      ) : null}

      <MoneyToday accounts={data.accounts} investments={data.investments} onChanged={load} />

      <MonthNav ym={ym} onChange={setYm} />

      <View style={{ gap: 8 }}>
        <Segmented
          options={[{ value: 'mes', label: 'Mês todo' }, { value: 'c5', label: '5º dia útil' }, { value: 'c20', label: 'Dia 20' }]}
          value={period}
          onChange={setPeriod}
        />
        <Text style={{ fontSize: 12, color: C.muted, paddingLeft: 4 }}>{rangeLabel}</Text>
      </View>

      {view.uncategorized > 0 ? (
        <Notice
          title={`${view.uncategorized} gasto(s) sem categoria`}
          text="Toque para classificar e deixar o gráfico mais certo."
          onPress={() => nav.navigate('Tabs', { screen: 'Lancamentos', params: { categoryId: 'none', ym: ymKey(ym) } })}
        />
      ) : null}

      <Card style={{ gap: 12 }}>
        <Text style={{ fontSize: 13, color: C.muted, fontWeight: '600' }}>Gasto no período</Text>
        <Text style={{ fontSize: 34, fontWeight: '800', color: C.ink, letterSpacing: -0.5 }}>{brl(view.total)}</Text>
        {diff !== null ? (
          <Text style={{ fontSize: 13, fontWeight: '700', color: diff > 0 ? C.warn : C.green }}>
            {diff > 0 ? '▲' : '▼'} {Math.abs(Math.round(diff))}% {diff > 0 ? 'a mais' : 'a menos'} que o {period === 'mes' ? 'mês' : 'ciclo'} anterior
          </Text>
        ) : null}
        <View style={{ height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: C.track }}>
          {view.cats.map((c) => (
            <View key={c.id} style={{ width: pw(pct(c.value, view.total)), backgroundColor: c.color, borderRightWidth: 2, borderRightColor: '#fff' }} />
          ))}
        </View>
        {view.bills.length ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.bg, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>Contas fixas pagas</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.green }}>{paidCount} de {view.bills.length}</Text>
          </View>
        ) : null}
      </Card>

      <H2 right={<LinkText title="Ver lançamentos" onPress={() => nav.navigate('Tabs', { screen: 'Lancamentos', params: { ym: ymKey(ym) } })} />}>
        Onde foi o dinheiro
      </H2>
      {view.cats.length ? (
        <Card pad={false} style={{ paddingVertical: 6 }}>
          {view.cats.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => nav.navigate('Tabs', { screen: 'Lancamentos', params: { categoryId: c.id, ym: ymKey(ym) } })}
              style={{ paddingHorizontal: 18, paddingVertical: 12, gap: 8 }}
              accessibilityRole="button"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Dot color={c.color} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.ink }}>{c.name}</Text>
                <Text style={{ fontSize: 12, color: C.muted, fontWeight: '600' }}>{Math.round(pct(c.value, view.total))}%</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink, minWidth: 96, textAlign: 'right' }}>{brl(c.value)}</Text>
              </View>
              <View style={{ marginLeft: 20 }}><Bar pct={pct(c.value, view.total)} color={c.color} /></View>
            </Pressable>
          ))}
        </Card>
      ) : <Empty text="Nenhum gasto neste período ainda." />}

      <H2 right={<LinkText title="Ver detalhes" onPress={() => nav.navigate('Bancos')} />}>Por banco e cartão</H2>
      {view.accounts.length ? (
        <Card pad={false}>
          {view.accounts.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <RowDivider /> : null}
              <Pressable
                onPress={() => nav.navigate('Tabs', { screen: 'Lancamentos', params: { accountId: a.id, ym: ymKey(ym) } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={a.icon} size={20} color={C.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{a.name}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>{Math.round(pct(a.value, view.total))}% do período</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{brl(a.value)}</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : <Empty text="Os gastos por conta aparecem aqui depois da primeira sincronização." />}

      <H2 right={<LinkText title="Gerenciar" onPress={() => nav.navigate('Tabs', { screen: 'ContasFixas' })} />}>Contas fixas do período</H2>
      {view.bills.length ? (
        <Card pad={false}>
          {view.bills.map((b, i) => (
            <View key={b.id}>
              {i > 0 ? <RowDivider /> : null}
              <Pressable onPress={() => nav.navigate('ContaFixa', { id: b.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>{b.name}</Text>
                  {b.status.paid
                    ? <Pill tone="ok" text={b.status.paidDate ? `Paga em ${ddmm(b.status.paidDate)}` : 'Paga'} />
                    : <Pill tone={b.status.due < todayYmd() ? 'danger' : 'warn'} text={`${b.status.due < todayYmd() ? 'Venceu' : 'Vence'} ${ddmm(b.status.due)}`} />}
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{b.estimated ? '≈ ' : ''}{brl(b.value)}</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : <Empty text="Cadastre suas contas fixas (aluguel, luz, internet...) na aba Contas fixas." />}
    </Screen>
  );
}
