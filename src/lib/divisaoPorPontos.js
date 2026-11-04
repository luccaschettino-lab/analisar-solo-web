import bbox from '@turf/bbox'
import intersect from '@turf/intersect'
import union from '@turf/union'
import voronoi from '@turf/voronoi'
import { featureCollection, point } from '@turf/helpers'
import area from '@turf/area'
import { paraFeature, areaEmHectares } from './geo.js'

// Pedaços menores que isto (m²) são resto do recorte, não terra: a divisa do
// talhão tem estreitamentos, e a união das células deixa fiapos de 1 a 40 m²
// ligados a uma gleba. Eles não servem para nada e atrapalham a edição: ficam
// com alças amontoadas, impossíveis de pegar. O menor pedaço real que
// apareceu tinha 1.900 m², então 100 m² separa um do outro com folga.
export const AREA_MINIMA_DO_PEDACO_M2 = 100

/**
 * Tira de uma geometria os pedaços de área desprezível. Sempre fica com algo:
 * se todos forem pequenos, mantém o maior. Devolve a mesma Feature (ou uma
 * nova, sem os fiapos); um MultiPolygon que sobra com um pedaço só vira Polygon.
 */
export function descartarPedacosMinusculos(feature, minimoM2 = AREA_MINIMA_DO_PEDACO_M2) {
  const g = feature?.geometry
  if (g?.type !== 'MultiPolygon') return feature

  const medidos = g.coordinates.map((coordenadas) => ({
    coordenadas,
    m2: area({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: coordenadas } }),
  }))
  let mantidos = medidos.filter((p) => p.m2 >= minimoM2)
  if (mantidos.length === 0) mantidos = [medidos.reduce((a, b) => (b.m2 > a.m2 ? b : a))]
  if (mantidos.length === medidos.length) return feature

  const coordenadas = mantidos.map((p) => p.coordenadas)
  return {
    ...feature,
    geometry:
      coordenadas.length === 1
        ? { type: 'Polygon', coordinates: coordenadas[0] }
        : { type: 'MultiPolygon', coordinates: coordenadas },
  }
}

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
    const feature = descartarPedacosMinusculos({ type: 'Feature', properties: {}, geometry: geometria.geometry })
    resultado.set(chave, {
      geometria: feature,
      areaHa: areaEmHectares(feature),
      pedacos: feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates.length : 1,
    })
  }
  return resultado
}
