import area from '@turf/area'
import booleanWithin from '@turf/boolean-within'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'

// O banco guarda sempre uma Feature GeoJSON completa em `geometria`, nunca uma
// geometry solta. Feature carrega properties, e o Leaflet e o Geoman trabalham
// nesse formato — normalizar na entrada evita conversao espalhada pelo codigo.
export function paraFeature(geoJson) {
  if (!geoJson) return null
  if (geoJson.type === 'Feature') return geoJson
  return { type: 'Feature', properties: {}, geometry: geoJson }
}

/**
 * L.geoJSON(feature).toGeoJSON() devolve uma FeatureCollection, mesmo tendo
 * recebido uma Feature só. Ao ler de volta uma geometria editada no mapa,
 * precisamos da Feature de dentro — é ela que o banco guarda.
 */
export function primeiraFeature(geoJson) {
  if (!geoJson) return null
  if (geoJson.type === 'FeatureCollection') return geoJson.features?.[0] ?? null
  return paraFeature(geoJson)
}

export function tipoDaGeometria(geoJson) {
  const f = paraFeature(geoJson)
  return f?.geometry?.type ?? null
}

export function ehPonto(geoJson) {
  return tipoDaGeometria(geoJson) === 'Point'
}

// Area em hectares, arredondada a 2 casas. Turf devolve metros quadrados
// sobre o elipsoide, entao nao precisamos projetar nada manualmente.
// Ponto e linha nao tem area: devolve null em vez de 0, para distinguir
// "nao se aplica" de "area zero".
export function areaEmHectares(geoJson) {
  const f = paraFeature(geoJson)
  if (!f) return null
  const t = f.geometry?.type
  if (t !== 'Polygon' && t !== 'MultiPolygon') return null
  const m2 = area(f)
  if (!Number.isFinite(m2)) return null
  return Math.round((m2 / 10000) * 100) / 100
}

/**
 * A gleba esta dentro do talhao?
 *
 * Devolve `null` quando nao da para decidir — talhao sem geometria, ou tipo
 * inesperado. Quem chama trata null como "nao verificado", nunca como falha:
 * a validacao avisa, mas jamais bloqueia o salvamento. GPS de campo erra, e o
 * produtor conhece a terra dele melhor que o desenho.
 */
export function glebaDentroDoTalhao(geoGleba, geoTalhao) {
  const gleba = paraFeature(geoGleba)
  const talhao = paraFeature(geoTalhao)
  if (!gleba || !talhao) return null

  const tipoTalhao = talhao.geometry?.type
  if (tipoTalhao !== 'Polygon' && tipoTalhao !== 'MultiPolygon') return null

  try {
    if (gleba.geometry?.type === 'Point') {
      return booleanPointInPolygon(gleba, talhao)
    }
    return booleanWithin(gleba, talhao)
  } catch {
    // Geometria degenerada (auto-intersecao, anel aberto) faz o turf lancar.
    // Nao e motivo para impedir o cadastro.
    return null
  }
}

// Feature de ponto a partir de lat/lng, usado no cadastro em lote e no
// clique de marcar centro da fazenda.
export function pontoFeature(lat, lng) {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [lng, lat] },
  }
}

// GeoJSON e [lng, lat]; Leaflet e [lat, lng]. Trocar na fronteira, uma vez,
// evita o bug classico de coordenada invertida espalhado pelo codigo.
export function latLngDoPonto(geoJson) {
  const f = paraFeature(geoJson)
  const c = f?.geometry?.coordinates
  if (!Array.isArray(c) || c.length < 2) return null
  return [c[1], c[0]]
}
