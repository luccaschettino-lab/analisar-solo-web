import shp from 'shpjs'
import { pontoFeature, glebaDentroDoTalhao, areaEmHectares, latLngDoPonto } from './geo.js'
import { dividirTalhaoPorPontos, unirPartes } from './divisaoPorPontos.js'

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
 * Pontos da mesma amostra em talhões diferentes só são a mesma gleba se
 * estiverem perto uns dos outros. É o que separa a amostra que atravessa a
 * divisa (o ponto do outro lado fica a 190–300 m dos demais, nos dados reais)
 * da numeração que recomeça em cada talhão (o "1" do talhão 7 e o "1" do
 * talhão 8, a quilômetros). Os pontos de uma mesma amostra dentro de um
 * talhão chegam a 1,4 km entre si, mas o que se mede aqui é o vizinho mais
 * próximo do outro lado da divisa, não o par mais distante.
 */
export const DISTANCIA_MAXIMA_ENTRE_TALHOES_M = 500

function distanciaM([lng1, lat1], [lng2, lat2]) {
  const kLat = 111320
  const kLng = 111320 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
  return Math.hypot((lng2 - lng1) * kLng, (lat2 - lat1) * kLat)
}

function menorDistanciaM(a, b) {
  let menor = Infinity
  for (const p of a) for (const q of b) menor = Math.min(menor, distanciaM(p, q))
  return menor
}

/**
 * Agrupa pontos de coleta já gravados em glebas: um grupo por amostra.
 *
 * O código vem do arquivo (`id`/`amostra`) e é o que une os pontos — as dez
 * coletas de uma mesma amostra composta têm o mesmo número. Quem manda é a
 * amostra, não o talhão: se parte dos pontos caiu do outro lado da divisa,
 * a gleba atravessa os talhões e continua uma só (ver
 * `DISTANCIA_MAXIMA_ENTRE_TALHOES_M`). Ela pertence ao talhão onde está a
 * maior parte dos pontos (empate: o de código menor), e o código segue a
 * convenção do rótulo: "talhão-número".
 *
 * Cada talhão é dividido entre os pontos que caem nele: cada pedaço do talhão
 * vai para a gleba cujo ponto está mais perto (ver `dividirTalhaoPorPontos`),
 * então a soma das glebas é a fazenda, sem vão nem sobreposição. A gleba que
 * atravessa a divisa junta os pedaços dos dois lados; a que sai em mais de um
 * pedaço é contada em `emPedacos`, e a que ocupa mais de um talhão, em
 * `entreTalhoes`. Se nenhum talhão dá pedaço para um grupo (talhão sem
 * polígono, ou divisão que falhou), o grupo cai no contorno dos seus próprios
 * pontos; com menos de três pontos (ou todos alinhados) vira um ponto no
 * centro. Ponto sem código no arquivo não tem como ser agrupado e fica de
 * fora, contado em `semCodigo`.
 */
