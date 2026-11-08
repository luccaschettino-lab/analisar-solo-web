import { glebasSemAmostra } from '../src/lib/glebasSemAmostra.js'

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

const quadrado = (x0, y0, x1, y1) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
})

// Talhão A com três glebas lado a lado; talhão B sem amostra no filtro.
const glebas = [
  { id: 'a1', talhao_id: 'A', geometria: quadrado(0, 0, 1, 1) },
  { id: 'a2', talhao_id: 'A', geometria: quadrado(1, 0, 2, 1) },
  { id: 'a3', talhao_id: 'A', geometria: quadrado(2, 0, 3, 1) },
  { id: 'a4', talhao_id: 'A', geometria: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [2.5, 0.5] } } },
  { id: 'b1', talhao_id: 'B', geometria: quadrado(5, 5, 6, 6) },
]
const amostras = new Map([['A', [{ lat: 0.5, lng: 0.5 }, { lat: 0.4, lng: 2.6 }]]])

console.log('Glebas sem amostra no filtro')
const ids = glebasSemAmostra(glebas, amostras).map((g) => g.id)
ok('gleba com amostra dentro não é hachurada', !ids.includes('a1') && !ids.includes('a3'))
ok('gleba sem amostra no talhão com dado é hachurada', ids.includes('a2'), JSON.stringify(ids))
ok('gleba que é só ponto fica de fora (sem área)', !ids.includes('a4'))
ok('talhão sem amostra nenhuma não entra (ele já é hachurado inteiro)', !ids.includes('b1'))
ok('amostra sem posição não conta como dentro', glebasSemAmostra([glebas[1]], new Map([['A', [{ lat: null, lng: null }]]])).length === 1)
const multi = {
  id: 'm',
  talhao_id: 'A',
  geometria: { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [quadrado(10, 10, 11, 11).geometry.coordinates, quadrado(0, 0, 1, 1).geometry.coordinates] } },
}
ok('gleba em pedaços: amostra em qualquer pedaço conta', glebasSemAmostra([multi], amostras).length === 0)

if (falhas) {
  console.log(`\n${falhas} falha(s)`)
  process.exit(1)
}
console.log('\nTudo certo.')
