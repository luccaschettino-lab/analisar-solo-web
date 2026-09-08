import area from '@turf/area'
import booleanWithin from '@turf/boolean-within'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import difference from '@turf/difference'
import { featureCollection } from '@turf/helpers'

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
 * Quanto da gleba escapa do talhao, e se isso e aceitavel.
 *
 * Ate aqui a resposta era so "dentro ou fora", e o cadastro apenas avisava.
 * Passou a bloquear, a pedido do responsavel — o que inverte a decisao da
 * Fase 2, registrada em docs/decisoes.md. Mas bloquear pela regra estrita
 * tornaria impossivel cadastrar a gleba desenhada rente a divisa, que e caso
 * legitimo e comum: o snap gruda o vertice na borda do talhao e um fio de
 * ponto flutuante o joga para fora.
 *
 * Por isso a resposta agora tem tres situacoes, e nao duas:
 *
 *   - `dentro`          — cabe inteira, ou o que escapa e irrisorio
 *   - `fora`            — escapa o bastante para ser erro de verdade
 *   - `nao_verificavel` — talhao sem geometria, ou desenho degenerado
 *
 * **`nao_verificavel` nunca bloqueia.** Nao saber conferir e diferente de
 * saber que esta errado, e impedir o cadastro por causa da propria
 * incapacidade de medir seria trocar um problema do sistema por um problema
 * do usuario.
 */

/** Fracao da area da gleba que pode ficar fora sem ser considerada erro. */
export const TOLERANCIA_FORA = 0.01

export const CONTENCAO = {
  DENTRO: 'dentro',
  FORA: 'fora',
  NAO_VERIFICAVEL: 'nao_verificavel',
}

export function avaliarContencao(geoGleba, geoTalhao) {
  const semResposta = { situacao: CONTENCAO.NAO_VERIFICAVEL, fracaoFora: null, areaForaHa: null }

  const gleba = paraFeature(geoGleba)
  const talhao = paraFeature(geoTalhao)
  if (!gleba || !talhao) return semResposta

  const tipoTalhao = talhao.geometry?.type
  if (tipoTalhao !== 'Polygon' && tipoTalhao !== 'MultiPolygon') return semResposta

  try {
    // Ponto nao tem area: ou esta dentro, ou nao esta. Nao ha meio termo a
    // tolerar — um ponto de coleta fora do talhao e sempre engano.
    if (gleba.geometry?.type === 'Point') {
      return booleanPointInPolygon(gleba, talhao)
        ? { situacao: CONTENCAO.DENTRO, fracaoFora: 0, areaForaHa: 0 }
        : { situacao: CONTENCAO.FORA, fracaoFora: 1, areaForaHa: null }
    }

    if (booleanWithin(gleba, talhao)) {
      return { situacao: CONTENCAO.DENTRO, fracaoFora: 0, areaForaHa: 0 }
    }

    // O que sobra da gleba depois de recortar o talhao e, literalmente, a
    // parte que escapou. Medi-la e o que separa "encostou na cerca" de
    // "desenhou no talhao errado".
    const areaGleba = area(gleba)
    if (!Number.isFinite(areaGleba) || areaGleba <= 0) return semResposta

    const sobra = difference(featureCollection([gleba, talhao]))
    // Sem sobra: o recorte nao deixou nada fora. Acontece quando as bordas
    // coincidem e o booleanWithin reprovou por arredondamento — exatamente o
    // caso que esta funcao existe para nao punir.
    if (!sobra) return { situacao: CONTENCAO.DENTRO, fracaoFora: 0, areaForaHa: 0 }

    const areaFora = area(sobra)
    if (!Number.isFinite(areaFora)) return semResposta

    const fracaoFora = areaFora / areaGleba
    return {
      situacao: fracaoFora <= TOLERANCIA_FORA ? CONTENCAO.DENTRO : CONTENCAO.FORA,
      fracaoFora,
      areaForaHa: Math.round((areaFora / 10000) * 100) / 100,
    }
  } catch {
    // Geometria degenerada (auto-intersecao, anel aberto) faz o turf lancar.
    // Nao e motivo para impedir o cadastro.
    return semResposta
  }
}

/**
 * A gleba esta dentro do talhao? `true`, `false` ou `null` (nao verificavel).
 *
 * Mantida porque o cadastro em lote so precisa do sim ou nao — la sao pontos,
 * e ponto nao tem divisa para tolerar.
 */
