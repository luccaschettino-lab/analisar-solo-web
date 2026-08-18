import { PARAMETROS, NIVEIS, TRACO, SEM_MEDICAO } from '../config/parametros.js'

/**
 * Funções que leem a tabela de parâmetros.
 *
 * Separadas de `config/parametros.js` só por tamanho: lá ficam os dados, aqui
 * a leitura deles. A fonte de verdade continua sendo uma só — nada aqui
 * inventa rótulo, unidade ou faixa.
 */

const PORCHAVE = Object.fromEntries(PARAMETROS.map((p) => [p.chave, p]))

export function parametro(chave) {
  return PORCHAVE[chave] ?? null
}

export function parametrosDoGrupo(grupo) {
  return PARAMETROS.filter((p) => p.grupo === grupo)
}

/**
 * Valor formatado para exibição, com as casas decimais do parâmetro.
 *
 * Ausência devolve traço; zero devolve "0,00". A distinção é o ponto: um solo
 * com P zero não é o mesmo que um laudo que não mediu P.
 */
export function formatarValor(chave, valor) {
  if (valor === null || valor === undefined || valor === '') return TRACO
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return TRACO
  const p = parametro(chave)
  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: p?.casas ?? 2,
    maximumFractionDigits: p?.casas ?? 2,
  })
}

/** Como `formatarValor`, mas a ausência sai por extenso: "sem medição". */
export function formatarMedicao(chave, valor) {
  const formatado = formatarValor(chave, valor)
  return formatado === TRACO ? SEM_MEDICAO : formatado
}

/** A medição existe? Zero conta como existente. */
export function temMedicao(valor) {
  return valor !== null && valor !== undefined && valor !== ''
}

export function rotuloComUnidade(chave) {
  const p = parametro(chave)
  if (!p) return chave
  return p.unidade ? `${p.rotulo} (${p.unidade})` : p.rotulo
}

/**
 * A faixa que classifica o valor, ou null.
 *
 * Devolve a faixa inteira, não só o nível, porque quem exibe precisa do rótulo
 * próprio quando ele existe — ver o pH em `config/parametros.js`.
 *
 * O terceiro argumento existe desde que as faixas deixaram de morar só no
 * config. Três estados, iguais aos de `lib/criterios.js`:
 *
 *   - omitido   → usa as faixas do config (todo o código anterior à Fase 7);
 *   - array     → usa essas, vindas do conjunto de critérios da fazenda;
 *   - `null`    → não há classificação, mesmo que o config tenha uma.
 *
 * Recebe as faixas já resolvidas, e não o conjunto de critérios, de propósito:
 * este arquivo é folha e `lib/criterios.js` depende dele. Passar o conjunto
 * fecharia um ciclo de imports entre os dois — e, de todo modo, quem
 * classifica um número não precisa saber que existem consultores.
 */
export function faixaDe(chave, valor, faixas) {
  const efetivas = faixas === undefined ? parametro(chave)?.faixas : faixas
  if (!efetivas || !temMedicao(valor)) return null
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return null
  for (const faixa of efetivas) {
    if (faixa.ate === null || numero <= faixa.ate) return faixa
  }
  return null
}

/** Nível de interpretação, ou null se o parâmetro não tem faixas aplicáveis. */
export function nivelDe(chave, valor, faixas) {
  return faixaDe(chave, valor, faixas)?.nivel ?? null
}

/**
 * Rótulo a exibir para uma faixa: o próprio dela quando definido, senão o do
 * nível. A cor sempre vem do nível — só o texto pode ser específico.
 */
export function rotuloDaFaixa(faixa) {
  if (!faixa) return null
  return faixa.rotulo ?? NIVEIS[faixa.nivel].rotulo
}

/**
 * O valor está fora do que um laudo plausível traria?
 * Serve para avisar sobre erro de digitação — nunca para impedir o salvamento.
 */
export function foraDaFaixaPlausivel(chave, valor) {
  const p = parametro(chave)
  if (!p?.plausivel || valor === null || valor === undefined || valor === '') return false
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return false
  return numero < p.plausivel.min || numero > p.plausivel.max
}

export function textoDaFaixaPlausivel(chave) {
  const p = parametro(chave)
  if (!p?.plausivel) return ''
  return `${p.plausivel.min} a ${p.plausivel.max}${p.unidade ? ` ${p.unidade}` : ''}`
}
