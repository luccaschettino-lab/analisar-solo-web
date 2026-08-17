/**
 * Diferença entre o valor de uma safra e o da safra comparada.
 *
 * Três resultados possíveis, e a distinção importa:
 *
 *  - `null`        — não dá para comparar, porque falta medição de um dos
 *                    lados. Nunca tratar como "sem mudança".
 *  - `relativa`    — variação percentual, o caso normal.
 *  - `absoluta`    — quando a base é zero. Dividir por zero daria infinito, e
 *                    "aumentou ∞%" não informa nada. Aí mostramos quanto
 *                    variou em valor, não em percentual.
 */

export function calcularDiferenca(atual, anterior) {
  const a = paraNumero(atual)
  const b = paraNumero(anterior)
  if (a === null || b === null) return null

  const delta = a - b

  if (b === 0) {
    return { tipo: 'absoluta', delta, percentual: null, sentido: sentidoDe(delta) }
  }

  const percentual = (delta / Math.abs(b)) * 100
  return { tipo: 'relativa', delta, percentual, sentido: sentidoDe(delta) }
}

function paraNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

function sentidoDe(delta) {
  if (delta > 0) return 'subiu'
  if (delta < 0) return 'desceu'
  return 'igual'
}

/**
 * Texto curto da diferença, para caber numa célula de tabela.
 *
 * Sem julgamento de "bom" ou "ruim": subir alumínio é péssimo e subir cálcio é
 * ótimo, e para pH existe um ponto ideal no meio — nem sempre mais é melhor.
 * A interpretação fica nas faixas de `config/parametros.js`; aqui é só o fato.
 */
export function textoDaDiferenca(diferenca, casas = 1) {
  if (!diferenca) return null

  const sinal = diferenca.delta > 0 ? '+' : diferenca.delta < 0 ? '−' : ''

  if (diferenca.tipo === 'absoluta') {
    const valor = Math.abs(diferenca.delta).toLocaleString('pt-BR', {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    })
    return `${sinal}${valor}`
  }

  const valor = Math.abs(diferenca.percentual).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${sinal}${valor}%`
}
