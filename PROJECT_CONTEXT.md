# Analisar Solo — contexto do projeto

Sistema web de visualização de análises de solo para produtores rurais.
Substitui a prática de guardar laudos de laboratório em planilhas soltas.

> **Este arquivo responde "o que é o projeto".** Os *porquês* — decisões que
> divergem da especificação, limitações aceitas, detalhes de implementação —
> ficam em **[`docs/decisoes.md`](docs/decisoes.md)**. Antes de "corrigir"
> algo que parece errado, procure lá: provavelmente tem um motivo escrito.

## O problema que o sistema resolve

Hoje é impossível comparar a análise de um ano com a do ano seguinte, porque
**o laboratório renumera as amostras a cada coleta** e ninguém sabe qual amostra
corresponde a qual pedaço de terra.

Tudo no modelo de dados existe para resolver isso.

## Modelo conceitual

```
Fazenda  →  Talhão  →  Gleba  →  Análise (por ano-safra e profundidade)
```

| Entidade | O que é | Equivalente na planilha do laboratório |
|---|---|---|
| **Fazenda** | Propriedade rural, pertence a um usuário | — |
| **Talhão** | Subdivisão da fazenda, com polígono no mapa | coluna `Lote` |
| **Gleba** | Ponto ou micro-área onde a amostra é coletada | coluna `Amostra` |
| **Análise** | Um laudo, para uma gleba, num ano-safra e profundidade | uma linha do laudo |

### Regra crítica

> O número da amostra do laboratório **NÃO** é a identidade da gleba.
> Ele é apenas um atributo do laudo daquele ano.

A gleba é uma entidade cadastral **permanente**, com nome e geometria próprios,
criada pelo usuário. A comparação entre anos se apoia em `gleba_id`, nunca no
número da amostra — que vive em `analises.numero_amostra_lab`, só como
referência ao papel do laudo.

Modelar isso errado faz o produto inteiro perder a razão de existir.

**Chave natural de uma análise:** `(gleba_id, ano_safra, profundidade)`.

## Stack

| Camada | Escolha |
|---|---|
| Build | Vite 8 |
| UI | React 19, **JavaScript sem TypeScript** |
| Estilo | Tailwind CSS 3 (via PostCSS) |
| Rotas | React Router 7, **modo hash** (`createHashRouter`) |
| Backend | Supabase (Postgres + Auth + RLS) |
| Hospedagem | GitHub Pages |
| Mapa | Leaflet 1.9.4 + `@geoman-io/leaflet-geoman-free` 2.20 |
| Geometria | turf granular: `@turf/area`, `@turf/boolean-within`, `@turf/boolean-point-in-polygon`, `@turf/helpers` |

| Gráficos | Chart.js 4.5 + `react-chartjs-2` 5.3 |

**Turf granular, não `@turf/turf`.** O pacote completo arrasta dezenas de
módulos para usarmos três funções. Os pacotes avulsos entregam o mesmo.

**Bundle em 1,2 MB / 352 KB gzip.** Leaflet, Geoman, turf, Supabase e Chart.js
somados. Pesado para o 3G do campo. A saída registrada é carregar mapa e
gráficos por rota com `lazy` — não feito ainda.

Restrições: sem TypeScript, sem SSR, sem framework de UI além do Tailwind.

### Decisões de infraestrutura

- **`base: '/analisar-solo-web/'`** no `vite.config.js`. O site fica em
  `https://luccaschettino-lab.github.io/analisar-solo-web/`, então o caminho
  precisa ser absoluto. O servidor de dev usa o mesmo prefixo de propósito,
  para que um caminho quebrado apareça em desenvolvimento e não só no deploy.
- **Modo hash** nas rotas. A URL fica `.../analisar-solo-web/#/login`; nada
  depois do `#` chega ao servidor, então o GitHub Pages só precisa entregar o
  `index.html` — sem 404 em refresh ou link direto.
- **`flowType: 'pkce'`** no cliente Supabase. O fluxo implícito devolveria a
  sessão no fragmento (`#access_token=...`), disputando o mesmo espaço da URL
  que o hash router usa para a rota. O PKCE devolve em `?code=`, na query.

## Credenciais

`.env` na raiz, ignorado pelo git. Modelo em `.env.example`.

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Valores em **Supabase Dashboard → Project Settings → API Keys**. Nunca escrever
chave no código.

Usamos a **publishable key** (`sb_publishable_...`), não a anon key JWT legada.
As duas funcionam, mas a publishable é o formato atual e pode ser rotacionada
sem invalidar as sessões já emitidas. O nome da variável reflete o conteúdo de
propósito — chamá-la de `ANON_KEY` guardando outra coisa confundiria quem
fosse rotacioná-la.

