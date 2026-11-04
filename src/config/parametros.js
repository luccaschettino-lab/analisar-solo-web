/**
 * Fonte única de verdade dos parâmetros de análise de solo.
 *
 * Rótulo, unidade, casas decimais, grupo e faixas moram aqui e em nenhum outro
 * lugar. Nenhum componente deve repetir essas informações — se um rótulo ou
 * uma unidade aparecer hardcoded numa tela, é bug.
 *
 * O banco não guarda unidade: as colunas de `analises` são `numeric` puras.
 *
 * ┌─ ATENÇÃO ────────────────────────────────────────────────────────────┐
 * │ As `faixas` de interpretação abaixo são um ponto de partida e         │
 * │ PRECISAM DE VALIDAÇÃO AGRONÔMICA antes de virarem cor no mapa ou      │
 * │ recomendação. Elas seguem valores de referência largamente citados    │
 * │ para solos de Minas Gerais, mas interpretação de solo depende de      │
 * │ cultura, textura e método de extração do laboratório.                 │
 * │                                                                        │
 * │ Onde `faixas: null`, é porque uma faixa fixa seria errada — não       │
 * │ porque faltou preencher. O motivo está no campo `nota`.               │
 * └────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Níveis de interpretação, do MENOS ao MAIS: a posição na escala é a quantidade,
 * e a cor diz se aquela quantidade serve.
 *
 * O ideal é o do meio. Pouco demais e muito demais são ruins — por isso as
 * pontas têm a mesma cor, e a cor dos dois lados afasta do verde conforme se
 * afasta do ideal: vermelho nas pontas, laranja ao lado do ideal. Antes a
 * escala era "pobre → rico", verde só em cima, e nada podia ser "demais".
 *
 * Só a cor não diz de que lado do ideal está o valor (laranja pode ser pouco
 * ou muito): quem diz é o rótulo, que a legenda e as dicas do mapa mostram.
 *
 * Escalas onde menos é sempre melhor (Al, m) usam estas mesmas cores com
 * rótulo próprio em cada faixa, ver abaixo.
 */
export const NIVEIS = {
  muito_baixo: { rotulo: 'Muito baixo', cor: '#b91c1c' },
  baixo: { rotulo: 'Baixo', cor: '#ea580c' },
  medio: { rotulo: 'Médio (ideal)', cor: '#15803d' },
  alto: { rotulo: 'Alto', cor: '#ea580c' },
  muito_alto: { rotulo: 'Muito alto', cor: '#b91c1c' },
}

/**
 * Nomes que os níveis de cima tinham quando a escala era "pobre → rico".
 * Critérios salvos antes da mudança ainda trazem `bom` e `muito_bom`; sem esta
 * tradução o mapa procuraria uma cor que não existe. A posição na escala é a
 * mesma (4º e 5º nível), só o sentido mudou: agora são "alto" e "muito alto".
 */
export const NIVEL_LEGADO = { bom: 'alto', muito_bom: 'muito_alto' }

export const GRUPOS = [
  { chave: 'granulometria', rotulo: 'Granulometria' },
  { chave: 'acidez', rotulo: 'Acidez' },
  { chave: 'macronutrientes', rotulo: 'Macronutrientes' },
  { chave: 'indices', rotulo: 'Índices calculados' },
  { chave: 'materia_organica', rotulo: 'Matéria orgânica' },
  { chave: 'micronutrientes', rotulo: 'Micronutrientes' },
]

