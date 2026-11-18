import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { PARAMETROS, NIVEIS } from '../../config/parametros.js'
import { faixaDe, rotuloDaFaixa } from '../parametros.js'
import { faixasEfetivas } from '../criterios.js'
import { paraFeature, ehPonto, latLngDoPonto, areaEmHectares } from '../geo.js'
import { centroDaGleba } from '../fazendaExemplo.js'

/**
 * As linhas de cada parte da exportação, a partir dos dados da fazenda.
 * Puro (sem planilha, sem rede): `planilha.js` e `mapas.js` só formatam.
 *
 * `filtro`: { talhoes: Set|null, safras: Set|null, profundidades: Set|null }
 * — null = tudo.
 */

export const INDICES_SATELITE = ['ndvi', 'evi', 'savi', 'ndwi']

const passa = (conjunto, valor) => !conjunto || conjunto.has(valor)
const ordemCodigo = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })

/** Nível de um valor pelo critério em vigor: { rotulo, cor, nivel } ou null. */
export function interpretar(chave, valor, parametrosDoCriterio) {
  const faixas = faixasEfetivas(chave, parametrosDoCriterio)
  const faixa = faixas ? faixaDe(chave, valor, faixas) : null
  if (!faixa) return null
  return { nivel: faixa.nivel, rotulo: rotuloDaFaixa(faixa), cor: NIVEIS[faixa.nivel]?.cor ?? null }
}

/** Gleba que contém o ponto da análise (ou null). */
function glebaDaAnalise(analise, glebasDoTalhao) {
  const pos = latLngDoPonto(analise.geometria)
  if (!pos) return null
  const ponto = [pos[1], pos[0]]
  for (const g of glebasDoTalhao) {
    const f = paraFeature(g.geometria)
    if (!f?.geometry || ehPonto(f)) continue
    try {
      if (booleanPointInPolygon(ponto, f)) return g
    } catch {
      // Desenho com defeito: tenta a próxima.
    }
  }
  return null
}

