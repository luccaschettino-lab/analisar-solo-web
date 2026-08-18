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

### Fase 5

| Decisão | Motivo |
|---|---|
| **Cinco estados de variação, não três.** A spec previa queda, estabilidade e alta, mais os dois cinzas. | Os dois cinzas são estados de verdade e precisam de nome próprio no código, senão a regra "nunca tratar como zero" vira responsabilidade de cada componente. `SEM_UM_ANO` sai hachurado, `SEM_OS_DOIS` sai cinza neutro, e nenhum dos dois passa pela rampa de cor. |
| **A escala divergente não reaproveita as cores de `NIVEIS`.** | `NIVEIS` afirma bom e ruim; a variação afirma só subiu e desceu. Alumínio que sobe é péssimo, cálcio que sobe é ótimo, e no pH o ideal fica no meio — pintar variação com a paleta da classificação prometeria um juízo que a conta não faz. O par vermelho/azul saiu do ColorBrewer RdBu, que preserva contraste nos tipos mais comuns de daltonismo. |
| **`delta_minimo` é opcional e ninguém declara ainda.** O padrão é 5% da amplitude das faixas — distância entre o menor e o maior limite finito. | Precisava de um padrão que saísse da mesma régua já usada para classificar, em vez de um número escolhido a esmo. No K, cujos limites vão de 15 a 120, dá 5,25 mg/dm³. |
| **Parâmetro sem faixas fica com limiar zero, não com um limiar inventado.** | Sem escala de interpretação não há como afirmar o que é ruído de laboratório. Zero preserva o fato bruto: toda diferença aparece como diferença. Inventar uma zona de estabilidade esconderia mudança real — e são justamente os 10 parâmetros sem faixa, o fósforo entre eles. O seletor e a legenda avisam. |
| **A escala é simétrica por construção: os dois lados ancoram em `max(\|Δ\|)`.** | Ancorar cada lado no seu próprio máximo faria uma queda de 0,3 sair tão vermelha quanto uma alta de 2,0 sai azul. Duas mudanças de tamanhos diferentes com a mesma intensidade na tela é leitura falsa. |
| **A legenda desenha a zona estável com largura proporcional a `limiar / max`.** | É a única forma de a legenda responder "o quanto desta escala conta como parado". Com limiar grande diante de variações pequenas, a barra sai quase toda neutra — que é exatamente o que o mapa mostra. |
| **A legenda diz de onde veio o limiar** — config, 5% da amplitude, ou sem faixas. | "Estável até 0,18" é afirmação forte sobre a terra de alguém. Quem lê tem direito de saber se o número foi validado ou se é a regra genérica. |
| **Linha sem valor afunda na ordenação nas duas direções.** | Ausência não é o menor valor nem o maior. Ordenando junto com os números, a pergunta "quem menos variou?" seria respondida por uma gleba que não variou coisa nenhuma — ela não foi medida. |
| **A ordem padrão (maior \|Δ\|) tem botão próprio, porque a coluna Diferença ordena com sinal.** | Ordenar com sinal separa as maiores quedas das maiores altas, e é o que a coluna mostra. Mas aí a ordem de abertura não voltaria por clique nenhum, e a pergunta central da tela — quem mais mudou — ficaria inalcançável. |
| **`useGeometrias` ganhou `conteudoTooltip` opcional em vez de uma cópia.** | O mapa divergente usa as mesmas geometrias, a mesma hachura e a mesma seleção; só a cor e o texto mudam. Duas cópias do desenho das camadas divergiriam na primeira correção — foi o que já quase aconteceu entre destaque e coloração na Fase 4. |
| **A fazenda aparece nos filtros da tela *e* na barra lateral, com um estado só.** | No celular a barra é gaveta fechada, e trocar de fazenda no meio de uma comparação exigiria abrir outro painel. Como as duas entradas escrevem no `FazendaContext`, não há como divergirem. |
| **Base zero mostra "partiu de zero", não célula vazia.** | (B − A) / 0 não existe, e omitir a porcentagem deixaria parecer que a conta falhou. O `delta` continua válido e continua colorindo o mapa. |
| **Os filtros começam vazios, como na Fase 4.** | Abrir já comparando dois anos escolhidos por nós afirmaria algo sobre a terra sem ninguém ter pedido — e aqui a afirmação é mais forte, porque a tela diz o que melhorou e o que piorou. |

