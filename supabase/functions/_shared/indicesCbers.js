import { Buffer } from 'node:buffer'
import { abrirTiff } from './tiffRecorte.js'
import { latLngParaUtm, utmParaLatLng, zonaDoEpsg } from './utm.js'

/**
 * NDVI, EVI, SAVI e NDWI de UM talhão, numa cena CBERS-4A MUX do INPE.
 *
 * Fluxo: acha a cena no catálogo, lê só o recorte do talhão nas quatro bandas,
 * converte o número digital em reflectância no topo da atmosfera e calcula os
 * índices dentro do contorno. Devolve números e matrizes pequenas, não imagem:
 * quem desenha é a tela.
 *
 * O e-mail do cadastro no INPE vem de fora (segredo da função) e NUNCA entra em
 * mensagem de erro nem na resposta.
 *
 * A reflectância é a do TOPO da atmosfera (sem correção atmosférica). Serve
 * para acompanhar a lavoura ao longo da safra; os valores absolutos ficam um
 * pouco abaixo dos de reflectância de superfície, o que a tela avisa.
 */

const CATALOGO = 'https://www.dgi.inpe.br/lgi-stac/collections/CBERS4A_MUX_L4_DN/items'
const HOST_PERMITIDO = 'www.dgi.inpe.br'

// Irradiância solar média por banda, W/(m²·µm): tabela do CBERS-4A na
// documentação de calibração da Carta Internacional de Desastres (OPT-Calib).
export const ESUN = { azul: 1984.65, verde: 1823.4, vermelho: 1536.38, nir: 981.91 }
const BANDAS = {
  azul: { ativo: 'blue', numero: 5 },
  verde: { ativo: 'green', numero: 6 },
  vermelho: { ativo: 'red', numero: 7 },
  nir: { ativo: 'nir', numero: 8 },
}

export const ESCALA = 10000 // índice = inteiro / 10000
export const SEM_VALOR = -32768
export const LADRILHO_MAXIMO = 700 // lado máximo da janela, em pixels (700 x 16 m = 11,2 km)

// Estados de cada pixel da janela.
export const PIXEL = { FORA: 0, VALIDO: 1, NUVEM: 2, SEM_DADO: 3 }

// Reflectância mínima, nas três bandas visíveis, para suspeitar de nuvem: lavoura
// e solo exposto raramente passam de 0,25 no AZUL; nuvem passa em todas.
const LIMIAR_NUVEM = 0.25

const falha = (status, mensagem) => Object.assign(new Error(mensagem), { status })

// ---------------------------------------------------------------- calibração

/** Distância Terra-Sol em unidades astronômicas, pela data (aprox. de 1e-4). */
export function distanciaTerraSol(dataISO) {
  const d = new Date(dataISO)
  const diaDoAno = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000)
  return 1 - 0.01672 * Math.cos((0.9856 * (diaDoAno - 4) * Math.PI) / 180)
}

/** Coeficientes de calibração absoluta por banda e elevação do sol, do XML da cena. */
export function lerCalibracao(xml) {
  const bloco = /<absoluteCalibrationCoefficient>([\s\S]*?)<\/absoluteCalibrationCoefficient>/.exec(xml)?.[1]
  const elevacao = Number(/<sunPosition>[\s\S]*?<elevation>([\d.+-]+)<\/elevation>/.exec(xml)?.[1])
  if (!bloco || !Number.isFinite(elevacao)) throw falha(502, 'O arquivo de metadados da cena não traz a calibração esperada.')
  const coeficientes = {}
  for (const m of bloco.matchAll(/<band name="(\d+)">([\d.eE+-]+)<\/band>/g)) coeficientes[Number(m[1])] = Number(m[2])
  return { coeficientes, elevacao }
}

