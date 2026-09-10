# AgroHub — API

Backend do AgroHub:

1. **Autenticação** — cadastro e login de usuários, e o mecanismo de proteção que as demais
   funcionalidades herdam.
2. **Cadastro de produtores rurais** — produtores, propriedades e culturas plantadas.
3. **Painel** — visão consolidada do cadastro.
4. **Safras** — remodeladas como entidade compartilhada por todo o cadastro.

A interface web está em [`../frontend`](../frontend/README.md). Para uma visão geral do projeto
inteiro, veja o [README da raiz](../README.md).

---

## O que o sistema faz

- **Cadastro** — qualquer visitante cria uma conta com e-mail e senha. A conta funciona
  imediatamente; não há confirmação por e-mail.
- **Login** — quem já tem conta troca e-mail e senha por um token de acesso.
- **Rotas protegidas** — o token identifica quem está chamando. Quem não apresenta um token válido
  é recusado.
- **Proteção contra força bruta** — tentativas repetidas de adivinhar senha são bloqueadas.

---

## Como rodar

Pré-requisitos: Docker e Docker Compose.

```bash
cp backend/.env.example backend/.env
```

Gere um valor real para `JWT_SECRET` e coloque no `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> A aplicação **não inicia** sem `JWT_SECRET` com pelo menos 32 caracteres. Isso é proposital: não
> existe valor padrão no código, porque um valor padrão é um segredo fixo — é ele que passa a valer
> sempre que o segredo real não carrega.

```bash
docker compose up -d
```

As migrations são aplicadas na subida, dentro do container: o `CMD` do `Dockerfile` roda
`prisma migrate deploy` antes de iniciar a API. Uma migration que falha derruba o container, em vez
de deixar a API servindo contra um schema que não corresponde.

- API: `http://localhost:3000/api`
- Documentação (Swagger): `http://localhost:3000/api/docs`

A versão publicada responde em `https://agrohub-production.up.railway.app`, com o Swagger em
[`/api/docs`](https://agrohub-production.up.railway.app/api/docs).

---

## Como usar

### 1. Criar uma conta

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"produtor@agrohub.com.br","password":"SenhaSegura1"}'
```

Resposta `201`:

```json
{ "id": "3f9a1c7e-...", "email": "produtor@agrohub.com.br", "createdAt": "2026-09-09T14:32:11.421Z" }
```

**Regras da senha:** mínimo de 8 caracteres, com pelo menos uma letra e um número. O limite máximo
é de **72 bytes** — acentos e emojis ocupam mais de um byte cada.

### 2. Entrar

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"produtor@agrohub.com.br","password":"SenhaSegura1"}'
```

Resposta `200`:

```json
{
  "accessToken": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": "3f9a1c7e-...", "email": "produtor@agrohub.com.br", "createdAt": "..." }
}
```

### 3. Chamar uma rota protegida

```bash
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer <accessToken>"
```

---

## Endpoints

| Método | Rota | Autenticação | O que faz |
|--------|------|--------------|-----------|
| `POST` | `/api/auth/register` | Pública | Cria uma conta |
| `POST` | `/api/auth/login` | Pública | Devolve o token de acesso |
| `GET`  | `/api/auth/me` | **Bearer** | Dados da conta autenticada |
| `GET`  | `/api/health` | Pública | Verifica se a API está no ar |

**Toda rota nova é protegida por padrão.** Para abrir uma rota é preciso marcá-la explicitamente
com o decorador `@Public()`.

---

## Respostas de erro