Essa chave é pública por natureza — vai embutida no bundle do navegador —
então **a segurança real está toda na RLS**, não em escondê-la.

> **Salve o `.env` como UTF-8 sem BOM.** O `Set-Content -Encoding utf8` do
> PowerShell 5.1 grava BOM, e o BOM entra no nome da primeira variável,
> deixando-a `undefined` no Vite. VS Code e Bloco de Notas gravam sem BOM.

Variável de ambiente é lida na inicialização: **reinicie o dev server** depois
de editar o `.env`.

## Banco de dados

Projeto Supabase: **`analise-solo`**, ref `ekjaiwidaypvxtallhmu`, região `us-west-2`,
Postgres 17.6.

Migrações em `supabase/migrations/`, aplicadas em ordem de timestamp.
**Todas aplicadas em 2026-08-14.**

| Arquivo | Conteúdo |
|---|---|
| `20260814133139_schema_inicial.sql` | tabelas, constraints, índices |
| `20260814133228_rls.sql` | funções de autorização e policies |
| `20260814133243_triggers.sql` | perfil no cadastro, criador vira proprietário |
| `20260814133412_revogar_execute_dos_triggers.sql` | fecha as funções de trigger ao `/rest/v1/rpc/` |
| `20260814135859_perfis_policy_insert.sql` | usuário pode recriar o próprio perfil |

> **Regra: o nome do arquivo tem que ser igual ao `version` gravado em
> `supabase_migrations.schema_migrations`.** As quatro primeiras foram aplicadas
> pela API de gerenciamento, que carimba o próprio horário em vez de usar o do
> arquivo — os nomes locais ficaram divergentes e foram renomeados em
> 2026-08-14 para casar. Divergência aqui faz um `supabase db push` futuro
> concluir que nada foi aplicado e tentar rodar tudo de novo, falhando em
> `table already exists`.
>
> Ao aplicar uma migração pela API, confira o `version` gerado e nomeie o
> arquivo local com ele.

Tabelas: `perfis`, `fazendas`, `fazenda_membros`, `talhoes`, `glebas`,
`analises`.

**Unidades não ficam no banco.** Rótulo, unidade, casas decimais e faixas de
cor de cada parâmetro vivem em **`src/config/parametros.js`**, criado na Fase 3.

**Essa é a fonte única.** Nenhum componente pode repetir rótulo, unidade,
casas decimais ou faixa — se aparecer hardcoded numa tela, é bug. As funções
que leem a tabela ficam em `src/lib/parametros.js`, separadas só por tamanho.
A coluna `analises.extras jsonb` guarda parâmetros de laboratórios que fujam da
lista fixa.

### Desenho da RLS

Toda a autorização deriva de `fazenda_membros`. As tabelas abaixo de `fazendas`
não guardam dono: sobem a hierarquia.

Funções, todas `security definer stable set search_path = ''`:

| Função | Uso |
|---|---|
| `papel_na_fazenda(f_id)` | base — a única que lê `fazenda_membros` |
| `tem_acesso_fazenda(f_id)` | leitura (qualquer papel) |
| `pode_editar_fazenda(f_id)` | escrita (`proprietario`, `editor`) |
| `e_proprietario_fazenda(f_id)` | gerir membros, apagar fazenda |
| `fazenda_do_talhao(t_id)` | atalho de hierarquia |
| `fazenda_da_gleba(g_id)` | atalho de hierarquia |

**Por que `security definer`:** a policy de `fazenda_membros` precisa consultar
`fazenda_membros`. Como subconsulta direta, o Postgres reaplica a policy sobre
a própria consulta e estoura com *infinite recursion detected in policy*.
Dentro da função, a consulta roda como dona da tabela, que não passa por RLS.

**Por que `search_path = ''`:** sem isso, um schema no `search_path` do
chamador poderia sequestrar nomes de tabela dentro de uma função que roda com
privilégio elevado. Por isso todo nome nas funções está qualificado.

**Detalhe não óbvio na policy de `select` de `fazendas`:**

```sql
using (criado_por = auth.uid() or public.tem_acesso_fazenda(id))
```

A primeira metade não é redundância. O `supabase-js` emite `INSERT ... RETURNING`
no `.insert().select()`, e o Postgres aplica a policy de `SELECT` à linha
devolvida. Nesse instante o trigger que registra o criador como proprietário
ainda não rodou — ele é `AFTER INSERT`, e não pode ser `BEFORE` porque a FK de
`fazenda_membros` exige a fazenda já existindo. Sem essa cláusula, **toda
criação de fazenda falharia na volta**.

