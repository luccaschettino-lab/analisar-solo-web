import { areaEmHectares, pontoFeature } from './geo.js'

/**
 * Fazenda de exemplo: dados FICTÍCIOS para quem está começando ver o site
 * funcionando antes de cadastrar a própria fazenda.
 *
 * Tudo aqui é determinístico (gerador com semente fixa): duas fazendas de
 * exemplo saem iguais, e os testes conferem números exatos. Nada disto grava
 * no banco — quem grava é `dados/fazendaExemplo.js`, pelos mesmos caminhos que
 * o produtor usa (talhão, pontos de amostra, glebas automáticas, análises).
 *
 * O desenho: quatro talhões retangulares de ~85 ha numa grade 2×2, cada um
 * com seis amostras compostas de cinco pontos (24 glebas), e análises de duas
 * safras em duas profundidades. O que o exemplo mostra de propósito:
 *   - o mapa de calor variando dentro de cada talhão;
 *   - o talhão 2 corrigido com calcário entre as safras (pH, Ca e V sobem),
 *     para a comparação de anos ter o que mostrar;
 *   - o talhão 3 perdendo potássio (exportação pela colheita);
 *   - duas glebas do talhão 4 sem análise, que aparecem hachuradas.
 */

export const NOME_FAZENDA_EXEMPLO = 'Fazenda Exemplo (dados fictícios)'
export const SAFRAS_EXEMPLO = ['24-25', '25-26']
export const OBSERVACAO_EXEMPLO = 'Dado fictício — fazenda de exemplo.'

// Região agrícola plana (MT). O local é só um cenário: os talhões não seguem
// as lavouras reais da imagem de satélite.
const ORIGEM = { lat: -12.6, lng: -55.82 }
const LARGURA = 0.009 // ~980 m
const ALTURA = 0.008 // ~885 m
const VAO = 0.0006

const TALHOES = [
  { codigo: '1', nome: 'Sede', cor: '#2e7d32', coluna: 0, linha: 0 },
  { codigo: '2', nome: 'Chapada', cor: '#1565c0', coluna: 1, linha: 0 },
  { codigo: '3', nome: 'Baixada', cor: '#ef6c00', coluna: 0, linha: 1 },
  { codigo: '4', nome: 'Córrego', cor: '#6a1b9a', coluna: 1, linha: 1 },
]

// Amostras do talhão 4 que ficam sem análise (hachura no mapa).
const SEM_ANALISE = new Set([23, 24])

/** Gerador pseudoaleatório com semente (mulberry32). */
function gerador(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function retangulo(oeste, sul, leste, norte) {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[oeste, sul], [leste, sul], [leste, norte], [oeste, norte], [oeste, sul]]] },
  }
}

function limitesDoTalhao({ coluna, linha }) {
  const oeste = ORIGEM.lng + coluna * (LARGURA + VAO)
  const norte = ORIGEM.lat - linha * (ALTURA + VAO)
  return { oeste, leste: oeste + LARGURA, norte, sul: norte - ALTURA }
}

/** Sede: um pouco a sudoeste da grade. */
export function sedeExemplo() {
  return { lat: ORIGEM.lat - 2 * (ALTURA + VAO) - 0.0015, lng: ORIGEM.lng - 0.0015 }
}

/** Os quatro talhões, prontos para `criarTalhao`. */
export function talhoesExemplo() {
  return TALHOES.map((t) => {
    const { oeste, sul, leste, norte } = limitesDoTalhao(t)
    const geometria = retangulo(oeste, sul, leste, norte)
    return { codigo: t.codigo, nome: t.nome, cor: t.cor, geometria, areaHa: areaEmHectares(geometria) }
  })
}

/**
 * Pontos de amostra por talhão (pelo código do talhão): seis amostras
 * compostas por talhão, numa grade 3×2, com cinco coletas cada — uma perto do
 * centro da célula e quatro em volta. A amostra é numerada de 1 a 24 na
 * fazenda inteira, como num laudo.
 */
export function pontosExemplo() {
  const sorteio = gerador(20261118)
  const porTalhao = new Map()
  let amostra = 0
  for (const t of TALHOES) {
    const { oeste, norte } = limitesDoTalhao(t)
    const lista = []
    for (let linha = 0; linha < 2; linha++) {
      for (let coluna = 0; coluna < 3; coluna++) {
        amostra++
        const centroLng = oeste + (coluna + 0.5) * (LARGURA / 3)
        const centroLat = norte - (linha + 0.5) * (ALTURA / 2)
        const passoLng = LARGURA / 3 / 2
        const passoLat = ALTURA / 2 / 2
        for (const [dx, dy] of [[0, 0], [-0.55, -0.5], [0.55, -0.5], [-0.5, 0.55], [0.5, 0.55]]) {
          const lng = centroLng + (dx + (sorteio() - 0.5) * 0.25) * passoLng
          const lat = centroLat + (dy + (sorteio() - 0.5) * 0.25) * passoLat
          lista.push({ geometria: pontoFeature(lat, lng), propriedades: { amostra } })
        }
      }
    }
    porTalhao.set(t.codigo, lista)
  }
  return porTalhao
}

/** Número da amostra a partir do código da gleba ("2-8" → 8). */
export function numeroDaAmostra(codigoGleba) {
  return Number(String(codigoGleba).split('-').pop())
}

// Campo suave sobre a fazenda (0 a 1), com fase própria por parâmetro: é o
// que dá o desenho de manchas ao mapa de calor em vez de ruído.
function campo(x, y, fase) {
  const v = 0.5 + 0.28 * Math.sin(2.4 * x + fase) * Math.cos(2.0 * y - fase / 2) + 0.18 * (x - y) * Math.cos(fase)
  return Math.min(1, Math.max(0, v))
}