/**
 * `faixas`: limites superiores em ordem crescente. O último item tem
 * `ate: null`, significando "daí para cima". Ausência de faixas (null) quer
 * dizer que não existe classificação fixa aplicável.
 *
 * Cada faixa aceita um `rotulo` opcional, que sobrescreve o rótulo do nível.
 * Existe para escalas não-monotônicas, onde o mesmo nível aparece nas duas
 * pontas: no pH, tanto o solo ácido demais quanto o alcalino demais são
 * `baixo`, e uma legenda com "Baixo" duas vezes não se explica. Com o rótulo
 * próprio, lê-se "Muito ácido" e "Alcalino". A cor continua vindo do nível.
 *
 * `plausivel`: faixa de sanidade do dado, não de interpretação. Serve só para
 * avisar que o número provavelmente foi digitado errado. Nunca bloqueia.
 *
 * `delta_minimo` (opcional): o quanto o valor precisa mudar entre duas safras
 * para a variação contar como significativa, na unidade do parâmetro. Existe
 * porque parte do que muda de um ano para o outro é ruído de amostragem e de
 * laboratório, não mudança no solo — pintar tudo que não é exatamente zero
 * afirmaria movimento onde não houve.
 *
 * **Nenhum parâmetro define `delta_minimo` hoje.** Sem ele, o limiar é
 * calculado em `src/lib/variacao.js`: 5% da amplitude das faixas, isto é, da
 * distância entre o menor e o maior limite finito de `faixas`. No K, cujos
 * limites vão de 15 a 120, dá 5,25 mg/dm³.
 *
 * Parâmetro sem faixas (`faixas: null`) fica com limiar **zero**. Sem escala
 * de interpretação não há como afirmar o que é ruído, e zero preserva o fato
 * bruto: qualquer diferença aparece como diferença, sem inventar uma zona de
 * estabilidade que ninguém validou. Preencher `delta_minimo` sobrescreve os
 * dois casos, e é o caminho quando houver validação agronômica.
 */
