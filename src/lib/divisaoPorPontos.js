import bbox from '@turf/bbox'
import intersect from '@turf/intersect'
import union from '@turf/union'
import voronoi from '@turf/voronoi'
import { featureCollection, point } from '@turf/helpers'
import area from '@turf/area'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
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

// Distância (m) de um ponto a um polígono (zero se está dentro), numa
// projeção plana local — para centenas de metros o erro é desprezível.
function distanciaAoPoligonoM(lng, lat, aneis) {
  if (booleanPointInPolygon([lng, lat], { type: 'Polygon', coordinates: aneis })) return 0
  const kLat = 111320
  const kLng = 111320 * Math.cos((lat * Math.PI) / 180)
  let menor = Infinity
  for (const anel of aneis) {
    for (let i = 0; i < anel.length - 1; i++) {
      const ax = (anel[i][0] - lng) * kLng
      const ay = (anel[i][1] - lat) * kLat
      const dx = (anel[i + 1][0] - anel[i][0]) * kLng
      const dy = (anel[i + 1][1] - anel[i][1]) * kLat
      const comp = dx * dx + dy * dy
      const t = comp === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / comp))
      menor = Math.min(menor, Math.hypot(ax + t * dx, ay + t * dy))
    }
  }
  return menor
}

/** Células de Voronoi dos pontos, recortadas por UMA parte do talhão. */
function dividirParte(parte, pontos, guardar) {
  if (pontos.length === 1) {
    guardar(pontos[0].chave, parte)
    return
  }
  const [minX, minY, maxX, maxY] = bbox(parte)
  const folga = Math.max(maxX - minX, maxY - minY) * 0.1 || 0.001
  const caixa = [
    Math.min(minX, ...pontos.map((p) => p.lng)) - folga,
    Math.min(minY, ...pontos.map((p) => p.lat)) - folga,
    Math.max(maxX, ...pontos.map((p) => p.lng)) + folga,
    Math.max(maxY, ...pontos.map((p) => p.lat)) + folga,
  ]
  const celulas = voronoi(featureCollection(pontos.map((p) => point([p.lng, p.lat]))), { bbox: caixa })
  // Uma célula por ponto, na ordem de entrada.
  celulas.features.forEach((celula, i) => {
    if (!celula) return
    try {
      guardar(pontos[i].chave, intersect(featureCollection([celula, parte])))
    } catch {
      // Topologia degenerada numa célula: ela some, e o grupo cobre o que sobrar.
    }
  })
}

/**
 * Divide um talhão entre grupos de pontos, de modo que a soma das partes seja
 * o talhão inteiro — sem vão e sem sobreposição.
 *
 * **Cada parte do talhão é dividida à parte** (2026-11-19). Talhão desenhado
 * em várias partes (MultiPolygon) tem os campos separados pelos carreadores, e
 * a divisão não pode atravessar a estrada: antes, a gleba 10-17 descia em
 * zigue-zague para o campo vizinho, porque o ponto mais próximo ficava do
 * outro lado. Agora:
 *   - cada ponto pertence à parte que o contém (ponto caído fora de todas, na
 *     estrada, vai para a parte mais próxima);
 *   - parte com pontos: cada pedaço dela fica com o grupo do ponto mais perto
 *     (célula de Voronoi, cortada pela parte) — parte de um grupo só fica
 *     inteira com ele, com a borda na estrada;
 *   - parte sem nenhum ponto: vai inteira para o grupo do ponto mais próximo,
 *     para o talhão continuar todo coberto.
 * Talhão de uma parte só se comporta como antes.
 *
 * A área de um grupo é a união dos seus pedaços. O que espalha entre pontos
 * de outros grupos pode sair em mais de um pedaço (MultiPolygon).
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

  const aneisDasPartes = tipo === 'Polygon' ? [talhao.geometry.coordinates] : talhao.geometry.coordinates
  const partes = aneisDasPartes.map((aneis) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: aneis } }))

  // Cada ponto vai para a parte que o contém, ou para a mais próxima.
  const pontosDaParte = partes.map(() => [])
  for (const p of unicos) {
    let melhor = 0
    let menor = Infinity
    aneisDasPartes.forEach((aneis, i) => {
      const d = distanciaAoPoligonoM(p.lng, p.lat, aneis)
      if (d < menor) {
        menor = d
        melhor = i
      }
    })
    pontosDaParte[melhor].push(p)
  }

  partes.forEach((parte, i) => {
    if (pontosDaParte[i].length > 0) {
      dividirParte(parte, pontosDaParte[i], guardar)
      return
    }
    // Parte sem ponto (faixa entre estradas): inteira para o ponto mais perto.
    let chave = unicos[0].chave
    let menor = Infinity
    for (const p of unicos) {
      const d = distanciaAoPoligonoM(p.lng, p.lat, aneisDasPartes[i])
      if (d < menor) {
        menor = d
        chave = p.chave
      }
    }
    guardar(chave, parte)
  })

  const resultado = new Map()
  for (const [chave, partes] of celulasPorChave) {
    const unida = unirPartes(partes)
    if (unida) resultado.set(chave, unida)
  }
  return resultado
}

/**
 * Une pedaços de uma mesma gleba numa geometria só: as células de Voronoi
 * dentro de um talhão, ou as partes de uma gleba que atravessa a divisa entre
 * talhões (cada talhão dividido à parte). Pedaços vizinhos viram um polígono;
 * os que não se tocam ficam num MultiPolygon. Devolve
 * `{ geometria, areaHa, pedacos }`, ou `null` se a união falhar.
 */
export function unirPartes(partes) {
  const validas = partes.filter(Boolean)
  if (validas.length === 0) return null
  let geometria = validas[0]
  if (validas.length > 1) {
    try {
      geometria = union(featureCollection(validas))
    } catch {
      return null
    }
  }
  if (!geometria) return null
  const feature = descartarPedacosMinusculos({ type: 'Feature', properties: {}, geometry: geometria.geometry })
  return {
    geometria: feature,
    areaHa: areaEmHectares(feature),
    pedacos: feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates.length : 1,
  }
}
