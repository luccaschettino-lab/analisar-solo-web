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
 */
export function faixaDe(chave, valor) {
  const p = parametro(chave)
  if (!p?.faixas || !temMedicao(valor)) return null
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return null
  for (const faixa of p.faixas) {
    if (faixa.ate === null || numero <= faixa.ate) return faixa
  }
  return null
}

/** Nível de interpretação, ou null se o parâmetro não tem faixas aplicáveis. */
export function nivelDe(chave, valor) {
  return faixaDe(chave, valor)?.nivel ?? null
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
