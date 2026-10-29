import shp from 'shpjs'
import { pontoFeature, glebaDentroDoTalhao, areaEmHectares } from './geo.js'
import { dividirTalhaoPorPontos } from './divisaoPorPontos.js'

// O que o arquivo diz que é o ponto: `amostra` ou `id`. Vazio, ou um objeto
// (propriedade aninhada), não identifica nada.
function rotuloDoArquivo(ponto) {
  const propriedades = ponto.propriedades ?? {}
  const valor =
    propriedades.amostra ??
    propriedades.Amostra ??
    propriedades.id ??
    propriedades.ID

  if (valor == null || typeof valor === 'object' || String(valor).trim() === '') return null
  return String(valor).trim()
}

// Número puro vira "talhão-número"; quem já vem com hífen (ex. "7-58") fica como está.
function comTalhao(rotulo, codigoTalhao) {
  return codigoTalhao && /^\d+$/.test(rotulo) ? `${codigoTalhao}-${rotulo}` : rotulo
}

export function rotuloPontoColeta(ponto, indice = 0, codigoTalhao = '') {
  const rotulo = rotuloDoArquivo(ponto)
  return rotulo === null ? `Ponto ${indice + 1}` : comTalhao(rotulo, codigoTalhao)
}

/**
 * Casca convexa (monotone chain) de pontos [lng, lat], sem repetir o primeiro
 * no fim. Devolve menos de 3 vértices quando os pontos são um só, dois, ou
 * ficam todos na mesma reta — não há polígono nesses casos.
 */
function cascoConvexo(pontos) {
  const unicos = [...new Map(pontos.map((p) => [`${p[0]},${p[1]}`, p])).values()]
  if (unicos.length < 3) return unicos
  unicos.sort((a, b) => a[0] - b[0] || a[1] - b[1])

  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const montar = (lista) => {
    const meia = []
    for (const p of lista) {
      while (meia.length >= 2 && cruz(meia[meia.length - 2], meia[meia.length - 1], p) <= 0) meia.pop()
      meia.push(p)
    }
    meia.pop()
    return meia
  }
  return [...montar(unicos), ...montar([...unicos].reverse())]
}

/**
 * Agrupa pontos de coleta já gravados em glebas: um grupo por talhão + código.
 *
 * O código vem do arquivo (`id`/`amostra`) e é o que une os pontos — as dez
 * coletas de uma mesma amostra composta têm o mesmo número. O código da gleba
 * segue a convenção do rótulo: "talhão-número".
 *
 * As glebas de um talhão dividem o talhão inteiro entre si: cada pedaço do
 * talhão vai para a gleba cujo ponto está mais perto (ver `dividirTalhaoPorPontos`),
 * então a soma das glebas é o talhão, sem vão nem sobreposição. A gleba que
 * sai em mais de um pedaço é contada em `emPedacos`. Se o talhão não tem
 * polígono, ou a divisão falha para um grupo, o grupo cai no contorno dos seus
 * próprios pontos; com menos de três pontos (ou todos alinhados) vira um
 * ponto no centro. Ponto sem código no arquivo não tem como ser agrupado e
 * fica de fora, contado em `semCodigo`.
 */
export function agruparPontosEmGlebas(pontos, talhoes) {
  const talhaoPorId = new Map(talhoes.map((t) => [t.id, t]))
  const grupos = new Map()
  let semCodigo = 0

  for (const ponto of pontos) {
    const bruto = rotuloDoArquivo(ponto)
    const coordenadas = ponto.geometria?.geometry?.coordinates
    if (bruto === null || !Array.isArray(coordenadas)) {
      semCodigo++
      continue
    }
    const codigo = comTalhao(bruto, talhaoPorId.get(ponto.talhao_id)?.codigo ?? '')
    const chave = JSON.stringify([ponto.talhao_id, codigo])
    if (!grupos.has(chave)) grupos.set(chave, { chave, talhaoId: ponto.talhao_id, codigo, ids: [], coordenadas: [] })
    const grupo = grupos.get(chave)
    grupo.ids.push(ponto.id)
    grupo.coordenadas.push([coordenadas[0], coordenadas[1]])
  }

  // Divisão do talhão, uma vez por talhão, com os pontos de todos os seus grupos.
  const divisaoPorTalhao = new Map()
  for (const talhaoId of new Set([...grupos.values()].map((g) => g.talhaoId))) {
    const doTalhao = [...grupos.values()].filter((g) => g.talhaoId === talhaoId)
    const divisao = dividirTalhaoPorPontos(
      talhaoPorId.get(talhaoId)?.geometria,
      doTalhao.flatMap((g) => g.coordenadas.map(([lng, lat]) => ({ chave: g.chave, lng, lat }))),
    )
    if (divisao) divisaoPorTalhao.set(talhaoId, divisao)
  }

  const glebas = [...grupos.values()].map(({ chave, talhaoId, codigo, ids, coordenadas }) => {
    const dividida = divisaoPorTalhao.get(talhaoId)?.get(chave)
    if (dividida) {
      return { talhaoId, codigo, geometria: dividida.geometria, areaHa: dividida.areaHa, pedacos: dividida.pedacos, pontoIds: ids }
    }
    const casco = cascoConvexo(coordenadas)
    if (casco.length >= 3) {
      const geometria = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[...casco, casco[0]]] },
      }
      return { talhaoId, codigo, geometria, areaHa: areaEmHectares(geometria), pedacos: 1, pontoIds: ids }
    }
    const lng = coordenadas.reduce((soma, c) => soma + c[0], 0) / coordenadas.length
    const lat = coordenadas.reduce((soma, c) => soma + c[1], 0) / coordenadas.length
    return { talhaoId, codigo, geometria: pontoFeature(lat, lng), areaHa: null, pedacos: 1, pontoIds: ids }
  })

  const codigoDoTalhao = (id) => String(talhaoPorId.get(id)?.codigo)
  glebas.sort(
    (a, b) =>
      codigoDoTalhao(a.talhaoId).localeCompare(codigoDoTalhao(b.talhaoId), 'pt-BR', { numeric: true }) ||
      a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }),
  )
  return { glebas, semCodigo, emPedacos: glebas.filter((g) => g.pedacos > 1).length }
}

