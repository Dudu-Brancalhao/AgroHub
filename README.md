# AgroHub

Cadastro de produtores rurais: quem produz, em quais fazendas, e o que foi plantado em cada safra.
Uma API em NestJS, uma interface em React e um painel que resume o cadastro inteiro — total de
fazendas e hectares, com recortes por estado, por cultura e por uso do solo.

---

## Acesso rápido

| | Endereço |
|---|---|
| **Aplicação web** | https://agrohub-three.vercel.app/ |
| **API** | https://agrohub-production.up.railway.app |
| **Swagger** | https://agrohub-production.up.railway.app/api/docs |

O Swagger é o caminho mais rápido para conhecer a API: ele lista todas as rotas, aceita o token no
botão **Authorize** e permite disparar cada chamada direto do navegador.

---

## Funcionalidades Principais

**Dashboard** — total de fazendas e de hectares cadastrados, com três recortes em gráficos de
pizza: por estado, por cultura e por uso do solo (agricultável, vegetação e o que sobra sem
classificação).

**Produtores** — lista paginada com busca por nome ou documento, mais cadastro, edição e exclusão.
Dentro de cada produtor ficam suas fazendas, e dentro de cada fazenda o que foi plantado em cada
safra.

**Safras** — as safras são compartilhadas por todo o cadastro: existe uma "2021", não uma por
fazenda. Dá para cadastrar, editar, excluir e ver tudo o que foi plantado em cada uma.

---

## Arquitetura

```mermaid
flowchart LR
    B["Navegador"] --> V["Vite :5173 (dev)<br/>Vercel (prod)<br/>proxy /api"]
    V --> A["API NestJS<br/>prefixo /api"]
    A --> D[("PostgreSQL 16")]
    A -.-> S["Swagger<br/>/api/docs"]
```

```
AgroHub/
├── backend/                      API NestJS + Prisma
│   ├── prisma/
│   │   ├── schema.prisma         tabelas, índices e chaves estrangeiras
│   │   ├── migrations/           histórico versionado, aplicado no boot do container
│   │   └── seed.ts               dados de exemplo
│   ├── src/
│   │   ├── producers/            um domínio completo — as três camadas, lado a lado
│   │   │   ├── *.controller.ts   recebe, valida via DTO, delega
│   │   │   ├── *.service.ts      a regra de negócio
│   │   │   ├── *.repository.ts   o único que fala Prisma
│   │   │   ├── *.module.ts       liga os três
│   │   │   ├── dto/              o que ENTRA, validado no request
│   │   │   └── entities/         o que SAI, projetado para a resposta
│   │   ├── properties/           fazendas e culturas, mesma estrutura
│   │   ├── harvests/             safras, mesma estrutura
│   │   ├── dashboard/            os números consolidados, mesma estrutura
│   │   ├── auth/                 login, registro, guards e strategies
│   │   ├── users/                só módulo, repositório e entidade — quem expõe é o auth
│   │   ├── common/               filtros, decorators, validação e configuração do Swagger
│   │   ├── config/               variáveis de ambiente validadas no boot
│   │   ├── throttling/           limites de tentativa, persistidos no banco
│   │   └── health/               a única rota pública além do login e do cadastro
│   └── test/                     cinco projetos Jest, de unit a security
├── frontend/                     Interface React + Redux
│   └── src/
│       ├── features/             uma pasta por domínio (auth, dashboard, producers…)
│       ├── components/           componentes compartilhados, sem domínio
│       ├── lib/                  regras puras (áreas, CPF/CNPJ, formatação, httpClient)
│       ├── app/                  store, hooks tipados e a tabela de rotas
│       ├── layout/               cabeçalho, menu lateral e transição de página
│       ├── icons/                Material Icons reexportados por papel
│       ├── styles/               tema, estilo global e animações
│       └── config/               leitura das variáveis de ambiente
├── specs/                        Especificação de cada entrega
├── .specify/                     constituição do projeto e templates
├── docker-compose.yml            API + PostgreSQL
└── docker-compose.test.yml       PostgreSQL descartável para testes
```

As regras abaixo não são aspiração: estão escritas em
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) e cada pull request é revisado
contra elas.

### Backend — camadas

Toda funcionalidade atravessa três camadas, e a dependência aponta sempre para dentro:

```
Requisição  →  Controller  →  Service  →  Repository  →  Prisma  →  PostgreSQL
                (HTTP)       (regra)     (persistência)
```

| Camada | Faz | Não faz |
|---|---|---|
| **Controller** | Recebe, valida via DTO, delega, mapeia a resposta | Nenhuma regra de negócio |
| **Service** | A regra de negócio, testável sem HTTP e sem banco | Não conhece `Request`/`Response` |
| **Repository** | O único lugar que fala Prisma | Não conhece regra de negócio |

**SOLID.** Cada classe tem uma responsabilidade declarada; uma unidade que precise de "e" para ser
descrita é dividida. Os services recebem seus repositories por injeção, então trocar a persistência
não toca na regra.

**KISS.** Nenhuma abstração entra antes do segundo uso. Não há repositório genérico, nem
camada de mapeamento configurável, nem factory para um caso só.

**Clean Code.** Nomes revelam intenção sem precisar de comentário que os traduza. Onde há
comentário, ele explica **por quê** — a matemática decimal das áreas, a assimetria das chaves
estrangeiras, o motivo de o login não detalhar campos. Código morto ou comentado não passa na
revisão.

**Contratos explícitos.** Toda rota é documentada em OpenAPI e tipada por DTO, validada em tempo de
execução por `class-validator` com um `ValidationPipe` global e *whitelist* ligada — **14 DTOs**
hoje. Nenhum payload sem tipo atravessa um controller. O contrato vivo fica em
[`/api/docs`](https://agrohub-production.up.railway.app/api/docs).

**Testes.** **45 arquivos de teste**, divididos em cinco projetos Jest com propósitos distintos:

| Projeto | O que cobre |
|---|---|
| `unit` | Regras de negócio isoladas |
| `integration` | Endpoints, com o banco substituído em memória |
| `integration-db` | Endpoints contra um PostgreSQL descartável de verdade |
| `persistence` | Só o que **é** o banco: unicidade sob concorrência, janela deslizante |
| `security` | Vazamento em log e conformidade com o contrato OpenAPI |

Nenhum teste depende de estado externo real, e todos rodam em qualquer ordem.

### Frontend — organizado por feature

O frontend não é dividido por tipo de arquivo (`components/`, `hooks/`, `services/`), e sim **por
domínio**. Cada pasta em `features/` carrega tudo o que aquele domínio precisa:

São seis: `auth`, `dashboard`, `producers`, `properties`, `harvests` e `ui`. O raio de alcance de
uma mudança é uma pasta, e um arquivo e seu teste andam juntos.

A direção da dependência é a mesma do backend, com outros nomes:

```
Componente  →  hook  →  thunk / slice  →  módulo de API  →  httpClient  →  rede
 (só desenha)          (estado)          (contrato)        (transporte)
```

Duas regras sustentam isso:

- **`lib/httpClient.ts` é o único arquivo que chama `fetch`** — e não por convenção: o ESLint
  recusa qualquer outro que tente, com a mensagem apontando o princípio.
- **As regras puras moram em `lib/`**, fora de qualquer componente: aritmética de áreas, dígitos
  verificadores de CPF e CNPJ, formatação pt-BR, UFs. São funções sem React, testadas sozinhas.

O que é genuinamente compartilhado e sem domínio — botão, campo, modal, esqueleto, gráfico — fica
em `components/`. **272 testes** cobrem cada tela nos quatro estados: carregando, com dados, vazia
e com erro.

---

## Stack

| Backend | | Frontend | |
|---|---|---|---|
| NestJS | 11 | React | 18 |
| Prisma ORM | 6 | Redux Toolkit | 2 |
| PostgreSQL | 16 | Vite | 5 |
| Passport + JWT | — | styled-components | 6 |
| bcrypt | 5 | react-router-dom | 6 |
| Pino (logs) | 9 | Material Icons | 9 |
| Swagger | 11 | Jest + Testing Library | 29 / 16 |
| TypeScript | 5.7 | TypeScript | 5.6 |

**Node.js 20 ou superior** para rodar localmente. A imagem da API usa Node 22.

---

## Como rodar localmente

### Pré-requisitos

Docker, Docker Compose e Node.js 20+.

### 1. Subir a API e o banco

```bash
cp backend/.env.example backend/.env

# Gere um JWT_SECRET real e cole no .env:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

docker compose up -d
```

É só isso. **As migrations são aplicadas sozinhas**, dentro do container, na subida — o `CMD` do
`Dockerfile` roda `prisma migrate deploy` antes de iniciar a API. Se a migration falhar, o
container para em vez de servir contra um schema que não corresponde.

> [!IMPORTANT]
> **`JWT_SECRET` não tem valor padrão.** A aplicação se recusa a subir sem ele, e o mínimo é 32
> caracteres. É proposital: um segredo padrão em produção é um segredo público.

Confirme que subiu:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"..."}
```

### 2. Popular com dados de exemplo (opcional)

```bash
cd backend
npm install
npm run db:seed
```

Cria 5 produtores (3 CPF, 2 CNPJ), 5 fazendas em estados diferentes, as safras 2021 e 2022 e 6
culturas. É **idempotente** — rodar de novo não duplica nada. Ao final imprime os totais que o
`GET /api/dashboard` deve devolver, para conferência.

Para criar também um usuário de acesso, defina antes:

```bash
SEED_USER_EMAIL=demo@agrohub.com.br SEED_USER_PASSWORD=SenhaSegura1 npm run db:seed
```

Sem essas duas variáveis nenhum usuário é criado — não há credencial padrão em lugar nenhum.

> [!TIP]
> **O seed roda na sua máquina, não dentro do container**, então usa o `DATABASE_URL` do
> `backend/.env` — que precisa apontar para um endereço alcançável de fora do Docker
> (`localhost:5432`). Vale o mesmo para `prisma migrate` fora do container e para os testes.
>
> Se o seu `.env` estiver apontando para um banco remoto, passe a URL local só nesse comando em vez
> de editar o arquivo:
>
> ```bash
> DATABASE_URL="postgresql://agrohub:agrohub@localhost:5432/agrohub" npx prisma db seed
> ```
>
> Dentro do container nada disso se aplica: o `docker-compose.yml` define `DATABASE_URL` em
> `environment:`, apontando para `postgres:5432`.

### 3. Subir a interface

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

A interface sobe em **http://localhost:5173**. Crie uma conta pela própria tela ou entre com o
usuário do seed.

### Por que duas portas

A API ocupa a 3000, então o servidor de desenvolvimento usa a 5173 e encaminha `/api` para ela.
Assim o navegador enxerga uma origem só, que é o que dispensa CORS.

---

## Portas

| Serviço | Porta | Observação |
|---|---|---|
| API | `3000` | Prefixo global `/api` |
| Swagger | `3000` | `/api/docs` |
| PostgreSQL | `5432` | Ajustável com `POSTGRES_PORT` |
| PostgreSQL de teste | `5433` | Só com `docker-compose.test.yml`, dados em memória |
| Interface (dev) | `5173` | Encaminha `/api` para a 3000 |

---

## Variáveis de ambiente

### Backend (`backend/.env`)

| Variável | Padrão | O que faz |
|---|---|---|
| `DATABASE_URL` | `postgresql://agrohub:agrohub@localhost:5432/agrohub` | Usada por tudo que roda **fora** do container: migrations, seed, testes. |
| `JWT_SECRET` | — | **Obrigatória, sem padrão, mínimo 32 caracteres.** |
| `JWT_EXPIRES_IN` | `12h` | Validade do token. Não há renovação nem revogação, então é o que limita o estrago de um token vazado. |
| `BCRYPT_COST` | `12` | Custo do hash (4–15). |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `20` | Limite geral por origem: 20 requisições por minuto. |
| `REGISTER_THROTTLE_TTL` / `REGISTER_THROTTLE_LIMIT` | `60` / `5` | Limite do cadastro, mais restrito de propósito. |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_MINUTES` | `5` / `15` | Tentativas de login por identificador. |
| `LOG_LEVEL` | `info` | Nível do Pino. |
| `PORT` | `3000` | Porta da API. |

Só para o seed, e sem padrão: `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` e `SEED_RESET=true` (limpa
culturas, safras e produtores antes de popular — nunca mexe em usuários).

> O container **não lê** o `DATABASE_URL` do `.env`: o `docker-compose.yml` define o valor em
> `environment:`, que tem precedência sobre `env_file:`, apontando para `postgres:5432`. Os dois
> contextos convivem sem precisar trocar um pelo outro.

### Frontend (`frontend/.env`)

| Variável | Padrão | O que faz |
|---|---|---|
| `VITE_API_BASE_PATH` | `/api` | **Mantenha relativo.** Uma URL absoluta reintroduz o problema de CORS que a API não configura. |

---

## API

Prefixo global **`/api`**.

| | Base |
|---|---|
| Publicada | `https://agrohub-production.up.railway.app/api` |
| Local | `http://localhost:3000/api` |