export function montarExportacao({ fazenda, talhoes, glebas, analises, pontos, indices, fotos, parametrosDoCriterio, filtro, comparar }) {
  const talhoesSel = talhoes.filter((t) => passa(filtro.talhoes, t.id)).sort((a, b) => ordemCodigo(a.codigo, b.codigo))
  const idsTalhoes = new Set(talhoesSel.map((t) => t.id))
  const talhaoPorId = new Map(talhoes.map((t) => [t.id, t]))
  const glebasSel = glebas.filter((g) => idsTalhoes.has(g.talhao_id))
  const glebasDoTalhao = (id) => glebasSel.filter((g) => g.talhao_id === id)
  const pontosPorGleba = new Map()
  for (const p of pontos) if (p.gleba_id) pontosPorGleba.set(p.gleba_id, (pontosPorGleba.get(p.gleba_id) ?? 0) + 1)

  const analisesSel = analises
    .filter((a) => idsTalhoes.has(a.talhao_id) && passa(filtro.safras, a.ano_safra) && passa(filtro.profundidades, a.profundidade))
    .map((a) => ({ ...a, gleba: glebaDaAnalise(a, glebasDoTalhao(a.talhao_id)) }))

  // ---- Glebas: uma linha por gleba × safra × profundidade ----
  const linhasGlebas = []
  const glebasOrdenadas = [...glebasSel].sort(
    (a, b) => ordemCodigo(talhaoPorId.get(a.talhao_id)?.codigo, talhaoPorId.get(b.talhao_id)?.codigo) || ordemCodigo(a.codigo, b.codigo),
  )
  for (const g of glebasOrdenadas) {
    const centro = centroDaGleba(g.geometria)
    const base = {
      talhao: talhaoPorId.get(g.talhao_id)?.codigo ?? '',
      gleba: g.codigo,
      nome: g.nome ?? '',
      areaHa: g.area_ha != null ? Number(g.area_ha) : areaEmHectares(g.geometria),
      pontos: pontosPorGleba.get(g.id) ?? 0,
      lat: centro ? centro[1] : null,
      lng: centro ? centro[0] : null,
    }
    const dela = analisesSel.filter((a) => a.gleba?.id === g.id)
    if (dela.length === 0) {
      linhasGlebas.push({ ...base, safra: '', profundidade: '', analise: null })
      continue
    }
    for (const a of dela) linhasGlebas.push({ ...base, safra: a.ano_safra, profundidade: a.profundidade, analise: a })
  }
  linhasGlebas.sort((a, b) => ordemCodigo(a.talhao, b.talhao) || ordemCodigo(a.gleba, b.gleba) || String(b.safra).localeCompare(String(a.safra)) || ordemCodigo(a.profundidade, b.profundidade))

  // ---- Talhões ----
  const linhasTalhoes = talhoesSel.map((t) => {
    const deles = analisesSel.filter((a) => a.talhao_id === t.id)
    return {
      talhao: t.codigo,
      nome: t.nome ?? '',
      areaHa: t.area_ha != null ? Number(t.area_ha) : areaEmHectares(t.geometria),
      glebas: glebasDoTalhao(t.id).length,
      analises: deles.length,
      safras: [...new Set(deles.map((a) => a.ano_safra))].sort().join(', '),
    }
  })

  // ---- Análises (como lançadas) ----
  const linhasAnalises = [...analisesSel]
    .sort((a, b) => ordemCodigo(talhaoPorId.get(a.talhao_id)?.codigo, talhaoPorId.get(b.talhao_id)?.codigo) || String(b.ano_safra).localeCompare(String(a.ano_safra)) || ordemCodigo(a.gleba?.codigo ?? '', b.gleba?.codigo ?? ''))
    .map((a) => {
      const pos = latLngDoPonto(a.geometria)
      return {
        talhao: talhaoPorId.get(a.talhao_id)?.codigo ?? '',
        gleba: a.gleba?.codigo ?? '',
        safra: a.ano_safra,
        profundidade: a.profundidade,
        dataColeta: a.data_coleta ?? '',
        laboratorio: a.laboratorio ?? '',
        numero: a.numero_amostra_lab ?? '',
        origem: { manual: 'Digitada', pdf: 'Laudo PDF', importacao: 'Importada' }[a.origem] ?? a.origem ?? '',
        lat: pos ? pos[0] : null,
        lng: pos ? pos[1] : null,
        observacoes: a.observacoes ?? '',
        analise: a,
      }
    })

  // ---- Pontos de amostra ----
  const glebaPorId = new Map(glebas.map((g) => [g.id, g]))
  const linhasPontos = pontos
    .filter((p) => idsTalhoes.has(p.talhao_id))
    .map((p) => {
      const pos = latLngDoPonto(p.geometria)
      const prop = p.propriedades ?? {}
      return {
        talhao: talhaoPorId.get(p.talhao_id)?.codigo ?? '',
        gleba: glebaPorId.get(p.gleba_id)?.codigo ?? '',
        amostra: String(prop.amostra ?? prop.Amostra ?? prop.id ?? prop.ID ?? ''),
        lat: pos ? pos[0] : null,
        lng: pos ? pos[1] : null,
      }
    })
    .sort((a, b) => ordemCodigo(a.talhao, b.talhao) || ordemCodigo(a.gleba, b.gleba) || ordemCodigo(a.amostra, b.amostra))

  // ---- Satélite (resumos guardados) ----
  const linhasSatelite = indices
    .filter((i) => idsTalhoes.has(i.talhao_id))
    .map((i) => {
      const q = i.qualidade ?? {}
      return {
        talhao: talhaoPorId.get(i.talhao_id)?.codigo ?? '',
        data: i.data,
        satelite: i.fonte === 'cbers' ? 'CBERS-4A' : 'Sentinel-2',
        limpoPct: q.pixelsNoTalhao ? (q.validos / q.pixelsNoTalhao) * 100 : 0,
        estatisticas: i.estatisticas ?? {},
      }
    })
    .sort((a, b) => ordemCodigo(a.talhao, b.talhao) || Date.parse(a.data) - Date.parse(b.data))

  // ---- Comparação de safras (média por gleba e profundidade) ----
  const linhasComparacao = []
  if (comparar?.safraA && comparar?.safraB && comparar.safraA !== comparar.safraB) {
    const media = (lista, chave) => {
      const v = lista.map((a) => a[chave]).filter((x) => x != null && Number.isFinite(Number(x))).map(Number)
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
    }
    for (const g of glebasOrdenadas) {
      for (const prof of [...new Set(analisesSel.filter((a) => a.gleba?.id === g.id).map((a) => a.profundidade))].sort(ordemCodigo)) {
        const deA = analises.filter((a) => a.talhao_id === g.talhao_id && a.ano_safra === comparar.safraA && a.profundidade === prof && glebaDaAnalise(a, [g]))
        const deB = analises.filter((a) => a.talhao_id === g.talhao_id && a.ano_safra === comparar.safraB && a.profundidade === prof && glebaDaAnalise(a, [g]))
        if (!deA.length || !deB.length) continue
        for (const p of PARAMETROS) {
          const a = media(deA, p.chave)
          const b = media(deB, p.chave)
          if (a == null || b == null) continue
          linhasComparacao.push({
            talhao: talhaoPorId.get(g.talhao_id)?.codigo ?? '',
            gleba: g.codigo,
            profundidade: prof,
            parametro: p,
            a,
            b,
            variacao: b - a,
            variacaoPct: a !== 0 ? ((b - a) / Math.abs(a)) * 100 : null,
          })
        }
      }
    }
  }

  // ---- Critérios ----
  const linhasCriterios = PARAMETROS.map((p) => ({ parametro: p, faixas: faixasEfetivas(p.chave, parametrosDoCriterio) }))

  // ---- Fotos ----
  const fotosSel = fotos
    .filter((f) => glebasSel.some((g) => g.id === f.gleba_id) && passa(filtro.safras, f.ano_safra) && passa(filtro.profundidades, f.profundidade))
    .map((f) => {
      const g = glebaPorId.get(f.gleba_id)
      return { ...f, gleba: g?.codigo ?? '', talhao: talhaoPorId.get(g?.talhao_id)?.codigo ?? '' }
    })

  return {
    fazenda,
    talhoes: talhoesSel,
    glebas: glebasOrdenadas,
    linhasGlebas,
    linhasTalhoes,
    linhasAnalises,
    linhasPontos,
    linhasSatelite,
    linhasComparacao,
    linhasCriterios,
    fotos: fotosSel,
    totais: {
      talhoes: talhoesSel.length,
      glebas: glebasSel.length,
      analises: analisesSel.length,
      pontos: linhasPontos.length,
      imagensSatelite: linhasSatelite.length,
      fotos: fotosSel.length,
    },
  }
}
