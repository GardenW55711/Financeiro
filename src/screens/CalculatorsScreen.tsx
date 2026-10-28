// Calculadoras: Graham, Bazin, preço-teto de FII, LCI x CDB e juro real.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Card, Chip, Field, Screen } from '../components/ui';
import { numText, pctText } from '../components/invest';
import { C } from '../theme';
import { RootStackParamList } from '../navigation';
import { getRates } from '../market';
import { bazinPrice, grahamPrice, grossEquivalent, irRate, realReturn, safetyMargin } from '../lib/portfolio';
import { moneyInput, parseMoney } from '../lib/format';

type Tool = 'graham' | 'bazin' | 'teto' | 'lci' | 'real';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'graham', label: 'Graham' },
  { id: 'bazin', label: 'Bazin' },
  { id: 'teto', label: 'Preço-teto FII' },
  { id: 'lci', label: 'LCI x CDB' },
  { id: 'real', label: 'Juro real' },
];

const num = (s: string) => parseMoney(s);

export default function CalculatorsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Calculadoras'>>();
  const p: NonNullable<RootStackParamList['Calculadoras']> = route.params ?? {};
  const [tool, setTool] = useState<Tool>((p.tool as Tool) ?? 'graham');
  const [lpa, setLpa] = useState(moneyInput(p.lpa));
  const [vpa, setVpa] = useState(moneyInput(p.vpa));
  const [price, setPrice] = useState(moneyInput(p.price));
  const [div, setDiv] = useState(moneyInput(p.div12m));
  const [yieldPct, setYieldPct] = useState(p.tool === 'teto' ? '8' : '6');
  const [exempt, setExempt] = useState('90');
  const [days, setDays] = useState('720');
  const [nominal, setNominal] = useState('');
  const [infl, setInfl] = useState('');

  useEffect(() => {
    getRates().then((r) => {
      if (r.ipca12m !== null) setInfl((v) => v || String(r.ipca12m).replace('.', ','));
      if (r.cdi !== null) setNominal((v) => v || String(r.cdi).replace('.', ','));
    });
  }, []);

  const pr = num(price);

  return (
    <Screen edges={['bottom']}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TOOLS.map((t) => <Chip key={t.id} label={t.label} active={tool === t.id} onPress={() => { setTool(t.id); if (t.id === 'teto' && yieldPct === '6') setYieldPct('8'); }} />)}
      </View>

      {tool === 'graham' ? (
        <Calc
          title="Preço justo de Graham"
          help="Para empresas estáveis e com lucro. LPA = lucro por ação nos últimos 12 meses. VPA = valor patrimonial por ação. Os dois aparecem em sites como Status Invest, Investidor10 ou no relatório da empresa."
          formula="√(22,5 × LPA × VPA)"
        >
          <Field label="LPA (R$)" value={lpa} onChangeText={setLpa} keyboardType="decimal-pad" placeholder="Ex.: 4,20" />
          <Field label="VPA (R$)" value={vpa} onChangeText={setVpa} keyboardType="decimal-pad" placeholder="Ex.: 25,00" />
          <Field label="Preço atual (R$)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" optional placeholder="Para ver a margem de segurança" />
          <Result fair={grahamPrice(num(lpa), num(vpa))} price={pr} />
        </Calc>
      ) : null}

      {tool === 'bazin' || tool === 'teto' ? (
        <Calc
          title={tool === 'bazin' ? 'Preço-teto de Bazin (ações)' : 'Preço-teto de FII'}
          help={tool === 'bazin'
            ? 'Some os dividendos e JCP pagos por ação nos últimos 12 meses. Bazin exigia no mínimo 6% ao ano.'
            : 'Some os rendimentos pagos por cota nos últimos 12 meses e escolha o rendimento anual que você quer receber.'}
          formula="dividendos de 12 meses ÷ rendimento desejado"
        >
          <Field label={tool === 'bazin' ? 'Dividendos por ação em 12 meses (R$)' : 'Rendimentos por cota em 12 meses (R$)'} value={div} onChangeText={setDiv} keyboardType="decimal-pad" placeholder="Ex.: 1,20" />
          <Field label="Rendimento desejado (% ao ano)" value={yieldPct} onChangeText={setYieldPct} keyboardType="decimal-pad" />
          <Field label="Preço atual (R$)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" optional />
          <Result fair={bazinPrice(num(div), num(yieldPct))} price={pr} />
          {num(div) > 0 && pr > 0 ? (
            <Text style={{ fontSize: 13, color: C.ink2 }}>No preço atual, o rendimento (DY) é de {pctText((num(div) / pr) * 100)} ao ano.</Text>
          ) : null}
        </Calc>
      ) : null}

      {tool === 'lci' ? (
        <Calc
          title="LCI/LCA x CDB"
          help="LCI e LCA não pagam imposto de renda. Esta conta mostra quanto um CDB (que paga IR) precisa render para empatar."
          formula="taxa isenta ÷ (1 − alíquota do IR)"
        >
          <Field label="Taxa da LCI/LCA (% do CDI)" value={exempt} onChangeText={setExempt} keyboardType="decimal-pad" />
          <Field label="Prazo (dias)" value={days} onChangeText={setDays} keyboardType="number-pad" />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[['6 meses', '180'], ['1 ano', '360'], ['2 anos', '720'], ['3 anos', '1080']].map(([l, d]) => <Chip key={d} label={l} active={days === d} onPress={() => setDays(d)} />)}
          </View>
          {num(exempt) > 0 && num(days) > 0 ? (
            <Card style={{ backgroundColor: C.greenSoft, gap: 4 }}>
              <Text style={{ fontSize: 13, color: C.greenDark, fontWeight: '700' }}>Um CDB precisaria render</Text>
              <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>{numText(grossEquivalent(num(exempt), num(days)), 1)}% do CDI</Text>
              <Text style={{ fontSize: 12, color: C.ink2 }}>IR nesse prazo: {String(irRate(num(days))).replace('.', ',')}%. Abaixo disso, a LCI/LCA rende mais.</Text>
            </Card>
          ) : null}
        </Calc>
      ) : null}

      {tool === 'real' ? (
        <Calc
          title="Juro real (acima da inflação)"
          help="Quanto seu dinheiro cresce de verdade, descontando a inflação. Já vem preenchido com o CDI e o IPCA atuais."
          formula="(1 + taxa) ÷ (1 + inflação) − 1"
        >
          <Field label="Rendimento (% ao ano)" value={nominal} onChangeText={setNominal} keyboardType="decimal-pad" />
          <Field label="Inflação (% ao ano)" value={infl} onChangeText={setInfl} keyboardType="decimal-pad" />
          {Number.isFinite(num(nominal)) && Number.isFinite(num(infl)) && nominal && infl ? (
            <Card style={{ backgroundColor: C.greenSoft, gap: 4 }}>
              <Text style={{ fontSize: 13, color: C.greenDark, fontWeight: '700' }}>Ganho real</Text>
              <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>{pctText(realReturn(num(nominal), num(infl)), 2)} ao ano</Text>
              <Text style={{ fontSize: 12, color: C.ink2 }}>R$ 10.000 ganhariam cerca de R$ {numText((10000 * realReturn(num(nominal), num(infl))) / 100, 0)} de poder de compra em 1 ano (antes do IR).</Text>
            </Card>
          ) : null}
        </Calc>
      ) : null}

      <Text style={{ fontSize: 11, color: C.faint, lineHeight: 16 }}>Contas para estudo, não são recomendação de compra ou venda.</Text>
    </Screen>
  );
}

