import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, DashedButton, Empty, Loading, MonthNav, Notice, Pill, RowDivider, Screen, Title } from '../components/ui';
import { C } from '../theme';
import { useNav } from '../navigation';
import { billsForMonth, BillView, loadMonth, MonthData } from '../data';
import { setBillManual } from '../db';
import { ddmm, shortDate, todayYmd, ymKey, ymOf, YM } from '../lib/dates';
import { holidayName } from '../lib/paydays';
import { brl } from '../lib/format';

export default function BillsScreen() {
  const nav = useNav();
  const [ym, setYm] = useState<YM>(() => ymOf(todayYmd()));
  const [data, setData] = useState<MonthData | null>(null);

  const load = useCallback(async () => setData(await loadMonth(ym)), [ym]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <Loading />;
  const bills = billsForMonth(data, ym);
  const today = todayYmd();

  const toggle = async (b: BillView) => {
    // Paga automática ou aberta -> marca o contrário manualmente. Marcação manual -> volta ao automático.
    if (b.status.source === 'manual') await setBillManual(b.id, ymKey(ym), null);
    else await setBillManual(b.id, ymKey(ym), !b.status.paid);
    load();
  };

  const p20Holiday = holidayName(`${ymKey(ym)}-20`);
  const p20Moved = data.periods.pay20 !== `${ymKey(ym)}-20`;

  const sections: { key: 'c5' | 'c20'; title: string; sub: string }[] = [
    { key: 'c5', title: 'Pagamento do 5º dia útil', sub: `Cai em ${shortDate(data.periods.pay5)}` },
    { key: 'c20', title: 'Pagamento do dia 20', sub: `Cai em ${shortDate(data.periods.pay20)}${p20Moved ? (data.settings.rule20 === 'antecipar' ? ' (antecipado)' : ' (adiado)') : ''}` },
  ];

  return (
    <Screen>
      <Title sub="Você cadastra cada conta: valor, vencimento e de qual pagamento ela sai. O app marca como paga sozinho quando encontra no extrato. Toque numa conta para editar.">
        Contas fixas
      </Title>
      <MonthNav ym={ym} onChange={setYm} />

      {p20Moved ? (
        <Notice
          title={p20Holiday ? `Dia 20 é feriado (${p20Holiday})` : 'Dia 20 cai no fim de semana'}
          text={`O pagamento do dia 20 deve vir ${data.settings.rule20 === 'antecipar' ? 'antecipado' : 'adiado'} para ${shortDate(data.periods.pay20)}. Você pode mudar essa regra em Ajustes.`}
        />
      ) : null}

      {bills.length === 0 ? <Empty text="Nenhuma conta fixa cadastrada ainda. Toque no botão abaixo para adicionar a primeira (ex.: aluguel, luz, internet)." /> : null}

      {sections.map((sec) => {
        const list = bills.filter((b) => b.cycle === sec.key);
        if (!list.length) return null;
        const total = list.reduce((a, b) => a + b.value, 0);
        const paid = list.filter((b) => b.status.paid).length;
        return (
          <Card key={sec.key} pad={false} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 12 }}>
              <View style={{ gap: 3, flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink }}>{sec.title}</Text>
                <Text style={{ fontSize: 12, color: C.muted }}>{sec.sub}</Text>
              </View>
              <Pill tone={paid === list.length ? 'ok' : 'warn'} text={`${paid} de ${list.length} pagas`} />
            </View>
            {list.map((b) => {
              const late = !b.status.paid && b.status.due < today;
              return (
                <View key={b.id}>
                  <RowDivider />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 8, paddingVertical: 10 }}>
                    <Pressable style={{ flex: 1, gap: 4, minHeight: 44, justifyContent: 'center' }} onPress={() => nav.navigate('ContaFixa', { id: b.id })} accessibilityRole="button">
                      <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{b.name}</Text>
                      <Text style={{ fontSize: 12, color: C.muted }}>
                        Vence {ddmm(b.status.due)}{b.estimated ? ' · valor estimado' : ''}{b.account_id ? ' · fatura do cartão' : ''}
                      </Text>
                    </Pressable>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{b.estimated ? '≈ ' : ''}{brl(b.value)}</Text>
                      {b.status.paid
                        ? <Pill tone="ok" text={b.status.paidDate ? `Paga ${ddmm(b.status.paidDate)}` : 'Paga (manual)'} />
                        : <Pill tone={late ? 'danger' : 'warn'} text={late ? 'Atrasada' : 'A pagar'} />}
                    </View>
                    <Pressable
                      onPress={() => toggle(b)}
                      accessibilityRole="button"
                      accessibilityLabel={b.status.paid ? `Desmarcar ${b.name} como paga` : `Marcar ${b.name} como paga`}
                      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name={b.status.paid ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={b.status.paid ? C.green : C.faint} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingHorizontal: 16, backgroundColor: C.greenSoft }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.greenDark }}>Separar deste pagamento</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.greenDark }}>{brl(total)}</Text>
            </View>
          </Card>
        );
      })}

      <DashedButton title="+ Adicionar conta fixa" onPress={() => nav.navigate('ContaFixa', {})} />

      <Text style={{ fontSize: 12, color: C.ink2, lineHeight: 18, paddingHorizontal: 4 }}>
        Dica: o círculo à direita marca ou desmarca a conta como paga à mão. A fatura do cartão aparece aqui para você se organizar,
        mas não entra no gráfico de categorias: as compras dela já foram contadas uma a uma.
      </Text>
    </Screen>
  );
}
