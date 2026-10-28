// Análise de um investimento seu, ou de qualquer ação/FII que você digitar.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Chip, Empty, H2, Loading, Notice, PrimaryButton, RowDivider, Screen, TextButton, pw, s as ui } from '../components/ui';
import { IndicatorRow, numText, pctText, StatBox } from '../components/invest';
import { C } from '../theme';
import { RootStackParamList, useNav } from '../navigation';
import { deleteInvestment, getInvestment } from '../db';
import { getBrapiToken, getQuote, getRates, Quote, Rates } from '../market';
import { Investment, subtypeLabel } from '../lib/investments';
import { assetClass, bazinPrice, estimatedIr, grahamPrice, hasFgc, isFii, isListed, pctOfCdi, realReturn, safetyMargin } from '../lib/portfolio';
import { FII_CHECKLIST, readFii, readStock, STOCK_CHECKLIST } from '../lib/indicators';
import { diffDays, shortDate, todayYmd } from '../lib/dates';
import { brl } from '../lib/format';

export default function AssetScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<RootStackParamList, 'Ativo'>>();
  const [inv, setInv] = useState<Investment | null>(null);
  const [symbol, setSymbol] = useState<string | null>(route.params?.symbol ?? null);
  const [typed, setTyped] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [hasToken, setHasToken] = useState(true);
  const [loading, setLoading] = useState(!!route.params?.id);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState<string | null>(null);
  const [fiiYield, setFiiYield] = useState(8);

  useFocusEffect(useCallback(() => {
    (async () => {
      setRates(await getRates());
      setHasToken(!!(await getBrapiToken()));
      if (route.params?.id) {
        const i = await getInvestment(route.params.id);
        setInv(i);
        if (i?.code && isListed(i)) setSymbol(i.code);
        nav.setOptions({ title: i?.code && isListed(i) ? i.code : 'Investimento' });
      } else {
        nav.setOptions({ title: route.params?.symbol ?? 'Analisar ativo' });
      }
      setLoading(false);
    })();
  }, [route.params?.id]));

  const fetchQuote = useCallback(async (sym: string, force = false) => {
    setQLoading(true);
    setQError(null);
    try {
      const q = await getQuote(sym, { force });
      setQuote(q);
      if (!q) setQError('Para ver os números da bolsa, configure o token da brapi em Ajustes.');
    } catch (e: any) {
      setQError(String(e?.message ?? e));
    } finally {
      setQLoading(false);
    }
  }, []);

  useEffect(() => { if (symbol) fetchQuote(symbol); }, [symbol, fetchQuote]);

  const today = todayYmd();
  const fii = inv ? isFii(inv) || /11$/.test(inv.code ?? '') : /11$/.test(symbol ?? '');

  const analysis = useMemo(() => {
    if (!quote) return null;
    const graham = grahamPrice(quote.lpa ?? 0, quote.vpa ?? 0);
    const bazin = bazinPrice(quote.dividends12m ?? 0, 6);
    const teto = bazinPrice(quote.dividends12m ?? 0, fiiYield);
    return {
      readings: fii ? readFii(quote, rates?.cdi ?? null) : readStock(quote),
      graham, bazin, teto,
      mGraham: safetyMargin(graham, quote.price),
      mBazin: safetyMargin(bazin, quote.price),
      mTeto: safetyMargin(teto, quote.price),
    };
  }, [quote, fii, rates, fiiYield]);

  if (loading) return <Loading />;

  // Sem ativo escolhido: caixa para digitar o código
  if (!inv && !symbol) {
    return (
      <Screen edges={['bottom']}>
        <Text style={{ fontSize: 13, color: C.muted, lineHeight: 19 }}>
          Digite o código de uma ação (ex.: ITUB4, WEGE3) ou de um FII (ex.: MXRF11, HGLG11) para ver os indicadores e o preço justo.
        </Text>
        <TextInput
          value={typed}
          onChangeText={(t) => setTyped(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="Código na bolsa"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          style={[ui.input, { fontSize: 20, fontWeight: '800', letterSpacing: 1 }]}
        />
        <PrimaryButton title="Analisar" onPress={() => typed.length >= 5 && setSymbol(typed)} disabled={typed.length < 5} />
        {!hasToken ? (
          <Notice title="Precisa do token da brapi" text="É grátis. Toque para configurar em Ajustes." tone="info" onPress={() => nav.navigate('Tabs', { screen: 'Ajustes' })} />
        ) : null}
      </Screen>
    );
  }

  const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : brl(n));
  const ir = inv ? estimatedIr(inv, today) : null;
  const gain = inv && inv.invested !== null ? inv.balance - inv.invested : inv?.profit ?? null;
  const gainPct = inv && inv.invested ? ((inv.balance - inv.invested) / inv.invested) * 100 : null;
  const held = inv?.purchase_date ? diffDays(inv.purchase_date, today) : null;

  return (
    <Screen edges={['bottom']} refreshing={qLoading} onRefresh={symbol ? () => fetchQuote(symbol, true) : undefined}>
      {/* Cabeçalho */}
      <View style={{ backgroundColor: C.teal, borderRadius: 22, padding: 20, gap: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: C.tealSoft }}>
          {[inv ? assetClass(inv) : fii ? 'FII' : 'Ação', inv?.bank_name, subtypeLabel(inv?.subtype ?? null)].filter(Boolean).join(' · ')}
        </Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>{inv?.name ?? quote?.name ?? symbol}</Text>
        {inv ? <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff' }}>{money(inv.balance)}</Text> : null}
        {quote?.price ? (
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.tealSoft }}>
            Cotação R$ {numText(quote.price)}{quote.changePct !== null ? `  ${quote.changePct >= 0 ? '▲' : '▼'} ${pctText(Math.abs(quote.changePct), 2)} hoje` : ''}
          </Text>
        ) : null}
      </View>

      {/* Dados do seu investimento */}
      {inv ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>Seu investimento</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <StatBox label="Aplicado" value={money(inv.invested)} />
            <StatBox label="Ganho" value={money(gain)} sub={gainPct !== null ? pctText(gainPct) : undefined} tone={gain !== null ? (gain >= 0 ? 'ok' : 'danger') : undefined} />
            {inv.quantity ? <StatBox label="Quantidade" value={numText(inv.quantity, inv.quantity % 1 ? 2 : 0)} sub={inv.invested ? `preço médio R$ ${numText(inv.invested / inv.quantity)}` : undefined} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {inv.rate ? <StatBox label="Taxa contratada" value={inv.rate} /> : null}
            {inv.rate_12m !== null ? (
              <StatBox label="Rendeu em 12 meses" value={pctText(inv.rate_12m)} sub={rates?.cdi ? `${Math.round(pctOfCdi(inv.rate_12m, rates.cdi) ?? 0)}% do CDI` : undefined} />
            ) : null}
            {inv.rate_12m !== null && rates?.ipca12m ? <StatBox label="Acima da inflação" value={pctText(realReturn(inv.rate_12m, rates.ipca12m))} sub="juro real 12m" /> : null}
          </View>
          <View style={{ gap: 6 }}>
            {inv.purchase_date ? <Line label="Aplicado em" value={`${shortDate(inv.purchase_date)}${held !== null ? ` (${held} dias)` : ''}`} /> : null}
            {inv.due_date ? <Line label="Vencimento" value={`${shortDate(inv.due_date)} (faltam ${Math.max(0, diffDays(today, inv.due_date))} dias)`} /> : null}
            {ir ? <Line label="IR se resgatasse hoje" value={ir.rate === 0 ? 'Isento' : `${String(ir.rate).replace('.', ',')}% do lucro ≈ ${money(ir.value)}`} /> : null}
            {inv.issuer ? <Line label="Emissor" value={inv.issuer} /> : null}
            <Line label="Garantia do FGC" value={hasFgc(inv) ? 'Sim, até R$ 250 mil por instituição' : isListed(inv) ? 'Não (renda variável)' : 'Não informado / não se aplica'} />
            <Line label="Origem" value={inv.source === 'manual' ? 'Lançado à mão' : 'Veio do banco (Pluggy)'} />
          </View>
        </Card>
      ) : null}

      {/* Bolsa */}
      {symbol ? (
        <>
          <H2>Indicadores de {symbol}</H2>
          {qError ? (
            <Notice title="Sem dados da bolsa" text={qError} tone="info" onPress={!hasToken ? () => nav.navigate('Tabs', { screen: 'Ajustes' }) : undefined} />
          ) : null}
          {quote && analysis ? (
            <>
              {quote.low52 && quote.high52 && quote.price ? <RangeCard low={quote.low52} high={quote.high52} price={quote.price} /> : null}
              <Card style={{ paddingVertical: 6 }}>
                {analysis.readings.map((r, i) => (
                  <View key={r.key}>
                    {i > 0 ? <RowDivider /> : null}
                    <IndicatorRow name={r.name} value={r.value} verdict={r.verdict} explain={r.explain} />
                  </View>
                ))}
              </Card>
              {quote.partial ? (
                <Text style={{ fontSize: 11, color: C.muted, marginTop: -8 }}>
                  "Sem dado" = a brapi não informou esse número (pode ser limite do plano grátis ou o ativo não ter esse dado).
                </Text>
              ) : null}

              <H2>Preço justo</H2>
              <Card style={{ gap: 12 }}>
                {fii ? (
                  <>
                    <Text style={{ fontSize: 13, color: C.ink2, lineHeight: 18 }}>
                      Preço-teto: o maior preço que ainda entrega o rendimento que você quer, com base nos rendimentos dos últimos 12 meses.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {[7, 8, 9, 10, 12].map((y) => <Chip key={y} label={`${y}% ao ano`} active={fiiYield === y} onPress={() => setFiiYield(y)} />)}
                    </View>
                    <FairRow label={`Preço-teto para ${fiiYield}%`} fair={analysis.teto} margin={analysis.mTeto} />
                  </>
                ) : (
                  <>
                    <FairRow label="Graham √(22,5 × LPA × VPA)" fair={analysis.graham} margin={analysis.mGraham} />
                    <RowDivider />
                    <FairRow label="Bazin (dividendos ÷ 6%)" fair={analysis.bazin} margin={analysis.mBazin} />
                  </>
                )}
                <Text style={{ fontSize: 11, color: C.muted, lineHeight: 16 }}>
                  Margem positiva = preço atual abaixo do preço justo. São estimativas simples, use junto com o resto da análise.
                </Text>
                <TextButton
                  title="Abrir na calculadora"
                  color={C.green}
                  onPress={() => nav.navigate('Calculadoras', { tool: fii ? 'teto' : 'graham', lpa: quote.lpa ?? undefined, vpa: quote.vpa ?? undefined, div12m: quote.dividends12m ?? undefined, price: quote.price ?? undefined })}
                />
              </Card>

              {quote.lastDividends.length ? (
                <>
                  <H2>Últimos proventos (por {fii ? 'cota' : 'ação'})</H2>
                  <Card pad={false}>
                    {quote.lastDividends.slice(0, 8).map((d, i) => (
                      <View key={`${d.date}-${i}`}>
                        {i > 0 ? <RowDivider /> : null}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
                          <Text style={{ fontSize: 13, color: C.ink }}>{shortDate(d.date)}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>R$ {d.value.toFixed(4).replace('.', ',')}</Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                  {inv?.quantity && quote.dividends12m ? (
                    <Text style={{ fontSize: 12, color: C.ink2, marginTop: -8 }}>
                      Com {numText(inv.quantity, 0)} {fii ? 'cotas' : 'ações'}, você recebeu cerca de {money(quote.dividends12m * inv.quantity)} em 12 meses (≈ {money((quote.dividends12m * inv.quantity) / 12)} por mês).
                    </Text>
                  ) : null}
                </>
              ) : null}
            </>
          ) : !qError ? <Empty text="Carregando dados da bolsa..." /> : null}

          <H2>Confira também (o app não mede)</H2>
          <Card style={{ gap: 8 }}>
            {(fii ? FII_CHECKLIST : STOCK_CHECKLIST).map((c) => (
              <View key={c} style={{ flexDirection: 'row', gap: 8 }}>
                <Ionicons name="checkbox-outline" size={16} color={C.green} />
                <Text style={{ flex: 1, fontSize: 13, color: C.ink2, lineHeight: 18 }}>{c}</Text>
              </View>
            ))}
            <TextButton title={fii ? 'Entender os indicadores de FII' : 'Entender os indicadores de ações'} color={C.green} onPress={() => nav.navigate('Guia', { section: fii ? 'fii' : 'acoes' })} />
          </Card>
        </>
      ) : null}

      {inv?.source === 'manual' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <TextButton title="Editar" color={C.green} onPress={() => nav.navigate('Investimento', { id: inv.id })} />
          <TextButton
            title="Apagar"
            color={C.danger}
            onPress={() => Alert.alert('Apagar investimento?', inv.name, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Apagar', style: 'destructive', onPress: async () => { await deleteInvestment(inv.id); nav.goBack(); } },
            ])}
          />
        </View>
      ) : null}

      {!inv && symbol ? <TextButton title="Analisar outro código" onPress={() => { setSymbol(null); setQuote(null); setQError(null); }} /> : null}
      <Text style={{ fontSize: 11, color: C.faint, lineHeight: 16 }}>Conteúdo para estudo, não é recomendação de compra ou venda.</Text>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontSize: 13, color: C.muted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function FairRow({ label, fair, margin }: { label: string; fair: number | null; margin: number | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{label}</Text>
        <Text style={{ fontSize: 11, color: C.muted }}>
          {margin === null ? 'Faltam dados para calcular' : margin >= 0 ? `Margem de segurança de ${pctText(margin, 0)}` : `Preço ${pctText(-margin, 0)} acima do preço justo`}
        </Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: margin === null ? C.faint : margin >= 0 ? C.green : C.warn }}>
        {fair ? `R$ ${numText(fair)}` : '—'}
      </Text>
    </View>
  );
}

function RangeCard({ low, high, price }: { low: number; high: number; price: number }) {
  const p = high > low ? ((price - low) / (high - low)) * 100 : 50;
  return (
    <Card style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>Preço nas últimas 52 semanas</Text>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.track }}>
        <View style={{ position: 'absolute', left: pw(p), top: -4, width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: C.green, borderWidth: 3, borderColor: '#fff' }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, color: C.muted }}>Mínima R$ {numText(low)}</Text>
        <Text style={{ fontSize: 11, color: C.muted }}>Máxima R$ {numText(high)}</Text>
      </View>
    </Card>
  );
}
