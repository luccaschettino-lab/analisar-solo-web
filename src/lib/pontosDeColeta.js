import shp from 'shpjs'
import { pontoFeature, glebaDentroDoTalhao } from './geo.js'

/**
 * Pontos de coleta vindos de um arquivo (shapefile zipado ou GeoJSON), prontos
 * para virar glebas de ponto.
 *
 * Mesma ideia de `importarArquivo.js`, mas para pontos: lá só interessam
 * polígonos. Cada ponto sai como `{ indice, lat, lng, propriedades }`, na ordem
 * em que aparece no arquivo (a ordem define a numeração das glebas).
 */

function pontosDaColecao(colecao) {
  const features =
    colecao?.type === 'FeatureCollection' ? (colecao.features ?? [])
    : colecao?.type === 'Feature' ? [colecao]
    : []

  const pontos = []
  for (const feature of features) {
    const g = feature?.geometry
    const coordenadas =
      g?.type === 'Point' ? [g.coordinates]
      : g?.type === 'MultiPoint' ? g.coordinates
      : []
    for (const [lng, lat] of coordenadas) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      pontos.push({ indice: pontos.length + 1, lat, lng, propriedades: feature.properties ?? {} })
    }
  }
  return pontos
}

export async function pontosDoArquivo(arquivo) {
  const nome = arquivo.name.toLowerCase()
  let colecoes

  if (nome.endsWith('.zip')) {
    // shpjs reprojeta pelo .prj, então o resultado já vem em lat/lng.
    const resultado = await shp(await arquivo.arrayBuffer())
    colecoes = Array.isArray(resultado) ? resultado : [resultado]
  } else if (nome.endsWith('.geojson') || nome.endsWith('.json')) {
    try {
      colecoes = [JSON.parse(await arquivo.text())]
    } catch {
      throw new Error('Isso não parece um arquivo GeoJSON válido.')
    }
  } else {
    throw new Error('Formato não aceito aqui. Use um .zip de shapefile ou um .geojson de pontos.')
  }

  const pontos = colecoes.flatMap(pontosDaColecao).map((p, i) => ({ ...p, indice: i + 1 }))
  if (pontos.length === 0) {
    throw new Error('Nenhum ponto encontrado neste arquivo — ele só tem polígonos ou linhas, ou está vazio.')
  }
  return pontos
}

/**
 * Descobre em que talhão cada ponto cai e dá o código da gleba: o código do
 * talhão, um hífen e um número de ordem (`8-1`, `8-2`…). A contagem continua de
 * onde as glebas que o talhão já tem pararam, para não repetir código.
 *
 * Ponto que não cai em nenhum talhão não é descartado: vai para o talhão mais
 * próximo e entra também em `fora`, com a distância, para a revisão avisar.
 * Se um ponto cair em dois talhões sobrepostos, fica com o primeiro da lista.
 */
export function distribuirPontos(pontos, talhoes, glebasExistentes) {
  const proximoNumero = new Map() // talhaoId -> próximo número livre
  const codigosEmUso = new Set(glebasExistentes.map((g) => `${g.talhao_id}|${g.codigo}`))

  for (const t of talhoes) {
    const prefixo = `${t.codigo}-`
    let maior = 0
    for (const g of glebasExistentes) {
      if (g.talhao_id !== t.id || !g.codigo.startsWith(prefixo)) continue
      const n = Number(g.codigo.slice(prefixo.length))
      if (Number.isInteger(n) && n > maior) maior = n
    }
    proximoNumero.set(t.id, maior + 1)
  }

  const porTalhao = new Map() // talhaoId -> [{ codigo, ponto }]
  const fora = [] // { ponto, talhao, distanciaM, codigo }

  for (const ponto of pontos) {
    const feature = pontoFeature(ponto.lat, ponto.lng)
    let talhao = talhoes.find((t) => glebaDentroDoTalhao(feature, t.geometria) === true)
    let foraInfo = null
    if (!talhao) {
      const mais = talhaoMaisProximo(ponto, talhoes)
      if (!mais) continue // nenhum talhão com polígono utilizável
      talhao = mais.talhao
      foraInfo = { ponto, talhao, distanciaM: mais.distanciaM }
    }

    let numero = proximoNumero.get(talhao.id)
    while (codigosEmUso.has(`${talhao.id}|${talhao.codigo}-${numero}`)) numero += 1
    proximoNumero.set(talhao.id, numero + 1)

    if (!porTalhao.has(talhao.id)) porTalhao.set(talhao.id, [])
    const codigo = `${talhao.codigo}-${numero}`
    porTalhao.get(talhao.id).push({ codigo, ponto, fora: Boolean(foraInfo) })
    if (foraInfo) fora.push({ ...foraInfo, codigo })
  }

  return { porTalhao, fora }
}

// Distância (m) de um ponto a um segmento, numa projeção plana local — para
// distâncias de centenas de metros o erro é desprezível.
function distanciaAoSegmentoM(lat, lng, a, b) {
  const kLat = 111320
  const kLng = 111320 * Math.cos((lat * Math.PI) / 180)
  const px = 0
  const py = 0
  const ax = (a[0] - lng) * kLng
  const ay = (a[1] - lat) * kLat
  const bx = (b[0] - lng) * kLng
  const by = (b[1] - lat) * kLat
  const dx = bx - ax
  const dy = by - ay
  const comp = dx * dx + dy * dy
  const t = comp === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / comp))
  return Math.hypot(ax + t * dx - px, ay + t * dy - py)
}

function aneisDoTalhao(geometria) {
  const g = geometria?.geometry ?? geometria
  if (g?.type === 'Polygon') return g.coordinates
  if (g?.type === 'MultiPolygon') return g.coordinates.flat()
  return []
}

function talhaoMaisProximo(ponto, talhoes) {
  let melhor = null
  for (const talhao of talhoes) {
    for (const anel of aneisDoTalhao(talhao.geometria)) {
      for (let i = 0; i < anel.length - 1; i++) {
        const d = distanciaAoSegmentoM(ponto.lat, ponto.lng, anel[i], anel[i + 1])
        if (!melhor || d < melhor.distanciaM) melhor = { talhao, distanciaM: d }
      }
    }
  }
  return melhor
}