#### Correções da auditoria da Fase 5

| Decisão | Motivo |
|---|---|
| **`variacao.js` dividido em cinco arquivos**: `estadosVariacao` (folha), `variacao` (cálculo), `escalaDivergente` (cor), `textosVariacao` (apresentação), `ordenarVariacao` (tabela). | O arquivo chegou a 460 linhas misturando quatro responsabilidades. O quinto arquivo — as constantes de estado — não estava na proposta: apareceu porque o cálculo precisa da cor e a cor precisa dos estados, o que fechava um ciclo de imports. Ciclo em módulo ES funciona por acidente da ordem de avaliação e quebra no dia em que alguém ler a constante no topo do arquivo em vez de dentro de uma função. `variacao.js` reexporta `LADO` e `VARIACAO`, então a superfície pública não mudou. |
| **Erro de carga vem antes de qualquer mensagem de "não tem".** Os três erros — fazendas, hierarquia, análises — saem juntos na faixa de alerta dos filtros; o mapa e a tabela apontam para lá. | A tela dizia "Esta fazenda ainda não tem glebas cadastradas" quando as glebas tinham **falhado** ao carregar, e a mesma frase enquanto ainda carregavam. Não saber distinguir "falhou" de "está vazio" é o pior que esta tela pode fazer: as duas leem igual e só uma é problema de quem está olhando. |
| **`useEnquadramentoDaFazenda` extraído de `useMapaDaFazenda`.** | A tela de comparação reusava o hook inteiro e levava junto o modo de marcar a sede — estado, listener de clique e a escrita em `definirSede` — numa tela que não escreve nada. Criar um hook novo e parecido duplicaria a regra de para onde o mapa vai ao abrir uma fazenda; extrair mantém uma cópia só. A API de `useMapaDaFazenda` não mudou, então o Painel não sentiu. |
| **`ROTULO_VARIACAO` removido.** | Definido, exportado e usado em lugar nenhum — nem no código, nem no teste. Constante exportada que ninguém consome é pior que código feio: alguém a mantém. |

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

- **O limiar de estabilidade da Fase 5 é heurística, não agronomia.** Nenhum
  parâmetro declara `delta_minimo`, então todos usam o padrão: 5% da amplitude
  das faixas — que são justamente as faixas não validadas do item acima. Na
  prática, o que a tela chama de "estável" é uma régua derivada de outra régua
  não conferida. A legenda diz de onde o número veio, mas dizer a origem não é
  o mesmo que estar certo. **O caminho é preencher `delta_minimo` parâmetro a
  parâmetro quando houver validação**, e o código já prefere o valor do config
  ao padrão.

- **Variação não é causa.** O mapa divergente mostra que o cálcio subiu, não
  que a calagem funcionou: mudança de laboratório, de método de extração, de
  ponto exato da coleta dentro da gleba e de umidade do solo aparecem todas
  como variação. O sistema não guarda nada disso além do campo livre
  `laboratorio`, e portanto não tem como descontar nenhuma delas.

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

---

## Desenho da RLS

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

---

## Histórico das fases

Registro do caminho: o que cada fase entregou e o que a auditoria dela apontou.

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
- [x] CRUD de fazenda e marcação da sede pelo mapa (era "centro"; renomeado depois da Fase 5)
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

### Rótulos fixos e sede da fazenda

Feito depois da Fase 5, a pedido do responsável, a partir de um aplicativo de
campo que ele usa como referência.

