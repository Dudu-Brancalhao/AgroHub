# AgroHub — Interface Web

Interface web do AgroHub: cadastro de produtores rurais, suas propriedades e as safras
plantadas, com um painel que resume o cadastro inteiro.

A aplicação consome a API do AgroHub (pasta `backend/`) pelo contrato HTTP já publicado. Nenhuma
alteração no backend é necessária para rodar esta interface.

## O que dá para fazer

- **Dashboard** — total de fazendas e de hectares, com três recortes: fazendas por estado,
  hectares por cultura e hectares por uso do solo.
- **Produtores** — lista paginada com busca por nome ou documento, além de cadastro, edição e
  exclusão. Dentro de cada produtor ficam as fazendas e o que foi plantado em cada safra.
- **Safras** — lista de safras compartilhadas por todo o cadastro, com cadastro, edição e
  exclusão, e a visão do que foi plantado em cada uma.

## Pré-requisitos

- Node.js 20 ou superior
- A API rodando em `http://localhost:3000` (na raiz do repositório: `docker compose up -d`)

## Como rodar

```bash
cp .env.example .env
npm install
npm run dev
```

A interface sobe em <http://localhost:5173>.

### Por que duas portas

A API ocupa a porta 3000, então o servidor de desenvolvimento usa a 5173. Todas as chamadas do
navegador são relativas (`/api/...`) e o Vite as encaminha para a API. Assim o navegador enxerga
uma única origem — o que importa porque a API não habilita CORS.

**Em produção, o bundle e a API precisam ser servidos pela mesma origem**, com um proxy reverso
mandando `/api/*` para a API e devolvendo `index.html` para qualquer outro caminho. Sem esse
retorno para o `index.html`, recarregar um endereço como `/produtores/<id>` responde 404.

Na Vercel, isso é um `vercel.json` na raiz do projeto:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://agrohub-production.up.railway.app/api/:path*"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Enquanto esse arquivo não existir, a versão publicada carrega em `/` mas responde 404 em qualquer
outra rota e não alcança a API. Veja o [README da raiz](../README.md#acesso-rápido).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com recarga automática |
| `npm run build` | Verifica os tipos e gera o bundle de produção em `dist/` |
| `npm run preview` | Serve o bundle já construído em `4173`, com o mesmo proxy de `/api` |
| `npm test` | Roda todos os testes (Jest + React Testing Library) |
| `npm run test:watch` | Testes em modo observador |
| `npm run lint` | ESLint sobre `src/` |
| `npm run typecheck` | Verificação de tipos sem gerar arquivos |

Antes de qualquer merge, tudo isto precisa passar:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Como o código está organizado

```text
src/
├── app/         store, hooks tipados e a tabela de rotas
├── layout/      o esqueleto fixo: cabeçalho, menu lateral e transição de página
├── features/    uma pasta por domínio (auth, dashboard, producers, properties, harvests),
│                cada uma com sua fatia do estado, seu módulo de API e suas telas
├── components/  componentes compartilhados sem domínio (botão, campo, modal, esqueleto…)
├── icons/       ícones do Material Icons, reexportados por papel
├── lib/         regras puras: cliente HTTP, áreas, CPF/CNPJ, formatação, UFs
├── styles/      tema, estilo global e animações
└── config/      leitura de variáveis de ambiente
```

A direção das dependências é sempre a mesma: **componente → hook → thunk/fatia → módulo de API →
cliente HTTP**. `lib/httpClient.ts` é o único arquivo que chama `fetch`, e o ESLint recusa
qualquer outro que tente.

## Decisões que valem conhecer

- **Áreas são inteiros.** Um hectare é guardado como centésimos de hectare (`"1500.11"` vira
  `150011`). Em ponto flutuante, `1000 + 500.11` dá `1500.1100000000001` e a interface recusaria
  uma fazenda válida de 1500,11 ha — que o servidor aceita.
- **Estado no Redux, escrito à mão.** Redux Toolkit com fatias e thunks explícitos, para que o
  formato do estado continue legível. Cada operação expõe `idle`, `pending`, `succeeded` ou
  `failed`, e uma resposta que chega depois de o usuário sair da tela é descartada.
- **Os ícones vêm do Material Icons**, mas passam todos por `src/icons/index.tsx`, que os
  reexporta com nomes de papel (`ProducersIcon`, `TrashIcon`). O resto do código nunca importa a
  biblioteca direto, então trocar um ícone — ou a biblioteca inteira — mexe em um arquivo só.
- **Os gráficos são feitos aqui.** Nenhuma biblioteca de gráficos: `PieChart.tsx` desenha as
  roscas do painel em SVG, com uma paleta de seis cores validada para daltonismo. Cada fatia
  aparece também na legenda como texto, para que a identidade nunca dependa só da cor.
- **O token fica no `localStorage`**, para sobreviver a um recarregamento. Sair da conta em uma
  aba desconecta as outras.
- **Em desenvolvimento, cada requisição sai duas vezes.** É o `StrictMode` do React 18, que monta,
  desmonta e remonta cada componente para expor efeitos que não aguentam rodar de novo. Vale só no
  modo de desenvolvimento: `npm run build` remove esse comportamento. Para conferir com os próprios
  olhos, rode `npm run preview` e olhe a aba de rede — uma requisição por chamada.

## Testes

Os testes rodam em jsdom, sem rede e sem servidor. O módulo de API de cada feature é o único
ponto de mock, então cada tela é exercitada nos quatro estados: carregando, com dados, vazia e
com erro.

```bash
npm test
```