export const PARAMETROS = [
  // ---- Granulometria (%) ----
  {
    chave: 'cascalho', rotulo: 'Cascalho', unidade: '%', casas: 1,
    grupo: 'granulometria', plausivel: { min: 0, max: 100 }, faixas: null,
    nota: 'Fração física; não tem interpretação de fertilidade.',
  },
  {
    chave: 'areia', rotulo: 'Areia', unidade: '%', casas: 1,
    grupo: 'granulometria', plausivel: { min: 0, max: 100 }, faixas: null,
    nota: 'Compõe a classe textural junto com silte e argila.',
  },
  {
    chave: 'silte', rotulo: 'Silte', unidade: '%', casas: 1,
    grupo: 'granulometria', plausivel: { min: 0, max: 100 }, faixas: null,
    nota: 'Fração física; interpreta-se pela classe textural, não isolada.',
  },
  {
    chave: 'argila', rotulo: 'Argila', unidade: '%', casas: 1,
    grupo: 'granulometria', plausivel: { min: 0, max: 100 }, faixas: null,
    nota: 'Define a classe textural e condiciona a interpretação de P e K.',
  },

  // ---- Acidez ----
  {
    chave: 'ph_h2o', rotulo: 'pH em água', unidade: '', casas: 1,
    grupo: 'acidez', plausivel: { min: 3, max: 9 },
    // O ideal fica no meio e os dois extremos pontuam mal — agora como em todos
    // os parâmetros. Cada faixa traz rótulo próprio porque "Baixo"/"Alto" não
    // dizem nada num pH: o que se lê é "Muito ácido" e "Alcalino".
    faixas: [
      { ate: 4.5, nivel: 'muito_baixo', rotulo: 'Muito ácido' },
      { ate: 5.4, nivel: 'baixo', rotulo: 'Ácido' },
      { ate: 6.0, nivel: 'medio', rotulo: 'Ideal' },
      { ate: 7.0, nivel: 'alto', rotulo: 'Pouco ácido' },
      { ate: null, nivel: 'muito_alto', rotulo: 'Alcalino' },
    ],
    nota: 'Faixa ideal para a maioria das culturas fica entre 5,5 e 6,5; por isso os extremos, ácido e alcalino, pontuam mal.',
  },
  {
    chave: 'al', rotulo: 'Al³⁺', unidade: 'cmolc/dm³', casas: 2,
    grupo: 'acidez', plausivel: { min: 0, max: 15 },
    // Quanto menos, melhor: aqui pouco NÃO é ruim. O rótulo diz a quantidade e a
    // cor diz o que ela vale (verde no pouco, vermelho no muito).
    faixas: [
      { ate: 0.2, nivel: 'medio', rotulo: 'Muito baixo' },
      { ate: 0.5, nivel: 'medio', rotulo: 'Baixo' },
      { ate: 1.0, nivel: 'alto', rotulo: 'Médio' },
      { ate: 2.0, nivel: 'muito_alto', rotulo: 'Alto' },
      { ate: null, nivel: 'muito_alto', rotulo: 'Muito alto' },
    ],
    nota: 'Alumínio trocável: quanto menor, melhor. Por isso o pouco é verde e só o muito é ruim, ao contrário dos nutrientes.',
  },
  {
    chave: 'h_al', rotulo: 'H+Al', unidade: 'cmolc/dm³', casas: 2,
    grupo: 'acidez', plausivel: { min: 0, max: 30 }, faixas: null,
    nota: 'Acidez potencial. Entra no cálculo de T e da necessidade de calagem, não se interpreta isolada.',
  },

  // ---- Macronutrientes ----
  {
    chave: 'p', rotulo: 'P', unidade: 'mg/dm³', casas: 1,
    grupo: 'macronutrientes', plausivel: { min: 0, max: 500 }, faixas: null,
    nota: 'A interpretação de P por Mehlich-1 depende do P-Rem (ou da argila). Uma faixa fixa classificaria errado em boa parte dos solos, então fica sem faixa até haver o cruzamento.',
  },
  {
    chave: 'k', rotulo: 'K', unidade: 'mg/dm³', casas: 0,
    grupo: 'macronutrientes', plausivel: { min: 0, max: 800 },
    faixas: [
      { ate: 15, nivel: 'muito_baixo' },
      { ate: 40, nivel: 'baixo' },
      { ate: 70, nivel: 'medio' },
      { ate: 120, nivel: 'alto' },
      { ate: null, nivel: 'muito_alto' },
    ],
  },
  {
    chave: 'ca', rotulo: 'Ca²⁺', unidade: 'cmolc/dm³', casas: 2,
    grupo: 'macronutrientes', plausivel: { min: 0, max: 30 },
    faixas: [
      { ate: 0.4, nivel: 'muito_baixo' },
      { ate: 1.2, nivel: 'baixo' },
      { ate: 2.4, nivel: 'medio' },
      { ate: 4.0, nivel: 'alto' },
      { ate: null, nivel: 'muito_alto' },
    ],
  },
  {
    chave: 'mg', rotulo: 'Mg²⁺', unidade: 'cmolc/dm³', casas: 2,
    grupo: 'macronutrientes', plausivel: { min: 0, max: 15 },
    faixas: [
      { ate: 0.15, nivel: 'muito_baixo' },
      { ate: 0.45, nivel: 'baixo' },
      { ate: 0.9, nivel: 'medio' },
      { ate: 1.5, nivel: 'alto' },
      { ate: null, nivel: 'muito_alto' },
    ],
  },
  {
    chave: 's', rotulo: 'S', unidade: 'mg/dm³', casas: 1,
    grupo: 'macronutrientes', plausivel: { min: 0, max: 200 },
    faixas: [
      { ate: 3, nivel: 'muito_baixo' },
      { ate: 5, nivel: 'baixo' },
      { ate: 10, nivel: 'medio' },
      { ate: null, nivel: 'alto' },
    ],
  },
  {
    chave: 'p_rem', rotulo: 'P-Rem', unidade: 'mg/L', casas: 1,
    grupo: 'macronutrientes', plausivel: { min: 0, max: 70 }, faixas: null,
    nota: 'Fósforo remanescente: indica o poder tampão do solo. Não se interpreta como nutriente — é a chave para interpretar o P.',
  },

  // ---- Índices calculados ----
  {
    chave: 'sb', rotulo: 'SB', unidade: 'cmolc/dm³', casas: 2,
    grupo: 'indices', plausivel: { min: 0, max: 40 }, faixas: null,
    nota: 'Soma de bases: Ca + Mg + K (+ Na). Derivado.',
  },
  {
    chave: 't_efetiva', rotulo: 't (CTC efetiva)', unidade: 'cmolc/dm³', casas: 2,
    grupo: 'indices', plausivel: { min: 0, max: 40 }, faixas: null,
    nota: 'CTC no pH atual do solo. "t" minúsculo no laudo.',
  },
  {
    chave: 't_potencial', rotulo: 'T (CTC a pH 7)', unidade: 'cmolc/dm³', casas: 2,
    grupo: 'indices', plausivel: { min: 0, max: 60 }, faixas: null,
    nota: 'CTC potencial. "T" maiúsculo no laudo.',
  },
  {
    chave: 'v', rotulo: 'V (saturação por bases)', unidade: '%', casas: 1,
    grupo: 'indices', plausivel: { min: 0, max: 100 },
    faixas: [
      { ate: 20, nivel: 'muito_baixo' },
      { ate: 40, nivel: 'baixo' },
      { ate: 60, nivel: 'medio' },
      { ate: 80, nivel: 'alto' },
      { ate: null, nivel: 'muito_alto' },
    ],
  },
  {
    chave: 'm', rotulo: 'm (saturação por alumínio)', unidade: '%', casas: 1,
    grupo: 'indices', plausivel: { min: 0, max: 100 },
    faixas: [
      { ate: 15, nivel: 'medio', rotulo: 'Muito baixo' },
      { ate: 30, nivel: 'medio', rotulo: 'Baixo' },
      { ate: 50, nivel: 'alto', rotulo: 'Médio' },
      { ate: 75, nivel: 'muito_alto', rotulo: 'Alto' },
      { ate: null, nivel: 'muito_alto', rotulo: 'Muito alto' },
    ],
    nota: 'Quanto menor, melhor: pouco é verde e só o muito é ruim, como no Al.',
  },

  // ---- Matéria orgânica ----
  {
    chave: 'mo', rotulo: 'Matéria orgânica', unidade: 'dag/kg', casas: 2,
    grupo: 'materia_organica', plausivel: { min: 0, max: 30 },
    faixas: [
      { ate: 0.7, nivel: 'muito_baixo' },
      { ate: 2.0, nivel: 'baixo' },
      { ate: 4.0, nivel: 'medio' },
      { ate: 7.0, nivel: 'alto' },
      { ate: null, nivel: 'muito_alto' },
    ],
  },

  // ---- Micronutrientes (mg/dm³) ----
  {
    chave: 'b', rotulo: 'B', unidade: 'mg/dm³', casas: 2,
    grupo: 'micronutrientes', plausivel: { min: 0, max: 20 },
    faixas: [
      { ate: 0.15, nivel: 'muito_baixo' },
      { ate: 0.35, nivel: 'baixo' },
      { ate: 0.6, nivel: 'medio' },
      { ate: null, nivel: 'alto' },
    ],
  },
  {
    chave: 'cu', rotulo: 'Cu', unidade: 'mg/dm³', casas: 2,
    grupo: 'micronutrientes', plausivel: { min: 0, max: 50 },
    faixas: [
      { ate: 0.3, nivel: 'muito_baixo' },
      { ate: 0.7, nivel: 'baixo' },
      { ate: 1.2, nivel: 'medio' },
      { ate: null, nivel: 'alto' },
    ],
  },
  {
    chave: 'mn', rotulo: 'Mn', unidade: 'mg/dm³', casas: 1,
    grupo: 'micronutrientes', plausivel: { min: 0, max: 500 },
    faixas: [
      { ate: 2, nivel: 'muito_baixo' },
      { ate: 5, nivel: 'baixo' },
      { ate: 8, nivel: 'medio' },
      { ate: null, nivel: 'alto' },
    ],
  },
  {
    chave: 'fe', rotulo: 'Fe', unidade: 'mg/dm³', casas: 1,
    grupo: 'micronutrientes', plausivel: { min: 0, max: 800 },
    faixas: [
      { ate: 8, nivel: 'muito_baixo' },
      { ate: 18, nivel: 'baixo' },
      { ate: 30, nivel: 'medio' },
      { ate: null, nivel: 'alto' },
    ],
  },
  {
    chave: 'zn', rotulo: 'Zn', unidade: 'mg/dm³', casas: 2,
    grupo: 'micronutrientes', plausivel: { min: 0, max: 100 },
    faixas: [
      { ate: 0.4, nivel: 'muito_baixo' },
      { ate: 1.0, nivel: 'baixo' },
      { ate: 2.2, nivel: 'medio' },
      { ate: null, nivel: 'alto' },
    ],
  },
]

export const CHAVES_PARAMETROS = PARAMETROS.map((p) => p.chave)

export const PROFUNDIDADES = ['0-20', '20-40', '40-60', 'outro']

/** Traço para campo não informado (data, número de amostra). */
export const TRACO = '—'

/**
 * Ausência de medição, por extenso.
 *
 * Escrito em vez de simbolizado porque é o ponto onde o produto mais erraria
 * se fosse mal lido: um traço pode ser confundido com zero, com "não se
 * aplica" ou com falha de carregamento. "sem medição" não deixa dúvida.
 */
export const SEM_MEDICAO = 'sem medição'

// As funções que leem esta tabela — formatar, classificar, validar faixa —
// ficam em src/lib/parametros.js. Aqui só os dados.