/** Reflectância no topo da atmosfera (0 a ~1) a partir do número digital. */
export function reflectanciaTopo(dn, coeficiente, esun, distancia, elevacaoGraus) {
  const radiancia = dn * coeficiente
  const cosZenital = Math.cos(((90 - elevacaoGraus) * Math.PI) / 180)
  return (Math.PI * radiancia * distancia * distancia) / (esun * cosZenital)
}

// ------------------------------------------------------------------- índices
// As mesmas fórmulas de src/lib/indicesVegetacao.js (o teste confere as duas).

export const ndvi = (nir, vermelho) => (nir + vermelho === 0 ? null : (nir - vermelho) / (nir + vermelho))
export const evi = (nir, vermelho, azul) => {
  const den = nir + 6 * vermelho - 7.5 * azul + 1
  return den === 0 ? null : 2.5 * ((nir - vermelho) / den)
}
export const savi = (nir, vermelho, l = 0.5) => (nir + vermelho + l === 0 ? null : ((nir - vermelho) / (nir + vermelho + l)) * (1 + l))
export const ndwi = (verde, nir) => (verde + nir === 0 ? null : (verde - nir) / (verde + nir))

// ------------------------------------------------------------------ geometria

function aneisDe(geometria) {
  const g = geometria?.type === 'Feature' ? geometria.geometry : geometria
  if (g?.type === 'Polygon') return [g.coordinates]
  if (g?.type === 'MultiPolygon') return g.coordinates
  throw falha(400, 'A geometria do talhão precisa ser um polígono.')
}

/** Ponto dentro de um polígono (anel externo e furos, regra par-ímpar). */
function dentroDoPoligono(x, y, aneis) {
  let dentro = false
  for (const anel of aneis) {
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [xi, yi] = anel[i]
      const [xj, yj] = anel[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro
    }
  }
  return dentro
}

// -------------------------------------------------------------------- estatística

function estatisticas(valores) {
  const n = valores.length
  if (n === 0) return null
  let soma = 0
  let minimo = Infinity
  let maximo = -Infinity
  for (const v of valores) {
    soma += v
    if (v < minimo) minimo = v
    if (v > maximo) maximo = v
  }
  const media = soma / n
  let variancia = 0
  for (const v of valores) variancia += (v - media) ** 2
  const ordenados = Float64Array.from(valores).sort()
  const percentil = (p) => ordenados[Math.min(n - 1, Math.floor(p * n))]
  const r = (x) => Math.round(x * 10000) / 10000
  return { media: r(media), minimo: r(minimo), maximo: r(maximo), desvio: r(Math.sqrt(variancia / n)), p10: r(percentil(0.1)), p90: r(percentil(0.9)), validos: n }
}

const base64 = (tipado) => Buffer.from(tipado.buffer, tipado.byteOffset, tipado.byteLength).toString('base64')

// ----------------------------------------------------------------- orquestração

/**
 * @param {object} p
 * @param {string} p.cenaId       id da cena no catálogo do INPE
 * @param {object} p.geometria    GeoJSON (Feature/Polygon/MultiPolygon) do talhão, em lat/lng
 * @param {string} p.email        e-mail cadastrado no INPE
 * @param {typeof fetch} [p.buscar]
 */
