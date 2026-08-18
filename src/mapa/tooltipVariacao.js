import { escapar } from './tooltipGleba.js'
import { rotuloComUnidade, parametro, formatarValor } from '../lib/parametros.js'
import { VARIACAO } from '../lib/variacao.js'
import { textoDelta, textoPercentual, textoDaAusencia } from '../lib/textosVariacao.js'

/**
 * Tooltip do mapa divergente.
 *
 * Mostra os dois anos lado a lado e a variação entre eles. O tooltip da Fase 4
 * não serve aqui: ele fala de um valor e de sua classificação, e a pergunta
 * desta tela é outra — o que mudou, e de quanto para quanto.
 *
 * **Ausência aparece nomeada, com o ano e o motivo.** "sem dado" sozinho
 * deixaria quem olha sem saber qual laudo procurar. O ano vem escrito na
 * própria linha, para o tooltip continuar legível fora do contexto da legenda.
 */

function identificacao(gleba) {
  return gleba.nome ? `${gleba.codigo} · ${gleba.nome}` : gleba.codigo
}

/** Uma linha "ano: valor" ou "ano: sem dado (motivo)". */
function linhaDoAno(ano, lado, unidade) {
  const rotulo = escapar(ano)

  if (lado.formatado === null) {
    const motivo = textoDaAusencia(lado.estado)
    return `<span class="text-slate-500">${rotulo}: sem dado${motivo ? ` (${motivo})` : ''}</span>`
  }

  const valor = `${escapar(lado.formatado)}${unidade ? ` ${escapar(unidade)}` : ''}`
  return `${rotulo}: <span class="font-medium">${valor}</span>`
}

/**
 * Devolve `(gleba, info) => html`, no formato que `useGeometrias` espera.
 *
 * É uma fábrica porque o texto precisa dos rótulos dos dois anos, que vivem na
 * comparação e não na linha de cada gleba — repeti-los em toda linha seria
 * carregar a mesma string dezenas de vezes.
 */
export function criarTooltipVariacao(comparacao) {
  if (!comparacao) return null

  const { anoA, anoB, chaveParametro, limiar } = comparacao
  const unidade = parametro(chaveParametro)?.unidade ?? ''
  const nome = escapar(rotuloComUnidade(chaveParametro))

  return (gleba, info) => {
    const titulo = `<span class="font-semibold">${escapar(identificacao(gleba))}</span>`
    const linha = info?.linha
    if (!linha) return titulo

    const cabecalho = `${titulo}<br><span class="text-slate-500">${nome}</span>`

    if (linha.estado === VARIACAO.SEM_OS_DOIS) {
      return `${cabecalho}<br><span class="text-slate-500">sem dado em ${escapar(anoA)} nem em ${escapar(anoB)}</span>`
    }

    const anos = `${linhaDoAno(anoA, linha.a, unidade)}<br>${linhaDoAno(anoB, linha.b, unidade)}`

    // Falta um dos anos: mostra o que existe e diz, sem rodeio, que não há
    // variação a calcular. Nunca "0" e nunca "estável".
    if (linha.estado === VARIACAO.SEM_UM_ANO) {
      return `${cabecalho}<br>${anos}<br><span class="text-slate-500">sem variação a calcular</span>`
    }

    const delta = escapar(textoDelta(linha, chaveParametro))
    const percentual = textoPercentual(linha)
    // Ano A igual a zero: a porcentagem não existe, e dizer isso é melhor que
    // omitir a linha e deixar parecer que a conta falhou.
    const relativo = percentual
      ? ` (${escapar(percentual)})`
      : linha.tipoDiferenca === 'absoluta'
        ? ' <span class="text-slate-400">(sem % — partiu de zero)</span>'
        : ''

    const variacao = `<span class="font-medium">${delta}${unidade ? ` ${escapar(unidade)}` : ''}</span>${relativo}`

    if (linha.estado === VARIACAO.ESTAVEL) {
      // Magnitude sem sinal: o limiar é uma distância, não uma direção.
      const abaixoDe = limiar > 0 ? ` (variou menos de ${escapar(formatarValor(chaveParametro, limiar))})` : ''
      return `${cabecalho}<br>${anos}<br>${variacao}<br><span class="text-slate-500">estável${abaixoDe}</span>`
    }

    const sentido = linha.estado === VARIACAO.ALTA ? 'alta significativa' : 'queda significativa'
    return `${cabecalho}<br>${anos}<br>${variacao}<br><span class="font-medium">${sentido}</span>`
  }
}
