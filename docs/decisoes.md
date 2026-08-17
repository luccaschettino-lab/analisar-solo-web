# Decisões, limitações e detalhes de implementação

Companheiro do [`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md), que fica na raiz
e responde "o que é este projeto". Aqui ficam os **porquês** — as decisões que
divergem da especificação, as limitações aceitas e os detalhes que não se
deduzem lendo o código.

Nada aqui é lacuna a preencher. Se uma decisão parece errada, ela tem um motivo
escrito ao lado; discuta o motivo antes de "corrigir".

---

## Decisões que divergem da especificação original

### Fase 1

Levantadas na auditoria de 2026-08-14 e **aceitas explicitamente**.

| # | Decisão | Motivo |
|---|---|---|
| 1 | `criado_por` com `default auth.uid()` em `fazendas` e `analises` | A spec listava a coluna sem default. Com ele o cliente nunca precisa mandar a coluna, e a policy de insert consegue exigir que ela seja o próprio usuário. |
| 2 | `check (ano_safra ~ '^\d{2}-\d{2}$')` | A spec dizia "formato 25-26" sem constraint. Sem o check, `2025/26` e `25-26` conviveriam e quebrariam o agrupamento por safra — o eixo da comparação entre anos. |
| 3 | Policy de `select` de `fazendas` é `criado_por = auth.uid() OR tem_acesso_fazenda(id)` | A spec pedia a função nas policies. A primeira metade é obrigatória: no `INSERT ... RETURNING` do supabase-js, a policy de select é aplicada à linha devolvida antes de o trigger `AFTER INSERT` criar o vínculo de proprietário. Sem ela, **toda criação de fazenda falha na volta**. |
| 4 | `delete` de `fazendas` restrito a `proprietario` | A regra geral de escrita é `proprietario`+`editor`. Apagar a fazenda derruba talhões, glebas e análises em cascata — destrutivo demais para um editor. |
| 5 | Cinco funções além da `tem_acesso_fazenda` pedida | `papel_na_fazenda` é a base e a única que lê `fazenda_membros`; as outras derivam dela. Concentra a regra de papéis num lugar só e evita repetir a consulta em cada policy. |
| 10 | `not null` com default em `criado_em`, `cor`, `origem`, `extras`, `papel` | A spec não especificava. Coluna com default e ainda anulável aceita `null` explícito e obriga todo consumidor a tratar o caso. |
| 11 | Índices não pedidos | `fazenda_membros_usuario_idx` (painel: "fazendas deste usuário"), `talhoes_fazenda_idx`, `glebas_talhao_idx`, `analises_gleba_idx` (FKs usadas em toda navegação da hierarquia), `analises_safra_idx` (comparativo entre safras). |
| 12 | `criado_em` em `fazenda_membros` | Não estava na definição. Saber desde quando um consultor tem acesso é auditoria básica de compartilhamento. |
| 13 | Tailwind 3, não 4 | Configuração mais previsível e documentação de terceiros (Leaflet etc.) assume a versão 3. Decidido antes do scaffold. |

### Fase 2

| Decisão | Motivo |
|---|---|
| **Barra de ferramentas do Geoman desligada.** A spec pedia as ferramentas visíveis para `proprietario` e `editor`; em vez disso o desenho parte dos botões do painel. | Um polígono desenhado pela barra é ambíguo: talhão ou gleba? E gleba exige um talhão pai, que a barra não tem como saber. Os botões do painel carregam essa intenção. A regra de papel continua valendo em todos os caminhos. |
| **Atribuição das duas camadas não aparece simultaneamente.** | Limitação do Leaflet, não escolha: ele adiciona e remove a atribuição junto com a camada. Você vê a do Esri no satélite e a do OSM nas ruas. Atende a obrigação legal — credita-se o que está sendo exibido. |
| **Tooltip mostra `código — nome`**, não só o nome. | Talhão sem nome ficaria com tooltip vazio. |
| **Entrada do lote fica dentro do seletor de tipo de gleba.** | O talhão pai já está definido nesse ponto do fluxo. |
| **Parser do lote aceita `;`, tabulação e vírgula decimal.** | É o que o Excel em português exporta. Recusar obrigaria o produtor a reformatar a planilha antes de colar. Quando o separador é `;` ou tab, a vírgula vale como decimal; quando é vírgula, o decimal tem que ser ponto. |
| **Parser rejeita código já existente no talhão** antes de enviar. | O insert do lote é uma transação só — ver limitações. |
| **Controle de escala métrica** no mapa, não pedido. | Referência rápida para conferir se o polígono desenhado tem o tamanho esperado. |
| **Última fazenda lembrada no `localStorage`**, não pedido. | Quem tem uma fazenda só não deveria reselecioná-la a cada visita. |
| **CRUD de fazenda incluído na fase.** | Combinado antes de começar: sem ele o seletor abre vazio e nada mais pode ser testado. |
| **`maxNativeZoom: 19` com `maxZoom: 22`** nas duas camadas. | O Esri World Imagery não serve tiles além de z19 na maior parte do Brasil. Sem isso, aproximar para posicionar o ponto de coleta devolveria 404 e tela cinza; com `maxNativeZoom` o Leaflet estica o tile de 19. |
| **`circleMarker` e `divIcon` em vez de `L.marker`.** | O ícone padrão do Leaflet não resolve o caminho da imagem sob bundler. `circleMarker` é SVG e `divIcon` é HTML — nenhum dos dois depende de arquivo. |

### Fase 3

| Decisão | Motivo |
|---|---|
| **Ausência aparece como "sem medição"**, por extenso, não como traço. | Pedido do responsável durante a fase. Um traço pode ser lido como zero, como "não se aplica" ou como falha de carregamento. O traço sobrou para campos que não são medição: data e número de amostra. |
| **A aba Análises mostra uma safra por vez, com comparação opcional e variação percentual.** | Pedido do responsável. Estava marcado como Fase 4/5 na especificação original da Fase 3. |
| **A variação não é colorida de verde/vermelho.** | Subir alumínio é ruim, subir cálcio é bom, e pH tem um ponto ideal no meio — de 7,0 para 7,7 é piora. Colorir sem a direção certa de cada parâmetro daria conclusão errada com aparência de certeza. Quando as faixas forem validadas, a direção vem do config. |
| **Base zero vira diferença absoluta**, marcada `abs.` | Percentual sobre zero não existe. "Aumentou ∞%" não informa nada. |
| **Ordem dos grupos**: granulometria, acidez, macronutrientes, índices, MO, micro. | A especificação pedia macronutrientes antes de acidez. Acidez primeiro acompanha a ordem do laudo e agrupa pH/Al/H+Al junto, que se leem em conjunto. |
| **`p_rem` no grupo macronutrientes**, não em índices calculados. | É medido, não calculado, e serve para interpretar o P. |
| **Eixo Y dos gráficos não começa em zero.** | Numa faixa de pH entre 5 e 6, ancorar em zero achataria a variação que o produtor precisa enxergar. |
| **Série por profundidade usa rampa ordinal de um matiz** (mais fundo, mais escuro), com matiz distinto só para `outro`. | Profundidade é ordenada; cor categórica jogaria a ordem fora. `outro` está fora da sequência e não pode ser lido como posição no perfil. Paleta validada por script: lightness monotônica, ΔL ≥ 0,06, matiz único, e ΔE 23–27 do laranja contra os extremos da rampa em deuteranopia/protanopia. |
| **Conflito em modo edição remove a análise de origem** quando a chave é movida para uma já ocupada. | As duas passariam a disputar `(gleba, safra, profundidade)`. Recusar deixaria o usuário travado sem caminho óbvio. O diálogo diz isso em texto antes de confirmar. |
| **Abas guardam estado na query string** (`?aba=historico`). | Link direto para o histórico funciona, e o botão voltar do navegador se comporta como esperado. |
| **`inputMode="decimal"` em vez de `type="number"`.** | `type="number"` recusa vírgula em pt-BR, que é como o produtor digita e como o laudo imprime. |
| **Número ilegível bloqueia o salvamento; valor fora da faixa plausível, não.** | São coisas diferentes: `abc` não entra numa coluna `numeric` e o banco recusaria com erro incompreensível; `pH 12` é dado estranho, e laboratório erra. |

### Fase 4

| Decisão | Motivo |
|---|---|
| **Quatro estados de coloração, não três.** A spec previa "com cor", "sem faixa" e "sem dado". | "Sem dado" se parte em dois casos que o produtor distingue: a gleba não foi amostrada naquele filtro (`SEM_ANALISE`), ou foi amostrada e o laboratório não mediu aquele parâmetro (`SEM_MEDICAO`). O primeiro é problema de coleta, o segundo é de contrato com o laboratório. Os dois ficam sem cor; o tooltip diz qual é. |
| **Gleba-ponto sem dado usa círculo vazado tracejado, não hachura.** | A hachura tem ladrilho de 8 px e o círculo tem 14 px de diâmetro: caberiam uma ou duas listras, que leem como ruído. Num alvo pequeno, o que comunica ausência é estar visualmente vazio. A legenda mostra as duas amostras. |
| **A hachura é um `<pattern>` SVG injetado no renderizador do Leaflet.** | Não há API pública para preenchimento com padrão. O Leaflet escreve `options.fillColor` direto no atributo `fill` (`SVG.prototype._updateStyle`), então `url(#hachura-sem-dado)` chega intacto. **Só funciona no renderizador SVG** — com `preferCanvas: true` o pattern seria ignorado, e a saída seria cinza claro com borda tracejada. Confirmado visualmente no navegador antes de ficar. |
| **Destaque e coloração no mesmo efeito.** | Os dois escrevem `fillColor` na mesma camada. Separados, o último a rodar apagava o outro — foi o que aconteceu no primeiro teste da hachura, e reapareceria ao selecionar uma gleba colorida. |
| **`dashArray: null` explícito ao voltar ao estado colorido.** | `setStyle` do Leaflet **mescla** com o estilo anterior. Sem isso, o tracejado de um filtro anterior sobreviveria, e a gleba ficaria colorida *e* tracejada — sugerindo ausência onde há dado. |
| **Faixa pode ter `rotulo` próprio, sobrescrevendo o do nível.** | O pH é a única escala não-monotônica: ácido demais e alcalino demais são ambos `baixo`, e a legenda mostrava "Baixo" duas vezes com a mesma cor. Agora lê-se "Muito ácido … Ideal … Alcalino". **A cor continua vindo do nível** — só o texto é específico. Os outros 13 parâmetros com faixa seguem usando os rótulos genéricos. |
| **Os filtros começam vazios; o mapa abre em cinza.** | Colorir por padrão já afirmaria algo sobre o solo sem o usuário ter pedido — ainda mais com as faixas não validadas. |
| **Trocar de fazenda limpa só a safra**, não profundidade nem parâmetro. | A safra pode não existir na fazenda nova; as outras duas são preferência de leitura. Quem estava olhando pH em 0-20 continua olhando pH em 0-20. |
| **O seletor marca os parâmetros sem faixa com "— sem classificação".** | Sem o aviso, o usuário escolheria fósforo — o mais interessante — veria tudo cinza e concluiria que o filtro quebrou. O sufixo sai de `p.faixas`, sem lista de exceções escrita à mão. |
| **Todas as análises da fazenda carregam de uma vez.** | Trocar de parâmetro, safra ou profundidade é recorte do que já está em memória. Numa conexão de campo, é a diferença entre o filtro responder na hora e travar a cada clique. |
| **Talhão mantém a cor do cadastro; só a gleba recebe cor de valor.** | O talhão é a moldura, a gleba é o dado. Colorir os dois competiria pela mesma leitura. |

### Navegação em cascata

Feita depois da Fase 4, a pedido do responsável, que não gostava das abas.

| Decisão | Motivo |
|---|---|
| **Uma barra lateral única em todas as telas**, com Fazenda › Talhão › Gleba › seção. Substituiu o menu do topo, as abas das telas e o painel do mapa. | Havia três lugares de navegação — menu, abas e painel — e nenhum mostrava onde se estava dentro da hierarquia. A cascata responde "onde estou" e "para onde dá para ir" no mesmo lugar. |
| **Clicar num talhão ou gleba seleciona no mapa; as sub-entradas navegam.** | As duas ações são legítimas, e a mais frequente — olhar no mapa — tem que ser a mais barata. Selecionar estando em outra tela leva de volta ao mapa. |
| **`FazendaContext` levanta o estado da fazenda para o layout.** | A barra vive acima das rotas e precisa da mesma árvore que o mapa desenha. Dois estados divergiriam: criar um talhão no mapa não apareceria na barra. |
| **O pedido de desenho ("+ Talhão", "+ Gleba") viaja por estado no contexto.** | A barra não tem acesso à instância do Leaflet, e dar acesso a ela seria pior. A página do mapa consome o pedido e limpa. É evento carregado por estado — feio, mas explícito. |
| **Ações da fazenda viraram botões sobre o mapa**, no canto oposto aos controles do Leaflet. | Moravam no painel que deixou de existir. O zoom foi para a direita justamente para liberar esse canto. |
| **`PainelLateral.jsx` e `ArvoreHierarquia.jsx` removidos.** | Ficaram órfãos. Componente que ninguém importa é pior que componente ruim: alguém tenta mantê-lo. |

---

## Limitações conhecidas, não corrigidas

### Dados e interpretação

- **10 dos 24 parâmetros não têm faixa de interpretação** (`faixas: null`):
  `cascalho`, `areia`, `silte`, `argila`, `h_al`, `p`, `p_rem`, `sb`,
  `t_efetiva`, `t_potencial`. Não é lacuna a preencher — cada um tem `nota`
  explicando. Frações físicas e índices derivados não se interpretam isolados.
  O caso que mais importa é o **`p`**: a interpretação de fósforo por Mehlich-1
  depende do P-Rem ou da argila, e uma faixa fixa classificaria errado em boa
  parte dos solos. Melhor não mostrar cor do que mostrar cor errada sobre o
  nutriente mais caro da adubação. A forma correta é o cruzamento P × P-Rem,
  ainda não implementado.

- **As 14 faixas preenchidas não passaram por validação agronômica.** Seguem
  valores de referência largamente citados para solos de Minas, mas
  interpretação depende de cultura, textura e método de extração. Há um bloco
  de atenção no topo de `config/parametros.js`. **Validar antes de virar cor no
  mapa (Fase 4) ou recomendação.**

### Escrita e concorrência

- **O insert de glebas em lote é atômico: um código repetido derruba o lote
  inteiro.** `criarGlebasEmLote` faz um `insert` só, e o Postgres desfaz tudo
  se qualquer linha violar a constraint `unique (talhao_id, codigo)`. O parser
  pré-verifica duplicatas dentro do texto e contra as glebas já carregadas,
  então na prática isso quase nunca acontece — mas se outra sessão criar o
  mesmo código no intervalo entre a verificação e o envio, o usuário perde o
  lote todo e precisa colar de novo. O erro é mostrado corretamente; o que se
  perde é o trabalho. A saída, se virar problema: trocar por `upsert` com
  `onConflict` ignorado, ou inserir em blocos e relatar quais falharam.

### Acesso e permissões

- **Um `editor` ou `leitor` não consegue se remover de uma fazenda.** Só o
  `proprietario` remove membros (`"membros: remover se proprietario"`). A
  alternativa — permitir auto-remoção — deixaria o único proprietário sair e a
  fazenda ficar órfã, sem ninguém capaz de recuperar acesso. O custo é que um
  consultor não larga sozinho um cliente: precisa pedir. Aceito por ora; se
  virar problema, a saída é permitir auto-remoção **exceto** para o último
  proprietário.

- **`perfis` não tem policy de `delete`.** A linha morre por cascade de
  `auth.users`; apagar o próprio perfil mantendo a conta viva não é caso de uso.

- **Não é possível excluir uma conta que já criou fazendas.**
  `fazendas.criado_por` e `analises.criado_por` referenciam `auth.users(id)`
  sem cláusula `on delete`, então o padrão é `NO ACTION`. `delete from
  auth.users` falha com `23503`. Foi como a spec definiu as colunas. O conserto
  é uma migração trocando para `on delete set null`: quem criou se perde, a
  fazenda sobrevive — o comportamento certo quando um consultor deixa a
  empresa. Contorno atual: apagar as fazendas antes do usuário.

### Entrega

- **Bundle em 1,2 MB / 352 KB gzip.** Leaflet, Geoman, turf, Supabase e
  Chart.js somados. Pesado para o 3G do campo. A saída registrada é carregar
  mapa e gráficos por rota com `lazy` — tiraria Leaflet+Geoman+turf da abertura
  e Chart.js de tudo que não é a aba Histórico. Não feito.

---

## Advisors de segurança do Supabase

Após aplicar as migrações, o linter apontou 10 avisos. Quatro eram reais e
foram corrigidos na migração `..._revogar_execute_dos_triggers.sql`: as duas
funções de trigger nasciam executáveis por `anon` e `authenticated` via
`/rest/v1/rpc/`.

Os **6 avisos restantes são aceitos de propósito** — as funções de autorização
(`papel_na_fazenda`, `tem_acesso_fazenda`, `pode_editar_fazenda`,
`e_proprietario_fazenda`, `fazenda_do_talhao`, `fazenda_da_gleba`) precisam de
`EXECUTE` para `authenticated`, porque **policies de RLS são avaliadas com as
permissões de quem consulta**. Revogar esse grant faria toda leitura falhar.

Vazamento residual conhecido e aceito: um usuário autenticado que já conheça o
UUID de um talhão ou gleba pode chamar `fazenda_do_talhao` / `fazenda_da_gleba`
por RPC e descobrir o UUID da fazenda correspondente. Não expõe dado de negócio
— só relaciona dois identificadores opacos que ele já teria de possuir.

---

## Detalhes de implementação

### Autenticação

- `carregando` começa `true` no `AuthContext`. Os guards não redirecionam
  enquanto a sessão não resolve — decidir cedo demais expulsaria um usuário
  logado a cada F5.
- `getSession()` dá o estado inicial; `onAuthStateChange` mantém em dia depois
  (refresh de token, logout em outra aba).
- O nome do cadastro vai em `options.data.nome` → `raw_user_meta_data` →
  o trigger preenche `perfis.nome`. É o único caminho: durante o `signUp` ainda
  não existe sessão para o cliente escrever em `perfis`.
- Ao ser barrado, o guard guarda a rota tentada em `state.de` e o login volta
  para lá.
- O logout trata erro e mostra mensagem no cabeçalho. Em caso de sucesso o
  botão **não** volta a ficar habilitado: o `onAuthStateChange` derruba a
  sessão e o guard troca de tela, então reabilitar só causaria um piscar.

### Falha na raiz da aplicação

`src/lib/supabase.js` **não lança** quando falta configuração — exporta
`erroConfiguracao`. O motivo é sutil e vale lembrar: um `throw` no corpo do
módulo acontece durante a avaliação do `import`, antes de o React montar
qualquer coisa. **Nenhum error boundary alcança esse momento**, e o resultado é
tela branca com o erro só no console. Foi exatamente o que aconteceu quando o
`.env` foi gravado com BOM.

Por isso são duas camadas:

- `main.jsx` checa `erroConfiguracao` **antes** de montar o `App` e renderiza
  `<ErroFatal>` no lugar.
- `<ErrorBoundary>` envolve o `App` e captura erros de render e de efeito.

### Arquitetura da tela do mapa

`Painel.jsx` só compõe. Cada responsabilidade vive num hook:
`useSelecaoFazenda`, `useMapaDaFazenda`, `useCriacaoDeGeometria`,
`useItemSelecionado`, `useAviso`. O JSX pesado saiu para `SobreposicoesDoMapa`
e `ModaisDoPainel`.

`useItemSelecionado` **compõe `useGeometrias` por dentro**, em vez de recebê-lo
pronto. A dependência é circular: o desenho das camadas precisa de
`selecionado` e `revisao`, que moram no hook, e a edição de vértices precisa do
`obterCamada`, que sai de `useGeometrias`. Compondo, some.

**O contador `revisao`** existe para redesenhar as camadas a partir dos dados
salvos. Ao descartar uma edição de vértices, os dados não mudaram — então nada
no React dispararia o redesenho, e o polígono ficaria arrastado na tela.

**Escrita nunca é otimista.** A geometria editada só sai do modo de edição
depois de o servidor confirmar; se falhar, a camada volta ao que está no banco.
Todo botão que dispara uma escrita tem guarda de reentrância além do
`disabled` — dois cliques rápidos chegam antes do re-render.

### Ausência nunca é zero

A regra que atravessa o produto, aplicada em três camadas:

- **Entrada** — `lib/numeros.js`: campo vazio vira `null`, nunca `0`.
  `montarPayload` grava `null` explícito para todo parâmetro ausente, em vez de
  omitir a chave: omitir deixaria o valor antigo no banco numa edição, e apagar
  um número digitado por engano ficaria impossível.
- **Leitura** — `lib/parametros.js`: ausência vira `"sem medição"`; `0` vira
  `"0,00"`.
- **Gráfico** — `lib/historico.js`: `null` na posição correta do array e
  `spanGaps: false`. Encurtar o array deslocaria os pontos seguintes e
  mostraria valores no ano errado — pior que não mostrar.

Verificado contra o PostgREST real: um `p = 0` e um `k = null` no mesmo insert
sobreviveram à ida e volta com os tipos certos.
