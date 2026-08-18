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

**Bundle em 1,26 MB / 369 KB gzip.** Leaflet, Geoman, turf, Supabase e Chart.js
somados. Pesado para o 3G do campo. A saída registrada é carregar mapa e
gráficos por rota com `lazy` — não feito ainda, e a tela de comparação da Fase 5
somou mais 16 KB gzip por entrar no mesmo pedaço.

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
`analises`, `criterios`.

**Unidades não ficam no banco.** Rótulo, unidade, casas decimais, grupo e
faixa plausível de cada parâmetro vivem em **`src/config/parametros.js`**,
criado na Fase 3.

**Essa é a fonte única dos fatos.** Nenhum componente pode repetir rótulo,
unidade ou casas decimais — se aparecer hardcoded numa tela, é bug.

**As faixas de interpretação saíram de lá na Fase 7.** Elas viraram juízo
editável: a tabela `criterios` guarda conjuntos nomeados, a fazenda aponta para
um em `fazendas.criterio_id`, e o config passou a ser **semente** — vale para
todo parâmetro que o conjunto não tocar. A mescla está em `src/lib/criterios.js`. As funções
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

Três detalhes desse desenho não se deduzem lendo o SQL — por que
`security definer`, por que `search_path = ''`, e por que a policy de `select`
de `fazendas` tem uma cláusula que parece redundante e sem a qual **toda
criação de fazenda falha**. Estão em
[`docs/decisoes.md`](docs/decisoes.md), seção *Desenho da RLS*.

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
               historico, comparacao, coloracao, lote, permissoes, supabase
               + a família da variação: estadosVariacao (folha), variacao
                 (cálculo), escalaDivergente (cor), textosVariacao, ordenarVariacao
  dados/       uma ida ao servidor por função, erro do Postgres traduzido
  hooks/       estado compartilhado: fazendas, hierarquia, análises, seleção, aviso
  mapa/        Leaflet e Geoman, imperativos, isolados do React
  componentes/ genéricos: Modal, formulário, guards, ErrorBoundary
  context/     AuthContext (sessão) e FazendaContext (fazenda aberta)
  layouts/     casca pública (login), casca autenticada e a BarraLateral
  paginas/     Painel (mapa), Dados, Comparar, GlebaDetalhe, Login, Cadastro
    painel/    peças da tela do mapa, incluindo seus hooks
    gleba/     trilha, tabela e gráficos de /#/glebas/:id
    dados/     seletor em cascata, formulário e listagem de /#/dados
    comparacao/ filtros, legenda divergente e tabela de /#/comparar
    criterios/  editor de faixas por parâmetro de /#/criterios
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
npm run testar   # coloração do mapa, busca e variação entre safras
```

**`npm run testar`** roda três arquivos no Node, sem navegador e sem framework:
`testes/coloracao.mjs`, `testes/busca.mjs` e `testes/variacao.mjs`.

`coloracao.mjs` cobre as regras que não podem quebrar na Fase 4: zero é dado e
não ausência, ausência não vira zero nem se aproxima da faixa vizinha,
parâmetro sem faixa no config não recebe cor, filtro incompleto desliga a
coloração, e nenhuma legenda tem rótulo repetido nos 24 parâmetros.

`variacao.mjs` cobre as da Fase 5: gleba medida num ano só nunca vira zero nem
recebe cor de variação, gleba sem dado nos dois anos não some do mapa, a escala
divergente é simétrica, o limiar cai para zero em parâmetro sem faixa, base
zero não produz porcentagem, e linha sem valor afunda na ordenação nas duas
direções.

**Rode depois de mexer em `lib/coloracao.js`, `lib/variacao.js` ou nas faixas
de `config/parametros.js`.**

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

**Publicado e funcionando desde 2026-08-17**, com login validado no ar.

> Cuidado ao editar `VITE_SUPABASE_URL`: o domínio é **`.supabase.co`**, não
> `.supabase.com`. Um M a mais faz o navegador não resolver o nome, e o
> sintoma é um genérico "sem conexão com o servidor" — aconteceu na primeira
> publicação. Por isso a mensagem de erro passou a incluir o host tentado.

> **O repositório é público.** A publishable key vai no bundle e é visível —
> isso é esperado, a segurança está na RLS. Mas **nunca** commitar laudos,
> planilhas ou dados de propriedades: o `.gitignore` bloqueia `*.xlsx`, `*.xls`,
> `*.csv` e `laudos/` por isso. Arquivo commitado fica no histórico para sempre;
> apagar depois não remove de clones já feitos.

## Onde o projeto está

**No ar e em uso**: cadastro de propriedade com desenho no mapa, lançamento de
laudos, tabela comparativa entre safras, gráficos de evolução, coloração do
mapa por parâmetro e busca por lugar ou coordenada. Os talhões aparecem com
rótulo fixo — código, descrição e área —, e a fazenda tem uma **sede** marcável,
que vira um pin com o nome dela e tem botão próprio para o mapa ir até lá.

**Fase 5 concluída** — `/#/comparar`: mapa divergente entre dois anos-safra,
com escala simétrica centrada em zero, e tabela de variação ordenável ao lado.
Gleba medida em apenas um dos anos nunca é tratada como zero: fica hachurada no
mapa e nomeia, na tabela, qual ano falta e por quê. **Ainda não exercitada no
navegador** — o build passa e as regras puras têm teste, mas a tela só foi
verificada por leitura.

**Fase 7 concluída** — `/#/criterios`: o consultor cria conjuntos nomeados de
faixas de interpretação e aplica um em cada fazenda. A cor do mapa deixou de
ser anônima; a legenda assina, parâmetro a parâmetro. **Ainda não exercitada no
navegador.**

**Fase 6 não iniciada** — importação de KML/GeoJSON do QGIS, em stand by.

**O que trava a próxima etapa:** as faixas de interpretação de
`config/parametros.js` **não passaram por validação agronômica**, e o fósforo
segue sem classificação por depender do P-Rem. Enquanto isso não for resolvido,
a cor do mapa não sustenta decisão de adubação — a legenda avisa, mas aviso é
remendo. **A Fase 5 herdou a dívida:** o limiar que separa "estável" de
"variação significativa" é, por padrão, 5% da amplitude dessas mesmas faixas.
O campo `delta_minimo` existe em `config/parametros.js` justamente para receber
o valor validado, parâmetro a parâmetro — hoje nenhum o declara.

**Outras pendências**: bundle em 369 KB gzip sem carregamento por rota; a
fazenda real (Angra) nunca foi cadastrada; há 5 análises de demonstração no
banco. Detalhe em [`docs/decisoes.md`](docs/decisoes.md).

O caminho até aqui, fase a fase, está em
[`docs/decisoes.md`](docs/decisoes.md), seção *Histórico das fases*.

## Convenções

- Código e comentários em **português**; identificadores sem acento.
- Nomes de domínio em português (`fazendas`, `talhoes`, `glebas`, `analises`)
  tanto no banco quanto no front, para não haver tradução mental no meio.
- Trabalho em **passos incrementais**, com explicação antes de aplicar.
