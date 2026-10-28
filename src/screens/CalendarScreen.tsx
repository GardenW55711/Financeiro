import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Empty, IconButton, Loading, MonthNav, RowDivider, Screen, Segmented, Title } from '../components/ui';
import { C } from '../theme';
import { useNav } from '../navigation';
import { billsForMonth, loadMonth, MonthData } from '../data';
import { accountLabel } from '../db';
import { addDays, addMonths, daysInMonth, longDate, parseYmd, shortDate, todayYmd, weekday, WEEKDAYS_SHORT, ymd, ymOf, YM } from '../lib/dates';
import { holidayName, nextPayday } from '../lib/paydays';
import { brl } from '../lib/format';

type Ev = {
  kind: 'bill' | 'pay' | 'info';
  title: string;
  sub: string;
  value?: number;
  paid?: boolean;
  billId?: number;
};

export default function CalendarScreen() {
  const nav = useNav();
  const today = todayYmd();
  const [ym, setYm] = useState<YM>(() => ymOf(today));
  const [data, setData] = useState<MonthData | null>(null);
  const [nowData, setNowData] = useState<MonthData | null>(null);
  const [nextData, setNextData] = useState<MonthData | null>(null);
  const [mode, setMode] = useState<'semana' | 'mes'>('mes');
  const [sel, setSel] = useState<number>(() => parseYmd(today).d);
  const [show, setShow] = useState(true);

  const load = useCallback(async () => {
    const cur = ymOf(today);
    const [d, c, n] = await Promise.all([loadMonth(ym), loadMonth(cur), loadMonth(addMonths(cur, 1))]);
    setData(d);
    setNowData(c);
    setNextData(n);
  }, [ym, today]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeMonth = (n: YM) => {
    setYm(n);
    const t = ymOf(today);
    setSel(n.y === t.y && n.m === t.m ? parseYmd(today).d : 1);
  };

  const view = useMemo(() => {
    if (!data || !nowData || !nextData) return null;
    const dim = daysInMonth(ym.y, ym.m);
    const events = new Map<number, Ev[]>();
    const push = (date: string, ev: Ev) => {
      const p = parseYmd(date);
      if (p.y !== ym.y || p.m !== ym.m) return;
      events.set(p.d, [...(events.get(p.d) || []), ev]);
    };
    const bills = billsForMonth(data, ym);
    bills.forEach((b) => push(b.status.due, {
      kind: 'bill', title: b.name, value: b.value, paid: b.status.paid, billId: b.id,
      sub: `${b.status.paid ? 'Paga' : b.estimated ? 'Valor estimado' : 'A pagar'} · sai ${b.cycle === 'c5' ? 'do 5º dia útil' : 'do dia 20'}`
        + (weekday(b.status.due) === 0 || holidayName(b.status.due) ? ' · cai em dia sem banco, dá para pagar no próximo dia útil' : ''),
    }));
    const moved = data.periods.pay20 !== ymd(ym.y, ym.m, 20);
    push(data.periods.pay5, { kind: 'pay', title: 'Pagamento do 5º dia útil', sub: data.settings.countSaturday ? 'Previsto · sábado conta como dia útil' : 'Previsto' });
    push(data.periods.pay20, { kind: 'pay', title: 'Pagamento do dia 20', sub: moved ? `Previsto · ${data.settings.rule20 === 'antecipar' ? 'antecipado' : 'adiado'} (dia 20 sem banco)` : 'Previsto' });
    data.accounts.filter((a) => a.type === 'CREDIT').forEach((a) => {
      if (a.close_date) push(ymd(ym.y, ym.m, Math.min(parseYmd(a.close_date).d, dim)), { kind: 'info', title: `Fatura fecha · ${accountLabel(a)}`, sub: 'Compras depois disso vão para a próxima fatura' });
    });
    for (let d = 1; d <= dim; d++) {
      const h = holidayName(ymd(ym.y, ym.m, d));
      if (h) push(ymd(ym.y, ym.m, d), { kind: 'info', title: `Feriado · ${h}`, sub: 'Bancos fechados' });
    }

    // Saldos das contas correntes
    const banks = nowData.accounts.filter((a) => a.type === 'BANK');
    const totalBalance = banks.reduce((s, a) => s + (a.balance ?? 0), 0);

    // Contas abertas que vencem antes do próximo pagamento (a partir de hoje)
    const nextPay = nextPayday(today, data.settings);
    const curYm = ymOf(today);
    const pool = [...billsForMonth(nowData, curYm), ...billsForMonth(nextData, addMonths(curYm, 1))];
    // inclui contas atrasadas deste mês e as que vencem antes do próximo salário
    const dueBeforePay = pool.filter((b) => !b.status.paid && b.status.due < nextPay && b.status.due >= addDays(today, -31));
    const dueSum = dueBeforePay.reduce((s, b) => s + b.value, 0);

    const c5 = bills.filter((b) => b.cycle === 'c5').reduce((s, b) => s + b.value, 0);
    const c20 = bills.filter((b) => b.cycle === 'c20').reduce((s, b) => s + b.value, 0);
    return { dim, events, banks, totalBalance, nextPay, dueBeforePay, dueSum, c5, c20 };
  }, [data, nowData, nextData, ym, today]);

  if (!data || !view) return <Loading />;

  const first = weekday(ymd(ym.y, ym.m, 1));
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= view.dim; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const weekIdx = Math.max(0, weeks.findIndex((w) => w.includes(sel)));
  const listDays = mode === 'mes' ? [sel] : (weeks[weekIdx] ?? []).filter((d): d is number => d !== null);
  const items = listDays.flatMap((d) => (view.events.get(d) || []).map((e) => ({ ...e, day: d })));
  const listSum = items.filter((e) => e.kind === 'bill' && !e.paid).reduce((s, e) => s + (e.value ?? 0), 0);
  const isTodayMonth = ymOf(today).y === ym.y && ymOf(today).m === ym.m;
  const hide = (v: string) => (show ? v : 'R$ ••••');

  const dayCell = (d: number | null, i: number, tall: boolean) => {
    if (d === null) return <View key={`e${i}`} style={{ flex: 1, height: tall ? 64 : 50 }} />;
    const evs = view.events.get(d) || [];
    const on = d === sel;
    const hasPay = evs.some((e) => e.kind === 'pay');
    const isToday = isTodayMonth && d === parseYmd(today).d;
    const billsDue = evs.filter((e) => e.kind === 'bill' && !e.paid).reduce((s, e) => s + (e.value ?? 0), 0);
    return (
      <Pressable
        key={d}
        onPress={() => setSel(d)}
        accessibilityRole="button"
        accessibilityLabel={`${longDate(ymd(ym.y, ym.m, d))}${evs.length ? `, ${evs.length} item` : ''}`}
        accessibilityState={{ selected: on }}
        style={{
          flex: 1, height: tall ? 64 : 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4,
          backgroundColor: on ? C.ink : hasPay ? C.greenSoft : '#fff',
          borderWidth: isToday && !on ? 1.5 : 0, borderColor: C.green,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: on || hasPay ? '800' : '600', color: on ? '#fff' : hasPay ? C.greenDark : C.ink }}>{d}</Text>
        {tall ? (
          <Text style={{ fontSize: 10, fontWeight: '800', color: on ? '#fff' : billsDue ? C.warnDark : hasPay ? C.greenDark : C.faint }}>
            {billsDue ? `R$ ${Math.round(billsDue)}` : hasPay ? 'entra' : '·'}
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 3, height: 6 }}>
            {evs.slice(0, 3).map((e, k) => (
              <View key={k} style={{
                width: 6, height: 6, borderRadius: e.kind === 'pay' ? 1 : 3,
                backgroundColor: e.kind === 'bill' ? (e.paid ? C.faint : C.warn) : e.kind === 'pay' ? C.green : 'transparent',
                borderWidth: e.kind === 'info' ? 1.5 : 0, borderColor: on ? '#fff' : C.muted,
              }} />
            ))}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Screen>
      <Title>Calendário</Title>

      <Card pad={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>Saldo nas contas</Text>
          <IconButton name={show ? 'eye-outline' : 'eye-off-outline'} label="Mostrar ou esconder saldos" onPress={() => setShow(!show)} />
        </View>
        {view.banks.length === 0 ? (
          <Text style={{ paddingHorizontal: 16, paddingBottom: 14, fontSize: 13, color: C.muted }}>Sincronize seus bancos para ver o saldo aqui.</Text>
        ) : view.banks.map((a) => (
          <View key={a.id}>
            <RowDivider />
            <Pressable onPress={() => nav.navigate('Bancos')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="business-outline" size={20} color={C.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{a.bank_name ?? 'Banco'}</Text>
                <Text style={{ fontSize: 12, color: C.muted }}>{accountLabel(a)}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: (a.balance ?? 0) < 0 ? C.danger : C.ink }}>{hide(brl(a.balance ?? 0))}</Text>
            </Pressable>
          </View>
        ))}
        {view.banks.length ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingHorizontal: 16, backgroundColor: C.bg, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>Total disponível</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink }}>{hide(brl(view.totalBalance))}</Text>
          </View>
        ) : null}
      </Card>

      {view.banks.length ? (
        <View style={{ backgroundColor: C.teal, borderRadius: 20, padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.tealSoft }}>Até o próximo pagamento ({shortDate(view.nextPay)})</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#fff', fontSize: 14 }}>Contas em aberto até lá</Text>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>− {hide(brl(view.dueSum))}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Sobra prevista</Text>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{hide(brl(view.totalBalance - view.dueSum))}</Text>
          </View>
          <Text style={{ color: C.tealSoft, fontSize: 12, lineHeight: 17 }}>
            {view.dueBeforePay.length ? `Em aberto: ${view.dueBeforePay.map((b) => `${b.name} (${shortDate(b.status.due)})`).join(', ')}.` : 'Nenhuma conta fixa em aberto até o próximo pagamento.'}
          </Text>
        </View>
      ) : null}

      <Segmented options={[{ value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }]} value={mode} onChange={setMode} />

      <Card style={{ gap: 10, padding: 12 }}>
        <MonthNav ym={ym} onChange={changeMonth} />
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {WEEKDAYS_SHORT.map((w) => <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: C.muted }}>{w}</Text>)}
        </View>
        {mode === 'mes'
          ? weeks.map((w, wi) => <View key={wi} style={{ flexDirection: 'row', gap: 4 }}>{w.map((d, i) => dayCell(d, wi * 7 + i, false))}</View>)
          : (
            <>
              <View style={{ flexDirection: 'row', gap: 4 }}>{(weeks[weekIdx] ?? []).map((d, i) => dayCell(d, i, true))}</View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Pressable disabled={weekIdx === 0} onPress={() => setSel((weeks[weekIdx - 1] ?? []).find((d) => d !== null) ?? sel)} style={{ minHeight: 40, justifyContent: 'center', opacity: weekIdx === 0 ? 0.4 : 1 }}>
                  <Text style={{ color: C.green, fontWeight: '700', fontSize: 13 }}>‹ Semana anterior</Text>
                </Pressable>
                <Pressable disabled={weekIdx >= weeks.length - 1} onPress={() => setSel((weeks[weekIdx + 1] ?? []).find((d) => d !== null) ?? sel)} style={{ minHeight: 40, justifyContent: 'center', opacity: weekIdx >= weeks.length - 1 ? 0.4 : 1 }}>
                  <Text style={{ color: C.green, fontWeight: '700', fontSize: 13 }}>Próxima semana ›</Text>
                </Pressable>
              </View>
            </>
          )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 4 }}>
          <Legend color={C.warn} round label="Conta vence" />
          <Legend color={C.green} label="Dia de pagamento" />
          <Legend outline label="Aviso" />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, flex: 1 }}>
          {mode === 'mes' ? longDate(ymd(ym.y, ym.m, sel)) : `Semana de ${listDays[0]} a ${listDays[listDays.length - 1]}`}
        </Text>
        {listSum ? <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>a pagar {brl(listSum)}</Text> : null}
      </View>
      {items.length ? (
        <Card pad={false}>
          {items.map((e, i) => (
            <View key={i}>
              {i > 0 ? <RowDivider /> : null}
              <Pressable
                onPress={() => (e.billId ? nav.navigate('ContaFixa', { id: e.billId }) : e.kind === 'pay' ? nav.navigate('Tabs', { screen: 'Ajustes' }) : undefined)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: e.kind === 'bill' ? (e.paid ? C.greenSoft : C.warnSoft) : e.kind === 'pay' ? C.greenSoft : C.track,
                }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: e.kind === 'bill' ? (e.paid ? C.greenDark : C.warnDark) : e.kind === 'pay' ? C.greenDark : C.ink2 }}>{e.day}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink, textDecorationLine: e.paid ? 'line-through' : 'none' }}>{e.title}</Text>
                  <Text style={{ fontSize: 12, color: C.muted, lineHeight: 16 }}>{e.sub}</Text>
                </View>
                {e.kind === 'bill' ? <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{brl(e.value ?? 0)}</Text> : null}
                {e.kind === 'pay' ? <Text style={{ fontSize: 14, fontWeight: '800', color: C.green }}>Entrada</Text> : null}
              </Pressable>
            </View>
          ))}
        </Card>
      ) : <Empty text={mode === 'mes' ? 'Nada vence neste dia.' : 'Nada vence nesta semana.'} />}

      <Card style={{ gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>Contas do mês por pagamento</Text>
        <Row label={`5º dia útil (${shortDate(data.periods.pay5)})`} value={brl(view.c5)} />
        <Row label={`Dia 20 (${shortDate(data.periods.pay20)})`} value={brl(view.c20)} />
        <RowDivider />
        <Row label="Total de contas no mês" value={brl(view.c5 + view.c20)} bold />
      </Card>
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 14, color: bold ? C.ink : C.ink2, fontWeight: bold ? '700' : '400' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{value}</Text>
    </View>
  );
}

function Legend({ color, label, round, outline }: { color?: string; label: string; round?: boolean; outline?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{
        width: 8, height: 8, borderRadius: round || outline ? 4 : 2, backgroundColor: outline ? 'transparent' : color,
        borderWidth: outline ? 1.5 : 0, borderColor: C.muted,
      }} />
      <Text style={{ fontSize: 12, color: C.ink2 }}>{label}</Text>
    </View>
  );
}