export function agruparPontosEmGlebas(pontos, talhoes) {
  const talhaoPorId = new Map(talhoes.map((t) => [t.id, t]))
  const codigoDoTalhao = (id) => String(talhaoPorId.get(id)?.codigo ?? '')
  const porCodigoDeTalhao = (a, b) => codigoDoTalhao(a).localeCompare(codigoDoTalhao(b), 'pt-BR', { numeric: true })
  let semCodigo = 0

  // 1) Subgrupos: amostra dentro de um talhão.
  const subgrupos = new Map()
  for (const ponto of pontos) {
    const bruto = rotuloDoArquivo(ponto)
    const coordenadas = ponto.geometria?.geometry?.coordinates
    if (bruto === null || !Array.isArray(coordenadas)) {
      semCodigo++
      continue
    }
    const chave = JSON.stringify([bruto, ponto.talhao_id])
    if (!subgrupos.has(chave)) subgrupos.set(chave, { bruto, talhaoId: ponto.talhao_id, ids: [], coordenadas: [] })
    const sub = subgrupos.get(chave)
    sub.ids.push(ponto.id)
    sub.coordenadas.push([coordenadas[0], coordenadas[1]])
  }

  // 2) Mesma amostra em talhões diferentes: junta os subgrupos próximos.
  const porBruto = new Map()
  for (const sub of subgrupos.values()) {
    if (!porBruto.has(sub.bruto)) porBruto.set(sub.bruto, [])
    porBruto.get(sub.bruto).push(sub)
  }
  const grupos = []
  for (const [bruto, lista] of porBruto) {
    const pai = lista.map((_, i) => i)
    const raiz = (i) => (pai[i] === i ? i : (pai[i] = raiz(pai[i])))
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        if (menorDistanciaM(lista[i].coordenadas, lista[j].coordenadas) <= DISTANCIA_MAXIMA_ENTRE_TALHOES_M) {
          pai[raiz(j)] = raiz(i)
        }
      }
    }
    const juntos = new Map()
    lista.forEach((sub, i) => {
      if (!juntos.has(raiz(i))) juntos.set(raiz(i), [])
      juntos.get(raiz(i)).push(sub)
    })
    for (const partes of juntos.values()) {
      const principal = [...partes].sort((a, b) => b.ids.length - a.ids.length || porCodigoDeTalhao(a.talhaoId, b.talhaoId))[0]
      const codigo = comTalhao(bruto, codigoDoTalhao(principal.talhaoId))
      grupos.push({
        chave: JSON.stringify([principal.talhaoId, codigo]),
        talhaoId: principal.talhaoId,
        codigo,
        partes,
        ids: partes.flatMap((p) => p.ids),
        coordenadas: partes.flatMap((p) => p.coordenadas),
      })
    }
  }

  // 3) Divisão de cada talhão entre os pontos que caem nele, de qualquer grupo.
  const pedacosPorGrupo = new Map()
  const talhoesComPontos = new Set(grupos.flatMap((g) => g.partes.map((p) => p.talhaoId)))
  for (const talhaoId of talhoesComPontos) {
    const noTalhao = grupos.flatMap((g) =>
      g.partes
        .filter((p) => p.talhaoId === talhaoId)
        .flatMap((p) => p.coordenadas.map(([lng, lat]) => ({ chave: g.chave, lng, lat }))),
    )
    const divisao = dividirTalhaoPorPontos(talhaoPorId.get(talhaoId)?.geometria, noTalhao)
    if (!divisao) continue
    for (const [chave, pedaco] of divisao) {
      if (!pedacosPorGrupo.has(chave)) pedacosPorGrupo.set(chave, [])
      pedacosPorGrupo.get(chave).push(pedaco.geometria)
    }
  }

  const glebas = grupos.map(({ chave, talhaoId, codigo, partes, ids, coordenadas }) => {
    const talhoesDaGleba = partes.length
    const dividida = unirPartes(pedacosPorGrupo.get(chave) ?? [])
    if (dividida) {
      return {
        talhaoId,
        codigo,
        geometria: dividida.geometria,
        areaHa: dividida.areaHa,
        pedacos: dividida.pedacos,
        talhoes: talhoesDaGleba,
        pontoIds: ids,
      }
    }
    const casco = cascoConvexo(coordenadas)
    if (casco.length >= 3) {
      const geometria = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[...casco, casco[0]]] },
      }
      return { talhaoId, codigo, geometria, areaHa: areaEmHectares(geometria), pedacos: 1, talhoes: talhoesDaGleba, pontoIds: ids }
    }
    const lng = coordenadas.reduce((soma, c) => soma + c[0], 0) / coordenadas.length
    const lat = coordenadas.reduce((soma, c) => soma + c[1], 0) / coordenadas.length
    return { talhaoId, codigo, geometria: pontoFeature(lat, lng), areaHa: null, pedacos: 1, talhoes: talhoesDaGleba, pontoIds: ids }
  })

  glebas.sort((a, b) => porCodigoDeTalhao(a.talhaoId, b.talhaoId) || a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }))
  return {
    glebas,
    semCodigo,
    emPedacos: glebas.filter((g) => g.pedacos > 1).length,
    entreTalhoes: glebas.filter((g) => g.talhoes > 1).length,
  }
}

