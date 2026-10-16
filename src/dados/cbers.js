import booleanIntersects from '@turf/boolean-intersects'

const COLECAO = 'CBERS4A_MUX_L4_DN'
const CATALOGO = `https://www.dgi.inpe.br/lgi-stac/collections/${COLECAO}/items`

function cenaValida(item) {
  const data = item?.properties?.datetime
  const bbox = item?.bbox
  const previa = item?.assets?.thumbnail?.href

  if (
    typeof data !== 'string' ||
    !Number.isFinite(Date.parse(data)) ||
    !Array.isArray(bbox) ||
    bbox.length !== 4 ||
    !bbox.every((valor) => Number.isFinite(Number(valor))) ||
    typeof previa !== 'string'
  ) {
    return null
  }

  const [oeste, sul, leste, norte] = bbox.map(Number)
  const geometria = item.geometry
  if (
    oeste >= leste ||
    sul >= norte ||
    !['Polygon', 'MultiPolygon'].includes(geometria?.type)
  ) {
    return null
  }

  let url
  try {
    url = new URL(previa)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== 'www.dgi.inpe.br') return null

  const coberturaNuvens = item.properties.cloud_cover
  const nuvens = coberturaNuvens == null ? NaN : Number(coberturaNuvens)
  return {
    id: item.id,
    data,
    nuvens: Number.isFinite(nuvens) && nuvens >= 0 && nuvens <= 100 ? nuvens : null,
    geometria,
    limites: [[sul, oeste], [norte, leste]],
    previa: url.href,
  }
}

function comoFeature(geoJson) {
  if (geoJson?.type === 'Feature') return geoJson
  if (geoJson?.type === 'Polygon' || geoJson?.type === 'MultiPolygon') {
    return { type: 'Feature', properties: {}, geometry: geoJson }
  }
  return null
}

async function consultarCenas(bbox, signal) {
  const parametros = new URLSearchParams({
    bbox: bbox.join(','),
    limit: '1000',
  })
  const resposta = await fetch(`${CATALOGO}?${parametros}`, { signal })

  if (!resposta.ok) {
    throw new Error(`O catálogo CBERS do INPE respondeu com erro (HTTP ${resposta.status}).`)
  }

  const dados = await resposta.json()
  if (!Array.isArray(dados?.features)) {
    throw new Error('O catálogo CBERS do INPE retornou uma resposta inválida.')
  }

  const cenas = dados.features.map(cenaValida).filter(Boolean)
  const encontradas = Number(dados.context?.matched)
  if (Number.isFinite(encontradas) && encontradas > dados.features.length) {
    throw new Error(
      `O catálogo encontrou ${encontradas} cenas; a consulta retornou apenas ${dados.features.length}. Reduza a área para ver todas as datas.`,
    )
  }

  return cenas
}

function coordenadasDaGeometria(geometria) {
  if (!geometria || !['Polygon', 'MultiPolygon'].includes(geometria.type)) return []

  const coordenadas = geometria.coordinates
  const pontos = []
  const visitar = (valor) => {
    if (!Array.isArray(valor)) return
    if (
      valor.length >= 2 &&
      Number.isFinite(valor[0]) &&
      Number.isFinite(valor[1])
    ) {
      pontos.push([valor[0], valor[1]])
      return
    }
    valor.forEach(visitar)
  }
  visitar(coordenadas)
  return pontos
}

export function bboxDaGeometria(geoJson) {
  const geometria = geoJson?.type === 'Feature' ? geoJson.geometry : geoJson
  const pontos = coordenadasDaGeometria(geometria)
  if (pontos.length === 0) return null

  const longitudes = pontos.map(([lng]) => lng)
  const latitudes = pontos.map(([, lat]) => lat)
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ]
}

/** Lista cenas que cruzam a área delimitada, com metadados e prévias do INPE. */
export async function listarCenasCbers(bbox, geometriaTalhao, signal) {
  if (
    !Array.isArray(bbox) ||
    bbox.length !== 4 ||
    !bbox.every(Number.isFinite) ||
    bbox[0] >= bbox[2] ||
    bbox[1] >= bbox[3]
  ) {
    throw new Error('Área inválida para consultar cenas CBERS.')
  }

  const talhao = comoFeature(geometriaTalhao)
  if (!talhao || !['Polygon', 'MultiPolygon'].includes(talhao.geometry?.type)) {
    throw new Error('Selecione um talhão com geometria de área para consultar cenas CBERS.')
  }

  const cenas = await consultarCenas(bbox, signal)
  const cenasDoTalhao = cenas.filter((cena) =>
    booleanIntersects(talhao, comoFeature(cena.geometria)),
  )
  return cenasDoTalhao.sort((a, b) => Date.parse(a.data) - Date.parse(b.data))
}
