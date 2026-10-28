# Financeiro

App Android pessoal para controlar gastos, com os dados dos bancos puxados automaticamente pela [Pluggy](https://pluggy.ai) (Open Finance).

Feito para quem recebe em **duas datas** (5º dia útil e dia 20) e quer saber de qual pagamento sai cada conta.

## O que o app faz

- **Início:** gasto do mês ou de cada ciclo de pagamento, por categoria e por banco/cartão, comparado com o período anterior.
- **Lançamentos:** tudo que veio dos bancos. Cada gasto pode receber categoria, tags, observação e um nome mais claro. Dá para criar regras ("todo PIX para fulano é Lazer"). Também é possível lançar gastos à mão.
- **Contas fixas:** aluguel, luz, internet... com vencimento, valor (fixo ou estimado) e de qual pagamento saem. O app marca como paga sozinho quando encontra o pagamento no extrato.
- **Calendário:** vencimentos e dias de pagamento no mês ou na semana, saldo de cada conta corrente e quanto **sobra** até o próximo salário.
- **Bancos e cartões:** fatura atual, limite usado, fechamento/vencimento e compras do cartão por categoria.
- **Regras de pagamento:** 5º dia útil (sábado conta ou não, pula feriados nacionais) e dia 20 (antecipa ou adia quando cai em fim de semana/feriado).

## Privacidade e segurança

- **Não existe servidor.** Os dados ficam só no celular, num banco SQLite local.
- As chaves da Pluggy (Client ID e Client Secret) são digitadas nos Ajustes do app e guardadas no **cofre do Android** (`expo-secure-store`). Elas **nunca** fazem parte deste código.
- Nunca cole suas chaves em issues, commits ou conversas.

## Instalar no celular

1. Abra a página **Releases** deste repositório no celular.
2. Baixe o arquivo `financeiro-vX.Y.Z.apk` mais recente.
3. Abra o arquivo. O Android vai pedir para **permitir instalar apps desta fonte** (o navegador ou o gerenciador de arquivos). Permita só para isso.
4. **Atualizações:** quando sair uma versão nova, o próprio app mostra um aviso no Início. Toque em **Atualizar** e depois em **Instalar**. Os dados continuam. Na primeira vez, o Android pede para permitir que o Financeiro instale apps: permita.

> O APK é gerado automaticamente pelo GitHub Actions a cada mudança na branch `main` (arquivo `.github/workflows/build-apk.yml`).

## Conectar os bancos (Meu Pluggy, grátis para uso pessoal)

A Pluggy tem um caminho gratuito para ler **os seus próprios dados**, com até 5 conexões. Resumo do [guia oficial](https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use):

1. Entre em **meu.pluggy.ai** e conecte seus bancos (cada banco pede autorização).
2. No **painel da Pluggy** (dashboard), com a mesma conta: *Applications → sua aplicação → Demo → Connect Account* e escolha o conector **MeuPluggy** (não escolha o banco direto nem o Sandbox).
3. Ainda na página *Demo*, em **Connected Items**, copie o **ID** de cada item (um por banco).
4. Em *Applications*, copie o **Client ID**. O **Client Secret** só aparece quando é gerado. Se você perdeu, gere outro.
5. No app, abra **Ajustes**, cole o Client ID e o Client Secret, adicione os IDs dos itens e toque em **Testar e sincronizar agora**.

Observações:
- Os dados do Meu Pluggy se atualizam sozinhos mais ou menos a cada 24 horas.
- A autorização vale **1 ano**. Quando vencer, o app avisa, e basta refazer o passo 2.
- Cartões de benefício (como Ticket) podem não estar disponíveis na Pluggy. Nesse caso, use o botão **+** em Lançamentos para registrar à mão.

## Para desenvolver

Requisitos: Node.js 20+, e para rodar no celular o app **Expo Go** ou um emulador Android.

```bash
npm install
npx expo install --fix   # alinha as versões das bibliotecas com o Expo
npm test                 # testes das regras de pagamento, categorias e contas
npx tsc --noEmit         # conferência de tipos
npx expo start           # abre o servidor de desenvolvimento
```

Estrutura:

```
App.tsx                 navegação (abas + telas)
src/db.ts               banco de dados local (SQLite)
src/pluggy.ts           conexão com a API da Pluggy
src/data.ts             junta os dados de um mês para as telas
src/lib/paydays.ts      5º dia útil, dia 20, feriados e ciclos
src/lib/bills.ts        contas fixas: vencimento e "já foi paga?"
src/lib/categories.ts   categorias padrão, sugestão automática e regras
src/screens/            telas
tests/                  testes automáticos
```

## Licença

MIT
