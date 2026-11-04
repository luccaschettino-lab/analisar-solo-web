import * as servidor from '../supabase/functions/_shared/indicesCbers.js'
import { latLngParaUtm, utmParaLatLng } from '../supabase/functions/_shared/utm.js'
import * as tela from '../src/lib/indicesVegetacao.js'
import { PIXEL, pixelsDoIndice, distribuicaoPorFaixa, faixasDoIndice } from '../src/lib/rasterIndice.js'

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

console.log('Calibração')
const d = servidor.distanciaTerraSol('2026-01-04T12:00:00')
ok('periélio (4 de janeiro): ~0,98328 UA', Math.abs(d - 0.98328) < 1e-4, String(d))
const dJul = servidor.distanciaTerraSol('2026-07-04T12:00:00')
ok('afélio (4 de julho): ~1,01672 UA', Math.abs(dJul - 1.01672) < 1e-4, String(dJul))
const esperado = (Math.PI * 100 * 0.946315 * 1 * 1) / (1536.38 * Math.cos(((90 - 49.04) * Math.PI) / 180))
ok('reflectância no topo, conta conferida à mão', Math.abs(servidor.reflectanciaTopo(100, 0.946315, 1536.38, 1, 49.04) - esperado) < 1e-12)
const xml = `<a><sunPosition><elevation>63.7</elevation></sunPosition><absoluteCalibrationCoefficient><band name="5">0.947982</band><band name="8">0.739644</band></absoluteCalibrationCoefficient></a>`
const cal = servidor.lerCalibracao(xml)
ok('lê os coeficientes e a elevação do sol do XML', cal.coeficientes[5] === 0.947982 && cal.coeficientes[8] === 0.739644 && cal.elevacao === 63.7)
let recusou = false
try { servidor.lerCalibracao('<a/>') } catch { recusou = true }
ok('XML sem calibração é recusado, não vira índice errado', recusou)

console.log('Projeção UTM')
const [e, n] = latLngParaUtm(-9.3339, -49.5687, 22, true)
const [lat, lng] = utmParaLatLng(e, n, 22, true)
ok('ida e volta lat/lng ↔ UTM', Math.abs(lat + 9.3339) < 1e-9 && Math.abs(lng + 49.5687) < 1e-9)

console.log('Segurança da função')
const email = 'segredo@exemplo.org'
const itemFalso = { properties: { datetime: '2026-08-04T13:17:07' }, assets: Object.fromEntries(['blue', 'green', 'red', 'nir'].flatMap((b) => [[b, { href: `https://www.dgi.inpe.br/api/download/TIFF/${b}.tif` }], [`${b}_xml`, { href: `https://www.dgi.inpe.br/api/download/TIFF/${b}.xml` }]])) }
const fetchNegado = async (url) => {
  if (String(url).includes('/items/')) return new Response(JSON.stringify(itemFalso), { status: 200 })
  return new Response('negado', { status: 403 })
}
let mensagem = ''
try { await servidor.calcularIndicesDoTalhao({ cenaId: 'CBERS4A_MUX21012520260804ETC2', geometria: { type: 'Polygon', coordinates: [[[-49.57, -9.33], [-49.56, -9.33], [-49.56, -9.32], [-49.57, -9.33]]] }, email, buscar: fetchNegado }) } catch (x) { mensagem = x.message }
ok('acesso negado dá erro claro', /recusou o acesso/.test(mensagem), mensagem)
ok('o e-mail do INPE nunca aparece na mensagem de erro', !mensagem.includes(email))
let foraDoInpe = ''
const itemMalicioso = { ...itemFalso, assets: { ...itemFalso.assets, blue: { href: 'https://outro-site.exemplo/b.tif' } } }
try { await servidor.calcularIndicesDoTalhao({ cenaId: 'CBERS4A_MUX21012520260804ETC2', geometria: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, email, buscar: async () => new Response(JSON.stringify(itemMalicioso), { status: 200 }) }) } catch (x) { foraDoInpe = x.message }
ok('endereço de banda fora do INPE é recusado (o e-mail não vaza para terceiros)', /fora do INPE/.test(foraDoInpe), foraDoInpe)
let idRuim = ''
try { await servidor.calcularIndicesDoTalhao({ cenaId: '../../etc/passwd', geometria: {}, email }) } catch (x) { idRuim = x.message }
ok('identificador de cena fora do padrão é recusado', /inválido/.test(idRuim))

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