Todas as falhas usam o mesmo formato:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Os dados enviados são inválidos.",
  "path": "/api/auth/register",
  "timestamp": "2026-09-10T16:00:05.647Z",
  "requestId": "874b54f7-8b86-47fd-94c2-795db731707a",
  "details": [
    { "field": "email", "message": "Informe um e-mail válido." },
    { "field": "password", "message": "A senha deve conter pelo menos uma letra e um número." },
    { "field": "password", "message": "A senha deve ter no mínimo 8 caracteres." }
  ]
}
```

`details` traz **uma entrada por regra violada**, não por campo — acima, a mesma senha aparece duas
vezes porque quebrou duas regras. Quem preenche o formulário vê tudo o que falta de uma vez, em vez
de descobrir um erro por tentativa.

| Código | Quando acontece |
|--------|-----------------|
| `400` | Dados inválidos **no cadastro**. `details` lista todos os campos com erro de uma vez. |
| `401` | Credenciais inválidas, corpo malformado **no login**, ou token ausente/expirado/adulterado. |
| `409` | Já existe conta com aquele e-mail. |
| `429` | Excesso de tentativas. O cabeçalho `Retry-After` diz quantos segundos aguardar. |

O `requestId` aparece também no log do servidor — é por ele que se localiza o erro completo.

### Três respostas propositalmente "pouco informativas"

1. **E-mail inexistente e senha errada devolvem exatamente a mesma resposta `401`.** Diferenciar as
   duas permitiria descobrir quais e-mails estão cadastrados.
2. **Quando o limite de tentativas é atingido, até a senha correta recebe `429`.** Responder `200`
   confirmaria ao atacante que aquela senha estava certa.
3. **O login não devolve `details`.** Um corpo malformado recebe o mesmo `401` de uma credencial
   errada. O cadastro continua detalhando os campos — quem está escolhendo uma senha precisa saber
   qual regra não cumpriu —, mas no login o detalhamento não ajuda quem enviou a requisição (ela
   já sabe o que mandou) e permite distinguir "o JSON estava errado" de "as credenciais estavam
   erradas".

   O motivo real fica no **log**, com o mesmo `requestId` devolvido na resposta — registrado como
   nome do campo + identificador da regra (`email:isEmail`), nunca o valor enviado. Para depurar
   um payload malformado, procure o `requestId` no log.

---

## Limites de tentativas

| Limite | Padrão | Configuração |
|--------|--------|--------------|
| Falhas por e-mail | 5 a cada 15 minutos (janela deslizante) | `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MINUTES` |
| Requisições por origem | 20 por minuto | `THROTTLE_LIMIT`, `THROTTLE_TTL` |
| Cadastros por origem | 5 por minuto | `REGISTER_THROTTLE_LIMIT`, `REGISTER_THROTTLE_TTL` |

O segundo limite existe porque o primeiro, sozinho, seria contornado apenas trocando o e-mail a
cada tentativa.

O terceiro é mais restrito de propósito. O cadastro responde `409` para um e-mail que já existe,
o que permite descobrir quais endereços estão cadastrados — uma requisição por endereço, sem
precisar adivinhar senha. Isso **não é eliminado** por um limite, apenas encarecido: a 20/min
seriam ~28.800 endereços por dia por origem; a 5/min, ~7.200. Ninguém legítimo cria contas em
série, então o custo recai inteiro sobre quem está varrendo. Os contadores ficam no PostgreSQL, e não na memória do processo, para que um
reinício — ou uma segunda instância da API — não zere o bloqueio.

Um login bem-sucedido zera o contador daquele e-mail.

---

## Desenvolvimento

```bash
npm install
npm run start:dev
```

### Testes

```bash
npm run test:unit          # regras de negócio isoladas
npm run test:integration   # os endpoints, com o banco substituído em memória
npm run test:security      # vazamento em log e conformidade do contrato OpenAPI
npm run test:all
```

O suíte de persistência precisa de um PostgreSQL descartável:

```bash
docker compose -f docker-compose.test.yml up -d
PERSISTENCE_DATABASE_URL=postgresql://agrohub:agrohub@localhost:5433/agrohub_test \
  npm run test:persistence
