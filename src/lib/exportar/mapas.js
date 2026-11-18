import { PARAMETROS } from '../../config/parametros.js'
import { paraFeature, ehPonto } from '../geo.js'

/**
 * Mapas da exportação: as camadas (talhões, glebas com a última análise e
 * pontos de amostra) como GeoJSON, KML (Google Earth) e Shapefile (QGIS,
 * softwares de agricultura de precisão).
 */

const esc = (s) => String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])

/** Polygon/MultiPolygon → MultiPolygon (o shp-write perde feições se misturar). */
function comoMulti(geometry) {
  if (!geometry) return null
  if (geometry.type === 'MultiPolygon') return geometry
  if (geometry.type === 'Polygon') return { type: 'MultiPolygon', coordinates: [geometry.coordinates] }
  return null
}

const geometriaDe = (geo) => paraFeature(geo)?.geometry ?? null

/** As três camadas como FeatureCollections, com atributos em nomes curtos (≤10, limite do .dbf). */
export function camadasGeo(dados) {
  const talhaoPorId = new Map(dados.talhoes.map((t) => [t.id, t]))

  const talhoes = {
    type: 'FeatureCollection',
    features: dados.talhoes
      .map((t) => {
        const linha = dados.linhasTalhoes.find((l) => l.talhao === t.codigo)
        const geometry = geometriaDe(t.geometria)
        if (!geometry || ehPonto(geometry)) return null
        return {
          type: 'Feature',
          geometry,
          properties: { talhao: t.codigo, nome: t.nome ?? '', area_ha: round(linha?.areaHa, 2), glebas: linha?.glebas ?? 0, analises: linha?.analises ?? 0 },
        }
      })
      .filter(Boolean),
  }

  // Gleba: a análise mais recente da camada mais rasa entra como atributos.
  const glebas = {
    type: 'FeatureCollection',
    features: dados.glebas
      .map((g) => {
        const geometry = geometriaDe(g.geometria)
        if (!geometry || ehPonto(geometry)) return null
        const linhas = dados.linhasGlebas.filter((l) => l.gleba === g.codigo && l.talhao === talhaoPorId.get(g.talhao_id)?.codigo && l.analise)
        const ultima = linhas.sort((a, b) => String(b.safra).localeCompare(String(a.safra)) || String(a.profundidade).localeCompare(String(b.profundidade), 'pt-BR', { numeric: true }))[0]
        const props = {
          talhao: talhaoPorId.get(g.talhao_id)?.codigo ?? '',
          gleba: g.codigo,
          area_ha: round(linhas[0]?.areaHa ?? dados.linhasGlebas.find((l) => l.gleba === g.codigo)?.areaHa, 2),
          safra: ultima?.safra ?? '',
          prof_cm: ultima?.profundidade ?? '',
        }
        for (const p of PARAMETROS) {
          const v = ultima?.analise?.[p.chave]
          props[p.chave.slice(0, 10)] = v == null ? null : Number(v)
        }
        return { type: 'Feature', geometry, properties: props }
      })
      .filter(Boolean),
  }

  const pontos = {
    type: 'FeatureCollection',
    features: dados.linhasPontos
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { talhao: p.talhao, gleba: p.gleba, amostra: p.amostra } })),
  }

  return { talhoes, glebas, pontos }
}

function round(v, casas) {
  if (v == null || !Number.isFinite(Number(v))) return null
  const f = 10 ** casas
  return Math.round(Number(v) * f) / f
}

// ---------------- KML ----------------

const kmlCor = (hex, alfa = 'ff') => {
  const h = hex.replace('#', '')
  return `${alfa}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}` // aabbggrr
}

function coordsAnel(anel) {
  return anel.map(([x, y]) => `${x},${y},0`).join(' ')
}

function kmlPoligono(geometry) {
  const polis = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const partes = polis.map(
    (p) =>
      `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordsAnel(p[0])}</coordinates></LinearRing></outerBoundaryIs>${p
        .slice(1)
        .map((h) => `<innerBoundaryIs><LinearRing><coordinates>${coordsAnel(h)}</coordinates></LinearRing></innerBoundaryIs>`)
        .join('')}</Polygon>`,
  )
  return partes.length === 1 ? partes[0] : `<MultiGeometry>${partes.join('')}</MultiGeometry>`
}

