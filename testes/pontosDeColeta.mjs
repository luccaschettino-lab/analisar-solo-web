import assert from 'node:assert/strict'
import { distribuirPontos, pontosNaGleba } from '../src/lib/pontosDeColeta.js'
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
console.log('pontos de coleta: atribuição por contorno e exclusão dos já usados OK')
