import assert from 'node:assert/strict'
import { distribuirPontos, pontosNaGleba, rotuloPontoColeta, agruparPontosEmGlebas } from '../src/lib/pontosDeColeta.js'
import { pontoFeature } from '../src/lib/geo.js'

const talhoes = [
  {
    id: 'talhao-1',
    codigo: '1',
    geometria: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[-43, -20], [-42, -20], [-42, -19], [-43, -19], [-43, -20]]],
      },
    },
  },
]
const pontos = [
  { indice: 1, lat: -19.5, lng: -42.5, propriedades: { amostra: 'A1' } },
  { indice: 2, lat: -18.99, lng: -42.5, propriedades: { amostra: 'A2' } },
]

const resultado = distribuirPontos(pontos, talhoes)

assert.equal(resultado.porTalhao.get('talhao-1').length, 2)
assert.deepEqual(resultado.fora.map(({ ponto }) => ponto.indice), [2])
assert.ok(resultado.porTalhao.get('talhao-1').every((item) => !('codigo' in item)))

const poligono = talhoes[0].geometria
const candidatos = [
  { id: 'disponivel', geometria: pontoFeature(-19.5, -42.5), gleba_id: null },
  { id: 'ja-usado', geometria: pontoFeature(-19.5, -42.5), gleba_id: 'gleba-1' },
  { id: 'fora', geometria: pontoFeature(-18.99, -42.5), gleba_id: null },
]
assert.deepEqual(pontosNaGleba(candidatos, poligono).map((ponto) => ponto.id), ['disponivel'])
assert.equal(rotuloPontoColeta({ propriedades: { id: 59 } }, 0, '7'), '7-59')
assert.equal(rotuloPontoColeta({ propriedades: { id: '7-58' } }, 0, '7'), '7-58')
assert.equal(rotuloPontoColeta({ propriedades: { amostra: '7-59' } }), '7-59')
console.log('pontos de coleta: atribuição por contorno e exclusão dos já usados OK')

// --- Glebas automáticas: um grupo por talhão + código ---
const pt = (id, talhaoId, lat, lng, props) => ({
  id,
  talhao_id: talhaoId,
  geometria: pontoFeature(lat, lng),
  propriedades: props,
})
const tal = [
  { id: 't7', codigo: '7' },
  { id: 't8', codigo: '8' },
]
const entrada = [
  // código 1 no talhão 7: quadrado com um ponto no meio -> casco = os 4 cantos
  pt('a', 't7', -10.000, -49.000, { id: 1 }),
  pt('b', 't7', -10.000, -48.999, { id: 1 }),
  pt('c', 't7', -10.001, -48.999, { id: 1 }),
  pt('d', 't7', -10.001, -49.000, { id: 1 }),
  pt('e', 't7', -10.0005, -48.9995, { id: 1 }),
  // código 2: só dois pontos -> não há polígono, vira ponto
  pt('f', 't7', -10.010, -49.000, { id: 2 }),
  pt('g', 't7', -10.010, -48.999, { id: 2 }),
  // mesmo código 1, mas em outro talhão -> gleba separada
  pt('h', 't8', -10.100, -49.000, { id: 1 }),
  // três pontos na mesma reta -> também vira ponto
  pt('i', 't8', -10.200, -49.000, { id: 3 }),
  pt('j', 't8', -10.200, -48.999, { id: 3 }),
  pt('k', 't8', -10.200, -48.998, { id: 3 }),
  // sem código no arquivo -> fica de fora
  pt('l', 't8', -10.300, -49.000, {}),
  // código que já vem com hífen é mantido
  pt('m', 't8', -10.400, -49.000, { amostra: '8-12' }),
]
const { glebas: agrupadas, semCodigo } = agruparPontosEmGlebas(entrada, tal)

assert.equal(semCodigo, 1)
assert.deepEqual(agrupadas.map((g) => g.codigo), ['7-1', '7-2', '8-1', '8-3', '8-12'])
const g71 = agrupadas.find((g) => g.codigo === '7-1')
assert.deepEqual(g71.pontoIds.sort(), ['a', 'b', 'c', 'd', 'e'])
assert.equal(g71.geometria.geometry.type, 'Polygon')
assert.equal(g71.geometria.geometry.coordinates[0].length, 5, 'quatro cantos + fechamento; o ponto do meio não é vértice')
assert.ok(g71.areaHa > 0)
const g72 = agrupadas.find((g) => g.codigo === '7-2')
assert.equal(g72.geometria.geometry.type, 'Point')
assert.equal(g72.areaHa, null)
assert.equal(agrupadas.find((g) => g.codigo === '8-3').geometria.geometry.type, 'Point')
assert.deepEqual(agrupadas.find((g) => g.codigo === '8-1').pontoIds, ['h'])
assert.equal(agrupadas.reduce((n, g) => n + g.pontoIds.length, 0), entrada.length - 1, 'nenhum ponto some nem se repete')
console.log('pontos de coleta: glebas automáticas por código OK')