export async function calcularIndicesDoTalhao({ cenaId, geometria, email, buscar = fetch }) {
  if (!/^CBERS4A_MUX[A-Za-z0-9_]{4,80}$/.test(String(cenaId ?? ''))) throw falha(400, 'Identificador de cena inválido.')
  if (!email) throw falha(500, 'A função não está configurada com o e-mail do INPE.')
  const aneisLatLng = aneisDe(geometria)

  // 1) a cena
  const respostaItem = await buscar(`${CATALOGO}/${cenaId}`)
  if (respostaItem.status === 404) throw falha(404, 'Cena não encontrada no catálogo do INPE.')
  if (!respostaItem.ok) throw falha(502, `O catálogo do INPE respondeu com erro (HTTP ${respostaItem.status}).`)
  const item = await respostaItem.json()
  const dataDaCena = item?.properties?.datetime
  if (!dataDaCena) throw falha(502, 'A cena não informa a data de aquisição.')

  const comEmail = (href) => {
    let url
    try {
      url = new URL(href)
    } catch {
      throw falha(502, 'Endereço de banda inválido no catálogo.')
    }
    if (url.protocol !== 'https:' || url.hostname !== HOST_PERMITIDO) throw falha(502, 'O catálogo apontou para fora do INPE.')
    url.searchParams.set('email', email)
    return url.href
  }

  const bandas = {}
  for (const [nome, { ativo }] of Object.entries(BANDAS)) {
    if (!item.assets?.[ativo]?.href || !item.assets?.[`${ativo}_xml`]?.href) throw falha(502, `A cena não traz a banda ${nome}.`)
    bandas[nome] = { url: comEmail(item.assets[ativo].href), urlXml: comEmail(item.assets[`${ativo}_xml`].href) }
  }

  // 2) cada banda: arquivo (por Range) e calibração
  const abrir = async ({ url }) => {
    const pedir = async (inicio, fim) => {
      const r = await buscar(url, { headers: { Range: `bytes=${inicio}-${fim}` } })
      if (r.status === 400 || r.status === 401 || r.status === 403) throw falha(502, 'O INPE recusou o acesso às bandas (confira o e-mail cadastrado).')
      if (r.status !== 206 && r.status !== 200) throw falha(502, `O INPE respondeu com erro ao ler a banda (HTTP ${r.status}).`)
      const todos = new Uint8Array(await r.arrayBuffer())
      if (r.status === 206) {
        const total = Number(/\/(\d+)$/.exec(r.headers.get('content-range') ?? '')?.[1])
        return { bytes: todos, total }
      }
      // Servidor ignorou o Range e mandou o arquivo todo: usa só o pedaço.
      return { bytes: todos.subarray(inicio, fim + 1), total: todos.length }
    }
    return abrirTiff(pedir)
  }
  const [tiffs, xmls] = await Promise.all([
    Promise.all(Object.values(bandas).map(abrir)),
    Promise.all(
      Object.values(bandas).map(async ({ urlXml }) => {
        const r = await buscar(urlXml)
        if (r.status === 400 || r.status === 401 || r.status === 403) throw falha(502, 'O INPE recusou o acesso às bandas (confira o e-mail cadastrado).')
        if (!r.ok) throw falha(502, `O INPE respondeu com erro ao ler os metadados (HTTP ${r.status}).`)
        return lerCalibracao(await r.text())
      }),
    ),
  ])
  const nomes = Object.keys(bandas)
  const tiff = Object.fromEntries(nomes.map((n, i) => [n, tiffs[i]]))
  const calibracao = Object.fromEntries(nomes.map((n, i) => [n, xmls[i]]))

  const ref = tiff.vermelho
  for (const n of nomes) {
    const t = tiff[n]
    if (t.largura !== ref.largura || t.altura !== ref.altura || t.georef.origemLeste !== ref.georef.origemLeste || t.georef.origemNorte !== ref.georef.origemNorte || t.georef.tamanhoX !== ref.georef.tamanhoX) {
      throw falha(502, 'As bandas da cena não têm a mesma grade.')
    }
  }
  const utmZona = zonaDoEpsg(ref.georef.epsg)
  if (!utmZona) throw falha(502, `Projeção ${ref.georef.epsg} não suportada (esperava UTM WGS84).`)
  const { zona, sul } = utmZona
  const { origemLeste, origemNorte, tamanhoX, tamanhoY } = ref.georef

  // 3) a janela do talhão, em pixels
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
      const cheio = new Uint8Array(colunas * linhas) // zero = sem dado
      for (let l = ll0; l < ll1; l++) {
        cheio.set(recorte.subarray((l - ll0) * (cc1 - cc0), (l - ll0 + 1) * (cc1 - cc0)), (l - l0) * colunas + (cc0 - c0))
      }
      dn[n] = cheio
    }),
  )

  // 4) pixel a pixel
  const distancia = distanciaTerraSol(dataDaCena)
  const fator = Object.fromEntries(
    nomes.map((n) => {
      const { numero } = BANDAS[n]
      const { coeficientes, elevacao } = calibracao[n]
      const coef = coeficientes[numero]
      if (!Number.isFinite(coef)) throw falha(502, `Sem coeficiente de calibração para a banda ${numero}.`)
      return [n, (dnValor) => reflectanciaTopo(dnValor, coef, ESUN[n], distancia, elevacao)]
    }),
  )

  const total = colunas * linhas
  const mascara = new Uint8Array(total)
  const saida = { ndvi: new Int16Array(total).fill(SEM_VALOR), evi: new Int16Array(total).fill(SEM_VALOR), savi: new Int16Array(total).fill(SEM_VALOR), ndwi: new Int16Array(total).fill(SEM_VALOR) }
  const validos = { ndvi: [], evi: [], savi: [], ndwi: [] }
  const quantizar = (v) => (v === null || !Number.isFinite(v) ? SEM_VALOR : Math.max(-32000, Math.min(32000, Math.round(v * ESCALA))))
  let noTalhao = 0
  let nuvens = 0
  let semDado = 0

  for (let l = 0; l < linhas; l++) {
    const y = origemNorte - (l0 + l + 0.5) * tamanhoY
    for (let c = 0; c < colunas; c++) {
      const x = origemLeste + (c0 + c + 0.5) * tamanhoX
      if (!dentroDoPoligono(x, y, aneisUtm.flat(1))) continue // PIXEL.FORA = 0
      const i = l * colunas + c
      noTalhao++
      if (!dn.azul[i] || !dn.verde[i] || !dn.vermelho[i] || !dn.nir[i]) {
        mascara[i] = PIXEL.SEM_DADO
        semDado++
        continue
      }
      const a = fator.azul(dn.azul[i])
      const g = fator.verde(dn.verde[i])
      const r = fator.vermelho(dn.vermelho[i])
      const nir = fator.nir(dn.nir[i])
      const ehNuvem = a > LIMIAR_NUVEM && g > LIMIAR_NUVEM && r > LIMIAR_NUVEM
      mascara[i] = ehNuvem ? PIXEL.NUVEM : PIXEL.VALIDO
      if (ehNuvem) nuvens++

      const valores = { ndvi: ndvi(nir, r), evi: evi(nir, r, a), savi: savi(nir, r), ndwi: ndwi(g, nir) }
      for (const k of Object.keys(valores)) {
        saida[k][i] = quantizar(valores[k])
        // Só pixel válido (nem nuvem, nem sem dado) entra nas estatísticas.
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
    cena: { id: cenaId, data: dataDaCena },
    janela: { colunas, linhas, tamanhoPixelM: tamanhoX, bbox: [oesteLng, sulLat, lesteLng, norteLat] },
    escala: ESCALA,
    semValor: SEM_VALOR,
    mascara: base64(mascara),
    indices: Object.fromEntries(Object.entries(saida).map(([k, v]) => [k, base64(v)])),
    estatisticas: Object.fromEntries(Object.entries(validos).map(([k, v]) => [k, estatisticas(v)])),
    qualidade: {
      pixelsNoTalhao: noTalhao,
      validos: noTalhao - nuvens - semDado,
      possivelNuvemPct: pct(nuvens),
      semDadoPct: pct(semDado),
    },
    calibracao: {
      tipo: 'reflectância no topo da atmosfera (sem correção atmosférica)',
      distanciaTerraSol: Math.round(distancia * 1e5) / 1e5,
      elevacaoSol: Math.round(calibracao.vermelho.elevacao * 100) / 100,
    },
  }
}
