/**
 * Regras do monitoramento de pragas, sem tela nem banco (testes/pragas.mjs).
 *
 * Vistoria = vários pontos; em cada ponto, zero ou mais registros (uma praga
 * e o valor medido). O valor do talhão para uma praga é a média de TODOS os
 * pontos da vistoria: ponto onde ela não foi registrada conta como zero, como
 * no MIP (média da lavoura).
 */
import { PRAGAS_REFERENCIA } from '../config/pragas.js'

// ---------- Lista de pragas da fazenda ----------

/**
 * Referência + o que a fazenda mudou ou acrescentou (mesma chave substitui).
 * Devolve todas, inclusive as desligadas (`ativa: false`), na ordem da
 * referência e depois as da fazenda por nome. `ajustada` marca o que a
 * fazenda mexeu; `propria` o que só existe nela.
 */
export function listaDaFazenda(ajustes = []) {
  const porChave = new Map(ajustes.map((a) => [a.chave, a]))
  const lista = PRAGAS_REFERENCIA.map((ref) => {
    const a = porChave.get(ref.chave)
    if (!a) return { ...ref, ajustada: false, propria: false }
    porChave.delete(ref.chave)
    return {
      ...ref,
      nome: a.nome ?? ref.nome,
      tipo: a.tipo ?? ref.tipo,
      metodo: a.metodo ?? ref.metodo,
      controle: a.controle ?? null,
      controle_reprodutivo: a.controle_reprodutivo ?? null,
      ativa: a.ativa !== false,
      ajustada: true,
      propria: false,
      referencia: ref,
    }
  })
  const proprias = [...porChave.values()]
    .map((a) => ({
      chave: a.chave,
      cultura: a.cultura,
      tipo: a.tipo,
      nome: a.nome,
      metodo: a.metodo,
      controle: a.controle ?? null,
      controle_reprodutivo: a.controle_reprodutivo ?? null,
      ativa: a.ativa !== false,
      ajustada: false,
      propria: true,
    }))
    .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
  return [...lista, ...proprias]
}