| Decisão | Motivo |
|---|---|
| **O rótulo do talhão passou de balão no hover para texto fixo sobre a geometria**, com `Talhão CÓDIGO (descrição)` e a área embaixo. | O produtor reconhece a propriedade dele pela disposição dos talhões. Ter que caçar cada nome com o cursor desfaz esse reconhecimento — e no celular, onde não há cursor, o rótulo só aparecia depois de um toque que também selecionava. |
| **A caixa do tooltip é removida por CSS; o texto é branco com contorno escuro.** | Fixo e repetido em todo talhão, o balão padrão do Leaflet vira uma parede de caixinhas cobrindo o que se quer ver. Sobre satélite não há como garantir contraste — o mesmo mapa tem solo exposto claro e mata escura —, então o contorno resolve os dois casos sem tapar a imagem. |
| **Os rótulos somem abaixo do zoom 13**, por uma classe no container do mapa. | Quatro talhões cabem na tela; trinta viram mancha. A classe evita abrir e fechar dezenas de tooltips a cada zoom, o que faria o Leaflet recriar os elementos e piscar. |
| **As glebas continuam com rótulo só no hover.** | Uma fazenda tem poucas dezenas de talhões e pode ter centenas de glebas. Tudo fixo ao mesmo tempo seria ilegível. |
| **Dizemos "Talhão", não "Lote"**, mesmo o aplicativo de referência dizendo Lote. | `Lote` é a coluna da planilha do laboratório. Talhão é a entidade do cadastro, com código próprio e permanente. Misturar os dois nomes na tela reintroduz a tradução mental que o modelo de dados existe para eliminar. |
| **"Marcar centro" virou "Marcar sede", e o ponto passou a aparecer** como pin com o nome da fazenda. | O ponto era um detalhe de interface — "onde o mapa abre" — e não tinha representação na tela. Vira um lugar real, que o produtor reconhece. O enquadramento de abertura continua caindo nele quando não há talhão desenhado, mas isso virou consequência, não a definição. |
| **As colunas foram renomeadas de `centro_lat`/`centro_lng` para `sede_lat`/`sede_lng`.** | Manter o nome antigo faria a coluna mentir sobre o que guarda. A migração foi aplicada **imediatamente antes do deploy**, porque renomear derruba o bundle que está no ar até o novo subir — a janela ficou em cerca de um minuto, em vez de meia hora. |
| **O pin é SVG inline num `divIcon`, e o nome vem como tooltip do marcador.** | Arquivo de ícone quebra com o bundler e com o prefixo `/analisar-solo-web/` do Pages — mesma razão de as glebas-ponto usarem `circleMarker`. O nome ficou fora do `divIcon` porque tem largura variável: dimensionar o ícone à mão para caber "Fazenda Chapada" e "Sítio São João" daria um retângulo errado nos dois casos. |
| **O botão "Ir para a sede" fica fora do bloco de editor.** | Localizar-se é leitura, não edição. Um consultor com papel de leitor precisa disso tanto quanto o dono. |

### Fase 7

| Decisão | Motivo |
|---|---|
| **`parametros` como `jsonb` num registro só**, não uma tabela de faixas. | As faixas nunca são consultadas isoladamente — carrega-se o conjunto inteiro ao abrir a fazenda. Em linhas seriam ~100 registros por conjunto com coluna de ordem para manter na mão; em jsonb o formato fica idêntico ao do config e o fallback vira uma linha. Precedente: `analises.extras`. |
| **Três estados por parâmetro:** chave ausente (usa o config), `faixas` preenchidas (substitui), `faixas: null` (declara que não há classificação). | O terceiro existe porque um consultor pode discordar da faixa genérica sem ter outra pronta. Sem ele, a única saída seria deixar de pé uma faixa que ele considera errada. |
| **Só o autor aplica o próprio conjunto numa fazenda**, garantido por trigger. | Sem isso bastaria adivinhar um UUID e apontá-lo na própria fazenda para passar a enxergar o conjunto de outra pessoa — a função de visibilidade o tornaria legível no instante seguinte. Não dá para resolver no `WITH CHECK`: ele roda depois da linha atualizada, quando o vínculo já existe. |
| **A restrição de autoria ficou em trigger, não no `WITH CHECK` da policy de update de `fazendas`.** | O `WITH CHECK` roda em *todo* update. Com ele, o dono de uma fazenda que usa o critério do consultor não conseguiria nem renomear a própria fazenda. O trigger enxerga a linha antiga e só se mete quando `criterio_id` de fato muda. |
| **`autor_nome` denormalizado em `criterios`**, preenchido por trigger. | A legenda precisa assinar, mas a policy de `perfis` é "ler o próprio" — de propósito. Afrouxá-la para exibir um nome abriria a leitura de todos os perfis. É um retrato do momento da criação: quem assinou, assinou com o nome daquele dia. |
| **A assinatura na legenda é por parâmetro, não por fazenda.** | Um conjunto pode sobrescrever o pH e não falar do zinco. Creditar o consultor pela cor do zinco seria mentira — ele não escreveu aquilo. Nesse caso a legenda volta a mostrar o aviso de classificação preliminar, dizendo que o conjunto está aplicado mas não define aquele parâmetro. |
| **`faixaDe` recebe as faixas já resolvidas, não o conjunto de critérios.** | `lib/parametros.js` é folha e `lib/criterios.js` depende dele; passar o conjunto fecharia um ciclo. E quem classifica um número não precisa saber que existem consultores. O argumento é opcional, então nada do que existia antes mudou de comportamento. |
| **`origemDoLimiar` deixou de devolver `'config'`.** | Com o `delta_minimo` podendo vir do conjunto, aquele valor fazia a legenda creditar ao arquivo um número que o consultor tinha escrito. Agora diz **como** o limiar foi obtido — declarado ou derivado das faixas —, e quem assina é assunto da assinatura. |
| **Personalizar um parâmetro começa com uma cópia das faixas do config**, não com lista vazia. | Digitar cinco faixas do zero para mudar um limite seria o caminho mais curto para ninguém usar a tela. |
| **A última faixa ser aberta é erro, não aviso.** | `faixaDe` devolve a primeira faixa em que o valor cabe. Se a última tiver teto, um valor acima dele não casa com nada e a gleba sai sem classificação — sem erro, sem aviso, e só aparecendo no laudo que passar do teto. É a falha mais perigosa desta tela. |
| **Rótulo repetido e limite fora do plausível são avisos, não erros.** | São escolhas legítimas de quem entende de solo. O sistema barra o que produziria classificação silenciosamente errada, e apenas avisa sobre o resto — mesma divisão do formulário de análises da Fase 3. |
| **Definir faixa para um parâmetro que o config deixou sem uma dispara o aviso com a `nota` registrada.** | É o caso do fósforo, que depende do P-Rem. O consultor pode decidir assim mesmo, mas a razão escrita tem que aparecer — e o aviso sai do próprio `nota`, sem lista de exceções à mão. |

