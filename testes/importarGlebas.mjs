import assert from 'node:assert/strict'
import { sugerirCodigoGleba, talhaoQueContem, prepararLinhasDeGlebas, errosDasLinhasDeGlebas } from '../src/lib/importarGlebas.js'
import { candidatosDoArquivo } from '../src/lib/importarArquivo.js'
import { candidatosDoKml } from '../src/lib/kml.js'
import { CONTENCAO } from '../src/lib/geo.js'

const quadrado = (x0, y0, x1, y1) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
})
const ponto = (lng, lat) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } })

const talhoes = [
  { id: 't1', codigo: '1', geometria: quadrado(-49.01, -9.01, -49.0, -9.0) },
  { id: 't2', codigo: '2', geometria: quadrado(-49.0, -9.01, -48.99, -9.0) },
  { id: 't3', codigo: '3', geometria: null }, // sem desenho: nunca responde
]

// --- nome -> código ---
assert.deepEqual(sugerirCodigoGleba('Gleba 12 - Mata'), { codigo: '12', nome: 'Mata' })
assert.deepEqual(sugerirCodigoGleba('gleba 7'), { codigo: '7', nome: '' })
assert.deepEqual(sugerirCodigoGleba('5-12'), { codigo: '5-12', nome: '' })
assert.deepEqual(sugerirCodigoGleba(null), { codigo: '', nome: '' })

// --- em que talhão a gleba cai ---
assert.equal(talhaoQueContem(quadrado(-49.008, -9.008, -49.004, -9.004), talhoes)?.id, 't1')
assert.equal(talhaoQueContem(ponto(-48.995, -9.005), talhoes)?.id, 't2', 'ponto dentro do talhão 2')
assert.equal(talhaoQueContem(quadrado(-49.002, -9.008, -48.998, -9.004), talhoes), null, 'atravessa a divisa: não escolhe sozinho')
assert.equal(talhaoQueContem(ponto(-40, -9), talhoes), null, 'fora de todos')
assert.equal(talhaoQueContem(quadrado(-49.008, -9.008, -49.004, -9.004), [{ id: 'tx', codigo: 'x', geometria: null }]), null)
const sobrepostos = [
  { id: 'a', codigo: 'a', geometria: quadrado(-49.01, -9.01, -49.0, -9.0) },
  { id: 'b', codigo: 'b', geometria: quadrado(-49.01, -9.01, -49.0, -9.0) },
]
assert.equal(talhaoQueContem(ponto(-49.005, -9.005), sobrepostos), null, 'cabe em dois talhões: ambíguo, quem escolhe é a pessoa')

// --- linhas de revisão ---
const candidatos = [
  { nomeOriginal: 'Gleba 1', geometria: quadrado(-49.008, -9.008, -49.004, -9.004), arquivo: 'a.geojson' },
  { nomeOriginal: 'Gleba 1', geometria: quadrado(-49.009, -9.003, -49.007, -9.001), arquivo: 'a.geojson' }, // mesmo código, mesmo talhão
  { nomeOriginal: 'Gleba 1', geometria: ponto(-48.995, -9.005), arquivo: 'a.geojson' }, // mesmo código, outro talhão
  { nomeOriginal: 'Fora', geometria: ponto(-40, -9), arquivo: 'a.geojson' },
]
const linhas = prepararLinhasDeGlebas(candidatos, talhoes)
assert.equal(linhas.length, 4)
assert.deepEqual(linhas.map((l) => l.codigo), ['1', '1-2', '1', 'Fora'], 'repetido no MESMO talhão ganha sufixo; em outro talhão não')
assert.deepEqual(linhas.map((l) => l.talhaoId), ['t1', 't1', 't2', ''])
assert.equal(linhas[0].talhaoAutomatico, true)
assert.equal(linhas[3].talhaoAutomatico, false)
assert.ok(linhas[0].areaHa > 0, 'polígono tem área')
assert.equal(linhas[2].areaHa, null, 'ponto não tem área: nulo, nunca zero')

// --- erros que travam a importação ---
const semFora = () => CONTENCAO.DENTRO
let erros = errosDasLinhasDeGlebas(linhas, { talhoes, glebasExistentes: [], contencaoDe: semFora })
assert.deepEqual(erros.get(linhas[0].id), [])
assert.deepEqual(erros.get(linhas[1].id), [])
assert.match(erros.get(linhas[3].id).join(' '), /Escolha o talhão/)