/** Chave para uma praga criada pela fazenda: cultura + nome sem acento. */
export function chaveNova(cultura, nome, existentes = []) {
  const base = `${cultura}-${nome}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52)
  const usadas = new Set(existentes)
  if (!usadas.has(base)) return base
  for (let i = 2; ; i++) if (!usadas.has(`${base}-${i}`)) return `${base}-${i}`
}

// ---------- Fase e nível ----------

/** Soja de R1 em diante é reprodutiva; o resto (e o café) não muda nível. */
export function faseDoEstadio(cultura, estadio) {
  if (cultura !== 'soja' || !estadio) return 'vegetativo'
  return /^\s*R\d/i.test(estadio) ? 'reprodutivo' : 'vegetativo'
}

/** Nível de controle para a fase, no método da praga. Nulo = sem nível. */
export function nivelDeControle(praga, fase) {
  if (!praga) return null
  if (fase === 'reprodutivo' && praga.controle_reprodutivo != null) return Number(praga.controle_reprodutivo)
  return praga.controle != null ? Number(praga.controle) : null
}

/** "Perto do limite" começa em 70% do nível de controle. */
export const FRACAO_ALERTA = 0.7

// ---------- Valor e semáforo ----------

/** Valor de um registro, na unidade do método (por metro, %, 0/1, 1-3). */
export function valorDoRegistro(r) {
  const v = Number(r.valor)
  if (!Number.isFinite(v)) return null
  if (r.metodo === 'pano') return v / (Number(r.amostra) > 0 ? Number(r.amostra) : 1)
  if (r.metodo === 'contagem') return Number(r.amostra) > 0 ? (v / Number(r.amostra)) * 100 : null
  return v
}

export const STATUS = {
  controle: { rotulo: 'Agir', descricao: 'Passou do nível de controle', ordem: 3, cor: '#b91c1c' },
  alerta: { rotulo: 'Atenção', descricao: 'Perto do nível de controle', ordem: 2, cor: '#ca8a04' },
  ok: { rotulo: 'Tranquilo', descricao: 'Abaixo do nível de controle', ordem: 1, cor: '#15803d' },
  'sem-nivel': { rotulo: 'Sem nível', descricao: 'Registrado, sem nível de controle definido', ordem: 0, cor: '#64748b' },
}

/**
 * Semáforo de um valor. Nota visual: a própria nota. Os demais: comparado ao
 * nível de controle — só quando o valor foi medido no mesmo método do nível.
 */
export function statusDoValor(valor, metodo, praga, fase) {
  if (valor == null) return 'sem-nivel'
  if (metodo === 'nota') return valor >= 3 ? 'controle' : valor >= 2 ? 'alerta' : 'ok'
  const nivel = praga && praga.metodo === metodo ? nivelDeControle(praga, fase) : null
  if (nivel == null) return 'sem-nivel'
  if (nivel === 0) return valor > 0 ? 'controle' : 'ok'
  if (valor >= nivel) return 'controle'
  if (valor >= nivel * FRACAO_ALERTA) return 'alerta'
  return 'ok'
}

/** Pontos da vistoria: número → { ponto, lat, lng }. */
export function pontosDaVistoria(registros) {
  const pontos = new Map()
  for (const r of registros) if (!pontos.has(r.ponto)) pontos.set(r.ponto, { ponto: r.ponto, lat: r.lat, lng: r.lng })
  return [...pontos.values()].sort((a, b) => a.ponto - b.ponto)
}

/**
 * Resumo de uma vistoria: uma linha por praga (e método) encontrada, com o
 * valor do talhão, o semáforo e em quantos pontos apareceu. Ordenado do
 * mais grave para o menos.
 *
 * Valor do talhão: média de todos os pontos (ausente = 0) para pano,
 * contagem e % estimada; presença = achou em algum ponto (1/0); nota = a
 * pior nota (o pior ponto é o que decide).
 */
export function resumoDaVistoria(registros, pragas, fase) {
  const pontos = pontosDaVistoria(registros)
  const total = pontos.length
  const porPraga = new Map()
  for (const r of registros) {
    if (!r.praga) continue
    const chave = `${r.praga}|${r.metodo}`
    if (!porPraga.has(chave)) porPraga.set(chave, { praga: r.praga, metodo: r.metodo, porPonto: new Map() })
    const v = valorDoRegistro(r)
    if (v == null) continue
    const g = porPraga.get(chave)
    // Dois registros da mesma praga no mesmo ponto: vale o maior.
    g.porPonto.set(r.ponto, Math.max(g.porPonto.get(r.ponto) ?? 0, v))
  }
  const indice = new Map(pragas.map((p) => [p.chave, p]))
  const linhas = [...porPraga.values()].map((g) => {
    const valores = [...g.porPonto.values()]
    const soma = valores.reduce((a, b) => a + b, 0)
    let valor
    if (g.metodo === 'presenca') valor = valores.some((v) => v > 0) ? 1 : 0
    else if (g.metodo === 'nota') valor = valores.length ? Math.max(...valores) : null
    else valor = total > 0 ? soma / total : null
    const praga = indice.get(g.praga) ?? null
    const status = statusDoValor(valor, g.metodo, praga, fase)
    return {
      praga: g.praga,
      nome: praga?.nome ?? g.praga,
      tipo: praga?.tipo ?? 'praga',
      metodo: g.metodo,
      valor,
      maximo: valores.length ? Math.max(...valores) : null,
      nivel: praga && praga.metodo === g.metodo ? nivelDeControle(praga, fase) : null,
      pontosCom: valores.filter((v) => v > 0).length,
      pontos: total,
      status,
    }
  })
  return linhas.sort(
    (a, b) => STATUS[b.status].ordem - STATUS[a.status].ordem || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

/** O pior semáforo de uma lista de linhas do resumo ('ok' se vazia). */
export function piorStatus(linhas) {
  let pior = 'ok'
  for (const l of linhas) if (STATUS[l.status].ordem > STATUS[pior].ordem) pior = l.status
  return pior
}

/** Texto do valor: "1,5/m", "12%", "Presente", "Médio". */
export function formatarValor(valor, metodo) {
  if (valor == null) return '—'
  if (metodo === 'presenca') return valor > 0 ? 'Presente' : 'Ausente'
  if (metodo === 'nota') return ['—', 'Baixo', 'Médio', 'Alto'][Math.round(valor)] ?? '—'
  const n = valor.toLocaleString('pt-BR', { maximumFractionDigits: valor < 10 ? 1 : 0 })
  return metodo === 'pano' ? `${n}/m` : `${n}%`
}

// ---------- Mapa de calor ----------

/**
 * Valor de uma praga em cada ponto da vistoria (zero onde não foi
 * registrada), para o mapa: [{ ponto, lat, lng, valor }].
 */
export function valoresPorPonto(registros, praga, metodo) {
  const pontos = pontosDaVistoria(registros)
  const valores = new Map()
  for (const r of registros) {
    if (r.praga !== praga || r.metodo !== metodo) continue
    const v = valorDoRegistro(r)
    if (v != null) valores.set(r.ponto, Math.max(valores.get(r.ponto) ?? 0, v))
  }
  return pontos.map((p) => ({ ...p, valor: valores.get(p.ponto) ?? 0 }))
}

/**
 * Interpolação pelo inverso da distância (IDW, potência 2) num ponto
 * qualquer. Distância plana com a longitude encolhida pelo cosseno da
 * latitude — num talhão, a diferença para a distância real é desprezível.
 */
export function interpolarIdw(pontos, lat, lng, potencia = 2) {
  const k = Math.cos((lat * Math.PI) / 180)
  let somaPesos = 0
  let somaValores = 0
  for (const p of pontos) {
    const dx = (p.lng - lng) * k
    const dy = p.lat - lat
    const d2 = dx * dx + dy * dy
    if (d2 < 1e-18) return p.valor
    const w = 1 / Math.pow(d2, potencia / 2)
    somaPesos += w
    somaValores += w * p.valor
  }
  return somaPesos > 0 ? somaValores / somaPesos : null
}

/**
 * Cor do mapa de calor. Com nível de controle: verde → amarelo (70%) →
 * vermelho (no nível e acima). Sem nível: um tom só, do claro (zero) ao
 * escuro (o maior valor da vistoria).
 */
export function corDoCalor(valor, { nivel, maximo, metodo }) {
  if (metodo === 'nota') nivel = 3
  if (metodo === 'presenca') nivel = 1
  if (nivel != null && nivel > 0) {
    const t = valor / nivel
    if (t <= 0) return [21, 128, 61]
    if (t < FRACAO_ALERTA) return misturar([21, 128, 61], [234, 179, 8], t / FRACAO_ALERTA)
    if (t < 1) return misturar([234, 179, 8], [185, 28, 28], (t - FRACAO_ALERTA) / (1 - FRACAO_ALERTA))
    return [185, 28, 28]
  }
  const t = maximo > 0 ? Math.min(1, valor / maximo) : 0
  return misturar([224, 231, 255], [67, 56, 202], t)
}

function misturar(a, b, t) {
  return a.map((x, i) => Math.round(x + (b[i] - x) * t))
}