### Fase 5 — concluída

- [x] Tela `/#/comparar`, no menu para qualquer usuário com acesso à fazenda
- [x] Quatro seletores: fazenda, Ano A, Ano B, profundidade e parâmetro
- [x] Anos iguais bloqueiam a comparação com mensagem, antes de qualquer conta
- [x] Mapa divergente com as geometrias da Fase 4 e escala simétrica em zero
- [x] Cinco estados: queda, estável, alta, sem dado em um ano, sem dado nos dois
- [x] Limiar de estabilidade de `delta_minimo`, ou 5% da amplitude das faixas
- [x] Legenda com a zona estável em tamanho real e a origem do limiar
- [x] Tabela de seis colunas, ordenável, com ausência nomeada por ano e motivo
- [x] Clicar na linha seleciona e centraliza a gleba no mapa
- [x] `testes/variacao.mjs` cobrindo as regras críticas

**A regra da Fase 3 e da Fase 4 continua valendo, e aqui é onde ela custa mais
caro.** Uma gleba medida num ano só não tem variação zero — não tem variação
nenhuma. Ela sai hachurada no mapa, sai com "sem dado" e o motivo na coluna do
ano que falta, sai com "sem comparação" nas colunas de diferença, e afunda em
qualquer ordenação. Nenhum valor é interpolado, estimado ou completado.

**Não exercitada no navegador.** O build passa e as regras puras estão
cobertas por teste, mas a tela em si — layout do mapa ao lado da tabela,
enquadramento, hachura sobre o satélite — só foi verificada por leitura de
código. Vale abrir `/#/comparar` com as 5 análises de demonstração antes de
confiar nela.

**Continua pendente:** as faixas de `config/parametros.js` não passaram por
validação agronômica, o fósforo segue sem classificação por depender do P-Rem,
e agora o limiar de estabilidade herda essa mesma fragilidade. Ver as
limitações acima.

### Foto do solo

Pedido depois da Fase 7. Primeiro uso de Storage no projeto.