docker compose -f docker-compose.test.yml down -v
```

Só vão para esse suíte as garantias que **são** o banco: a restrição de unicidade do e-mail sob
concorrência e a consulta da janela deslizante. O resto roda sem banco nenhum.

### Verificações antes de subir código

```bash
npm run lint && npm run typecheck && npm run test:all
```

---

## Notas de desempenho

O bcrypt é proposital e necessariamente lento (~250 ms por hash com custo 12) e roda no pool de
threads do libuv. **A vazão de login é limitada por esse pool**, não pela rede nem pelo banco:
`UV_THREADPOOL_SIZE` está definido no `Dockerfile` e deve acompanhar o número de CPUs do container.

Medição real nesta máquina (6 núcleos, pool padrão de 4 threads, custo 12):

| Logins simultâneos | Tempo até a última resposta |
|--------------------|-----------------------------|
| 10 | 629 ms |
| 50 | 2.861 ms |
| 200 | **10.976 ms** |

Ou seja: o critério SC-007 (200 simultâneos, 95% abaixo de 1 segundo) **não é atingido** em uma
instância pequena — o teto prático aqui fica em torno de 15 logins simultâneos. O cálculo previsto
está em `specs/001-user-auth/research.md` (R-002) e a medição confirma. Na prática esse cenário é
justamente o que o limite por origem recusa, e recusar custa uma consulta indexada. Se a demanda
real chegar a esse patamar, a saída é escalar horizontalmente: os contadores já são compartilhados
entre instâncias.

---

## Variáveis de ambiente

Todas estão listadas em [`.env.example`](./.env.example). As que exigem atenção:

| Variável | Observação |
|----------|------------|
| `JWT_SECRET` | Obrigatória, mínimo 32 caracteres, **sem valor padrão**. |
| `JWT_EXPIRES_IN` | Validade do token (`12h`). Como não há renovação nem revogação, é o único fator que limita o estrago de um token vazado. |
| `BCRYPT_COST` | `12` em produção. Os testes usam `4` para não gastar minutos por execução. |

---

# Cadastro de produtores rurais

Registro de quem produz, o quê e onde. A posse é estrita — cada registro pertence a exatamente um
pai — mas a safra fica de fora dessa cadeia:

    Produtor  ->  Propriedade  ->  Cultura
                                     |
                       Safra  --------+   (compartilhada, não pertence a ninguém)

Uma safra não é de uma fazenda: existe uma "2021" para todo o cadastro. Propriedade e safra se
relacionam **apenas** através das culturas que as ligam.

**Todas as rotas exigem autenticação.** Nenhuma delas é pública: a proteção vem do guard global
criado na entrega de autenticação, e não de código novo.

## Endpoints

| Método | Rota | O que faz |
|--------|------|-----------|
| `POST` | `/api/producers` | Cadastra um produtor |
| `GET` | `/api/producers` | Lista com paginação e busca |
| `GET` | `/api/producers/:id` | Produtor com propriedades e culturas agrupadas por safra |
| `PATCH` | `/api/producers/:id` | Altera nome e/ou documento |
| `DELETE` | `/api/producers/:id` | **Exclui em cascata** |
| `POST` | `/api/producers/:id/properties` | Cadastra uma propriedade |
| `GET` | `/api/producers/:id/properties` | Lista as propriedades do produtor |
| `GET` | `/api/properties/:id` | Propriedade com suas culturas agrupadas por safra |
| `PATCH` | `/api/properties/:id` | Altera a propriedade |
| `DELETE` | `/api/properties/:id` | Exclui a propriedade e suas culturas |
| `POST` | `/api/properties/:id/crops` | Registra uma cultura (safra em `harvestId`, no corpo) |
| `GET` | `/api/properties/:id/crops` | Lista as culturas da propriedade |
| `DELETE` | `/api/crops/:id` | Exclui a cultura |

Safras são um recurso próprio, de primeiro nível — não ficam sob uma propriedade:

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/harvests` | Lista as safras |
| `POST` | `/api/harvests` | Cadastra uma safra (o ano é único no sistema) |
| `GET` | `/api/harvests/:id` | Uma safra |
| `PATCH` | `/api/harvests/:id` | Altera o ano — vale para todas as fazendas de uma vez |
| `DELETE` | `/api/harvests/:id` | **Recusada com `409`** enquanto houver cultura registrada nela |
| `GET` | `/api/harvests/:id/crops` | O que foi plantado na safra, em todas as fazendas |

## Exemplo completo

```bash
AUTH="Authorization: Bearer <token do login>"
JSON="Content-Type: application/json"

# 1. produtor
curl -X POST http://localhost:3000/api/producers -H "$AUTH" -H "$JSON" \
  -d '{"document":"529.982.247-25","name":"José Antônio de Almeida"}'

# 2. propriedade
curl -X POST http://localhost:3000/api/producers/<id>/properties -H "$AUTH" -H "$JSON" \
  -d '{"farmName":"Fazenda Santa Helena","city":"Uberaba","state":"MG","totalArea":1500.11,"arableArea":1000,"vegetationArea":500.11}'

# 3. safra — compartilhada por todo o cadastro, criada uma vez só
curl -X POST http://localhost:3000/api/harvests -H "$AUTH" -H "$JSON" -d '{"year":2021}'

# 4. culturas — a fazenda é a dona; a safra entra como referência no corpo
curl -X POST http://localhost:3000/api/properties/<propertyId>/crops -H "$AUTH" -H "$JSON" \
  -d '{"harvestId":"<harvestId>","name":"Soja"}'
curl -X POST http://localhost:3000/api/properties/<propertyId>/crops -H "$AUTH" -H "$JSON" \
  -d '{"harvestId":"<harvestId>","name":"Milho"}'
```

## Regras que valem a pena conhecer

### Documento (CPF/CNPJ)