const arred = (v, casas) => (v == null ? null : Math.round(v * 10 ** casas) / 10 ** casas)

/**
 * Valores de uma análise fictícia. `x` e `y` (0 a 1) são a posição da
 * amostra na fazenda; os derivados (SB, t, T, V, m) saem dos medidos pelas
 * mesmas contas do laudo, para nada ficar incoerente.
 */
export function valoresExemplo({ x, y, talhao, safra, profundidade, amostra }) {
  const sorteio = gerador(amostra * 131 + (safra === SAFRAS_EXEMPLO[1] ? 7 : 3) + (profundidade === '20-40' ? 977 : 0))
  const ruido = (amp) => 1 + (sorteio() - 0.5) * 2 * amp
  const funda = profundidade === '20-40'
  const recente = safra === SAFRAS_EXEMPLO[1]

  let ph = (4.9 + 1.4 * campo(x, y, 0.3)) * ruido(0.02)
  let ca = (0.9 + 3.0 * campo(x, y, 1.1)) * ruido(0.08)
  let mg = (0.3 + 1.0 * campo(x, y, 1.7)) * ruido(0.08)
  let k = (22 + 85 * campo(x, y, 2.6)) * ruido(0.08)
  let p = (3 + 24 * campo(x, y, 3.4)) * ruido(0.12)
  let mo = (1.6 + 2.4 * campo(x, y, 4.2)) * ruido(0.06)
  const argila = 32 + 26 * campo(x, y, 5.0)

  // Calcário no talhão 2 entre as safras.
  if (talhao === '2' && recente) {
    ph += 0.55
    ca += 1.1
    mg += 0.35
  }
  // Exportação de potássio no talhão 3.
  if (talhao === '3' && recente) k *= 0.78

  if (funda) {
    ph -= 0.3
    ca *= 0.65
    mg *= 0.65
    k *= 0.75
    p *= 0.5
    mo *= 0.6
  }

  const al = Math.max(0, (5.5 - ph) * 0.75)
  const hAl = 1.8 + Math.max(0, 6.3 - ph) * 2.2
  const sb = ca + mg + k / 391
  const tEfetiva = sb + al
  const tPotencial = sb + hAl

  const valores = {
    argila: arred(argila, 1),
    silte: arred(18 - argila * 0.1, 1),
    areia: arred(100 - argila - (18 - argila * 0.1), 1),
    ph_h2o: arred(ph, 1),
    al: arred(al, 2),
    h_al: arred(hAl, 2),
    p: arred(p, 1),
    k: arred(k, 0),
    ca: arred(ca, 2),
    mg: arred(mg, 2),
    sb: arred(sb, 2),
    t_efetiva: arred(tEfetiva, 2),
    t_potencial: arred(tPotencial, 2),
    v: arred((100 * sb) / tPotencial, 1),
    m: arred(tEfetiva > 0 ? (100 * al) / tEfetiva : 0, 1),
    p_rem: arred(18 + 22 * (1 - campo(x, y, 5.0)), 1),
  }
  // Como nos laudos reais: MO, S e micronutrientes só na camada de cima.
  if (!funda) {
    Object.assign(valores, {
      mo: arred(mo, 2),
      s: arred((4 + 10 * campo(x, y, 0.9)) * ruido(0.1), 1),
      b: arred((0.15 + 0.55 * campo(x, y, 2.1)) * ruido(0.1), 2),
      cu: arred((0.4 + 1.2 * campo(x, y, 3.0)) * ruido(0.1), 2),
      mn: arred((3 + 17 * campo(x, y, 3.8)) * ruido(0.1), 1),
      fe: arred((15 + 45 * campo(x, y, 4.6)) * ruido(0.1), 1),
      zn: arred((0.5 + 2.0 * campo(x, y, 5.5)) * ruido(0.1), 2),
    })
  }
  return valores
}

/**
 * Análises de todas as glebas criadas: duas safras × duas profundidades, na
 * média dos pontos de cada gleba (a mesma regra da importação de laudo).
 *
 * `glebas`: [{ codigo, talhaoId, codigoTalhao, pontos: [[lng, lat]] }].
 * Devolve os payloads para `criarAnalisesEmLote`.
 */
export function analisesExemplo(glebas) {
  const todos = glebas.flatMap((g) => g.pontos)
  const lngs = todos.map((p) => p[0])
  const lats = todos.map((p) => p[1])
  const [minLng, maxLng, minLat, maxLat] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)]

  const payloads = []
  for (const g of glebas) {
    const amostra = numeroDaAmostra(g.codigo)
    if (SEM_ANALISE.has(amostra) || g.pontos.length === 0) continue
    const lng = g.pontos.reduce((s, p) => s + p[0], 0) / g.pontos.length
    const lat = g.pontos.reduce((s, p) => s + p[1], 0) / g.pontos.length
    const x = (lng - minLng) / (maxLng - minLng || 1)
    const y = (maxLat - lat) / (maxLat - minLat || 1)
    for (const safra of SAFRAS_EXEMPLO) {
      for (const profundidade of ['0-20', '20-40']) {
        payloads.push({
          talhao_id: g.talhaoId,
          geometria: pontoFeature(lat, lng),
          ano_safra: safra,
          profundidade,
          data_coleta: safra === SAFRAS_EXEMPLO[0] ? '2024-08-15' : '2025-08-20',
          laboratorio: 'Laboratório de exemplo',
          numero_amostra_lab: String(amostra),
          observacoes: OBSERVACAO_EXEMPLO,
          origem: 'importacao',
          ...valoresExemplo({ x, y, talhao: g.codigoTalhao, safra, profundidade, amostra }),
        })
      }
    }
  }
  return payloads
}