| Decisão | Motivo |
|---|---|
| **O caminho começa pelo `fazenda_id`.** | Não é organização de pastas: é o que as policies do bucket leem com `storage.foldername(name)` para chamar `tem_acesso_fazenda` e `pode_editar_fazenda`. A autorização das fotos passa a ser a mesma do resto do banco, sem inventar regra nova. |
| **`uuid_ou_nulo(text)` em vez de `::uuid` direto na policy.** | Um arquivo gravado num caminho que não começa por uuid faria o cast estourar com `22P02`. Numa policy, erro é pior que negação: derruba a consulta inteira em vez de esconder a linha. A função devolve `null`, e `null` reprova em `tem_acesso_fazenda` como deve. |
| **Bucket privado, com URL assinada de validade curta.** | Foto do solo é dado da propriedade. O `.gitignore` já bloqueia planilhas e laudos pelo mesmo motivo; bucket público seria a mesma exposição por outra porta. O custo é que a URL expira, e o hook precisa reassiná-la — o que ele faz cinco minutos antes do vencimento. |
| **Redução no navegador antes de subir**, 1600 px e JPEG 0,8. | Foto de celular tem 4-12 MB; reduzida fica em 200-400 KB. No 3G do campo é a diferença entre o envio terminar e a pessoa desistir. Sem dependência nova — `canvas` faz. O limite de 5 MB no bucket é rede de segurança, não o mecanismo: o servidor não deve confiar no cliente. |
| **`createImageBitmap(..., { imageOrientation: 'from-image' })`.** | O `<img>` da tela respeita a rotação gravada no EXIF, mas o canvas desenha os pixels crus. Sem isso, metade das fotos de celular subiria deitada. |
| **Nunca ampliar.** | Uma foto de 800 px virando 1600 px ocuparia quatro vezes mais bytes sem um pixel a mais de informação. Testado em `testes/imagem.mjs`. |
| **Uma foto por gleba, em coluna, não em tabela.** | Escolha do responsável. Uma galeria com data seria a versão visual da comparação entre anos, mas a segunda foto tomar o lugar da primeira resolve o pedido com muito menos superfície. Virar galeria depois é acrescentar tabela, não desfazer o que existe. |
| **Ordem do envio: sobe o arquivo → grava o caminho → apaga o antigo.** | Invertida, uma falha no meio deixaria a gleba apontando para um arquivo que não existe e a foto sumiria da tela. Nesta ordem, a falha no último passo deixa um arquivo órfão ocupando espaço — o problema menor, porque ninguém perde imagem. Se o passo do meio falhar, o arquivo recém-enviado é apagado na hora. |
| **Apagar a gleba não apaga o arquivo do Storage.** | Limitação aceita: a cascata do Postgres não alcança o bucket. Ficam órfãos. Resolver exigiria um trigger com chamada externa ou uma rotina de limpeza, e nenhum dos dois se justifica no volume atual. |
| **A aba Foto fica fora do bloco que depende das análises.** | A tela trocava todo o conteúdo pela mensagem "nenhuma análise nesta gleba", o que engoliria a aba justamente na gleba recém-cadastrada — que é onde a foto do solo mais serve. |
| **`capture="environment"` no seletor de arquivo.** | No celular abre a câmera traseira direto, em vez do seletor de arquivos. É o gesto certo para quem está em pé na gleba. No computador o atributo é ignorado e o seletor normal aparece. |

### Fase 7 — concluída

- [x] Tabela `criterios` com `parametros jsonb`, `fazendas.criterio_id` e RLS
- [x] `lib/criterios.js`: mescla conjunto × config e validação das faixas
- [x] `faixaDe`, `coloracao` e `variacao` passam a aceitar critérios
- [x] Tela `/#/criterios`, com editor por parâmetro agrupado
- [x] Aplicar e remover o conjunto na fazenda aberta
- [x] Legendas assinando o critério, parâmetro a parâmetro
- [x] `testes/criterios.mjs`, incluindo a integração com mapa e comparação

**Isto destrava o bloqueio registrado desde a Fase 3.** As faixas de
`config/parametros.js` nunca passaram por validação agronômica, e o mapa
pintava com uma tabela genérica que ninguém assinava. Agora quem responde pela
interpretação escreve as faixas e assina; o config virou **semente**, não
verdade.

**O que continua no config, e por quê:** rótulo, unidade, casas decimais,
grupo e faixa plausível. Isso é fato, não juízo — "cálcio se mede em
cmolc/dm³" não é opinião de consultor. A regra da fonte única continua valendo
para os fatos; só a interpretação saiu.

**Não exercitada no navegador.** Build e testes passam, e a integração está
coberta — o mesmo pH 6,2 muda de "Pouco ácido" para "Ideal" e de amarelo para
verde quando o conjunto entra —, mas a tela em si só foi verificada por leitura
de código.

### Fase 6 — não iniciada

Importação de GeoJSON do QGIS. Fora do escopo da Fase 5 por decisão do
responsável.
