/**
 * Posição das cenas de satélite numa barra de tempo.
 *
 * A barra anterior andava de cena em cena (1 de 12, 2 de 12...), como se as
 * datas fossem igualmente espaçadas. Não são: duas cenas podem estar a 5 dias
 * uma da outra e a próxima a 80. Aqui a posição é o tempo de verdade, em dias
 * desde a primeira cena, e quem mexe na barra vê o intervalo real.
 *
 * Puro e sem React de propósito, para testar a conta fora do navegador.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Dias de cada cena desde a primeira. As cenas já chegam em ordem de data. */
export function diasDasCenas(cenas) {
  if (cenas.length === 0) return []
  const base = Date.parse(cenas[0].data)
  return cenas.map((cena) => (Date.parse(cena.data) - base) / MS_POR_DIA)
}

/**
 * Onde cada cena fica na barra, de 0 a 1. Com uma cena só (ou várias no mesmo
 * instante) não há intervalo para repartir: todas ficam no meio.
 */
export function posicoesNaBarra(dias) {
  const total = dias.length > 0 ? dias[dias.length - 1] : 0
  return dias.map((d) => (total > 0 ? d / total : 0.5))
}

/**
 * A cena mais perto de um ponto da barra (em dias). Num empate de distância
 * vale a mais antiga, para a escolha ser estável quando o ponteiro está
 * exatamente entre duas.
 */
export function indiceMaisProximo(dias, valor) {
  if (dias.length === 0 || !Number.isFinite(valor)) return -1
  let melhor = 0
  let menor = Math.abs(dias[0] - valor)
  for (let i = 1; i < dias.length; i++) {
    const d = Math.abs(dias[i] - valor)
    if (d < menor) {
      menor = d
      melhor = i
    }
  }
  return melhor
}

/** Dias inteiros entre duas cenas vizinhas, para "12 dias depois da anterior". */
export function diasDesdeAAnterior(dias, indice) {
  if (indice <= 0 || indice >= dias.length) return null
  return Math.round(dias[indice] - dias[indice - 1])
}

/** Faixa de nuvem de uma cena: decide a cor da marca na barra. */
export function faixaDeNuvem(nuvens) {
  if (nuvens == null || !Number.isFinite(nuvens)) return 'desconhecida'
  if (nuvens <= 20) return 'pouca'
  if (nuvens <= 60) return 'media'
  return 'muita'
}