// ~10 cm. A posição da análise é a média dos pontos da gleba, calculada no
// banco; aqui a média é refeita em JS, e as duas coincidem a menos de um
// arredondamento de ponto flutuante.
const TOLERANCIA_AMOSTRA_GRAUS = 1e-6

/**
 * Cor de cada ponto de coleta segundo o filtro do mapa.
 *
 * Os pontos de uma gleba são as coletas de UMA amostra composta, e a análise
 * (o laudo) é uma só, posicionada na média desses pontos. Então cada ponto
 * herda a cor da análise da sua gleba: acha-se a amostra do talhão que está
 * na média dos pontos da gleba do ponto. Ponto sem gleba, ou cuja gleba não
 * tem análise no filtro, recebe `corSemDado` — com o filtro ligado, manter a
 * cor de antes passaria a impressão de ter um valor.
 *
 * `coloracao` é a função de `criarColoracao` (talhão -> estado com `pontos`).
 * Devolve `(ponto) => cor`.
 */
export function criarCorDosPontos(pontos, coloracao, corSemDado) {
  // A gleba que atravessa a divisa tem pontos em mais de um talhão, e a
  // análise dela está em só um deles: procura-se em todos.
  const somas = new Map() // gleba_id -> { lat, lng, n, talhoes }
  for (const ponto of pontos) {
    if (!ponto.gleba_id) continue
    const posicao = latLngDoPonto(ponto.geometria)
    if (!posicao) continue
    const soma = somas.get(ponto.gleba_id) ?? { lat: 0, lng: 0, n: 0, talhoes: new Set() }
    soma.lat += posicao[0]
    soma.lng += posicao[1]
    soma.n += 1
    soma.talhoes.add(ponto.talhao_id)
    somas.set(ponto.gleba_id, soma)
  }

  // coloracao(talhao) refaz o cálculo a cada chamada; uma vez por talhão basta.
  const amostrasPorTalhao = new Map()
  const amostrasDoTalhao = (talhaoId) => {
    if (!amostrasPorTalhao.has(talhaoId)) amostrasPorTalhao.set(talhaoId, coloracao(talhaoId)?.pontos ?? [])
    return amostrasPorTalhao.get(talhaoId)
  }

  return (ponto) => {
    const soma = ponto.gleba_id ? somas.get(ponto.gleba_id) : null
    if (!soma) return corSemDado
    const lat = soma.lat / soma.n
    const lng = soma.lng / soma.n
    for (const talhaoId of soma.talhoes) {
      const amostra = amostrasDoTalhao(talhaoId).find(
        (a) =>
          a.lat != null &&
          a.lng != null &&
          Math.abs(a.lat - lat) < TOLERANCIA_AMOSTRA_GRAUS &&
          Math.abs(a.lng - lng) < TOLERANCIA_AMOSTRA_GRAUS,
      )
      if (amostra?.cor) return amostra.cor
    }
    return corSemDado
  }
}

/**
 * Refaz a geometria das glebas que já foram criadas a partir dos pontos, para
 * que preencham o talhão (a primeira versão usava só o contorno dos pontos).
 *
 * Só mexe numa gleba que veio dos pontos: todos os pontos ligados a ela têm o
 * código dela. E só refaz um talhão quando TODAS as glebas presentes nele são
 * assim — uma gleba desenhada à mão ficaria sobreposta pelas novas, então o
 * talhão inteiro é deixado como está e listado em `talhoesIgnorados`.
 *
 * Presentes num talhão: as glebas dele e as de outro talhão com ponto ligado
 * caído nele (a gleba que atravessa a divisa). Cada talhão é dividido à parte
 * e os pedaços de uma mesma gleba são unidos; a gleba que tem pedaço num
 * talhão deixado como está também fica como está, para não abrir vão nem
 * sobrepor.
 *
 * `pontos` vêm do banco (com `gleba_id`); `glebas` e `talhoes`, do contexto.
 */