Documentação viva em **`/api/docs`** — [publicada](https://agrohub-production.up.railway.app/api/docs)
ou em `http://localhost:3000/api/docs`. O Swagger preserva o token entre recarregamentos: entre uma
vez pelo botão **Authorize** e todas as chamadas seguintes já vão autenticadas.

**Tudo exige autenticação por padrão.** Dois guards globais protegem a aplicação — primeiro o de
limite de requisições, depois o de JWT. Uma rota só é pública se estiver explicitamente marcada.

### Autenticação

| Método | Rota | Acesso |
|---|---|---|
| `POST` | `/api/auth/register` | **Público** |
| `POST` | `/api/auth/login` | **Público** |
| `GET` | `/api/auth/me` | Bearer |

### Infraestrutura

| Método | Rota | Acesso |
|---|---|---|
| `GET` | `/api/health` | **Público** |

### Produtores

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/api/producers` | Cadastra um produtor |
| `GET` | `/api/producers` | Lista com paginação e busca |
| `GET` | `/api/producers/:id` | Produtor com fazendas e culturas agrupadas por safra |
| `PATCH` | `/api/producers/:id` | Altera nome e/ou documento |
| `DELETE` | `/api/producers/:id` | Exclui em cascata |

Paginação: `?page=1&pageSize=20` (máximo 100). Busca: `?search=jose`, que compara com o nome
(ignorando maiúsculas e acentos) ou com o documento.

### Fazendas

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/api/producers/:producerId/properties` | Cadastra uma fazenda |
| `GET` | `/api/producers/:producerId/properties` | Lista as fazendas do produtor |
| `GET` | `/api/properties/:id` | Uma fazenda com suas culturas por safra |
| `PATCH` | `/api/properties/:id` | Altera a fazenda |
| `DELETE` | `/api/properties/:id` | Exclui a fazenda e suas culturas |

### Culturas

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/api/properties/:propertyId/crops` | Registra uma cultura (a safra vai no corpo, em `harvestId`) |
| `GET` | `/api/properties/:propertyId/crops` | O que a fazenda plantou |
| `GET` | `/api/harvests/:harvestId/crops` | O que foi plantado na safra, em todas as fazendas |
| `DELETE` | `/api/crops/:id` | Remove a cultura |

### Safras

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/harvests` | Lista as safras |
| `POST` | `/api/harvests` | Cadastra uma safra (ano único) |
| `GET` | `/api/harvests/:id` | Uma safra |
| `PATCH` | `/api/harvests/:id` | Altera o ano |
| `DELETE` | `/api/harvests/:id` | **Recusada com `409` enquanto houver cultura registrada nela** |

### Painel

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/dashboard` | Totais e os três recortes |

Com o banco populado pelo seed, a resposta é exatamente esta:

```json
{
  "totals": { "farms": 5, "hectares": "5411.00" },
  "byState": {
    "unit": "hectares",
    "categories": [
      { "key": "BA", "label": "BA", "value": "2300.00" },
      { "key": "MG", "label": "MG", "value": "1500.11" },
      { "key": "SP", "label": "SP", "value": "850.50" },
      { "key": "GO", "label": "GO", "value": "640.36" },
      { "key": "MT", "label": "MT", "value": "120.03" }
    ]
  },
  "byCrop": {
    "unit": "count",
    "categories": [
      { "key": "soja", "label": "Soja", "value": 3 },
      { "key": "algodao", "label": "Algodão", "value": 1 },
      { "key": "cafe", "label": "Café", "value": 1 },
      { "key": "milho", "label": "Milho", "value": 1 }
    ]
  },
  "byLandUse": {
    "unit": "hectares",
    "categories": [
      { "key": "arable", "label": "Área agricultável", "value": "4120.61" },
      { "key": "vegetation", "label": "Vegetação", "value": "1140.39" },
      { "key": "unclassified", "label": "Área não classificada", "value": "150.00" }
    ]
  }
}
```

Cada recorte declara sua própria `unit`. Leia sempre por ela, nunca pelo nome do recorte: hoje
`byState` vem em hectares e `byCrop` em contagem, e supor o contrário faz o rótulo contradizer o
número. As categorias de `byLandUse` somam **exatamente** o `totals.hectares`.

### Exemplo completo

```bash
# Local:
BASE=http://localhost:3000/api
# Publicada:
# BASE=https://agrohub-production.up.railway.app/api

JSON="Content-Type: application/json"

# 1. conta e token
curl -X POST $BASE/auth/register -H "$JSON" \
  -d '{"email":"demo@agrohub.com.br","password":"SenhaSegura1"}'

TOKEN=$(curl -s -X POST $BASE/auth/login -H "$JSON" \
  -d '{"email":"demo@agrohub.com.br","password":"SenhaSegura1"}' | jq -r .accessToken)
AUTH="Authorization: Bearer $TOKEN"

# 2. produtor
curl -X POST $BASE/producers -H "$AUTH" -H "$JSON" \
  -d '{"name":"José Antônio de Almeida","document":"529.982.247-25"}'

# 3. fazenda (1000 + 500,11 = 1500,11 — a soma fecha exatamente)
curl -X POST $BASE/producers/<producerId>/properties -H "$AUTH" -H "$JSON" \
  -d '{"farmName":"Fazenda Santa Helena","city":"Uberaba","state":"MG","totalArea":1500.11,"arableArea":1000,"vegetationArea":500.11}'

# 4. safra (compartilhada por todo o cadastro)
curl -X POST $BASE/harvests -H "$AUTH" -H "$JSON" -d '{"year":2021}'

# 5. cultura (a fazenda é a dona; a safra é uma referência)
curl -X POST $BASE/properties/<propertyId>/crops -H "$AUTH" -H "$JSON" \
  -d '{"harvestId":"<harvestId>","name":"Soja"}'

# 6. painel
curl $BASE/dashboard -H "$AUTH"
```

---

## Formato de erro

Toda falha usa o mesmo envelope:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Os dados enviados são inválidos.",
  "path": "/api/producers",
  "timestamp": "2026-09-10T15:56:25.052Z",
  "requestId": "2d1dc9c2-996f-46b4-8cae-0f9b8cc7ae8d",
  "details": [
    { "field": "document", "message": "Informe um CPF ou CNPJ válido." },
    { "field": "name", "message": "O nome é obrigatório." }
  ]
}
```

| Código | Quando acontece |
|---|---|
| `400` | Dados inválidos. `details` lista **todos** os campos com erro de uma vez. |
| `401` | Credenciais inválidas, corpo malformado no login, ou token ausente/expirado/adulterado. |
| `404` | Registro inexistente. |
| `409` | Conflito: documento ou e-mail já cadastrado, cultura repetida na mesma fazenda e safra, ou safra em uso. |
| `429` | Excesso de tentativas. O cabeçalho `Retry-After` diz quantos segundos esperar. |

O `requestId` também vai para o log do servidor — é por ele que se acha o erro completo.

### Onde `details` não aparece

**No login.** Um corpo malformado recebe o mesmo `401` genérico de uma credencial errada:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "E-mail ou senha inválidos.",
  "path": "/api/auth/login",
  "timestamp": "2026-09-10T15:56:25.117Z",
  "requestId": "8646af57-463f-4201-a925-583d8cc128de"
}
```

É proposital, e vale para o login apenas. Quem enviou a requisição já sabe o que mandou, então o
detalhamento não ajuda ninguém legítimo — mas permitiria a um atacante distinguir "o JSON estava
errado" de "as credenciais estavam erradas". O motivo real fica no log, sob o mesmo `requestId`.

Pela mesma razão, e-mail inexistente e senha errada devolvem respostas idênticas, e quando o limite
de tentativas é atingido até a senha correta recebe `429` — responder `200` confirmaria ao atacante
que aquela senha estava certa.

---

## Respostas de exclusão

Toda exclusão informa **quantos registros de cada tipo** foram removidos, para quem executou saber
o alcance real do que fez. A operação é atômica: ou tudo é removido, ou nada é. Não há desfazer.

Cada rota devolve a sua própria contagem — não existe um formato único:

```jsonc
DELETE /api/producers/:id   → { "deleted": { "producers": 1, "properties": 2, "crops": 2 } }
DELETE /api/properties/:id  → { "deleted": { "properties": 1, "crops": 0 } }
DELETE /api/crops/:id       → { "deleted": { "crops": 1 } }
DELETE /api/harvests/:id    → { "deleted": { "harvests": 1 } }
```

A cascata é **`Produtor → Fazenda → Cultura`, e para aí.**

**Safra nunca aparece nessa contagem.** Uma safra não pertence a ninguém: existe uma "2021"
compartilhada por todo o cadastro, e fazenda e safra só se relacionam através das culturas que as
ligam. Excluir um produtor não toca em safra alguma — e não é convenção de código, é o banco:
a chave estrangeira de cultura para safra é `Restrict`, o que torna a cascata estruturalmente
impossível.

O outro lado da mesma regra: excluir uma safra é **recusado** enquanto qualquer fazenda tiver
cultura registrada nela, porque uma cascata ali apagaria os plantios de todo o cadastro de uma vez.

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Não é possível excluir esta safra: existem 6 culturas registradas nela."
}
```