### Teste da RLS

`supabase/testes/teste_rls.sql` — cole no SQL Editor **depois** das migrações.
Roda em transação com `rollback` no fim; não deixa nada no banco. Cobre os dois
triggers, a recursão em `fazenda_membros`, o `INSERT ... RETURNING`, isolamento
entre usuários e escrita negada a não-membro. Sem exceção até o fim = passou.

**Executado em 2026-08-14: todos os invariantes passaram.** A recursão em
`fazenda_membros` não ocorreu, e o `INSERT ... RETURNING` em `fazendas` só
funciona por causa da cláusula `criado_por` descrita acima.

## Estrutura do código

Mapa por diretório. A listagem arquivo a arquivo se deduz do repositório e
envelhece rápido; o que importa aqui é onde cada tipo de coisa mora.

```
src/
  config/      dados de domínio: parametros.js (FONTE ÚNICA dos 24), mapa.js, graficos.js
  lib/         funções puras, testáveis fora do React: geo, numeros, parametros,
               historico, comparacao, lote, permissoes, supabase
  dados/       uma ida ao servidor por função, erro do Postgres traduzido
  hooks/       estado compartilhado: fazendas, hierarquia, análises, seleção, aviso
  mapa/        Leaflet e Geoman, imperativos, isolados do React
  componentes/ genéricos: Modal, Abas, formulário, guards, ErrorBoundary
  layouts/     casca pública (login) e autenticada (cabeçalho + Outlet)
  paginas/     Painel (mapa), Dados, GlebaDetalhe, Login, Cadastro
    painel/    peças da tela do mapa, incluindo seus hooks
    gleba/     trilha, tabela e gráficos de /#/glebas/:id
    dados/     seletor em cascata, formulário e listagem de /#/dados
  features/importacao/pdf/   placeholder + README do contrato
supabase/
  migrations/  aplicadas em ordem de timestamp
  testes/      teste_rls.sql, para rodar no SQL Editor
testes/
  coloracao.mjs   regras de coloração do mapa (npm run testar)
```

**Regras de organização.** Lógica que dá para testar sem navegador vive em
`lib/` — foi assim que a área do turf, o parser do lote, a comparação entre
safras e o alinhamento dos nulos dos gráficos puderam ser verificados de
verdade. Componente não fala com o Supabase direto: passa por `dados/`.
## Rodando

```bash
npm install
npm run dev      # http://localhost:5173/analisar-solo-web/
npm run build
npm run testar   # regras de coloração do mapa
```

**`npm run testar`** roda `testes/coloracao.mjs` no Node, sem navegador e sem
framework. Cobre as regras que não podem quebrar: zero é dado e não ausência,
ausência não vira zero nem se aproxima da faixa vizinha, parâmetro sem faixa no
config não recebe cor, filtro incompleto desliga a coloração, e nenhuma legenda
tem rótulo repetido nos 24 parâmetros. **Rode depois de mexer em
`lib/coloracao.js` ou nas faixas de `config/parametros.js`.**

A RLS tem seu próprio teste, em `supabase/testes/teste_rls.sql`, para colar no
SQL Editor.

## Publicação

Automática pelo GitHub Actions (`.github/workflows/deploy.yml`) a cada push em
`main`. O workflow confere os segredos, roda `npm run testar`, constrói e
publica.

Endereço: **https://luccaschettino-lab.github.io/analisar-solo-web/**

**O Vite embute as variáveis no bundle em tempo de build**, então elas precisam
existir como *repository secrets* no GitHub — `.env` local não chega lá:

| Segredo | Onde cadastrar |
|---|---|
| `VITE_SUPABASE_URL` | Settings → Secrets and variables → Actions |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | idem |

E em Settings → Pages, a origem tem que ser **GitHub Actions**, não "Deploy from
a branch".

> **O repositório é público.** A publishable key vai no bundle e é visível —
> isso é esperado, a segurança está na RLS. Mas **nunca** commitar laudos,
> planilhas ou dados de propriedades: o `.gitignore` bloqueia `*.xlsx`, `*.xls`,
> `*.csv` e `laudos/` por isso. Arquivo commitado fica no histórico para sempre;
> apagar depois não remove de clones já feitos.

## Estado das fases

### Fase 1 — concluída

- [x] Scaffold Vite + React + Tailwind
- [x] Roteamento em modo hash
- [x] Cliente Supabase lendo do `.env`, com `.env.example` e `.gitignore`
- [x] Migrações SQL com todas as tabelas, constraints e policies
- [x] Telas de login e cadastro
- [x] Este documento

