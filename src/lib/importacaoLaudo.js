import { latLngDoPonto, pontoFeature } from './geo.js'
import { montarPayload } from './payloadAnalise.js'

/**
 * Da amostra lida no laudo à análise que será gravada: qual gleba, qual
 * talhão, onde fica no mapa, e se vale a pena gravar.
 *
 * O laudo diz "Gleba 55": o número da referência do cliente. No app, a gleba é
 * `talhão-55` (ou só `55`), então o candidato é a gleba cujo código TERMINA em
 * 55. Se a mesma numeração existe em mais de um talhão, vale a gleba com mais
 * pontos de coleta ligados; empate não se decide sozinho, e quem escolhe é a
 * pessoa. Nunca se grava com uma gleba adivinhada: sem gleba escolhida a linha
 * fica de fora até alguém confirmar.
 *
 * A análise precisa de um ponto no mapa (é o que pinta o mapa de calor). Para
 * uma amostra composta, é a média dos pontos de coleta da gleba.
 */

export const STATUS = {
  PRONTA: 'pronta',
  SEM_GLEBA: 'sem_gleba',
  AMBIGUA: 'ambigua',
  SEM_PONTO: 'sem_ponto',
  SEM_PROFUNDIDADE: 'sem_profundidade',
  DUPLICADA: 'duplicada',
}

const PROFUNDIDADES_VALIDAS = ['0-20', '20-40', '40-60', 'outro']

/** Chave que identifica uma análise já gravada, para não gravar a mesma duas vezes. */
export function chaveDeDuplicidade({ talhaoId, anoSafra, profundidade, numeroAmostraLab }) {
  return JSON.stringify([talhaoId, String(anoSafra).trim(), profundidade, String(numeroAmostraLab ?? '').trim()])
}

function candidatasDaGleba(numero, glebas) {
  if (numero == null) return []
  const termina = new RegExp(`(^|-)${numero}$`)
  return glebas.filter((g) => termina.test(String(g.codigo).trim()))
}

function mediaDosPontos(pontosDaGleba) {
  const posicoes = pontosDaGleba.map((p) => latLngDoPonto(p.geometria)).filter(Boolean)
  if (posicoes.length === 0) return null
  const lat = posicoes.reduce((s, [la]) => s + la, 0) / posicoes.length
  const lng = posicoes.reduce((s, [, ln]) => s + ln, 0) / posicoes.length
  return pontoFeature(lat, lng)
}

// Gleba sem pontos de coleta ligados: cai no desenho dela (o próprio ponto, ou
// a média dos vértices do contorno).
function pontoDoDesenho(gleba) {
  const g = gleba.geometria?.geometry ?? gleba.geometria
  if (!g) return null
  if (g.type === 'Point') return pontoFeature(g.coordinates[1], g.coordinates[0])
  const anel = g.type === 'Polygon' ? g.coordinates?.[0] : g.type === 'MultiPolygon' ? g.coordinates?.[0]?.[0] : null
  if (!anel?.length) return null
  // O último vértice repete o primeiro; fora da média para não pesar duas vezes.
  const vertices = anel.length > 1 ? anel.slice(0, -1) : anel
  const lng = vertices.reduce((s, v) => s + v[0], 0) / vertices.length
  const lat = vertices.reduce((s, v) => s + v[1], 0) / vertices.length
  return pontoFeature(lat, lng)
}

/**
 * Uma amostra do laudo, resolvida contra a fazenda aberta.
 *
 * `escolhas` são as correções feitas na tela: `glebaId` e `profundidade`
 * valem mais que a detecção automática.
 */
export function resolverAmostraDoLaudo(amostra, escolhas, contexto) {
  const { glebas, pontos, anoSafra, existentes } = contexto

  const candidatas = candidatasDaGleba(amostra.gleba, glebas)
  const pontosPorGleba = (id) => pontos.filter((p) => p.gleba_id === id)
  const comContagem = candidatas.map((g) => ({ gleba: g, quantidade: pontosPorGleba(g.id).length }))

  let glebaEscolhida = null
  let motivo = null
  if (escolhas?.glebaId) {
    glebaEscolhida = glebas.find((g) => g.id === escolhas.glebaId) ?? null
  } else if (comContagem.length === 1) {
    glebaEscolhida = comContagem[0].gleba
  } else if (comContagem.length > 1) {
    const maior = Math.max(...comContagem.map((c) => c.quantidade))
    const empatadas = comContagem.filter((c) => c.quantidade === maior)
    if (empatadas.length === 1 && maior > 0) {
      glebaEscolhida = empatadas[0].gleba
      motivo = `A numeração ${amostra.gleba} existe em ${comContagem.length} talhões; escolhida a gleba com mais pontos de coleta (${maior}).`
    }
  }

  const profundidade = escolhas?.profundidade ?? amostra.profundidade
  const base = { amostra, candidatas: comContagem.map((c) => c.gleba), gleba: glebaEscolhida, profundidade, motivo, geometria: null }

  if (!profundidade || !PROFUNDIDADES_VALIDAS.includes(profundidade)) return { ...base, status: STATUS.SEM_PROFUNDIDADE }
  if (!glebaEscolhida) {
    return { ...base, status: comContagem.length > 1 ? STATUS.AMBIGUA : STATUS.SEM_GLEBA }
  }

  const geometria = mediaDosPontos(pontosPorGleba(glebaEscolhida.id)) ?? pontoDoDesenho(glebaEscolhida)
  if (!geometria) return { ...base, status: STATUS.SEM_PONTO }

  const resolvida = { ...base, geometria, talhaoId: glebaEscolhida.talhao_id }
  const chave = chaveDeDuplicidade({
    talhaoId: glebaEscolhida.talhao_id,
    anoSafra,
    profundidade,
    numeroAmostraLab: amostra.n_lab,
  })
  if (existentes?.has(chave)) return { ...resolvida, status: STATUS.DUPLICADA }

  return { ...resolvida, status: STATUS.PRONTA }
}

/** O que vai para a tabela `analises`, pela mesma montagem da entrada manual. */
export function payloadDaAmostra(resolvida, { anoSafra, laboratorio, solicitacao }) {
  const { amostra } = resolvida
  const payload = montarPayload({
    talhaoId: resolvida.talhaoId,
    geometria: resolvida.geometria,
    anoSafra,
    profundidade: resolvida.profundidade,
    dataColeta: null, // o laudo traz a data de entrada no laboratório, não a da coleta
    laboratorio,
    numeroAmostraLab: amostra.n_lab,
    observacoes: `Laudo UFV${solicitacao ? ` ${solicitacao}` : ''} - ${amostra.referencia || `Gleba ${amostra.gleba}`}`,
    valores: amostra.parametros,
  })
  return {
    ...payload,
    origem: 'pdf',
    // O que o laudo mede e o app não tem coluna própria (pH KCl, Na, N, metais pesados...).
    extras: amostra.extras ?? {},
  }
}
