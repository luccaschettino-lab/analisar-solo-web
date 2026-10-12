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
 * Ponto que não cai em nenhum talhão vai para `fora` — não vira gleba.
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
  const fora = []

  for (const ponto of pontos) {
    const feature = pontoFeature(ponto.lat, ponto.lng)
    const talhao = talhoes.find((t) => glebaDentroDoTalhao(feature, t.geometria) === true)
    if (!talhao) {
      fora.push(ponto)
      continue
    }

    let numero = proximoNumero.get(talhao.id)
    while (codigosEmUso.has(`${talhao.id}|${talhao.codigo}-${numero}`)) numero += 1
    proximoNumero.set(talhao.id, numero + 1)

    if (!porTalhao.has(talhao.id)) porTalhao.set(talhao.id, [])
    porTalhao.get(talhao.id).push({ codigo: `${talhao.codigo}-${numero}`, ponto })
  }

  return { porTalhao, fora }
}