export function recalcularGlebasDosPontos(pontos, glebas, talhoes) {
  const talhaoPorId = new Map(talhoes.map((t) => [t.id, t]))
  const glebaPorId = new Map(glebas.map((g) => [g.id, g]))
  const pontosDaGleba = new Map()
  for (const ponto of pontos) {
    if (!ponto.gleba_id || !glebaPorId.has(ponto.gleba_id)) continue
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

  // Talhões em que cada gleba está: o dela e os dos seus pontos.
  const talhoesDaGleba = new Map(glebas.map((g) => [g.id, new Set([g.talhao_id])]))
  for (const [glebaId, lista] of pontosDaGleba) {
    for (const p of lista) talhoesDaGleba.get(glebaId).add(p.talhao_id)
  }

  const presentesNo = new Map()
  for (const talhao of talhoes) {
    const presentes = glebas.filter((g) => talhoesDaGleba.get(g.id).has(talhao.id))
    if (presentes.length > 0) presentesNo.set(talhao.id, presentes)
  }

  // Talhões que ficam como estão: com gleba desenhada à mão, ou cuja divisão
  // falhou. A trava se espalha pela gleba que atravessa a divisa — se ela não
  // muda, o talhão vizinho dela também não pode mudar, senão um lado seria
  // redesenhado contando com um pedaço que o outro não entrega.
  const talhoesIgnorados = []
  const parados = new Set()
  const divisoes = new Map()
  for (const [talhaoId, presentes] of presentesNo) {
    if (!presentes.every(veioDosPontos)) {
      if (presentes.some(veioDosPontos)) talhoesIgnorados.push(talhaoPorId.get(talhaoId).codigo)
      parados.add(talhaoId)
      continue
    }
    const divisao = dividirTalhaoPorPontos(
      talhaoPorId.get(talhaoId).geometria,
      presentes.flatMap((g) =>
        pontosDaGleba.get(g.id).flatMap((p) => {
          const c = p.geometria?.geometry?.coordinates
          return p.talhao_id === talhaoId && Array.isArray(c) ? [{ chave: g.id, lng: c[0], lat: c[1] }] : []
        }),
      ),
    )
    if (divisao) divisoes.set(talhaoId, divisao)
    else parados.add(talhaoId)
  }
  let mudou = true
  while (mudou) {
    mudou = false
    for (const talhaoId of [...parados]) {
      for (const g of presentesNo.get(talhaoId) ?? []) {
        for (const outro of talhoesDaGleba.get(g.id)) {
          if (!parados.has(outro)) {
            parados.add(outro)
            mudou = true
          }
        }
      }
    }
  }

  const pedacos = new Map() // gleba id -> [Feature]
  for (const [talhaoId, divisao] of divisoes) {
    if (parados.has(talhaoId)) continue
    for (const [glebaId, pedaco] of divisao) {
      if (!pedacos.has(glebaId)) pedacos.set(glebaId, [])
      pedacos.get(glebaId).push(pedaco.geometria)
    }
  }

  const atualizacoes = []
  for (const gleba of glebas) {
    if (!pedacos.has(gleba.id)) continue
    const nova = unirPartes(pedacos.get(gleba.id))
    if (!nova) continue
    atualizacoes.push({
      glebaId: gleba.id,
      codigo: gleba.codigo,
      geometria: nova.geometria,
      areaHa: nova.areaHa,
      pedacos: nova.pedacos,
      talhoes: talhoesDaGleba.get(gleba.id).size,
    })
  }
  return {
    atualizacoes,
    talhoesIgnorados,
    emPedacos: atualizacoes.filter((a) => a.pedacos > 1).length,
    entreTalhoes: atualizacoes.filter((a) => a.talhoes > 1).length,
  }
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