Validado pelos **dígitos verificadores**, não pelo tamanho. Pontuação é ignorada e o documento é
armazenado apenas com dígitos, então `529.982.247-25` e `52998224725` são o mesmo produtor.

Documentos formados por um único dígito repetido (`111.111.111-11`) são recusados por uma regra
específica: eles **passam** na conta dos dígitos verificadores, e é por isso que tantas
implementações os aceitam.

Não pode haver dois produtores com o mesmo documento.

### Áreas

A soma de área agricultável e área de vegetação **não pode ultrapassar** a área total. Usar
exatamente toda a área é permitido. O que sobra é área não classificada, e não é um erro.

As áreas são guardadas com 2 casas decimais e comparadas em aritmética decimal exata. Isso não é
preciosismo: em JavaScript, `1000 + 500.11` resulta em `1500.1100000000001`, e uma implementação
ingênua recusaria uma fazenda de 1500,11 ha perfeitamente comum. As áreas são devolvidas como
**texto** (`"1500.11"`) justamente para o cliente não reintroduzir esse erro ao ler o JSON.

### Busca

A busca por nome ignora maiúsculas e acentos: procurar por `jose` encontra `José Antônio`.

### Exclusão

**A exclusão é permanente e em cascata.** Excluir um produtor exclui suas propriedades e as
culturas dessas propriedades. Não há desfazer, nem lixeira, nem histórico.

A cascata é **`Produtor → Propriedade → Cultura`, e para aí.**

Duas proteções limitam o estrago:

- A operação é **atômica**: ou tudo é removido, ou nada é.
- A resposta informa **quantos registros de cada tipo** foram excluídos, para quem executou saber
  o alcance real do que fez.

Cada rota devolve a sua própria contagem — não existe um formato único:

```jsonc
DELETE /api/producers/:id   → { "deleted": { "producers": 1, "properties": 2, "crops": 2 } }
DELETE /api/properties/:id  → { "deleted": { "properties": 1, "crops": 0 } }
DELETE /api/crops/:id       → { "deleted": { "crops": 1 } }
DELETE /api/harvests/:id    → { "deleted": { "harvests": 1 } }
```

### Safra nunca entra na cascata

Uma safra não pertence a ninguém, então **não aparece na contagem de um produtor** — nem como
`harvests: 0`, que daria a entender que a operação chegou a considerá-las.

E não é convenção de código: a chave estrangeira de cultura para safra é `Restrict`, enquanto a de
cultura para propriedade é `Cascade`. A assimetria é o modelo de posse, escrito no banco.

```
propertyId -> Cascade    a cultura pertence à fazenda e morre com ela
harvestId  -> Restrict   a safra não pertence a ninguém
```