// código que já existe no talhão
erros = errosDasLinhasDeGlebas(linhas, { talhoes, glebasExistentes: [{ talhao_id: 't1', codigo: '1' }], contencaoDe: semFora })
assert.match(erros.get(linhas[0].id).join(' '), /Já existe a gleba "1" no talhão 1/)
assert.deepEqual(erros.get(linhas[2].id), [], 'o mesmo código em outro talhão não conflita')

// repetido na importação (editado à mão)
const repetidas = linhas.map((l) => (l.id === linhas[1].id ? { ...l, codigo: '1' } : l))
erros = errosDasLinhasDeGlebas(repetidas, { talhoes, glebasExistentes: [], contencaoDe: semFora })
assert.match(erros.get(linhas[0].id).join(' '), /repetido/i)
assert.match(erros.get(linhas[1].id).join(' '), /repetido/i)

// talhão escolhido à mão onde a gleba não cabe
const emOutro = linhas.map((l) => (l.id === linhas[0].id ? { ...l, talhaoId: 't2', talhaoAutomatico: false } : l))
erros = errosDasLinhasDeGlebas(emOutro, {
  talhoes,
  glebasExistentes: [],
  contencaoDe: (linha, talhao) => (linha.id === linhas[0].id && talhao.id === 't2' ? CONTENCAO.FORA : CONTENCAO.DENTRO),
})
assert.match(erros.get(linhas[0].id).join(' '), /fora do talhão 2/i)

// código vazio, e linha desmarcada não gera erro
const vazia = linhas.map((l) => (l.id === linhas[0].id ? { ...l, codigo: '  ' } : l.id === linhas[3].id ? { ...l, incluir: false } : l))
erros = errosDasLinhasDeGlebas(vazia, { talhoes, glebasExistentes: [], contencaoDe: semFora })
assert.match(erros.get(linhas[0].id).join(' '), /Código obrigatório/)
assert.equal(erros.has(linhas[3].id), false, 'linha desmarcada não é validada')

// --- leitura de arquivo: pontos só no modo de glebas ---
const geojson = (features) => new File([JSON.stringify({ type: 'FeatureCollection', features })], 'glebas.geojson')
const poligonoF = { type: 'Feature', properties: { id: 7 }, geometry: quadrado(0, 0, 1, 1).geometry }
const pontoF = { type: 'Feature', properties: { gleba: '12' }, geometry: { type: 'Point', coordinates: [1, 2] } }
const multiponto = { type: 'Feature', properties: { nome: 'Amostras' }, geometry: { type: 'MultiPoint', coordinates: [[1, 1], [2, 2]] } }

const soTalhoes = await candidatosDoArquivo(geojson([poligonoF, pontoF]))
assert.deepEqual(soTalhoes.map((c) => c.geometria.geometry.type), ['Polygon'], 'sem a opção, ponto continua ignorado (talhões)')
assert.equal(soTalhoes[0].nomeOriginal, 'Polígono 1', 'em talhões, um "id" qualquer não vira código sugerido')

const comPontos = await candidatosDoArquivo(geojson([poligonoF, pontoF, multiponto]), { pontos: true })
assert.deepEqual(comPontos.map((c) => c.geometria.geometry.type), ['Polygon', 'Point', 'Point', 'Point'])
assert.deepEqual(comPontos.map((c) => c.nomeOriginal).slice(0, 2), ['7', '12'], 'em glebas, "id" e "gleba" dão o nome')
await assert.rejects(() => candidatosDoArquivo(geojson([{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }]), { pontos: true }), /Nenhum polígono nem ponto/)

// KML: Placemark de ponto, só com a opção
const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>Gleba 3</name><Point><coordinates>-49.5,-9.5,0</coordinates></Point></Placemark>
  <Placemark><name>Gleba 4</name><Polygon><outerBoundaryIs><LinearRing><coordinates>0,0 1,0 1,1 0,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`
assert.deepEqual(candidatosDoKml(kml).map((c) => c.nomeOriginal), ['Gleba 4'])
const kmlComPontos = candidatosDoKml(kml, { pontos: true })
assert.deepEqual(kmlComPontos.map((c) => [c.nomeOriginal, c.geometria.geometry.type]), [['Gleba 3', 'Point'], ['Gleba 4', 'Polygon']])
assert.deepEqual(kmlComPontos[0].geometria.geometry.coordinates, [-49.5, -9.5], 'altitude descartada')

console.log('importar glebas: leitura, talhão pela posição e validações OK')
