import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { paraFeature } from './geo.js'

/**
 * Glebas que ficam sem amostra no filtro do mapa, dentro de talhões que TÊM
 * amostra.
 *
 * O mapa de calor estima o talhão inteiro a partir das amostras (IDW). Numa
 * gleba sem amostra própria, a cor viria toda emprestada das vizinhas — no
 * talhão 12, 2 análises pintavam 356 ha embaixo de 14 glebas sem laudo. Essas
 * glebas passam a ser hachuradas por cima do calor, como o talhão sem dado.
 *
 * Uma gleba tem amostra quando a posição de alguma análise do talhão (no
 * filtro: safra, profundidade e parâmetro medido) cai dentro do polígono dela.
 * A análise importada fica na média dos pontos de coleta da gleba, que está
 * dentro dela; lançada à mão, fica onde a pessoa marcou.
 *
 * Gleba sem polígono (só um ponto) não entra: não há área para hachurar.
 *
 * @param {Array<{id, talhao_id, geometria}>} glebas
 * @param {Map<string, Array<{lat:number, lng:number}>>} amostrasPorTalhao
 *   só os talhões coloridos no filtro (com pelo menos uma amostra)
 * @returns {Array<{id, talhao_id, geometria}>}
 */
export function glebasSemAmostra(glebas, amostrasPorTalhao) {
  const resultado = []
  for (const gleba of glebas) {
    const amostras = amostrasPorTalhao.get(gleba.talhao_id)
    if (!amostras?.length) continue
    const feature = paraFeature(gleba.geometria)
    const tipo = feature?.geometry?.type
    if (tipo !== 'Polygon' && tipo !== 'MultiPolygon') continue
    const temAmostra = amostras.some(
      (a) => a.lat != null && a.lng != null && booleanPointInPolygon([a.lng, a.lat], feature),
    )
    if (!temAmostra) resultado.push(gleba)
  }
  return resultado
}
