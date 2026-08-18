import { NIVEIS } from '../config/parametros.js'

/**
 * Ordenação das linhas da tabela de variação.
 *
 * Isolado do cálculo por ser a única parte que depende de uma decisão de
 * interface — qual coluna o usuário clicou. Nada aqui sabe como a variação foi
 * calculada; só lê os campos prontos de cada linha.
 */

export const COLUNAS = {
  GLEBA: 'gleba',
  VALOR_A: 'valorA',
  VALOR_B: 'valorB',
  DELTA: 'delta',
  PERCENTUAL: 'percentual',
  CLASSIFICACAO: 'classificacao',
  /** Não é coluna da tabela: é a ordem padrão, por |delta|. */
  MODULO: 'modulo',
}

// Ordem de riqueza dos níveis, do mais pobre ao mais rico, como declarada no
// config. Ordena a coluna de classificação por significado e não pelo
// alfabeto — "Bom" antes de "Muito baixo" seria leitura errada.
const ORDEM_NIVEL = Object.fromEntries(Object.keys(NIVEIS).map((nivel, i) => [nivel, i]))

/**
 * Valor de ordenação de uma linha. `null` significa "não ordenável por esta
 * coluna" — e linha assim afunda, sempre.
 */
function chaveDeOrdenacao(linha, coluna) {
  switch (coluna) {
    case COLUNAS.GLEBA:
      return linha.gleba.codigo ?? ''
    case COLUNAS.VALOR_A:
      return linha.a.valor
    case COLUNAS.VALOR_B:
      return linha.b.valor
    case COLUNAS.DELTA:
      return linha.delta
    case COLUNAS.PERCENTUAL:
      return linha.percentual
    case COLUNAS.MODULO:
      return linha.delta === null ? null : Math.abs(linha.delta)
    case COLUNAS.CLASSIFICACAO:
      return linha.nivelB === null ? null : ORDEM_NIVEL[linha.nivelB]
    default:
      return null
  }
}

/**
 * Ordena sem mutar a lista recebida.
 *
 * **Linha sem valor na coluna afunda nas duas direções.** Ausência não é o
 * menor valor nem o maior: ordenar "sem dado" junto com os números faria a
 * pergunta "quem menos variou?" ser respondida por uma gleba que não variou
 * coisa nenhuma — ela não foi medida. O empate cai no código da gleba, para a
 * ordem ser estável entre renders.
 */
export function ordenarLinhas(linhas, coluna, direcao = 'desc') {
  const sinal = direcao === 'asc' ? 1 : -1

  return [...linhas].sort((x, y) => {
    const a = chaveDeOrdenacao(x, coluna)
    const b = chaveDeOrdenacao(y, coluna)

    if (a === null && b === null) return compararCodigos(x, y)
    if (a === null) return 1
    if (b === null) return -1

    const comparacao =
      typeof a === 'string'
        ? a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
        : a - b

    return comparacao === 0 ? compararCodigos(x, y) : comparacao * sinal
  })
}

function compararCodigos(x, y) {
  return String(x.gleba.codigo ?? '').localeCompare(String(y.gleba.codigo ?? ''), 'pt-BR', {
    numeric: true,
  })
}
