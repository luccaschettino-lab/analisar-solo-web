import { abrirCog } from './cogRecorte.js'
import { latLngParaUtm, utmParaLatLng, zonaDoEpsg } from './utm.js'
import { ESCALA, SEM_VALOR, PIXEL, ndvi, evi, savi, ndwi, aneisDe, dentroDoPoligono, estatisticas, base64 } from './indicesComuns.js'

/**
 * NDVI, EVI, SAVI e NDWI de UM talhão numa cena Sentinel-2 L2A, lida do
 * repositório público da AWS (Earth Search / sentinel-cogs). Sem cadastro.
 *
 * A saída, os índices e as estatísticas vêm de indicesComuns.js.
 *   - 10 m por pixel;
 *   - reflectância de SUPERFÍCIE, já corrigida da atmosfera pela ESA
 *     (DN × escala + offset, do próprio catálogo);
 *   - nuvem e sombra de nuvem vêm da camada SCL (classificação da cena, 20 m),
 *     pixel a pixel, em vez de um limiar de brilho.
 */

const CATALOGO = 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items'
const HOST_PERMITIDO = 'sentinel-cogs.s3.us-west-2.amazonaws.com'
const LADRILHO_MAXIMO = 1100 // lado máximo da janela, em pixels (11 km a 10 m)

// SCL: 0 sem dado, 1 saturado/defeito, 3 sombra de nuvem, 8 e 9 nuvem, 10 cirro.
const SCL_SEM_DADO = new Set([0, 1])
const SCL_NUVEM = new Set([3, 8, 9, 10])

const BANDAS = { azul: 'blue', verde: 'green', vermelho: 'red', nir: 'nir' }

// Cor real (vermelho, verde, azul): reflectância × ganho, com uma curva leve
// para clarear as sombras — o mesmo jeito de "foto" dos visualizadores do
// Sentinel. 0,30 de reflectância já é branco; lavoura e solo ficam no meio.
const GANHO_COR = 3.4
const GAMA_COR = 0.82
const corDoCanal = (refl) => Math.round(255 * Math.min(1, Math.max(0, refl * GANHO_COR)) ** GAMA_COR)

const falha = (status, mensagem) => Object.assign(new Error(mensagem), { status })

/**
 * @param {object} p
 * @param {string} p.cenaId    id da cena no Earth Search (ex.: S2B_22LFQ_20260916_0_L2A)
 * @param {object} p.geometria GeoJSON do talhão, em lat/lng
 * @param {typeof fetch} [p.buscar]
 */
