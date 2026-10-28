// Bloco do Início: quanto tem em cada conta e quanto está investido, hoje.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Empty, H2, RowDivider } from './ui';
import { C } from '../theme';
import { Account, accountLabel, getSetting, setSetting } from '../db';
import { groupInvestments, Investment, subtypeLabel } from '../lib/investments';
import { shortDate } from '../lib/dates';
import { brl, pct } from '../lib/format';

export default function MoneyToday({ accounts, investments }: { accounts: Account[]; investments: Investment[] }) {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { getSetting('hide_balances').then((v) => setHidden(v === '1')); }, []);
  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    setSetting('hide_balances', next ? '1' : '0');
  };

  const banks = useMemo(
    () => accounts.filter((a) => a.type === 'BANK').sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0)),
    [accounts],
  );
  const groups = useMemo(() => groupInvestments(investments), [investments]);
  const inAccounts = banks.reduce((s, a) => s + (a.balance ?? 0), 0);
  const invested = investments.reduce((s, i) => s + i.balance, 0);
  const profit = investments.some((i) => i.profit !== null) ? investments.reduce((s, i) => s + (i.profit ?? 0), 0) : null;

  if (!banks.length && !investments.length) return null;

  const money = (n: number) => (hidden ? 'R$ ••••' : brl(n));

  return (
    <View style={{ gap: 18 }}>
      <View style={{ backgroundColor: C.green, borderRadius: 22, padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.greenSoft }}>Seu dinheiro hoje</Text>
          <Pressable onPress={toggleHidden} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'Mostrar valores' : 'Esconder valores'}>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color="#fff" />
          </Pressable>
        </View>
        <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>{money(inAccounts + invested)}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Box label="Em conta" value={money(inAccounts)} />
          <Box label="Investido" value={money(invested)} />
        </View>
        <Text style={{ fontSize: 11, color: C.greenSoft }}>
          Saldo informado pelos bancos na última sincronização. Fatura de cartão não entra aqui.
        </Text>
      </View>

      <H2>Saldo em cada conta</H2>
      {banks.length ? (
        <Card pad={false}>
          {banks.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <RowDivider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={a.subtype === 'SAVINGS_ACCOUNT' ? 'wallet-outline' : 'business-outline'} size={20} color={C.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{a.bank_name ?? 'Banco'}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>{accountLabel(a)}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: (a.balance ?? 0) < 0 ? C.danger : C.ink }}>
                  {a.balance === null ? '—' : money(a.balance)}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : <Empty text="Nenhuma conta corrente ou poupança veio dos bancos." />}

      <H2>Investimentos</H2>
      {groups.length ? (
        <Card pad={false}>
          {profit !== null ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14 }}>
              <Text style={{ fontSize: 13, color: C.muted, fontWeight: '600' }}>Rendimento informado</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: profit >= 0 ? C.green : C.danger }}>
                {hidden ? 'R$ ••••' : `${profit >= 0 ? '+ ' : ''}${brl(profit)}`}
              </Text>
            </View>
          ) : null}
          {groups.map((g, gi) => {
            const isOpen = open === g.type;
            return (
              <View key={g.type}>
                {gi > 0 || profit !== null ? <RowDivider /> : null}
                <Pressable
                  onPress={() => setOpen(isOpen ? null : g.type)}
                  accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="trending-up-outline" size={20} color={C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{g.label}</Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>
                      {g.items.length} aplicaç{g.items.length === 1 ? 'ão' : 'ões'} · {Math.round(pct(g.total, invested))}% do investido
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{money(g.total)}</Text>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.faint} />
                </Pressable>
                {isOpen ? g.items.map((inv) => {
                  const details = [inv.bank_name, subtypeLabel(inv.subtype), inv.rate, inv.due_date ? `vence ${shortDate(inv.due_date)}` : null]
                    .filter(Boolean).join(' · ');
                  return (
                    <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 68, paddingRight: 16, paddingBottom: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }} numberOfLines={2}>{inv.name}</Text>
                        {details ? <Text style={{ fontSize: 11, color: C.muted }}>{details}</Text> : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{money(inv.balance)}</Text>
                        {inv.profit !== null && !hidden ? (
                          <Text style={{ fontSize: 11, fontWeight: '600', color: inv.profit >= 0 ? C.green : C.danger }}>
                            {inv.profit >= 0 ? '+ ' : ''}{brl(inv.profit)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                }) : null}
              </View>
            );
          })}
        </Card>
      ) : (
        <Empty text="Nenhum investimento encontrado. Se você tem aplicações, o banco pode não estar compartilhando esses dados pelo Meu Pluggy." />
      )}
    </View>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, gap: 2 }}>
      <Text style={{ fontSize: 11, color: C.greenSoft, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 15, color: '#fff', fontWeight: '800' }}>{value}</Text>
    </View>
  );
}
