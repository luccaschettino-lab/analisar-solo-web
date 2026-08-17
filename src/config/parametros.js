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

// Níveis de interpretação, do mais pobre ao mais rico.
export const NIVEIS = {
  muito_baixo: { rotulo: 'Muito baixo', cor: '#b91c1c' },
  baixo: { rotulo: 'Baixo', cor: '#ea580c' },
  medio: { rotulo: 'Médio', cor: '#eab308' },
  bom: { rotulo: 'Bom', cor: '#65a30d' },
  muito_bom: { rotulo: 'Muito bom', cor: '#15803d' },
}

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
    // Única escala não-monotônica do conjunto: o ideal fica no meio, e os dois
    // extremos pontuam mal. Por isso cada faixa traz rótulo próprio — sem ele,
    // a legenda mostraria "Baixo" para solo ácido e "Baixo" para alcalino.
    faixas: [
      { ate: 4.5, nivel: 'muito_baixo', rotulo: 'Muito ácido' },
      { ate: 5.4, nivel: 'baixo', rotulo: 'Ácido' },
      { ate: 6.0, nivel: 'bom', rotulo: 'Ideal' },
      { ate: 7.0, nivel: 'medio', rotulo: 'Pouco ácido' },
      { ate: null, nivel: 'baixo', rotulo: 'Alcalino' },
    ],
    nota: 'Faixa ideal para a maioria das culturas fica entre 5,5 e 6,5; por isso os extremos, ácido e alcalino, pontuam mal.',
  },
  {
    chave: 'al', rotulo: 'Al³⁺', unidade: 'cmolc/dm³', casas: 2,
    grupo: 'acidez', plausivel: { min: 0, max: 15 },
    faixas: [
      { ate: 0.2, nivel: 'muito_bom' },
      { ate: 0.5, nivel: 'bom' },
      { ate: 1.0, nivel: 'medio' },
      { ate: 2.0, nivel: 'baixo' },
      { ate: null, nivel: 'muito_baixo' },
    ],
    nota: 'Alumínio trocável: quanto menor, melhor. A escala está invertida de propósito.',
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
      { ate: 120, nivel: 'bom' },
      { ate: null, nivel: 'muito_bom' },
    ],
  },
  {
    chave: 'ca', rotulo: 'Ca²⁺', unidade: 'cmolc/dm³', casas: 2,
    grupo: 'macronutrientes', plausivel: { min: 0, max: 30 },
    faixas: [
      { ate: 0.4, nivel: 'muito_baixo' },
      { ate: 1.2, nivel: 'baixo' },
      { ate: 2.4, nivel: 'medio' },
      { ate: 4.0, nivel: 'bom' },
      { ate: null, nivel: 'muito_bom' },
    ],
  },
  {
    chave: 'mg', rotulo: 'Mg²⁺', unidade: 'cmolc/dm³', casas: 2,
    grupo: 'macronutrientes', plausivel: { min: 0, max: 15 },
    faixas: [
      { ate: 0.15, nivel: 'muito_baixo' },
      { ate: 0.45, nivel: 'baixo' },
      { ate: 0.9, nivel: 'medio' },
      { ate: 1.5, nivel: 'bom' },
      { ate: null, nivel: 'muito_bom' },
    ],
  },
  {
    chave: 's', rotulo: 'S', unidade: 'mg/dm³', casas: 1,
    grupo: 'macronutrientes', plausivel: { min: 0, max: 200 },
    faixas: [
      { ate: 3, nivel: 'muito_baixo' },
      { ate: 5, nivel: 'baixo' },
      { ate: 10, nivel: 'medio' },
      { ate: null, nivel: 'bom' },
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
      { ate: 80, nivel: 'bom' },
      { ate: null, nivel: 'muito_bom' },
    ],
  },
  {
    chave: 'm', rotulo: 'm (saturação por alumínio)', unidade: '%', casas: 1,
    grupo: 'indices', plausivel: { min: 0, max: 100 },
    faixas: [
      { ate: 15, nivel: 'muito_bom' },
      { ate: 30, nivel: 'bom' },
      { ate: 50, nivel: 'medio' },
      { ate: 75, nivel: 'baixo' },
      { ate: null, nivel: 'muito_baixo' },
    ],
    nota: 'Quanto menor, melhor: escala invertida, como o Al.',
  },

  // ---- Matéria orgânica ----
  {
    chave: 'mo', rotulo: 'Matéria orgânica', unidade: 'dag/kg', casas: 2,
    grupo: 'materia_organica', plausivel: { min: 0, max: 30 },
    faixas: [
      { ate: 0.7, nivel: 'muito_baixo' },
      { ate: 2.0, nivel: 'baixo' },
      { ate: 4.0, nivel: 'medio' },
      { ate: 7.0, nivel: 'bom' },
      { ate: null, nivel: 'muito_bom' },
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
      { ate: null, nivel: 'bom' },
    ],
  },
  {
    chave: 'cu', rotulo: 'Cu', unidade: 'mg/dm³', casas: 2,
    grupo: 'micronutrientes', plausivel: { min: 0, max: 50 },
    faixas: [
      { ate: 0.3, nivel: 'muito_baixo' },
      { ate: 0.7, nivel: 'baixo' },
      { ate: 1.2, nivel: 'medio' },
      { ate: null, nivel: 'bom' },
    ],
  },
  {
    chave: 'mn', rotulo: 'Mn', unidade: 'mg/dm³', casas: 1,
    grupo: 'micronutrientes', plausivel: { min: 0, max: 500 },
    faixas: [
      { ate: 2, nivel: 'muito_baixo' },
      { ate: 5, nivel: 'baixo' },
      { ate: 8, nivel: 'medio' },
      { ate: null, nivel: 'bom' },
    ],
  },
  {
    chave: 'fe', rotulo: 'Fe', unidade: 'mg/dm³', casas: 1,
    grupo: 'micronutrientes', plausivel: { min: 0, max: 800 },
    faixas: [
      { ate: 8, nivel: 'muito_baixo' },
      { ate: 18, nivel: 'baixo' },
      { ate: 30, nivel: 'medio' },
      { ate: null, nivel: 'bom' },
    ],
  },
  {
    chave: 'zn', rotulo: 'Zn', unidade: 'mg/dm³', casas: 2,
    grupo: 'micronutrientes', plausivel: { min: 0, max: 100 },
    faixas: [
      { ate: 0.4, nivel: 'muito_baixo' },
      { ate: 1.0, nivel: 'baixo' },
      { ate: 2.2, nivel: 'medio' },
      { ate: null, nivel: 'bom' },
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