export async function calcularIndicesSentinel({ cenaId, geometria, buscar = fetch }) {
  if (!/^S2[A-D]_\d{2}[A-Z]{3}_\d{8}_\d{1,2}_L2A$/.test(String(cenaId ?? ''))) throw falha(400, 'Identificador de cena inválido.')
  const aneisLatLng = aneisDe(geometria)

  const respostaItem = await buscar(`${CATALOGO}/${cenaId}`)
  if (respostaItem.status === 404) throw falha(404, 'Cena não encontrada no catálogo do Sentinel-2.')
  if (!respostaItem.ok) throw falha(502, `O catálogo do Sentinel-2 respondeu com erro (HTTP ${respostaItem.status}).`)
  const item = await respostaItem.json()
  const dataDaCena = item?.properties?.datetime
  if (!dataDaCena) throw falha(502, 'A cena não informa a data de aquisição.')

  const urlDe = (ativo) => {
    const href = item.assets?.[ativo]?.href
    let url
    try {
      url = new URL(href)
    } catch {
      throw falha(502, `A cena não traz a banda ${ativo}.`)
    }
    if (url.protocol !== 'https:' || url.hostname !== HOST_PERMITIDO) throw falha(502, 'O catálogo apontou para fora do repositório do Sentinel-2.')
    return url.href
  }
  // Reflectância = DN × escala + offset. O Earth Search já aplica o offset da
  // ESA (−0,1, das cenas a partir da versão 04.00) nos próprios arquivos e
  // avisa com `earthsearch:boa_offset_applied`, mas o catálogo continua
  // listando o offset na banda: aplicá-lo de novo zerava os pixels escuros
  // (NDVI 1 e NDWI −1 em toda parte, no primeiro teste).
  const offsetJaAplicado = item.properties?.['earthsearch:boa_offset_applied'] === true
  const conversao = Object.fromEntries(
    Object.entries(BANDAS).map(([nome, ativo]) => {
      const rb = item.assets?.[ativo]?.['raster:bands']?.[0] ?? {}
      const offset = offsetJaAplicado || !Number.isFinite(rb.offset) ? 0 : rb.offset
      return [nome, { escala: Number.isFinite(rb.scale) ? rb.scale : 0.0001, offset }]
    }),
  )

  const abrir = (url) =>
    abrirCog(async (inicio, fim) => {
      const r = await buscar(url, { headers: { Range: `bytes=${inicio}-${fim}` } })
      if (r.status !== 206 && r.status !== 200) throw falha(502, `O repositório do Sentinel-2 respondeu com erro ao ler a banda (HTTP ${r.status}).`)
      const todos = new Uint8Array(await r.arrayBuffer())
      if (r.status === 206) return { bytes: todos, total: Number(/\/(\d+)$/.exec(r.headers.get('content-range') ?? '')?.[1]) }
      return { bytes: todos.subarray(inicio, fim + 1), total: todos.length }
    })

  const nomes = Object.keys(BANDAS)
  const [tiffs, scl] = await Promise.all([Promise.all(nomes.map((n) => abrir(urlDe(BANDAS[n])))), abrir(urlDe('scl'))])
  const tiff = Object.fromEntries(nomes.map((n, i) => [n, tiffs[i]]))

  const ref = tiff.vermelho
  for (const n of nomes) {
    const t = tiff[n]
    if (t.largura !== ref.largura || t.georef.origemLeste !== ref.georef.origemLeste || t.georef.origemNorte !== ref.georef.origemNorte || t.georef.tamanhoX !== ref.georef.tamanhoX) {
      throw falha(502, 'As bandas da cena não têm a mesma grade.')
    }
  }
  const utmZona = zonaDoEpsg(ref.georef.epsg)
  if (!utmZona) throw falha(502, `Projeção ${ref.georef.epsg} não suportada (esperava UTM WGS84).`)
  const { zona, sul } = utmZona
  const { origemLeste, origemNorte, tamanhoX, tamanhoY } = ref.georef

  // A janela do talhão, em pixels de 10 m.
  const aneisUtm = aneisLatLng.map((poligono) => poligono.map((anel) => anel.map(([lng, lat]) => latLngParaUtm(lat, lng, zona, sul))))
  const todosUtm = aneisUtm.flat(2)
  const leste = todosUtm.map((p) => p[0])
  const norte = todosUtm.map((p) => p[1])
  const c0 = Math.floor((Math.min(...leste) - origemLeste) / tamanhoX) - 1
  const c1 = Math.ceil((Math.max(...leste) - origemLeste) / tamanhoX) + 2
  const l0 = Math.floor((origemNorte - Math.max(...norte)) / tamanhoY) - 1
  const l1 = Math.ceil((origemNorte - Math.min(...norte)) / tamanhoY) + 2
  const colunas = c1 - c0
  const linhas = l1 - l0
  if (colunas > LADRILHO_MAXIMO || linhas > LADRILHO_MAXIMO) throw falha(400, 'O talhão é grande demais para calcular de uma vez.')
  const cc0 = Math.max(0, c0)
  const cc1 = Math.min(ref.largura, c1)
  const ll0 = Math.max(0, l0)
  const ll1 = Math.min(ref.altura, l1)
  if (cc1 <= cc0 || ll1 <= ll0) throw falha(422, 'Esta cena não cobre o talhão.')

  const dn = {}
  await Promise.all(
    nomes.map(async (n) => {
      const recorte = await tiff[n].lerJanela(cc0, ll0, cc1, ll1)
      const cheio = new Uint16Array(colunas * linhas) // zero = sem dado
      for (let l = ll0; l < ll1; l++) cheio.set(recorte.subarray((l - ll0) * (cc1 - cc0), (l - ll0 + 1) * (cc1 - cc0)), (l - l0) * colunas + (cc0 - c0))
      dn[n] = cheio
    }),
  )

  // A SCL (20 m) correspondente à mesma área.
  const g = scl.georef
  const sx0 = Math.max(0, Math.floor((origemLeste + c0 * tamanhoX - g.origemLeste) / g.tamanhoX))
  const sx1 = Math.min(scl.largura, Math.ceil((origemLeste + c1 * tamanhoX - g.origemLeste) / g.tamanhoX) + 1)
  const sy0 = Math.max(0, Math.floor((g.origemNorte - (origemNorte - l0 * tamanhoY)) / g.tamanhoY))
  const sy1 = Math.min(scl.altura, Math.ceil((g.origemNorte - (origemNorte - l1 * tamanhoY)) / g.tamanhoY) + 1)
  const classes = sx1 > sx0 && sy1 > sy0 ? await scl.lerJanela(sx0, sy0, sx1, sy1) : null
  const classeEm = (x, y) => {
    if (!classes) return 0
    const sc = Math.floor((x - g.origemLeste) / g.tamanhoX) - sx0
    const sl = Math.floor((g.origemNorte - y) / g.tamanhoY) - sy0
    if (sc < 0 || sl < 0 || sc >= sx1 - sx0 || sl >= sy1 - sy0) return 0
    return classes[sl * (sx1 - sx0) + sc]
  }

  const refl = (n, v) => Math.max(0, v * conversao[n].escala + conversao[n].offset)
  const total = colunas * linhas
  const mascara = new Uint8Array(total)
  const cor = new Uint8Array(total * 3) // RGB por pixel; fora do talhão fica 0
  const saida = { ndvi: new Int16Array(total).fill(SEM_VALOR), evi: new Int16Array(total).fill(SEM_VALOR), savi: new Int16Array(total).fill(SEM_VALOR), ndwi: new Int16Array(total).fill(SEM_VALOR) }
  const validos = { ndvi: [], evi: [], savi: [], ndwi: [] }
  const quantizar = (v) => (v === null || !Number.isFinite(v) ? SEM_VALOR : Math.max(-32000, Math.min(32000, Math.round(v * ESCALA))))
  const aneisPlanos = aneisUtm.flat(1)
  let noTalhao = 0
  let nuvens = 0
  let semDado = 0

  for (let l = 0; l < linhas; l++) {
    const y = origemNorte - (l0 + l + 0.5) * tamanhoY
    for (let c = 0; c < colunas; c++) {
      const x = origemLeste + (c0 + c + 0.5) * tamanhoX
      if (!dentroDoPoligono(x, y, aneisPlanos)) continue // PIXEL.FORA = 0
      const i = l * colunas + c
      noTalhao++
      const classe = classeEm(x, y)
      if (!dn.azul[i] || !dn.verde[i] || !dn.vermelho[i] || !dn.nir[i] || SCL_SEM_DADO.has(classe)) {
        mascara[i] = PIXEL.SEM_DADO
        semDado++
        continue
      }
      const ehNuvem = SCL_NUVEM.has(classe)
      mascara[i] = ehNuvem ? PIXEL.NUVEM : PIXEL.VALIDO
      if (ehNuvem) nuvens++
      const a = refl('azul', dn.azul[i])
      const gr = refl('verde', dn.verde[i])
      const r = refl('vermelho', dn.vermelho[i])
      const nir = refl('nir', dn.nir[i])
      // A nuvem entra na cor real como ela é: a pessoa vê que estava nublado.
      cor[i * 3] = corDoCanal(r)
      cor[i * 3 + 1] = corDoCanal(gr)
      cor[i * 3 + 2] = corDoCanal(a)
      const valores = { ndvi: ndvi(nir, r), evi: evi(nir, r, a), savi: savi(nir, r), ndwi: ndwi(gr, nir) }
      for (const k of Object.keys(valores)) {
        saida[k][i] = quantizar(valores[k])
        if (!ehNuvem && saida[k][i] !== SEM_VALOR) validos[k].push(saida[k][i] / ESCALA)
      }
    }
  }
  if (noTalhao === 0) throw falha(422, 'Nenhum pixel da cena cai dentro do contorno do talhão.')

  const canto = (c, l) => utmParaLatLng(origemLeste + c * tamanhoX, origemNorte - l * tamanhoY, zona, sul)
  const [sulLat, oesteLng] = canto(c0, l1)
  const [norteLat, lesteLng] = canto(c1, l0)
  const pct = (x) => Math.round((x / noTalhao) * 1000) / 10

  return {
    cena: { id: cenaId, data: dataDaCena, satelite: 'Sentinel-2' },
    janela: { colunas, linhas, tamanhoPixelM: tamanhoX, bbox: [oesteLng, sulLat, lesteLng, norteLat] },
    escala: ESCALA,
    semValor: SEM_VALOR,
    mascara: base64(mascara),
    indices: Object.fromEntries(Object.entries(saida).map(([k, v]) => [k, base64(v)])),
    cor: base64(cor),
    estatisticas: Object.fromEntries(Object.entries(validos).map(([k, v]) => [k, estatisticas(v)])),
    qualidade: { pixelsNoTalhao: noTalhao, validos: noTalhao - nuvens - semDado, possivelNuvemPct: pct(nuvens), semDadoPct: pct(semDado) },
    calibracao: { tipo: 'reflectância de superfície (Sentinel-2 L2A, corrigida da atmosfera pela ESA)' },
  }
}