export function glebaDentroDoTalhao(geoGleba, geoTalhao) {
  const { situacao } = avaliarContencao(geoGleba, geoTalhao)
  if (situacao === CONTENCAO.NAO_VERIFICAVEL) return null
  return situacao === CONTENCAO.DENTRO
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

/**
 * Área (com sinal) e centroide de um anel, pela fórmula do shoelace.
 *
 * Área com sinal porque o centroide correto depende dela — dividir pelo
 * módulo desloca o ponto. Um anel degenerado (linha ou ponto repetido) dá
 * área zero; nesse caso cai na média simples dos vértices em vez de dividir
 * por zero.
 */
function areaEcentroideDoAnel(anel) {
  let areaAcc = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < anel.length - 1; i++) {
    const [x0, y0] = anel[i]
    const [x1, y1] = anel[i + 1]
    const cruz = x0 * y1 - x1 * y0
    areaAcc += cruz
    cx += (x0 + x1) * cruz
    cy += (y0 + y1) * cruz
  }
  areaAcc /= 2

  if (areaAcc === 0) {
    const pontos = anel.slice(0, -1)
    const n = pontos.length || 1
    const soma = pontos.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0])
    return { area: 0, centro: [soma[0] / n, soma[1] / n] }
  }

  return { area: Math.abs(areaAcc), centro: [cx / (6 * areaAcc), cy / (6 * areaAcc)] }
}

/**
 * Ponto onde ancorar o rótulo fixo de um talhão ou gleba — sempre dentro da
 * forma, nunca no vazio entre partes.
 *
 * O `direction: 'center'` do Leaflet usa o centro da caixa delimitadora, não
 * o centroide de verdade. Para um polígono simples isso quase sempre cai
 * dentro dele mesmo, mas um talhão mesclado (`combinarGeometrias`) ou uma
 * gleba que saiu em pedaços do recorte contra o talhão viram MultiPolygon
 * com partes bem separadas — aí a caixa delimitadora do conjunto cobre o
 * vão entre elas, e o rótulo flutua fora de qualquer parte, ou gruda na
 * borda de uma só. Por isso o cálculo aqui: pelo shoelace, direto, sem
 * depender do que o Leaflet decide internamente.
 *
 * Para MultiPolygon, ancora no maior pedaço — é o que o olho lê como "a
 * geometria", o resto é sobra do recorte.
 */
export function pontoRotulo(geoJson) {
  const f = paraFeature(geoJson)
  const geometry = f?.geometry
  if (!geometry) return null

  if (geometry.type === 'Point') return latLngDoPonto(f)

  if (geometry.type === 'Polygon') {
    const anel = geometry.coordinates?.[0]
    if (!anel?.length) return null
    const { centro } = areaEcentroideDoAnel(anel)
    return [centro[1], centro[0]]
  }

  if (geometry.type === 'MultiPolygon') {
    let melhor = null
    for (const poligono of geometry.coordinates ?? []) {
      const anel = poligono?.[0]
      if (!anel?.length) continue
      const resultado = areaEcentroideDoAnel(anel)
      if (!melhor || resultado.area > melhor.area) melhor = resultado
    }
    if (!melhor) return null
    return [melhor.centro[1], melhor.centro[0]]
  }

  return null
}

/**
 * Combina geometrias de área (Polygon ou MultiPolygon) numa MultiPolygon só
 * — usado ao mesclar talhões.
 *
 * Não é um "dissolve" geométrico: não redesenha a fronteira comum entre
 * polígonos vizinhos, só empilha os anéis de todos numa feature e num
 * registro só. Foi a escolha certa aqui — os talhões que motivaram isso
 * (o mesmo Lote do produtor, dividido em pedaços vizinhos com códigos
 * "10", "10-2", "10-3") não se sobrepõem nem encostam perfeitamente, então
 * um dissolve de verdade exigiria uma lib de topologia e ainda arriscaria
 * quebrar em polígonos com milhares de vértices vindos de KML.
 */
export function combinarGeometrias(geometrias) {
  const poligonos = []
  for (const g of geometrias) {
    const geometry = paraFeature(g)?.geometry
    if (!geometry) continue
    if (geometry.type === 'Polygon') poligonos.push(geometry.coordinates)
    else if (geometry.type === 'MultiPolygon') poligonos.push(...geometry.coordinates)
  }
  if (poligonos.length === 0) return null

  return {
    type: 'Feature',
    properties: {},
    geometry:
      poligonos.length === 1
        ? { type: 'Polygon', coordinates: poligonos[0] }
        : { type: 'MultiPolygon', coordinates: poligonos },
  }
}
