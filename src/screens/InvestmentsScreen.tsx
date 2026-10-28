// Aba Carteira: painel de todos os investimentos + atalhos para o guia e as calculadoras.
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, DashedButton, Empty, H2, LinkText, Loading, Notice, RowDivider, Screen, Segmented } from '../components/ui';
import { AllocationCard, numText, pctText, StatBox } from '../components/invest';
import { C } from '../theme';
import { useNav } from '../navigation';
import { getSetting, listInvestments, setSetting } from '../db';
import { syncAll } from '../pluggy';
import { getBrapiToken, getQuote, getRates, Quote, Rates } from '../market';
import { Investment } from '../lib/investments';
import {
  assetClass, estimatedIr, isFii, isListed, pctOfCdi, portfolioAlerts, realReturn, summarize, upcomingMaturities,
} from '../lib/portfolio';
import { shortDate, todayYmd } from '../lib/dates';
import { brl } from '../lib/format';

type View_ = 'painel' | 'ativos' | 'aprender';

export default function InvestmentsScreen() {
  const nav = useNav();
  const [list, setList] = useState<Investment[] | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [hasToken, setHasToken] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [view, setView] = useState<View_>('painel');
  const [refreshing, setRefreshing] = useState(false);

  const loadQuotes = useCallback(async (inv: Investment[], force = false) => {
    const token = await getBrapiToken();
    setHasToken(!!token);
    const symbols = Array.from(new Set(inv.filter(isListed).map((i) => i.code as string))).slice(0, 25);
    const out: Record<string, Quote> = {};
    for (const s of symbols) {
      try {
        const q = await getQuote(s, { force, maxAgeMin: 30 });
        if (q) out[s] = q;
      } catch { /* sem dados para esse ativo agora */ }
    }
    setQuotes(out);
  }, []);

  const load = useCallback(async (force = false) => {
    const inv = await listInvestments();
    setList(inv);
    setHidden((await getSetting('hide_balances')) === '1');
    getRates(force).then(setRates);
    loadQuotes(inv, force);
  }, [loadQuotes]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    try {
      await syncAll();
    } catch (e: any) {
      Alert.alert('Não deu para sincronizar os bancos', String(e?.message ?? e));
    }
    await load(true);
    setRefreshing(false);
  };

  const today = todayYmd();
  const data = useMemo(() => {
    if (!list) return null;
    // Para ações/FIIs, se tiver cotação e quantidade, o valor de hoje vem da cotação
    const live = list.map((i) => {
      const q = i.code ? quotes[i.code] : undefined;
      if (q?.price && i.quantity && i.source === 'manual') return { ...i, balance: q.price * i.quantity };
      return i;
    });
    const s = summarize(live, today);
    const alerts = portfolioAlerts(live, s, rates?.cdi ?? null);
    const maturities = upcomingMaturities(live, today);
    const listed = live.filter(isListed);
    const income12m = listed.reduce((sum, i) => {
      const q = i.code ? quotes[i.code] : undefined;
      return sum + (q?.dividends12m && i.quantity ? q.dividends12m * i.quantity : 0);
    }, 0);
    const irTotal = live.reduce((sum, i) => sum + (estimatedIr(i, today)?.value ?? 0), 0);
    return { live, s, alerts, maturities, listed, income12m, irTotal };
  }, [list, quotes, rates, today]);

  if (!list || !data) return <Loading />;

  const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : hidden ? 'R$ ••••' : brl(n));
  const toggleHidden = () => {
    setHidden(!hidden);
    setSetting('hide_balances', hidden ? '0' : '1');
  };
  const { s } = data;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.3 }}>Carteira</Text>
          <Text style={{ fontSize: 12, color: C.muted }}>Seus investimentos e como analisá-los</Text>
        </View>
        <Pressable onPress={toggleHidden} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'Mostrar valores' : 'Esconder valores'}>
          <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.ink} />
        </Pressable>
      </View>

      <Segmented
        options={[{ value: 'painel', label: 'Painel' }, { value: 'ativos', label: 'Ativos' }, { value: 'aprender', label: 'Aprender' }]}
        value={view}
        onChange={setView}
      />

      {view === 'painel' ? (
        <>
          {/* Resumo */}
          <View style={{ backgroundColor: C.teal, borderRadius: 22, padding: 20, gap: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.tealSoft }}>Total investido hoje</Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>{money(s.total)}</Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Tile label="Você aplicou" value={s.invested !== null ? money(s.invested) : '—'} />
              <Tile
                label="Ganho"
                value={s.profit !== null ? `${hidden ? 'R$ ••••' : brl(s.profit)}` : '—'}
                sub={s.profitPct !== null ? pctText(s.profitPct) : undefined}
              />
            </View>
            <Text style={{ fontSize: 11, color: C.tealSoft }}>
              {s.count} investimento(s). Valores brutos, antes do imposto. Puxe para baixo para atualizar.
            </Text>
          </View>

          {/* Termômetro da economia */}
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>Termômetro da economia</Text>
              <Text style={{ fontSize: 10, color: C.faint }}>Banco Central</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatBox label="CDI ao ano" value={pctText(rates?.cdi, 2)} sub="referência da renda fixa" />
              <StatBox label="Selic" value={pctText(rates?.selic, 2)} sub="juros básicos" />
              <StatBox label="Inflação 12m" value={pctText(rates?.ipca12m, 2)} sub="IPCA" />
            </View>
            {rates?.cdi && rates?.ipca12m ? (
              <Text style={{ fontSize: 12, color: C.ink2, lineHeight: 17 }}>
                Quem rende 100% do CDI hoje ganha cerca de {pctText(realReturn(rates.cdi, rates.ipca12m))} ao ano acima da inflação (antes do IR).
              </Text>
            ) : null}
          </Card>

          {s.count === 0 ? (
            <Empty text="Nenhum investimento encontrado. Se o seu banco não compartilha investimentos pelo Meu Pluggy, adicione à mão no botão abaixo." />
          ) : null}

          {/* Alertas */}
          {s.count > 0 ? (
            <>
              <H2>O que chama atenção</H2>
              {data.alerts.map((a, i) => <Notice key={i} title={a.title} text={a.text} tone={a.tone} />)}
            </>
          ) : null}

          {/* Divisão */}
          {s.count > 0 ? <H2>Como a carteira está dividida</H2> : null}
          <AllocationCard title="Por tipo de investimento" slices={s.byClass} hidden={hidden} />
          <AllocationCard title="Por indexador (do que depende o rendimento)" slices={s.byIndex} hidden={hidden} />
          <AllocationCard title="Por instituição" slices={s.byInstitution} hidden={hidden} />
          <AllocationCard title="Por prazo (quando o dinheiro fica livre)" slices={s.byLiquidity} hidden={hidden} />

          {/* Rendimento x CDI */}
          {data.live.some((i) => i.rate_12m !== null) ? (
            <>
              <H2>Rendimento dos últimos 12 meses</H2>
              <Card pad={false}>
                {data.live.filter((i) => i.rate_12m !== null).sort((a, b) => (b.rate_12m ?? 0) - (a.rate_12m ?? 0)).map((i, idx) => {
                  const p = rates?.cdi ? pctOfCdi(i.rate_12m as number, rates.cdi) : null;
                  return (
                    <View key={i.id}>
                      {idx > 0 ? <RowDivider /> : null}
                      <Pressable onPress={() => nav.navigate('Ativo', { id: i.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }} numberOfLines={1}>{i.name}</Text>
                          <Text style={{ fontSize: 11, color: C.muted }}>{p !== null ? `${Math.round(p)}% do CDI` : assetClass(i)}</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: (i.rate_12m as number) >= 0 ? C.green : C.danger }}>{pctText(i.rate_12m)}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </Card>
            </>
          ) : null}

          {/* Vencimentos */}
          {data.maturities.length ? (
            <>
              <H2>Próximos vencimentos</H2>
              <Card pad={false}>
                {data.maturities.map((i, idx) => {
                  const ir = estimatedIr(i, today);
                  return (
                    <View key={i.id}>
                      {idx > 0 ? <RowDivider /> : null}
                      <Pressable onPress={() => nav.navigate('Ativo', { id: i.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
                        <View style={{ width: 52, alignItems: 'center' }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: i.days <= 30 ? C.warn : C.ink }}>{i.days}</Text>
                          <Text style={{ fontSize: 10, color: C.muted }}>dias</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }} numberOfLines={1}>{i.name}</Text>
                          <Text style={{ fontSize: 11, color: C.muted }}>
                            {shortDate(i.due_date as string)} · {i.bank_name}{ir ? ` · IR ${ir.rate === 0 ? 'isento' : `${String(ir.rate).replace('.', ',')}%`}` : ''}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{money(i.balance)}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </Card>
            </>
          ) : null}

          {/* Imposto e renda passiva */}
          {s.count > 0 ? (
            <Card style={{ gap: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>Imposto e renda passiva</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <StatBox label="IR se resgatasse hoje" value={money(data.irTotal)} sub="renda fixa e fundos com data e valor aplicado" />
                <StatBox label="Proventos 12m (estimado)" value={hasToken && data.income12m ? money(data.income12m) : '—'} sub="ações e FIIs × quantidade" />
              </View>
            </Card>
          ) : null}

          <ShortcutRow nav={nav} />
          <DashedButton title="+ Adicionar investimento à mão" onPress={() => nav.navigate('Investimento')} />
        </>
      ) : null}

      {view === 'ativos' ? (
        <>
          {!hasToken && data.listed.length ? (
            <Notice
              title="Ative os dados da bolsa"
              text="Com um token grátis da brapi, aparecem preço, P/L, P/VP, dividendos e preço justo das suas ações e FIIs. Toque para configurar em Ajustes."
              tone="info"
              onPress={() => nav.navigate('Tabs', { screen: 'Ajustes' })}
            />
          ) : null}
          {data.live.length ? (
            <Card pad={false}>
              {[...data.live].sort((a, b) => b.balance - a.balance).map((i, idx) => {
                const q = i.code ? quotes[i.code] : undefined;
                const line = q
                  ? [q.price ? `R$ ${numText(q.price)}` : null, q.changePct !== null ? `${q.changePct >= 0 ? '▲' : '▼'} ${pctText(Math.abs(q.changePct))} hoje` : null,
                    isFii(i) || /11$/.test(i.code ?? '') ? (q.pvp ? `P/VP ${numText(q.pvp)}` : null) : (q.pl ? `P/L ${numText(q.pl, 1)}` : null),
                    q.dy ? `DY ${pctText(q.dy)}` : null].filter(Boolean).join(' · ')
                  : [assetClass(i), i.bank_name, i.rate].filter(Boolean).join(' · ');
                return (
                  <View key={i.id}>
                    {idx > 0 ? <RowDivider /> : null}
                    <Pressable onPress={() => nav.navigate('Ativo', { id: i.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }} numberOfLines={1}>
                          {i.code && isListed(i) ? `${i.code} · ` : ''}{i.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: C.muted }} numberOfLines={1}>{line}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{money(i.balance)}</Text>
                        <Text style={{ fontSize: 11, color: C.muted }}>{s.total ? `${Math.round((i.balance / s.total) * 100)}%` : ''}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={C.faint} />
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          ) : <Empty text="Nenhum investimento ainda." />}
          <DashedButton title="Analisar outra ação ou FII" onPress={() => nav.navigate('Ativo', {})} />
          <DashedButton title="+ Adicionar investimento à mão" onPress={() => nav.navigate('Investimento')} />
        </>
      ) : null}

      {view === 'aprender' ? (
        <>
          <Text style={{ fontSize: 13, color: C.muted, lineHeight: 19 }}>
            Os principais jeitos de analisar investimentos, explicados de forma simples. Toque num tema para abrir.
          </Text>
          <LearnCard icon="compass-outline" title="Antes de analisar" text="Reserva, prazo, risco e diversificação" onPress={() => nav.navigate('Guia', { section: 'base' })} />
          <LearnCard icon="shield-checkmark-outline" title="Renda fixa" text="CDI, IPCA+, IR, FGC, LCI x CDB" onPress={() => nav.navigate('Guia', { section: 'rf' })} />
          <LearnCard icon="bar-chart-outline" title="Ações: os indicadores" text="P/L, P/VP, DY, ROE, margem, dívida" onPress={() => nav.navigate('Guia', { section: 'acoes' })} />
          <LearnCard icon="school-outline" title="Métodos de análise de ações" text="Graham, Bazin, fluxo de caixa, Fórmula Mágica" onPress={() => nav.navigate('Guia', { section: 'metodos' })} />
          <LearnCard icon="business-outline" title="Fundos imobiliários" text="Tipos, DY, P/VP, vacância, preço-teto" onPress={() => nav.navigate('Guia', { section: 'fii' })} />
          <LearnCard icon="layers-outline" title="Fundos e ETFs" text="Taxas, come-cotas, Sharpe" onPress={() => nav.navigate('Guia', { section: 'fundos' })} />
          <LearnCard icon="document-text-outline" title="Imposto de renda 2026" text="Resumo do que vale hoje" onPress={() => nav.navigate('Guia', { section: 'ir' })} />
          <LearnCard icon="calculator-outline" title="Calculadoras" text="Graham, Bazin, preço-teto de FII, LCI x CDB, juro real" onPress={() => nav.navigate('Calculadoras')} />
        </>
      ) : null}
    </Screen>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 130, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, gap: 2 }}>
      <Text style={{ fontSize: 11, color: C.tealSoft, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 15, color: '#fff', fontWeight: '800' }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 11, color: C.tealSoft, fontWeight: '700' }}>{sub}</Text> : null}
    </View>
  );
}

function LearnCard({ icon, title, text, onPress }: { icon: string; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon as any} size={22} color={C.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{title}</Text>
          <Text style={{ fontSize: 12, color: C.muted }}>{text}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </Card>
    </Pressable>
  );
}

function ShortcutRow({ nav }: { nav: ReturnType<typeof useNav> }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Pressable onPress={() => nav.navigate('Guia')} style={{ flex: 1 }} accessibilityRole="button">
        <Card style={{ alignItems: 'center', gap: 6 }}>
          <Ionicons name="book-outline" size={22} color={C.green} />
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>Guia de análise</Text>
        </Card>
      </Pressable>
      <Pressable onPress={() => nav.navigate('Calculadoras')} style={{ flex: 1 }} accessibilityRole="button">
        <Card style={{ alignItems: 'center', gap: 6 }}>
          <Ionicons name="calculator-outline" size={22} color={C.green} />
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>Calculadoras</Text>
        </Card>
      </Pressable>
    </View>
  );
}
