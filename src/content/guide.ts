// Guia de análise de investimentos, em linguagem simples.
// Conteúdo educativo: não é recomendação de compra ou venda.
// Regras de imposto e FGC conferidas em out/2026.

export type Topic = {
  title: string;
  body: string; // explicação simples
  formula?: string; // como calcula
  reference?: string; // faixa de referência comum no mercado (não é regra)
};

export type Section = {
  id: string;
  title: string;
  icon: string; // nome do ícone (Ionicons)
  intro: string;
  topics: Topic[];
};

export const GUIDE: Section[] = [
  {
    id: 'base',
    title: 'Antes de analisar qualquer coisa',
    icon: 'compass-outline',
    intro: 'Três perguntas vêm antes de escolher um investimento: para que é o dinheiro, quando você vai precisar dele e quanto de sobe-e-desce você aguenta.',
    topics: [
      {
        title: 'Reserva de emergência',
        body: 'É o dinheiro para imprevistos (perder o emprego, conserto, saúde). Fica em algo seguro e que você resgata no mesmo dia, como Tesouro Selic ou CDB com liquidez diária. Costuma-se guardar de 6 a 12 meses de gastos. Só depois dela faz sentido ir para a bolsa.',
      },
      {
        title: 'Prazo e objetivo',
        body: 'Dinheiro que você vai usar em menos de 2 anos não deveria estar em ações, porque elas podem estar em baixa justo quando você precisar. Para 5, 10, 20 anos, a oscilação pesa menos e a renda variável tende a compensar.',
      },
      {
        title: 'Risco, retorno e liquidez',
        body: 'É como um triângulo: dificilmente um investimento é ao mesmo tempo muito seguro, muito rentável e fácil de resgatar. Se oferecerem os três, desconfie. Liquidez é a rapidez para transformar o investimento em dinheiro.',
      },
      {
        title: 'Diversificação',
        body: 'É não colocar todos os ovos na mesma cesta: misturar tipos (renda fixa, ações, FIIs), setores e instituições. Assim um problema num lugar não derruba a carteira inteira. O painel desta aba mostra como sua carteira está dividida.',
      },
      {
        title: 'Rebalanceamento',
        body: 'Você define uma divisão alvo (ex.: 70% renda fixa, 20% FIIs, 10% ações). Com o tempo, um pedaço cresce mais que o outro. De tempos em tempos (a cada 6 ou 12 meses), você aporta mais no que ficou para trás para voltar à divisão alvo. Na prática, isso faz comprar o que está mais barato.',
      },
    ],
  },
  {
    id: 'rf',
    title: 'Renda fixa',
    icon: 'shield-checkmark-outline',
    intro: 'Você empresta dinheiro (para o governo, um banco ou uma empresa) e recebe juros. As regras do rendimento são combinadas na hora da compra.',
    topics: [
      {
        title: 'CDI e Selic',
        body: 'A Selic é a taxa básica de juros do país, definida pelo Banco Central. O CDI é a taxa que os bancos cobram entre si, e anda quase colada na Selic. A maioria dos CDBs e fundos de renda fixa rende "X% do CDI". O painel mostra o CDI e a Selic atuais, puxados direto do Banco Central.',
        reference: '100% do CDI é o ponto de comparação. Acima disso é bom para renda fixa de banco grande; muito acima (ex.: 130%+) costuma vir com mais risco.',
      },
      {
        title: 'Pós-fixado, prefixado e IPCA+',
        body: 'Pós-fixado: rende conforme o CDI ou a Selic (acompanha os juros). Prefixado: você já sabe a taxa (ex.: 13% ao ano), bom se os juros caírem depois. IPCA+: rende a inflação mais uma taxa fixa (ex.: IPCA + 6%), protege o poder de compra no longo prazo.',
      },
      {
        title: 'Rentabilidade real',
        body: 'É quanto o dinheiro cresceu de verdade, descontando a inflação. Render 10% num ano com inflação de 5% significa que seu poder de compra cresceu só uns 4,8%.',
        formula: 'Real = (1 + taxa) ÷ (1 + inflação) − 1',
      },
      {
        title: 'Imposto de renda (tabela regressiva)',
        body: 'CDB, Tesouro Direto, debêntures comuns e fundos de renda fixa pagam IR só sobre o lucro, e a alíquota cai quanto mais tempo o dinheiro fica aplicado. O banco já desconta no resgate. LCI, LCA, CRI, CRA e debêntures incentivadas são isentas para pessoa física.',
        reference: 'Até 180 dias: 22,5% · 181 a 360: 20% · 361 a 720: 17,5% · acima de 720: 15%. Resgate antes de 30 dias também paga IOF.',
      },
      {
        title: 'Comparar LCI/LCA com CDB',
        body: 'Como a LCI/LCA não paga IR, 90% do CDI nela pode valer mais que 105% do CDI num CDB. Para comparar, converta a taxa isenta no "equivalente com imposto". A calculadora desta aba faz essa conta.',
        formula: 'Equivalente = taxa isenta ÷ (1 − alíquota do IR)',
      },
      {
        title: 'FGC (garantia)',
        body: 'O Fundo Garantidor de Créditos devolve seu dinheiro se o banco quebrar, para CDB, LCI, LCA, LC, RDB e poupança. Tesouro Direto não tem FGC, mas a garantia é do próprio governo. Debêntures, CRI e CRA não têm FGC.',
        reference: 'Até R$ 250 mil por CPF por instituição, com teto de R$ 1 milhão a cada 4 anos.',
      },
      {
        title: 'Liquidez e vencimento',
        body: 'Liquidez diária: resgata quando quiser. Liquidez no vencimento: o dinheiro fica preso até a data combinada. No Tesouro Prefixado e IPCA+, vender antes do vencimento pode dar lucro ou prejuízo, porque o preço do título muda com os juros (a chamada marcação a mercado).',
      },
    ],
  },
  {
    id: 'acoes',
    title: 'Ações: os indicadores',
    icon: 'bar-chart-outline',
    intro: 'Comprar uma ação é virar sócio de uma empresa. A análise fundamentalista olha a "saúde" e o preço da empresa, como quem compra um negócio inteiro. Nenhum indicador sozinho decide: eles se completam.',
    topics: [
      {
        title: 'P/L (Preço sobre Lucro)',
        body: 'Quantos anos de lucro seriam necessários para "pagar" o preço da ação, se o lucro ficasse igual. P/L 8 = 8 anos. Mais baixo parece mais barato, mas pode indicar que o mercado espera queda no lucro.',
        formula: 'P/L = preço da ação ÷ lucro por ação (LPA)',
        reference: 'Muito usado: abaixo de 10 barato, 10–20 normal, acima de 20 caro. Varia bastante por setor.',
      },
      {
        title: 'P/VP (Preço sobre Valor Patrimonial)',
        body: 'Compara o preço com o "valor contábil" da empresa (o que sobraria se vendesse tudo e pagasse as dívidas). P/VP 1 = paga-se o patrimônio exato. Bancos e empresas com muitos ativos físicos costumam ser analisados por aqui.',
        formula: 'P/VP = preço ÷ valor patrimonial por ação (VPA)',
        reference: 'Abaixo de 1 pode estar descontado; acima de 3 o mercado aposta muito no futuro.',
      },
      {
        title: 'Dividend Yield (DY)',
        body: 'Quanto a empresa devolveu em dinheiro (dividendos e JCP) nos últimos 12 meses, em relação ao preço. Funciona como o "aluguel" da ação.',
        formula: 'DY = proventos pagos em 12 meses ÷ preço × 100',
        reference: 'Acima de 6% é considerado alto (é o critério de Bazin). Cuidado com DY alto por lucro que não vai se repetir.',
      },
      {
        title: 'ROE (Retorno sobre o Patrimônio)',
        body: 'Quanto de lucro a empresa gera para cada R$ 100 do dinheiro dos sócios. Mostra se a empresa é eficiente. Um ROE alto e constante por vários anos é sinal de negócio bom.',
        formula: 'ROE = lucro líquido ÷ patrimônio líquido × 100',
        reference: 'Acima de 15% é considerado bom.',
      },
      {
        title: 'Margem líquida',
        body: 'De cada R$ 100 vendidos, quanto sobra de lucro no fim. Compare com empresas do mesmo setor: supermercado tem margem baixa por natureza; software, alta.',
        formula: 'Margem = lucro líquido ÷ receita × 100',
      },
      {
        title: 'Endividamento',
        body: 'Dívida em excesso deixa a empresa frágil quando os juros sobem ou as vendas caem. Os indicadores mais usados são Dívida líquida ÷ EBITDA (quantos anos de geração de caixa para pagar a dívida) e Dívida ÷ Patrimônio.',
        reference: 'Dívida líquida/EBITDA abaixo de 2 costuma ser confortável; acima de 3, atenção.',
      },
      {
        title: 'EV/EBITDA',
        body: 'Parecido com o P/L, mas considera também a dívida da empresa e olha a geração de caixa da operação (EBITDA). Bom para comparar empresas com níveis de dívida diferentes.',
        reference: 'Abaixo de 6 costuma ser visto como barato; depende do setor.',
      },
      {
        title: 'Crescimento e histórico',
        body: 'Veja o lucro e a receita dos últimos 5 a 10 anos. Empresas que crescem com consistência, sem prejuízos frequentes, tendem a ser mais previsíveis. Um ano isolado bom ou ruim diz pouco.',
      },
    ],
  },
  {
    id: 'metodos',
    title: 'Métodos de análise de ações',
    icon: 'school-outline',
    intro: 'São "receitas" famosas que juntam indicadores para estimar se uma ação está barata. Cada uma tem limitações; o ideal é usar mais de uma e entender a empresa.',
    topics: [
      {
        title: 'Preço justo de Graham',
        body: 'Benjamin Graham, professor de Warren Buffett, criou uma conta simples para empresas estáveis e lucrativas. Ela combina lucro e patrimônio para chegar num preço máximo razoável. Não serve bem para empresas com prejuízo ou em forte crescimento.',
        formula: 'Preço justo = √(22,5 × LPA × VPA)',
        reference: 'Se o preço atual está bem abaixo do preço justo, existe a chamada "margem de segurança".',
      },
      {
        title: 'Método Bazin (dividendos)',
        body: 'Décio Bazin, investidor brasileiro, só comprava ações que pagassem pelo menos 6% ao ano em dividendos. O "preço-teto" é o maior preço que garante esse rendimento. Ele também exigia empresas com pouca dívida e lucro constante.',
        formula: 'Preço-teto = dividendos dos últimos 12 meses ÷ 0,06',
      },
      {
        title: 'Fluxo de caixa descontado',
        body: 'É o método mais completo, usado por analistas profissionais. Você estima quanto dinheiro a empresa vai gerar nos próximos anos e traz esse valor para hoje, descontando uma taxa de juros. Analogia: quanto você pagaria hoje por uma máquina que vai render R$ 1.000 por ano durante 10 anos? Depende muito das premissas, então pequenas mudanças mudam bastante o resultado.',
      },
      {
        title: 'Fórmula Mágica (Joel Greenblatt)',
        body: 'Ordena as empresas por duas notas: as mais baratas (EV/EBIT baixo) e as mais eficientes (ROIC alto, retorno sobre o capital investido). Compra-se as que somam as melhores posições e repete-se uma vez por ano. É um método de "regras fixas", sem achismo.',
      },
      {
        title: 'Buy and hold (comprar e segurar)',
        body: 'Escolher empresas sólidas, que você entende, e manter por muitos anos, reinvestindo os dividendos. O foco não é acertar o melhor momento, e sim ficar sócio de bons negócios enquanto eles crescem.',
      },
      {
        title: 'Análise técnica (gráficos)',
        body: 'Olha o gráfico de preço para tentar prever movimentos de curto prazo: tendências, suportes e resistências, médias móveis e volume. É mais usada por quem faz operações rápidas (trade). Para quem investe no longo prazo, a análise fundamentalista costuma pesar mais.',
      },
    ],
  },
  {
    id: 'fii',
    title: 'Fundos imobiliários (FIIs)',
    icon: 'business-outline',
    intro: 'Um FII junta dinheiro de muitas pessoas para investir em imóveis ou em títulos do setor imobiliário. Você recebe "aluguéis" todo mês, isentos de IR para pessoa física (cumpridos os requisitos legais). O lucro na venda das cotas paga 20%.',
    topics: [
      {
        title: 'Tipos de FII',
        body: 'Tijolo: tem imóveis de verdade (shoppings, galpões, lajes corporativas, agências). Papel: investe em títulos de dívida imobiliária (CRI), rende conforme CDI ou IPCA. Fundo de fundos (FoF): compra cotas de outros FIIs. Híbrido: mistura. Cada tipo é analisado com olhos diferentes.',
      },
      {
        title: 'Dividend Yield do FII',
        body: 'Quanto o fundo pagou em rendimentos nos últimos 12 meses em relação ao preço da cota. Compare com o CDI e com fundos do mesmo tipo. Um DY muito acima dos outros pode indicar problema (inadimplência, venda de imóvel que não se repete).',
        formula: 'DY = rendimentos de 12 meses ÷ preço da cota × 100',
      },
      {
        title: 'P/VP do FII',
        body: 'Compara o preço da cota na bolsa com o valor dos imóveis/títulos do fundo. P/VP 0,90 = você paga R$ 0,90 por cada R$ 1,00 de patrimônio. Muito abaixo de 1 pode ser oportunidade ou sinal de que o mercado vê risco.',
        reference: 'Comum considerar entre 0,90 e 1,05 como faixa razoável.',
      },
      {
        title: 'Vacância (FII de tijolo)',
        body: 'É a parte dos imóveis que está vazia. Vacância física = área sem inquilino. Vacância financeira = aluguel que deixou de entrar. Imóvel vazio não paga aluguel, então menor é melhor.',
        reference: 'Abaixo de 10% costuma ser saudável; compare com a média do segmento.',
      },
      {
        title: 'Qualidade dos imóveis e contratos',
        body: 'Localização, idade dos imóveis, quantidade de inquilinos (depender de um só é arriscado) e tipo de contrato. Contrato típico pode ser renegociado; contrato atípico é longo e com multa alta de saída, dá mais previsibilidade. O WAULT é o prazo médio que falta para os contratos vencerem.',
      },
      {
        title: 'FII de papel: o que olhar',
        body: 'Indexador dos CRIs (CDI ou IPCA), qualidade de quem deve (high grade = devedores sólidos; high yield = paga mais, com mais risco), garantias, LTV (quanto a dívida representa do valor do imóvel dado em garantia) e inadimplência.',
      },
      {
        title: 'Liquidez, gestão e taxas',
        body: 'Liquidez diária: quanto se negocia por dia na bolsa (pouca liquidez dificulta vender). Número de cotistas e histórico do gestor também importam. Taxa de administração e de performance saem do rendimento que você recebe.',
        reference: 'Liquidez acima de R$ 1 milhão por dia costuma ser confortável para o pequeno investidor.',
      },
      {
        title: 'Preço-teto do FII',
        body: 'Mesma ideia do Bazin: defina o rendimento mínimo que você quer (por exemplo, o CDI menos o IR que você economiza, ou 8% ao ano) e veja até que preço a cota entrega isso.',
        formula: 'Preço-teto = rendimentos de 12 meses ÷ rendimento desejado',
      },
    ],
  },
  {
    id: 'fundos',
    title: 'Fundos de investimento e ETFs',
    icon: 'layers-outline',
    intro: 'Num fundo, um gestor profissional escolhe os investimentos por você, cobrando uma taxa. ETFs são fundos negociados na bolsa que copiam um índice (como o Ibovespa).',
    topics: [
      {
        title: 'Taxas',
        body: 'Taxa de administração é cobrada todo ano sobre o total, ganhe ou perca. Taxa de performance é uma parte do que passar de uma meta (ex.: 20% do que exceder o CDI). Num fundo de renda fixa simples, taxa alta come boa parte do rendimento.',
        reference: 'Renda fixa simples: acima de 0,5% ao ano já é cara. ETFs costumam cobrar bem menos que fundos ativos.',
      },
      {
        title: 'Compare com o índice certo',
        body: 'Fundo de renda fixa ou multimercado se compara com o CDI. Fundo de ações, com o Ibovespa. Se em vários anos o fundo perde para o índice, um ETF barato pode ser melhor.',
      },
      {
        title: 'Come-cotas',
        body: 'Fundos abertos de renda fixa e multimercado antecipam o IR duas vezes por ano (maio e novembro), diminuindo a quantidade de cotas. Fundos de ações e ETFs não têm come-cotas.',
      },
      {
        title: 'Volatilidade e índice de Sharpe',
        body: 'Volatilidade mede o quanto o fundo sobe e desce. O índice de Sharpe mostra se o retorno extra compensou esse sobe-e-desce: quanto maior, melhor a relação retorno/risco.',
        formula: 'Sharpe = (retorno do fundo − CDI) ÷ volatilidade',
      },
    ],
  },
  {
    id: 'ir',
    title: 'Imposto de renda em 2026 (resumo)',
    icon: 'document-text-outline',
    intro: 'Regras em vigor para pessoa física, conferidas em outubro de 2026. Em caso de dúvida na declaração, vale falar com um contador.',
    topics: [
      { title: 'Renda fixa tributada', body: 'Tabela regressiva de 22,5% a 15% sobre o lucro, descontada no resgate pelo banco.' },
      { title: 'Isentos', body: 'LCI, LCA, CRI, CRA, debêntures incentivadas, poupança e rendimentos mensais de FIIs (cumpridos os requisitos).' },
      { title: 'Ações', body: 'Vendas de até R$ 20 mil por mês no mercado à vista são isentas. Acima disso, 15% sobre o lucro (day trade: 20%), pagos por você via DARF até o fim do mês seguinte.' },
      { title: 'FIIs (venda de cotas)', body: '20% sobre o lucro na venda, sem a isenção dos R$ 20 mil, pago via DARF.' },
      { title: 'Dividendos e JCP', body: 'Dividendos seguem isentos para a maioria das pessoas; desde 2026 há retenção de 10% só quando uma mesma empresa paga mais de R$ 50 mil por mês à mesma pessoa. JCP tem 17,5% retido na fonte.' },
    ],
  },
];

export const DISCLAIMER =
  'Este guia e os números do app são para estudo e organização. Não são recomendação de compra ou venda. As faixas de referência são usadas por muita gente no mercado, mas não são regras: cada setor e cada momento têm suas particularidades.';
