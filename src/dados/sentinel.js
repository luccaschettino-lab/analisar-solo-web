import booleanIntersects from '@turf/boolean-intersects'
import booleanContains from '@turf/boolean-contains'
import { supabase } from '../lib/supabase.js'
import { bboxDaGeometria } from '../lib/geo.js'

export { bboxDaGeometria }

/**
 * Sentinel-2 L2A pelo Earth Search (catálogo STAC público da AWS, sem
 * cadastro). Passa a cada 2–5 dias e tem pixel de 10 m — é o que dá imagem
 * semanal ao Monitoramento. Único satélite desde 18/11/2026 (o CBERS-4A saiu).
 */

const BUSCA = 'https://earth-search.aws.element84.com/v1/search'
const MESES_DE_HISTORICO = 12
const LIMITE = 500

function comoFeature(geoJson) {
  if (geoJson?.type === 'Feature') return geoJson
  if (geoJson?.type === 'Polygon' || geoJson?.type === 'MultiPolygon') return { type: 'Feature', properties: {}, geometry: geoJson }
  return null
}


function cenaValida(item) {
  const data = item?.properties?.datetime
  const bbox = item?.bbox
  if (typeof data !== 'string' || !Number.isFinite(Date.parse(data))) return null
  if (!/^S2[A-D]_\d{2}[A-Z]{3}_\d{8}_\d{1,2}_L2A$/.test(item.id ?? '')) return null
  if (!Array.isArray(bbox) || bbox.length !== 4 || !['Polygon', 'MultiPolygon'].includes(item.geometry?.type)) return null
  const [oeste, sul, leste, norte] = bbox.map(Number)
  const nuvens = Number(item.properties['eo:cloud_cover'])
  return {
    id: item.id,
    data,
    nuvens: Number.isFinite(nuvens) && nuvens >= 0 && nuvens <= 100 ? nuvens : null,
    geometria: item.geometry,
    limites: [[sul, oeste], [norte, leste]],
    previa: item.assets?.thumbnail?.href ?? null,
  }
}

/**
 * Cenas dos últimos 12 meses que cruzam o talhão, da mais antiga para a mais
 * nova. Quando o talhão fica na beira de dois ladrilhos do Sentinel, o mesmo
 * dia aparece duas vezes: fica a cena que contém o talhão inteiro (ou, se
 * nenhuma contém, a de menos nuvem).
 */
export async function listarCenasSentinel(bbox, geometriaTalhao, signal) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite) || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) {
    throw new Error('Área inválida para consultar cenas do Sentinel-2.')
  }
  const talhao = comoFeature(geometriaTalhao)
  if (!talhao || !['Polygon', 'MultiPolygon'].includes(talhao.geometry?.type)) {
    throw new Error('Selecione um talhão com geometria de área para consultar as imagens.')
  }

  const fim = new Date()
  const inicio = new Date(fim)
  inicio.setMonth(inicio.getMonth() - MESES_DE_HISTORICO)
  const resposta = await fetch(BUSCA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      bbox,
      datetime: `${inicio.toISOString()}/${fim.toISOString()}`,
      limit: LIMITE,
      fields: { include: ['id', 'bbox', 'geometry', 'properties.datetime', 'properties.eo:cloud_cover', 'assets.thumbnail.href'], exclude: ['links'] },
    }),
    signal,
  })
  if (!resposta.ok) throw new Error(`O catálogo do Sentinel-2 respondeu com erro (HTTP ${resposta.status}).`)
  const dados = await resposta.json()
  if (!Array.isArray(dados?.features)) throw new Error('O catálogo do Sentinel-2 retornou uma resposta inválida.')

  const porDia = new Map()
  for (const cena of dados.features.map(cenaValida).filter(Boolean)) {
    const feature = comoFeature(cena.geometria)
    if (!booleanIntersects(talhao, feature)) continue
    let contem = false
    try {
      contem = booleanContains(feature, talhao)
    } catch {
      // Geometria que o turf não sabe comparar: conta como "não contém".
    }
    const dia = cena.data.slice(0, 10)
    const atual = porDia.get(dia)
    const melhor =
      !atual ||
      (contem && !atual.contem) ||
      (contem === atual.contem && (cena.nuvens ?? 101) < (atual.cena.nuvens ?? 101))
    if (melhor) porDia.set(dia, { cena, contem })
  }
  return [...porDia.values()].map((v) => v.cena).sort((a, b) => Date.parse(a.data) - Date.parse(b.data))
}

/** Índices do talhão numa cena Sentinel-2, calculados na função `sentinel-indice`. */
export async function calcularIndicesSentinel(cenaId, geometria) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase.functions.invoke('sentinel-indice', { body: { cenaId, geometria } })
  if (error) {
    let mensagem = 'Não foi possível calcular os índices desta imagem.'
    try {
      const corpo = await error.context?.json?.()
      if (corpo?.erro) mensagem = corpo.erro
    } catch {
      // Sem corpo legível: fica a mensagem genérica.
    }
    throw new Error(mensagem)
  }
  if (data?.erro) throw new Error(data.erro)
  return data
}