function kmlDados(props) {
  return `<ExtendedData>${Object.entries(props)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<Data name="${esc(k)}"><value>${esc(v)}</value></Data>`)
    .join('')}</ExtendedData>`
}

/** Um KML com uma pasta por camada (talhões, glebas, pontos). */
export function gerarKml(camadas, { nomeFazenda, camadasIncluidas = ['talhoes', 'glebas', 'pontos'] } = {}) {
  const pastas = []
  if (camadasIncluidas.includes('talhoes')) {
    pastas.push(
      `<Folder><name>Talhões</name>${camadas.talhoes.features
        .map((f) => `<Placemark><name>Talhão ${esc(f.properties.talhao)}</name><styleUrl>#talhao</styleUrl>${kmlDados(f.properties)}${kmlPoligono(f.geometry)}</Placemark>`)
        .join('')}</Folder>`,
    )
  }
  if (camadasIncluidas.includes('glebas')) {
    pastas.push(
      `<Folder><name>Glebas</name>${camadas.glebas.features
        .map((f) => `<Placemark><name>${esc(f.properties.talhao)} · ${esc(f.properties.gleba)}</name><styleUrl>#gleba</styleUrl>${kmlDados(f.properties)}${kmlPoligono(f.geometry)}</Placemark>`)
        .join('')}</Folder>`,
    )
  }
  if (camadasIncluidas.includes('pontos')) {
    pastas.push(
      `<Folder><name>Pontos de amostra</name>${camadas.pontos.features
        .map(
          (f) =>
            `<Placemark><name>${esc(f.properties.amostra)}</name><styleUrl>#ponto</styleUrl>${kmlDados(f.properties)}<Point><coordinates>${f.geometry.coordinates[0]},${f.geometry.coordinates[1]},0</coordinates></Point></Placemark>`,
        )
        .join('')}</Folder>`,
    )
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(nomeFazenda)} — Moinho</name>
<Style id="talhao"><LineStyle><color>${kmlCor('#ffffff')}</color><width>2.5</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>
<Style id="gleba"><LineStyle><color>${kmlCor('#facc15')}</color><width>1.5</width></LineStyle><PolyStyle><color>${kmlCor('#1f72ab', '33')}</color></PolyStyle></Style>
<Style id="ponto"><IconStyle><scale>0.6</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0.6</scale></LabelStyle></Style>
${pastas.join('\n')}
</Document></kml>`
}

// ---------------- Shapefile ----------------

/**
 * Arquivos .shp/.shx/.dbf/.prj de cada camada, prontos para entrar no ZIP.
 * `shpwrite` é o módulo @mapbox/shp-write (carregado só na hora).
 */
export async function gerarShapefiles(camadas, shpwrite, camadasIncluidas = ['talhoes', 'glebas', 'pontos']) {
  const arquivos = {}
  const nomes = { talhoes: 'talhoes', glebas: 'glebas', pontos: 'pontos_amostra' }
  for (const chave of camadasIncluidas) {
    const fc = camadas[chave]
    if (!fc?.features.length) continue
    const features =
      chave === 'pontos'
        ? fc.features
        : fc.features.map((f) => ({ ...f, geometry: comoMulti(f.geometry) })).filter((f) => f.geometry)
    const zip = await shpwrite.zip(
      { type: 'FeatureCollection', features },
      { outputType: 'uint8array', compression: 'STORE', types: { point: nomes[chave], polygon: nomes[chave], polyline: nomes[chave] } },
    )
    arquivos[chave] = zip
  }
  return arquivos
}

// ---------------- Satélite (KMZ) ----------------

/**
 * KML das imagens de índice (GroundOverlay), uma pasta por índice e uma
 * imagem por talhão. `imagens`: [{ talhao, indice, data, arquivo, bbox: [O, S, L, N] }].
 */
export function kmlDasImagens(imagens, { nomeFazenda }) {
  const porIndice = new Map()
  for (const im of imagens) {
    if (!porIndice.has(im.indice)) porIndice.set(im.indice, [])
    porIndice.get(im.indice).push(im)
  }
  const pastas = [...porIndice.entries()].map(
    ([indice, lista], i) =>
      `<Folder><name>${indice.toUpperCase()}</name><visibility>${i === 0 ? 1 : 0}</visibility>${lista
        .map(
          (im) => `<GroundOverlay><name>Talhão ${esc(im.talhao)} · ${esc(im.data)}</name><visibility>${i === 0 ? 1 : 0}</visibility><Icon><href>${esc(im.arquivo)}</href></Icon>
<LatLonBox><north>${im.bbox[3]}</north><south>${im.bbox[1]}</south><east>${im.bbox[2]}</east><west>${im.bbox[0]}</west></LatLonBox></GroundOverlay>`,
        )
        .join('')}</Folder>`,
  )
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(nomeFazenda)} — índices de satélite (Moinho)</name>
${pastas.join('\n')}
</Document></kml>`
}
