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