O outro lado da mesma regra: excluir uma safra é **recusado** enquanto qualquer fazenda tiver
cultura registrada nela — uma cascata ali apagaria os plantios de todo o cadastro de uma vez.

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Não é possível excluir esta safra: existem 6 culturas registradas nela."
}
```

## Limitações conhecidas

Decisões, não defeitos:

- **Qualquer usuário autenticado pode ler, alterar e excluir qualquer registro.** O cadastro é
  compartilhado e não existem perfis de acesso. Como o cadastro de usuários é aberto, na prática
  qualquer pessoa que crie uma conta pode excluir o cadastro inteiro. Ver *Postura de implantação*
  abaixo.
- **CNPJ alfanumérico ainda não é aceito.** Ver a seção seguinte.
- **Safra e safrinha do mesmo ano não são representáveis.** Uma safra é identificada pelo ano, e o
  ano é único no sistema inteiro — não há como registrar "2021 safrinha" ao lado de "2021". Foi uma
  troca consciente: a safra deixou de pertencer à fazenda justamente para que "2021" signifique a
  mesma coisa em todo o cadastro, e é isso que permite comparar fazendas por safra. Representar os
  dois ciclos exigiria um segundo atributo além do ano.
- **Cidades não são validadas** contra uma lista oficial de municípios. A UF é validada; a cidade
  é texto livre.
- **Não existe histórico de alterações** para o usuário. As alterações são registradas em log,
  mas não há tela nem endpoint de auditoria.

## Testes deste módulo

```bash
docker compose -f docker-compose.test.yml up -d
npm run test:db:migrate    # com PERSISTENCE_DATABASE_URL apontando para a porta 5433
npm run test:integration-db
npm run test:persistence
```

O suíte `integration-db` roda contra um PostgreSQL descartável, e não contra o banco falso em
memória usado pela entrega de autenticação. O motivo está em
`specs/002-rural-producer-crud/research.md` (R-008): o que estes testes verificam **é** o banco —
cascata transacional, restrições de unicidade compostas, paginação com total —, e um banco falso
que errasse a cascata reportaria sucesso enquanto a produção criava registros órfãos.

---

# Painel (dashboard)

Visão consolidada do cadastro em uma única chamada: quantas fazendas existem, quantos hectares
somam, e três distribuições prontas para desenhar como gráfico de pizza.

```
GET /api/dashboard      (exige token, como todas as rotas)
```

Não há filtros nesta versão — nem por data, nem por período, nem por estado. Cada requisição
reflete o cadastro no momento em que foi atendida.

## O que cada número significa

| Campo | Unidade | Significado |
|-------|---------|-------------|
| `totals.farms` | contagem | Quantidade de propriedades cadastradas |
| `totals.hectares` | hectares | Soma da área total de todas as propriedades |
| `byState` | **hectares** | Área por unidade federativa |
| `byCrop` | **contagem** | Quantidade de registros de cultura |
| `byLandUse` | **hectares** | Área agricultável, vegetação e área não classificada |

Cada distribuição informa a própria unidade no campo `unit`, para que nunca seja preciso adivinhar
se um número é hectare ou contagem.

Exemplo de resposta:

```json
{
  "totals": { "farms": 4, "hectares": "1725.47" },
  "byState": {
    "unit": "hectares",
    "categories": [
      { "key": "MG", "label": "MG", "value": "1200.11" },
      { "key": "SP", "label": "SP", "value": "500.36" },
      { "key": "BA", "label": "BA", "value": "25.00" }
    ]
  },
  "byCrop": {
    "unit": "count",
    "categories": [
      { "key": "soja", "label": "Soja", "value": 3 },
      { "key": "milho", "label": "Milho", "value": 2 }
    ]
  },
  "byLandUse": {
    "unit": "hectares",
    "categories": [
      { "key": "arable", "label": "Área agricultável", "value": "1200.36" },
      { "key": "vegetation", "label": "Vegetação", "value": "350.00" },
      { "key": "unclassified", "label": "Área não classificada", "value": "175.11" }
    ]
  }
}
```

## Regras de agrupamento

**Culturas com grafias diferentes viram uma categoria.** `Soja`, `soja` e `SOJA` são a mesma cultura;
o rótulo exibido é **a grafia mais usada** entre elas. Já `Soja` e `Soya` continuam sendo duas
culturas diferentes — são palavras diferentes, e o sistema nunca afirmou saber que significam a
mesma planta.

**Ordenação estável.** As categorias vêm da maior para a menor, com desempate pelo `key`. Duas
chamadas iguais devolvem exatamente a mesma ordem, então a legenda do gráfico não se reorganiza
sozinha entre um carregamento e outro.

**Propriedade sem safra ou sem cultura** conta normalmente em `totals` e em `byState`, mas não
aparece em `byCrop`.

**Cadastro vazio** devolve `200` com `farms: 0`, `hectares: "0.00"` e listas vazias. Cadastro vazio é
um estado válido, não um erro.

## Por que os hectares vêm como texto

`"1725.47"` e não `1725.47`. Interpretado como número de ponto flutuante, `1725.47` não é exatamente
1725,47 — e qualquer conta feita no cliente reintroduziria o erro que o servidor acabou de evitar.
Mesma decisão, e mesmo motivo, das áreas das propriedades.

## Desempenho

Medido com 10.000 propriedades, 50.000 safras e 150.000 culturas: **cerca de 40 ms** por requisição,
contra um orçamento de 2 segundos.

Não há índice novo para o painel, e isso é proposital: as agregações percorrem as tabelas inteiras,
sem filtro, então o PostgreSQL faz varredura sequencial de qualquer jeito. Um índice custaria tempo
de escrita em cada cultura cadastrada e não economizaria nada na leitura. Se uma versão futura
adicionar filtros, o padrão de acesso muda e a decisão deve ser revista com base naquela evidência,
não nesta.

## Testes deste módulo

```bash
npm run test:unit             # regra do rótulo de cultura, filtro de zeros, ordenação
npm run test:integration-db   # as agregações, contra PostgreSQL real
```

O suíte inclui um teste de escala que cria 10.000 propriedades e 150.000 culturas e mede o tempo de
resposta — ele existe para pegar regressão estrutural (um N+1 acidental, uma agregação perdida), não
para medir a velocidade da máquina.