/**
 * Refaz a geometria das glebas que já foram criadas a partir dos pontos, para
 * que preencham o talhão (a primeira versão usava só o contorno dos pontos).
 *
 * Só mexe numa gleba que veio dos pontos: todos os pontos ligados a ela têm o
 * código dela. E só refaz um talhão quando TODAS as glebas dele são assim —
 * uma gleba desenhada à mão ficaria sobreposta pelas novas, então o talhão
 * inteiro é deixado como está e listado em `talhoesIgnorados`.
 *
 * `pontos` vêm do banco (com `gleba_id`); `glebas` e `talhoes`, do contexto.
 */
export function recalcularGlebasDosPontos(pontos, glebas, talhoes) {
  const talhaoPorId = new Map(talhoes.map((t) => [t.id, t]))
  const pontosDaGleba = new Map()
  for (const ponto of pontos) {
    if (!ponto.gleba_id) continue
    if (!pontosDaGleba.has(ponto.gleba_id)) pontosDaGleba.set(ponto.gleba_id, [])
    pontosDaGleba.get(ponto.gleba_id).push(ponto)
  }

  const veioDosPontos = (gleba) => {
    const lista = pontosDaGleba.get(gleba.id)
    if (!lista?.length) return false
    const codigoTalhao = talhaoPorId.get(gleba.talhao_id)?.codigo ?? ''
    return lista.every((p) => {
      const bruto = rotuloDoArquivo(p)
      return bruto !== null && comTalhao(bruto, codigoTalhao) === gleba.codigo
    })
  }

  const atualizacoes = []
  const talhoesIgnorados = []
  for (const talhao of talhoes) {
    const doTalhao = glebas.filter((g) => g.talhao_id === talhao.id)
    if (doTalhao.length === 0) continue
    if (!doTalhao.every(veioDosPontos)) {
      if (doTalhao.some(veioDosPontos)) talhoesIgnorados.push(talhao.codigo)
      continue
    }
    const divisao = dividirTalhaoPorPontos(
      talhao.geometria,
      doTalhao.flatMap((g) =>
        pontosDaGleba.get(g.id).flatMap((p) => {
          const c = p.geometria?.geometry?.coordinates
          return Array.isArray(c) ? [{ chave: g.id, lng: c[0], lat: c[1] }] : []
        }),
      ),
    )
    if (!divisao) continue
    for (const gleba of doTalhao) {
      const nova = divisao.get(gleba.id)
      if (nova) atualizacoes.push({ glebaId: gleba.id, codigo: gleba.codigo, geometria: nova.geometria, areaHa: nova.areaHa, pedacos: nova.pedacos })
    }
  }
  return { atualizacoes, talhoesIgnorados, emPedacos: atualizacoes.filter((a) => a.pedacos > 1).length }
}

/**
 * Pontos de coleta vindos de um arquivo (shapefile zipado ou GeoJSON).
 *
 * Mesma ideia de `importarArquivo.js`, mas para pontos: lá só interessam
 * polígonos. Cada ponto sai como `{ indice, lat, lng, propriedades }`, na ordem
 * em que aparece no arquivo.
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
 * Descobre em que talhão cada ponto cai.
 *
 * Ponto que não cai em nenhum talhão não é descartado: vai para o talhão mais
 * próximo e entra também em `fora`, com a distância, para a revisão avisar.
 * Se um ponto cair em dois talhões sobrepostos, fica com o primeiro da lista.
 */
export function distribuirPontos(pontos, talhoes) {
  const porTalhao = new Map() // talhaoId -> [{ ponto, fora }]
  const fora = [] // { ponto, talhao, distanciaM }

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

    if (!porTalhao.has(talhao.id)) porTalhao.set(talhao.id, [])
    porTalhao.get(talhao.id).push({ ponto, fora: Boolean(foraInfo) })
    if (foraInfo) fora.push(foraInfo)
  }

  return { porTalhao, fora }
}

export function pontosNaGleba(pontos, geometriaGleba) {
  return pontos.filter(
    (ponto) =>
      !ponto.gleba_id &&
      glebaDentroDoTalhao(ponto.geometria, geometriaGleba) === true,
  )
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
