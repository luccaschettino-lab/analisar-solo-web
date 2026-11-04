import { paraFeature, areaEmHectares } from './geo.js'

/**
 * Divisa compartilhada entre glebas.
 *
 * Num talhão dividido entre glebas, a divisa de uma é a divisa da outra: os
 * vértices coincidem. Editar uma gleba movia só os dela, a vizinha ficava onde
 * estava, e entre as duas abria um buraco (ou uma sobreposição). Aqui, ao
 * gravar, se acha o que a pessoa moveu, e a mesma mudança é levada às vizinhas
 * que tinham aquele vértice, para a divisa continuar sendo uma só.
 *
 * Só vale para MOVER vértices. Se a pessoa acrescentou ou tirou vértices, a
 * correspondência entre "antes" e "depois" deixa de ser posição por posição e
 * o plano devolve `null`: melhor não mexer nas vizinhas do que mexer no
 * vértice errado.
 */

// ~11 cm: a precisão em que o mapa grava (6 casas decimais). Dois vértices mais
// perto que isso são o mesmo ponto — uma gleba salva pelo editor tem as
// coordenadas arredondadas, a vizinha ainda pode ter as originais.
const TOLERANCIA = 1e-6

const mesmoPonto = (a, b) => Math.abs(a[0] - b[0]) <= TOLERANCIA && Math.abs(a[1] - b[1]) <= TOLERANCIA

function aneisDe(geometry) {
  if (geometry?.type === 'Polygon') return geometry.coordinates
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.flat(1)
  return null
}

/**
 * Os vértices que a pessoa moveu: `[{ de, para }]`. Lista vazia se nada mudou;
 * `null` se a estrutura mudou (vértices acrescentados/tirados) ou não é área.
 *
 * Uma gleba que só passou pelo editor, sem nada arrastado, volta com as
 * coordenadas arredondadas a 6 casas — isso NÃO conta como movimento.
 */
export function verticesMovidos(antes, depois) {
  const ga = paraFeature(antes)?.geometry
  const gd = paraFeature(depois)?.geometry
  if (!ga || !gd || ga.type !== gd.type) return null
  const ra = aneisDe(ga)
  const rd = aneisDe(gd)
  if (!ra || !rd) return null
  if (ra.length !== rd.length || ra.some((anel, i) => anel.length !== rd[i].length)) return null

  const movidos = []
  const vistos = new Set()
  ra.forEach((anel, i) => {
    anel.forEach((p, j) => {
      const q = rd[i][j]
      if (mesmoPonto(p, q)) return
      // O vértice de fechamento repete o primeiro: conta uma vez só.
      const chave = `${p[0]},${p[1]}`
      if (vistos.has(chave)) return
      vistos.add(chave)
      movidos.push({ de: [p[0], p[1]], para: [q[0], q[1]] })
    })
  })
  return movidos
}

/** A geometria com os vértices de `movimentos` levados ao lugar novo. */
export function aplicarMovimentos(geometria, movimentos) {
  const f = paraFeature(geometria)
  if (!f?.geometry || !aneisDe(f.geometry)) return { geometria, alterados: 0 }
  let alterados = 0

  const levar = (p) => {
    const m = movimentos.find((x) => mesmoPonto(p, x.de))
    if (!m) return p
    alterados++
    return [m.para[0], m.para[1]]
  }
  const coordinates =
    f.geometry.type === 'Polygon'
      ? f.geometry.coordinates.map((anel) => anel.map(levar))
      : f.geometry.coordinates.map((poligono) => poligono.map((anel) => anel.map(levar)))

  return { geometria: { ...f, geometry: { ...f.geometry, coordinates } }, alterados }
}

// Orientação de c em relação ao segmento a→b: >0 esquerda, <0 direita.
const lado = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

function cruzam(a, b, c, d) {
  const o1 = lado(a, b, c)
  const o2 = lado(a, b, d)
  const o3 = lado(c, d, a)
  const o4 = lado(c, d, b)
  return o1 * o2 < 0 && o3 * o4 < 0
}

/**
 * A linha de algum anel cruza a si mesma? (Só cruzamento de verdade: dois
 * lados que apenas se tocam numa ponta não contam.) O editor já recusa isso
 * para a gleba que a pessoa está mexendo; a vizinha, que muda por tabela, não
 * passa por esse filtro.
 */
export function temAutoIntersecao(geometria) {
  const aneis = aneisDe(paraFeature(geometria)?.geometry)
  if (!aneis) return false
  for (const anel of aneis) {
    const lados = anel.length - 1
    for (let i = 0; i < lados; i++) {
      for (let j = i + 2; j < lados; j++) {
        if (i === 0 && j === lados - 1) continue // primeiro e último lado se encontram no fechamento
        if (cruzam(anel[i], anel[i + 1], anel[j], anel[j + 1])) return true
      }
    }
  }
  return false
}

/**
 * O que acontece com as vizinhas se a divisa mexida for levada junto.
 *
 * Devolve `null` quando não há nada a propagar (nenhum vértice movido, ou a
 * estrutura mudou). Senão:
 *   - `afetadas`: vizinhas que tinham algum dos vértices, já com a geometria nova;
 *   - `invalidas`: vizinhas que, movidas, passariam a cruzar a própria linha.
 *     Estas não devem ser alteradas.
 */
export function planejarDivisa({ antes, depois, vizinhas }) {
  const movimentos = verticesMovidos(antes, depois)
  if (!movimentos || movimentos.length === 0) return null

  const afetadas = []
  const invalidas = []
  for (const gleba of vizinhas) {
    const { geometria, alterados } = aplicarMovimentos(gleba.geometria, movimentos)
    if (alterados === 0) continue
    if (temAutoIntersecao(geometria)) invalidas.push({ gleba })
    else afetadas.push({ gleba, geometria, areaHa: areaEmHectares(geometria) })
  }
  if (afetadas.length === 0 && invalidas.length === 0) return null
  return { movimentos, afetadas, invalidas }
}
