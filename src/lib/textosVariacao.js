import { formatarValor } from './parametros.js'
import { LADO } from './estadosVariacao.js'

/**
 * Como a variação vira palavra: sinal, porcentagem e o nome da ausência.
 *
 * Mora fora de `lib/variacao.js` porque é apresentação, não cálculo — e
 * porque os dois consumidores são de camadas diferentes: o tooltip do mapa,
 * que escreve HTML, e a tabela, que escreve JSX. Deixar a regra do sinal num
 * dos dois faria o outro copiá-la.
 */

/**
 * O menos tipográfico (−), não o hífen do teclado.
 *
 * Numa coluna de números alinhados o hífen quase some, e "-0,30" lido como
 * "0,30" inverte o sentido da leitura. O mesmo sinal já é usado em
 * `lib/comparacao.js`, na tabela da tela de gleba.
 */
function sinalDe(numero) {
  if (numero > 0) return '+'
  if (numero < 0) return '−'
  return ''
}

/** Diferença absoluta com sinal, nas casas decimais do parâmetro. */
export function textoDelta(linha, chave) {
  if (linha.delta === null) return null
  return `${sinalDe(linha.delta)}${formatarValor(chave, Math.abs(linha.delta))}`
}

/**
 * Variação percentual com sinal, ou `null`.
 *
 * `null` cobre dois casos que a tela precisa distinguir: não há comparação
 * (falta um dos anos), ou o Ano A era zero e a porcentagem não existe —
 * `tipoDiferenca === 'absoluta'`. Quem exibe olha o `tipoDiferenca` para saber
 * qual dos dois é.
 */
export function textoPercentual(linha) {
  if (linha.percentual === null) return null
  const valor = Math.abs(linha.percentual).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${sinalDe(linha.percentual)}${valor}%`
}

/**
 * Por que falta o valor daquele lado, por extenso.
 *
 * Os dois motivos são de donos diferentes: não amostrada é problema de coleta,
 * não medida é problema de contrato com o laboratório. Achatar em "sem dado"
 * esconderia de quem é a pendência — mesma razão da Fase 4.
 */
export function textoDaAusencia(estadoDoLado) {
  if (estadoDoLado === LADO.SEM_ANALISE) return 'não amostrada'
  if (estadoDoLado === LADO.SEM_MEDICAO) return 'não medida'
  return null
}
