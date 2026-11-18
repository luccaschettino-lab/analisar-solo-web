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

// --- Amostra que atravessa a divisa: uma gleba só, nos dois talhões ---
{
  const quad = (x0, y0, x1, y1) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
  })
  // Dois talhões lado a lado (~1,1 km cada), divisa em lng -49.000.
  const t12 = { id: 't12', codigo: '12', geometria: quad(-49.01, -10.01, -49.0, -10.0) }
  const t14 = { id: 't14', codigo: '14', geometria: quad(-49.0, -10.01, -48.99, -10.0) }
  const lista = [
    // amostra 51: três pontos no 14 e um logo do outro lado, no 12
    pt('a1', 't14', -10.004, -48.998, { id: 51 }),
    pt('a2', 't14', -10.006, -48.997, { id: 51 }),
    pt('a3', 't14', -10.005, -48.999, { id: 51 }),
    pt('a4', 't12', -10.005, -49.0008, { id: 51 }),
    // o resto do talhão 12 é da amostra 40, longe da divisa
    pt('b1', 't12', -10.005, -49.008, { id: 40 }),
    pt('b2', 't12', -10.003, -49.007, { id: 40 }),
    // o resto do talhão 14 é da amostra 52
    pt('c1', 't14', -10.002, -48.992, { id: 52 }),
  ]
  const r = agruparPontosEmGlebas(lista, [t12, t14])
  assert.deepEqual(r.glebas.map((g) => g.codigo).sort(), ['12-40', '14-51', '14-52'])
  const g51 = r.glebas.find((g) => g.codigo === '14-51')
  assert.equal(g51.talhaoId, 't14', 'fica no talhão da maioria dos pontos')
  assert.deepEqual([...g51.pontoIds].sort(), ['a1', 'a2', 'a3', 'a4'])
  assert.equal(g51.talhoes, 2)
  assert.equal(r.entreTalhoes, 1)
  assert.equal(g51.pedacos, 1, 'os pedaços dos dois lados da divisa viram um polígono só')
  for (const id of g51.pontoIds) {
    assert.ok(booleanPointInPolygon(lista.find((p) => p.id === id).geometria, g51.geometria), `ponto ${id} na gleba 14-51`)
  }
  const area12e14 = areaEmHectares(t12.geometria) + areaEmHectares(t14.geometria)
  const soma = r.glebas.reduce((t, g) => t + g.areaHa, 0)
  assert.ok(Math.abs(soma - area12e14) / area12e14 < 0.005, `as glebas cobrem os dois talhões sem vão: ${soma} ~ ${area12e14}`)

  // Mesmo número em talhões distantes (numeração por talhão): glebas separadas.
  const t7 = { id: 't7b', codigo: '7', geometria: quad(-49.01, -10.11, -49.0, -10.1) }
  const longe = agruparPontosEmGlebas(
    [...lista, pt('z1', 't7b', -10.105, -49.005, { id: 51 })],
    [t12, t14, t7],
  )
  assert.ok(longe.glebas.some((g) => g.codigo === '7-51'), 'a 51 de um talhão a 10 km é outra amostra')
  assert.equal(longe.glebas.find((g) => g.codigo === '14-51').pontoIds.length, 4)

  // Recalcular: a gleba existente com ponto do outro lado também atravessa.
  const existentes = r.glebas.map((g, i) => ({ id: `e${i}`, talhao_id: g.talhaoId, codigo: g.codigo, geometria: pontoFeature(-10, -49) }))
  const ligados = lista.map((p) => ({ ...p, gleba_id: existentes.find((g) => g.codigo === r.glebas.find((x) => x.pontoIds.includes(p.id)).codigo).id }))
  const refeito2 = recalcularGlebasDosPontos(ligados, existentes, [t12, t14])
  assert.equal(refeito2.atualizacoes.length, 3)
  assert.equal(refeito2.entreTalhoes, 1)
  const soma2 = refeito2.atualizacoes.reduce((t, a) => t + a.areaHa, 0)
  assert.ok(Math.abs(soma2 - area12e14) / area12e14 < 0.005)

  // Gleba desenhada à mão no talhão 12 trava o 12 — e, pela 14-51 que
  // atravessa, o 14 também: nada é refeito pela metade.
  const travado = recalcularGlebasDosPontos(
    ligados,
    [...existentes, { id: 'mao', talhao_id: 't12', codigo: 'X', geometria: quad(-49.009, -10.009, -49.008, -10.008) }],
    [t12, t14],
  )
  assert.deepEqual(travado.talhoesIgnorados, ['12'])
  assert.equal(travado.atualizacoes.length, 0)
  console.log('pontos de coleta: amostra que atravessa a divisa vira uma gleba só OK')
}

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

// --- Cor dos pontos de coleta segundo o filtro ---
import { criarCorDosPontos } from '../src/lib/pontosDeColeta.js'
const ptc = (id, talhao, gleba, lat, lng) => ({ id, talhao_id: talhao, gleba_id: gleba, geometria: pontoFeature(lat, lng) })
const pontosCor = [
  ptc('a1', 't1', 'gA', -9.0, -49.0), ptc('a2', 't1', 'gA', -9.2, -49.2), // gleba A: média (-9.1, -49.1)
  ptc('b1', 't1', 'gB', -9.5, -49.5), // gleba B: média (-9.5, -49.5), sem análise no filtro
  ptc('s1', 't1', null, -9.9, -49.9), // sem gleba
  ptc('c1', 't2', 'gC', -8.0, -48.0), // gleba C no talhão t2
]
const estadoPorTalhao = {
  t1: { pontos: [{ lat: -9.1, lng: -49.1, cor: '#ff0000' }, { lat: -1, lng: -1, cor: '#00ff00' }] },
  t2: { pontos: [{ lat: -8.0000000001, lng: -48.0, cor: '#0000ff' }] }, // dentro da tolerância
}
let chamadas = 0
const corDe = criarCorDosPontos(pontosCor, (talhao) => { chamadas++; return estadoPorTalhao[talhao] ?? null }, '#cccccc')
assert.equal(corDe(pontosCor[0]), '#ff0000', 'ponto herda a cor da amostra da gleba dele')
assert.equal(corDe(pontosCor[1]), '#ff0000', 'todos os pontos da gleba têm a mesma cor')
assert.equal(corDe(pontosCor[2]), '#cccccc', 'gleba sem análise no filtro: sem dado')
assert.equal(corDe(pontosCor[3]), '#cccccc', 'ponto sem gleba: sem dado')
assert.equal(corDe(pontosCor[4]), '#0000ff', 'tolerância de ~10 cm na posição da amostra')
assert.equal(chamadas, 2, 'a coloração é calculada uma vez por talhão, não uma por ponto')

// gleba que atravessa: ponto no talhão t2, análise da gleba no t1
const cruzados = [ptc('x1', 't1', 'gX', -7.0, -47.0), ptc('x2', 't2', 'gX', -7.2, -47.2)]
const corCruzada = criarCorDosPontos(
  cruzados,
  (t) => (t === 't1' ? { pontos: [{ lat: -7.1, lng: -47.1, cor: '#123456' }] } : { pontos: [] }),
  '#cccccc',
)
assert.equal(corCruzada(cruzados[1]), '#123456', 'o ponto do outro lado da divisa acha a análise da gleba')
console.log('pontos de coleta: cor segundo o filtro OK')
