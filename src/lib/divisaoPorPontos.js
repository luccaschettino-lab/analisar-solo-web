import bbox from '@turf/bbox'
import intersect from '@turf/intersect'
import union from '@turf/union'
import voronoi from '@turf/voronoi'
import { featureCollection, point } from '@turf/helpers'
import { paraFeature, areaEmHectares } from './geo.js'

/**
 * Divide um talhão entre grupos de pontos, de modo que a soma das partes seja
 * o talhão inteiro — sem vão e sem sobreposição.
 *
 * Cada ponto fica com a área do talhão que está mais perto dele do que de
 * qualquer outro ponto (célula de Voronoi, cortada pela divisa). A área de um
 * grupo é a união das células dos seus pontos. O contorno de um grupo que se
 * espalha entre pontos de outros grupos pode sair em mais de um pedaço
 * (MultiPolygon): é o preço de cobrir tudo sem deixar buraco.
 *
 * `pontos`: [{ chave, lng, lat }]. A chave identifica o grupo (vários pontos
 * podem repetir a mesma). Devolve `Map(chave → { geometria, areaHa, pedacos })`,
 * ou `null` se o talhão não tem polígono utilizável. Uma chave pode faltar no
 * resultado (ponto sobre outro ponto, ou célula fora da divisa): quem chama
 * decide o que fazer com ela.
 */
export function dividirTalhaoPorPontos(geometriaTalhao, pontos) {
  const talhao = paraFeature(geometriaTalhao)
  const tipo = talhao?.geometry?.type
  if (tipo !== 'Polygon' && tipo !== 'MultiPolygon') return null
  if (pontos.length === 0) return new Map()

  // Dois pontos na mesma posição dariam uma célula vazia para o segundo: o
  // primeiro fica com o lugar.
  const unicos = [...new Map(pontos.map((p) => [`${p.lng},${p.lat}`, p])).values()]

  const celulasPorChave = new Map()
  const guardar = (chave, feature) => {
    if (!feature) return
    if (!celulasPorChave.has(chave)) celulasPorChave.set(chave, [])
    celulasPorChave.get(chave).push(feature)
  }

  if (unicos.length === 1) {
    guardar(unicos[0].chave, talhao)
  } else {
    const [minX, minY, maxX, maxY] = bbox(talhao)
    const folga = Math.max(maxX - minX, maxY - minY) * 0.1 || 0.001
    const celulas = voronoi(
      featureCollection(unicos.map((p) => point([p.lng, p.lat]))),
      { bbox: [minX - folga, minY - folga, maxX + folga, maxY + folga] },
    )
    // Uma célula por ponto, na ordem de entrada.
    celulas.features.forEach((celula, i) => {
      if (!celula) return
      try {
        guardar(unicos[i].chave, intersect(featureCollection([celula, talhao])))
      } catch {
        // Topologia degenerada numa célula: ela some, e o grupo cobre o que sobrar.
      }
    })
  }

  const resultado = new Map()
  for (const [chave, partes] of celulasPorChave) {
    let geometria = partes[0]
    if (partes.length > 1) {
      try {
        geometria = union(featureCollection(partes))
      } catch {
        continue
      }
    }
    if (!geometria) continue
    const feature = { type: 'Feature', properties: {}, geometry: geometria.geometry }
    resultado.set(chave, {
      geometria: feature,
      areaHa: areaEmHectares(feature),
      pedacos: feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates.length : 1,
    })
  }
  return resultado
}
