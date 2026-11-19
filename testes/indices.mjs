import * as servidor from '../supabase/functions/_shared/indicesComuns.js'
import { latLngParaUtm, utmParaLatLng } from '../supabase/functions/_shared/utm.js'
import * as tela from '../src/lib/indicesVegetacao.js'
import { PIXEL, pixelsDoIndice, distribuicaoPorFaixa, faixasDoIndice } from '../src/lib/rasterIndice.js'
import { bboxDaGeometria } from '../src/lib/geo.js'

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

console.log('Índices: servidor e tela usam a mesma conta')
let maior = 0
for (let nir = 0.05; nir <= 0.7; nir += 0.07) {
  for (let r = 0.02; r <= 0.4; r += 0.06) {
    for (let a = 0.01; a <= 0.3; a += 0.07) {
      const g = (r + a) / 2
      maior = Math.max(
        maior,
        Math.abs(servidor.ndvi(nir, r) - tela.ndvi(nir, r)),
        Math.abs(servidor.evi(nir, r, a) - tela.evi(nir, r, a)),
        Math.abs(servidor.savi(nir, r) - tela.savi(nir, r)),
        Math.abs(servidor.ndwi(g, nir) - tela.ndwi(g, nir)),
      )
    }
  }
}
ok('NDVI, EVI, SAVI e NDWI iguais nas duas pontas', maior === 0, `maior diferença ${maior}`)
ok('denominador zero vira null, não NaN', servidor.ndvi(0, 0) === null && servidor.ndwi(0, 0) === null)

console.log('Projeção UTM')
const [e, n] = latLngParaUtm(-9.3339, -49.5687, 22, true)
const [lat, lng] = utmParaLatLng(e, n, 22, true)
ok('ida e volta lat/lng ↔ UTM', Math.abs(lat + 9.3339) < 1e-9 && Math.abs(lng + 49.5687) < 1e-9)

console.log('Retângulo do talhão')
const multi = { type: 'MultiPolygon', coordinates: [[[[-45, -20], [-44.9, -20], [-44.9, -19.9], [-45, -20]]], [[[-44.5, -19.5], [-44.4, -19.5], [-44.4, -19.4], [-44.5, -19.5]]]] }
ok('bbox cobre todas as partes', JSON.stringify(bboxDaGeometria(multi)) === JSON.stringify([-45, -20, -44.4, -19.4]))
ok('ponto não tem bbox de talhão', bboxDaGeometria({ type: 'Point', coordinates: [0, 0] }) === null)

console.log('Mapa do índice')
const bytes16 = (arr) => { const b = Buffer.alloc(arr.length * 2); arr.forEach((v, i) => b.writeInt16LE(v, i * 2)); return b.toString('base64') }
const resposta = {
  janela: { colunas: 4, linhas: 1 },
  escala: 10000,
  semValor: -32768,
  mascara: Buffer.from([PIXEL.FORA, PIXEL.VALIDO, PIXEL.NUVEM, PIXEL.VALIDO]).toString('base64'),
  indices: { ndvi: bytes16([5000, 7000, 9000, -3000]) },
}
const rgba = pixelsDoIndice(resposta, 'ndvi')
ok('fora do talhão fica transparente', rgba[3] === 0)
ok('pixel válido recebe a cor da sua faixa (0,70 = bom)', `#${[...rgba.slice(4, 7)].map((v) => v.toString(16).padStart(2, '0')).join('')}` === '#65a30d')
ok('nuvem fica cinza, não verde', rgba[8] === 148 && rgba[9] === 163)
ok('NDVI negativo cai na primeira faixa', `#${[...rgba.slice(12, 15)].map((v) => v.toString(16).padStart(2, '0')).join('')}` === '#b91c1c')
const dist = distribuicaoPorFaixa(resposta, 'ndvi')
ok('a distribuição soma 100% só com pixels válidos', Math.abs(dist.reduce((s, f) => s + f.pct, 0) - 100) < 1e-9 && dist.length === faixasDoIndice('ndvi').length)

if (falhas) {
  console.log(`\n${falhas} falha(s)`)
  process.exit(1)
}
console.log('\nTudo certo.')