---

## Regras que valem conhecer

**CPF e CNPJ são validados por dígito verificador**, não por formato. Pontuação é opcional e
normalizada. Documentos de dígito repetido (`111.111.111-11`) são recusados: eles passam em uma
verificação ingênua de módulo.

**A soma das áreas não pode ultrapassar a total** — `agricultável + vegetação ≤ total`. A
comparação é feita em **inteiros de centésimos de hectare**, nunca em ponto flutuante. Em
JavaScript `1000 + 500.11` resulta em `1500.1100000000001`, e uma implementação ingênua recusaria
uma fazenda de 1500,11 ha perfeitamente comum.

**As áreas são devolvidas como texto** (`"1500.11"`) pela mesma razão: para o cliente não
reintroduzir o erro ao ler o JSON.

**A busca ignora maiúsculas e acentos** — procurar por `jose` encontra `José Antônio`.

**A mesma cultura não pode ser registrada duas vezes** para a mesma fazenda na mesma safra. Duas
fazendas na mesma safra, ou uma fazenda em duas safras, são normais.

---

## Testes e qualidade

### Backend

```bash
cd backend
npm run test:unit
npm run test:integration     # Prisma em memória, sem Docker
npm run test:security
npm run test:all
```

As suítes que exigem um PostgreSQL de verdade:

