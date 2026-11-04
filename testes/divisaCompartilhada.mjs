import assert from 'node:assert/strict'
import { verticesMovidos, aplicarMovimentos, temAutoIntersecao, planejarDivisa } from '../src/lib/divisaCompartilhada.js'

const feature = (aneis, tipo = 'Polygon') => ({
  type: 'Feature',
  properties: {},
  geometry: { type: tipo, coordinates: tipo === 'Polygon' ? aneis : aneis },
})
// Três glebas lado a lado (A | B | C), com 15 casas decimais como no banco.
//   A: x de 0 a 1      B: x de 1 a 2      C: x de 2 a 3      (y de 0 a 1)
const X0 = -49.570000000000001
const d = 0.001
const quadro = (xa, xb) => [[xa, -9.34], [xb, -9.34], [xb, -9.34 + d], [xa, -9.34 + d], [xa, -9.34]]
const A = feature([quadro(X0, X0 + d)])
const B = feature([quadro(X0 + d, X0 + 2 * d)])
const C = feature([quadro(X0 + 2 * d, X0 + 3 * d)])
const vizinhas = [{ id: 'B', codigo: '8-B', geometria: B }, { id: 'C', codigo: '8-C', geometria: C }]

// Como o mapa devolve: arredondado a 6 casas
const doMapa = (g) => {
  const copia = JSON.parse(JSON.stringify(g))
  const r = (c) => (Array.isArray(c) ? c.map(r) : Math.round(c * 1e6) / 1e6)
  copia.geometry.coordinates = r(copia.geometry.coordinates)
  return copia
}

// --- só passar pelo editor NÃO é movimento (o arredondamento não conta) ---
assert.deepEqual(verticesMovidos(A, doMapa(A)), [], 'gravar sem mexer em nada não move vértice nenhum')
assert.equal(planejarDivisa({ antes: A, depois: doMapa(A), vizinhas }), null, 'e não mexe nas vizinhas')

// --- mover o vértice de cima da divisa A|B ---
const depois = doMapa(A)
depois.geometry.coordinates[0][1] = [Math.round((X0 + d + 0.0002) * 1e6) / 1e6, -9.34] // (x=1, y=0) vai 22 m para a direita
depois.geometry.coordinates[0][1] = [depois.geometry.coordinates[0][1][0], -9.34]
const mov = verticesMovidos(A, depois)
assert.equal(mov.length, 1, 'um vértice movido')
assert.deepEqual(mov[0].de, [X0 + d, -9.34])

const plano = planejarDivisa({ antes: A, depois, vizinhas })
assert.ok(plano, 'há o que propagar')
assert.deepEqual(plano.afetadas.map((a) => a.gleba.id), ['B'], 'só B tinha esse vértice; C não')
assert.deepEqual(plano.invalidas, [])
const novaB = plano.afetadas[0].geometria.geometry.coordinates[0]
assert.deepEqual(novaB[0], depois.geometry.coordinates[0][1], 'o vértice de B foi para o MESMO lugar do de A (coincidem exatamente)')
assert.deepEqual(novaB[4], novaB[0], 'o fechamento do anel acompanha')
assert.deepEqual(novaB[1], B.geometry.coordinates[0][1], 'os outros vértices de B não mudam')
assert.ok(plano.afetadas[0].areaHa > 0)

// --- vértice que ninguém mais tem: nada a propagar ---
const livre = doMapa(A)
livre.geometry.coordinates[0][0] = [livre.geometry.coordinates[0][0][0] - 0.0001, -9.34] // canto externo de A
livre.geometry.coordinates[0][4] = livre.geometry.coordinates[0][0]
assert.equal(planejarDivisa({ antes: A, depois: livre, vizinhas }), null, 'canto sem vizinha: não há divisa a levar')

// --- vértices acrescentados ou tirados: não adivinha ---
const comMaisUm = doMapa(A)
comMaisUm.geometry.coordinates[0].splice(2, 0, [X0 + d, -9.3395])
assert.equal(verticesMovidos(A, comMaisUm), null, 'estrutura mudou: sem correspondência')
assert.equal(planejarDivisa({ antes: A, depois: comMaisUm, vizinhas }), null)

// --- ponto, tipo diferente ---
const P = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }
assert.equal(verticesMovidos(P, P), null)
assert.equal(verticesMovidos(A, P), null)

// --- vizinha que passaria a cruzar a própria linha NÃO é alterada ---
// Mover o vértice de baixo da divisa (x=1,y=0) de A para dentro de C faz o lado de B atravessar o de B.
const dentroDeC = doMapa(A)
dentroDeC.geometry.coordinates[0][1] = [X0 + 2.5 * d, -9.34 + 0.0005]
const ruim = planejarDivisa({ antes: A, depois: dentroDeC, vizinhas })
assert.ok(ruim, 'há plano')
assert.deepEqual(ruim.invalidas.map((i) => i.gleba.id), ['B'], 'B ficaria com a linha cruzada: é apontada e NÃO vai para as afetadas')
assert.deepEqual(ruim.afetadas, [], 'nada seria alterado nas vizinhas')

// --- detector de cruzamento ---
const laco = feature([[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]]) // "gravata": os lados se cruzam
assert.equal(temAutoIntersecao(laco), true, 'gravata é cruzamento')
assert.equal(temAutoIntersecao(A), false, 'quadrado não cruza')
assert.equal(temAutoIntersecao(feature([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]])), false)
const lShape = feature([[[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2], [0, 0]]])
assert.equal(temAutoIntersecao(lShape), false, 'L não cruza (lados que só se encontram na ponta não contam)')

// --- MultiPolygon: acha e leva o vértice em qualquer pedaço ---
const M = { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[quadro(X0 + d, X0 + 2 * d)], [quadro(X0 + 10 * d, X0 + 11 * d)]] } }
const { geometria: moveuM, alterados } = aplicarMovimentos(M, [{ de: [X0 + d, -9.34], para: [X0 + d + 0.0001, -9.34] }])
assert.equal(alterados, 2, 'o vértice e o fechamento do anel')
assert.equal(moveuM.geometry.type, 'MultiPolygon')
assert.equal(moveuM.geometry.coordinates.length, 2, 'os dois pedaços continuam')
const plano2 = planejarDivisa({ antes: A, depois, vizinhas: [{ id: 'M', codigo: '8-M', geometria: M }] })
assert.deepEqual(plano2.afetadas.map((a) => a.gleba.id), ['M'], 'vizinha em vários pedaços também acompanha')

// --- tolerância: a vizinha pode estar com coordenadas só arredondadas ---
const Barredondada = doMapa(B)
const plano3 = planejarDivisa({ antes: A, depois, vizinhas: [{ id: 'B', codigo: '8-B', geometria: Barredondada }] })
assert.deepEqual(plano3.afetadas.map((a) => a.gleba.id), ['B'], 'vizinha já arredondada (11 cm de folga) ainda é reconhecida')

console.log('divisa compartilhada: achar o vértice movido, levar às vizinhas e não mexer onde ficaria inválido OK')
