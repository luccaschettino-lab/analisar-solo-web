import { CHAVES_PARAMETROS } from '../config/parametros.js'
import { temMedicao } from './parametros.js'

/**
 * Transforma as análises de uma gleba em séries por parâmetro.
 *
 * Fica fora do componente para poder ser testado: o posicionamento dos `null`
 * é a regra que sustenta os gráficos, e um erro aqui vira uma linha reta
 * atravessando um ano sem medição — uma afirmação falsa sobre a terra.
 *
 * Devolve um Map: chave do parâmetro → { series: [{ profundidade, porAno }] }.
 * Parâmetro sem nenhuma medição não entra.
 */
export function montarSeriesPorParametro(analises, camadas) {
  const mapa = new Map()

  for (const chave of CHAVES_PARAMETROS) {
    const series = camadas
      .map((profundidade) => {
        const porAno = new Map()
        for (const a of analises) {
          if (a.profundidade !== profundidade) continue
          if (temMedicao(a[chave])) porAno.set(a.ano_safra, Number(a[chave]))
        }
        return { profundidade, porAno }
      })
      // Profundidade sem nenhuma medição deste parâmetro não vira série vazia
      // ocupando espaço na legenda.
      .filter((s) => s.porAno.size > 0)

    if (series.length > 0) mapa.set(chave, { series })
  }

  return mapa
}

/**
 * Array alinhado com o eixo X.
 *
 * Um item por safra, na ordem de `anos`. Safra sem medição vira `null` na
 * posição — nunca é omitida. Encurtar o array deslocaria todos os pontos
 * seguintes para a esquerda, e o gráfico mostraria valores no ano errado.
 */
export function valoresAlinhados(porAno, anos) {
  return anos.map((ano) => (porAno.has(ano) ? porAno.get(ano) : null))
}