```bash
docker compose -f docker-compose.test.yml up -d
PERSISTENCE_DATABASE_URL=postgresql://agrohub:agrohub@localhost:5433/agrohub_test npm run test:db:migrate
npm run test:integration-db
npm run test:persistence
docker compose -f docker-compose.test.yml down -v
```

### Frontend

```bash
cd frontend
npm test
```

Roda em jsdom, sem rede e sem servidor. O módulo de API de cada feature é o único ponto de mock,
então cada tela é exercitada nos quatro estados: carregando, com dados, vazia e com erro.

### Antes de qualquer merge

```bash
cd backend  && npm run lint && npm run typecheck && npm run test:all
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

**Não há CI configurada** — por enquanto esses passos são manuais.

---

## Como este projeto foi construído

Cada entrega nasceu de uma especificação antes de virar código. A pasta [`specs/`](specs/) guarda,
para cada uma, o que foi pedido (`spec.md`), como seria feito (`plan.md`), a lista de tarefas
(`tasks.md`) e as decisões técnicas com as alternativas descartadas (`research.md`):

| | Entrega |
|---|---|
| [`001-user-auth`](specs/001-user-auth/) | Autenticação, JWT e limites de tentativa |
| [`002-rural-producer-crud`](specs/002-rural-producer-crud/) | Produtores, fazendas e culturas |
| [`003-dashboard-api`](specs/003-dashboard-api/) | O painel |
| [`004-harvest-remodel`](specs/004-harvest-remodel/) | Safras como entidade compartilhada |
| [`005-web-frontend`](specs/005-web-frontend/) | A interface web |

As regras que valem para o repositório inteiro — arquitetura em camadas, cobertura de testes,
segurança por padrão, stack fixa e política de idiomas — estão em
[`.specify/memory/constitution.md`](.specify/memory/constitution.md).

Documentação detalhada de cada lado: [`backend/README.md`](backend/README.md) e
[`frontend/README.md`](frontend/README.md).