function Calc({ title, help, formula, children }: { title: string; help: string; formula: string; children: React.ReactNode }) {
  return (
    <Card style={{ gap: 14 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{title}</Text>
      <Text style={{ fontSize: 13, color: C.ink2, lineHeight: 19 }}>{help}</Text>
      <View style={{ backgroundColor: C.track, borderRadius: 10, padding: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{formula}</Text>
      </View>
      {children}
    </Card>
  );
}

function Result({ fair, price }: { fair: number | null; price: number }) {
  if (!fair) return <Text style={{ fontSize: 13, color: C.muted }}>Preencha os campos para ver o resultado.</Text>;
  const m = safetyMargin(fair, price > 0 ? price : null);
  return (
    <Card style={{ backgroundColor: C.greenSoft, gap: 4 }}>
      <Text style={{ fontSize: 13, color: C.greenDark, fontWeight: '700' }}>Preço justo estimado</Text>
      <Text style={{ fontSize: 28, fontWeight: '800', color: C.ink }}>R$ {numText(fair)}</Text>
      {m !== null ? (
        <Text style={{ fontSize: 13, fontWeight: '700', color: m >= 0 ? C.green : C.warn }}>
          {m >= 0 ? `Preço atual ${pctText(m, 0)} abaixo (margem de segurança)` : `Preço atual ${pctText(-m, 0)} acima do preço justo`}
        </Text>
      ) : null}
    </Card>
  );
}
