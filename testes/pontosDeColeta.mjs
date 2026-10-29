import assert from 'node:assert/strict'
import { distribuirPontos, pontosNaGleba, rotuloPontoColeta, agruparPontosEmGlebas, recalcularGlebasDosPontos } from '../src/lib/pontosDeColeta.js'
import { pontoFeature, areaEmHectares } from '../src/lib/geo.js'

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

// --- Glebas preenchem o talhão: a soma das partes é o talhão ---
const quadrado = (x0, y0, x1, y1) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
})
// ~ 1,1 km x 1,1 km perto do equador de longitude -49, latitude -10
const talhaoGrande = { id: 'tg', codigo: '9', geometria: quadrado(-49.01, -10.01, -49.0, -10.0) }
const grade = []
let n = 0
for (const [lng, lat, id] of [
  [-49.008, -10.002, 1], [-49.006, -10.003, 1],
  [-49.003, -10.002, 2], [-49.001, -10.004, 2],
  [-49.008, -10.007, 3], [-49.005, -10.008, 3],
  [-49.002, -10.008, 4], [-49.0035, -10.006, 4],
]) {
  grade.push({ id: `g${n++}`, talhao_id: 'tg', geometria: pontoFeature(lat, lng), propriedades: { id } })
}
const preenchido = agruparPontosEmGlebas(grade, [talhaoGrande])
assert.equal(preenchido.glebas.length, 4)
const areaTalhao = areaEmHectares(talhaoGrande.geometria)
const somaAreas = preenchido.glebas.reduce((t, g) => t + g.areaHa, 0)
assert.ok(Math.abs(somaAreas - areaTalhao) / areaTalhao < 0.005, `soma ${somaAreas} deveria ser ~${areaTalhao}`)
assert.ok(preenchido.glebas.every((g) => g.areaHa > 0 && g.geometria.geometry.type.endsWith('Polygon')))

// nenhum ponto pode cair na gleba de outro código: cada gleba contém os seus pontos
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
for (const g of preenchido.glebas) {
  for (const id of g.pontoIds) {
    const ponto = grade.find((x) => x.id === id).geometria
    assert.ok(booleanPointInPolygon(ponto, g.geometria), `ponto ${id} deve estar na gleba ${g.codigo}`)
  }
}

// um único código preenche o talhão todo
const unico = agruparPontosEmGlebas(grade.filter((p) => p.propriedades.id === 1), [talhaoGrande])
assert.equal(unico.glebas.length, 1)
assert.ok(Math.abs(unico.glebas[0].areaHa - areaTalhao) / areaTalhao < 0.005)

// Recalcular glebas que já existiam (criadas pelo contorno dos pontos)
const glebasAntigas = preenchido.glebas.map((g, i) => ({
  id: `gl${i}`,
  talhao_id: 'tg',
  codigo: g.codigo,
  geometria: pontoFeature(-10, -49),
}))
const pontosLigados = grade.map((p) => ({
  ...p,
  gleba_id: glebasAntigas.find((g) => g.codigo === `9-${p.propriedades.id}`).id,
}))
const refeito = recalcularGlebasDosPontos(pontosLigados, glebasAntigas, [talhaoGrande])
assert.equal(refeito.atualizacoes.length, 4)
assert.deepEqual(refeito.talhoesIgnorados, [])
const somaRefeita = refeito.atualizacoes.reduce((t, a) => t + a.areaHa, 0)
assert.ok(Math.abs(somaRefeita - areaTalhao) / areaTalhao < 0.005)

// talhão com uma gleba desenhada à mão (sem pontos ligados) não é tocado
const comManual = recalcularGlebasDosPontos(
  pontosLigados,
  [...glebasAntigas, { id: 'manual', talhao_id: 'tg', codigo: 'X', geometria: quadrado(-49.005, -10.005, -49.004, -10.004) }],
  [talhaoGrande],
)
assert.equal(comManual.atualizacoes.length, 0)
assert.deepEqual(comManual.talhoesIgnorados, ['9'])
console.log('pontos de coleta: glebas preenchem o talhão, sem vão, e recálculo respeita glebas manuais OK')