Banco aplicado e testado. Cadastro exercitado de ponta a ponta pela interface
em 2026-08-14: usuário criado, `perfis` preenchido pelo trigger, sessão emitida
na hora (confirmação de e-mail desligada no projeto).

Auditoria em 2026-08-14 apontou três itens parciais, **todos corrigidos**:
`perfis` sem policy de insert, logout sem tratamento de erro, e ausência de
error boundary. Ver as seções acima.

**Pendências conhecidas:**

- Nenhum commit feito ainda.
- Deploy no GitHub Pages via Actions ainda não configurado.
- **Redirect URLs** não confirmadas no dashboard. Só importam quando a
  confirmação de e-mail for religada ou for usada recuperação de senha —
  adicionar `https://luccaschettino-lab.github.io/analisar-solo-web/` e
  `http://localhost:5173` em *Authentication → URL Configuration*.
- **Confirmação de e-mail está desligada** no projeto, para acelerar os testes.
  Religar antes de publicar. O cadastro já trata os dois casos
  (`precisaConfirmarEmail`).

### Fase 2 — concluída

- [x] Mapa em tela cheia, satélite Esri por padrão, OSM alternável, escala
- [x] Painel lateral recolhível com seletor de fazenda
- [x] CRUD de fazenda e marcação do centro pelo mapa
- [x] Árvore Talhão › Gleba com contadores; clique centraliza e destaca
- [x] Desenho de talhão e de gleba (ponto ou sub-área) com Geoman
- [x] `area_ha` calculada com turf e gravada junto da geometria
- [x] Validação de contenção da gleba: avisa, pede confirmação, não bloqueia
- [x] Edição de vértices e de dados; exclusão com cascata contada
- [x] Glebas em lote com prévia no mapa e erro por linha

Arquitetura da tela do mapa, o contador `revisao` e a regra de escrita nunca
otimista: [`docs/decisoes.md`](docs/decisoes.md#arquitetura-da-tela-do-mapa).

### Fase 3 — concluída

- [x] `src/config/parametros.js` como fonte única dos 24 parâmetros
- [x] Tela da gleba em `/#/glebas/:id` com trilha Fazenda › Talhão › Gleba
- [x] Aba Análises: tabela rolável, uma safra por vez, comparação opcional
- [x] Aba Histórico: um gráfico por parâmetro, série por profundidade
- [x] Tela `/#/dados` com entrada manual e placeholder de importação por PDF
- [x] Formulário com os 24 campos agrupados, todos opcionais
- [x] Faixa plausível avisa sem bloquear; conflito de chave pergunta
- [x] Edição carrega no formulário; exclusão confirma
- [x] `src/features/importacao/pdf/README.md` com o contrato para o outro time

**A regra que atravessa tudo: ausência nunca é zero.** `null` no banco, "sem
medição" na tabela, buraco não conectado no gráfico. As três camadas em que
isso é aplicado e como foi verificado estão em
[`docs/decisoes.md`](docs/decisoes.md), seção *Ausência nunca é zero*.

### Fase 4 — concluída

- [x] Três filtros no painel: ano-safra, profundidade e parâmetro
- [x] Coloração das glebas pelas faixas de `config/parametros.js`
- [x] Quatro estados: com cor, sem faixa, sem medição, sem análise
- [x] Gleba sem dado continua visível — hachurada (área) ou vazada (ponto)
- [x] Legenda no canto do mapa, com o aviso de classificação preliminar
- [x] Tooltip com valor, unidade e classificação
- [x] `testes/coloracao.mjs` cobrindo as regras críticas

**A coloração é uma afirmação sobre a terra de alguém.** Por isso o mapa só
pinta com os três filtros escolhidos, parâmetro sem faixa validada fica cinza
com o valor no tooltip, e a legenda carrega o aviso de que a classificação é
preliminar. Nenhuma dessas três coisas é detalhe visual.

### Fase 5 — não iniciada

Comparação entre anos no mapa, mapa divergente e tabela de variação. Ainda não
especificada.

**Continua pendente:** as faixas de `config/parametros.js` não passaram por
validação agronômica, e o fósforo segue sem classificação por depender do
P-Rem. Ver as limitações em [`docs/decisoes.md`](docs/decisoes.md).

## Convenções

- Código e comentários em **português**; identificadores sem acento.
- Nomes de domínio em português (`fazendas`, `talhoes`, `glebas`, `analises`)
  tanto no banco quanto no front, para não haver tradução mental no meio.
- Trabalho em **passos incrementais**, com explicação antes de aplicar.
