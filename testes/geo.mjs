import { mesmaGeometria } from '../src/lib/geo.js'
import { descartarPedacosMinusculos, AREA_MINIMA_DO_PEDACO_M2 } from '../src/lib/divisaoPorPontos.js'
import {
  CONTENCAO, TOLERANCIA_FORA,
  avaliarContencao, glebaDentroDoTalhao, pontoFeature, areaEmHectares,
  combinarGeometrias,
} from '../src/lib/geo.js'

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

// Talhao quadrado de 0,01 grau de lado (~1,1 km), perto de Vicosa-MG.
const quadrado = (x0, y0, x1, y1) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
})

const TALHAO = quadrado(-42.90, -20.80, -42.89, -20.79)

console.log('=== ponto: ou esta dentro, ou nao esta ===')
ok('ponto no meio esta dentro',
   avaliarContencao(pontoFeature(-20.795, -42.895), TALHAO).situacao === CONTENCAO.DENTRO)
ok('ponto longe esta fora',
   avaliarContencao(pontoFeature(-20.70, -42.80), TALHAO).situacao === CONTENCAO.FORA)
// Ponto nao tem area para tolerar: um ponto de coleta fora do talhao e sempre
// engano, por menor que seja a distancia.
ok('ponto pouco fora tambem esta fora',
   avaliarContencao(pontoFeature(-20.7899, -42.895), TALHAO).situacao === CONTENCAO.FORA)
ok('ponto na borda conta como dentro',
   avaliarContencao(pontoFeature(-20.79, -42.895), TALHAO).situacao === CONTENCAO.DENTRO)

console.log('\n=== sub-area inteiramente dentro ===')
const dentro = quadrado(-42.897, -20.797, -42.893, -20.793)
const rDentro = avaliarContencao(dentro, TALHAO)
ok('situacao dentro', rDentro.situacao === CONTENCAO.DENTRO)
ok('nada fora', rDentro.fracaoFora === 0, String(rDentro.fracaoFora))

console.log('\n=== REGRA: encostar na divisa nao reprova ===')
// Sub-area colada na borda esquerda do talhao, escapando um fio. E o que o
// snap produz: o vertice gruda na borda e o arredondamento o joga para fora.
const naDivisa = quadrado(-42.9000001, -20.797, -42.896, -20.793)
const rDivisa = avaliarContencao(naDivisa, TALHAO)
ok('passa como dentro', rDivisa.situacao === CONTENCAO.DENTRO,
   `fracaoFora=${rDivisa.fracaoFora?.toExponential(2)}`)
ok('e a fracao fora e mesmo irrisoria', rDivisa.fracaoFora < TOLERANCIA_FORA)

console.log('\n=== REGRA: escapar de verdade reprova ===')
// Metade para fora, pela esquerda.
const metadeFora = quadrado(-42.902, -20.797, -42.898, -20.793)
const rMetade = avaliarContencao(metadeFora, TALHAO)
ok('situacao fora', rMetade.situacao === CONTENCAO.FORA, `fracaoFora=${rMetade.fracaoFora.toFixed(3)}`)
ok('mede perto de metade', Math.abs(rMetade.fracaoFora - 0.5) < 0.05, String(rMetade.fracaoFora))
ok('informa a area fora em hectares', rMetade.areaForaHa > 0, `${rMetade.areaForaHa} ha`)

const todaFora = quadrado(-42.88, -20.78, -42.87, -20.77)
const rFora = avaliarContencao(todaFora, TALHAO)
ok('sub-area totalmente fora', rFora.situacao === CONTENCAO.FORA)
ok('fracao fora = 1', Math.abs(rFora.fracaoFora - 1) < 0.001, String(rFora.fracaoFora))

console.log('\n=== o limite da tolerancia ===')
// Um pouco acima de 1% tem que reprovar; um pouco abaixo, passar.
// Sub-area de 0,004 grau de lado; escapando 0,00002 grau pela esquerda,
// a fatia fora e ~0,5% da area.
const quaseNoLimite = quadrado(-42.90002, -20.797, -42.896, -20.793)
ok('0,5% fora passa', avaliarContencao(quaseNoLimite, TALHAO).situacao === CONTENCAO.DENTRO,
   String(avaliarContencao(quaseNoLimite, TALHAO).fracaoFora))
// Escapando 0,0001 grau: ~2,5% da area.
const acimaDoLimite = quadrado(-42.9001, -20.797, -42.896, -20.793)
ok('2,5% fora reprova', avaliarContencao(acimaDoLimite, TALHAO).situacao === CONTENCAO.FORA,
   String(avaliarContencao(acimaDoLimite, TALHAO).fracaoFora))

console.log('\n=== REGRA: nao saber conferir nunca bloqueia ===')
ok('talhao sem geometria', avaliarContencao(dentro, null).situacao === CONTENCAO.NAO_VERIFICAVEL)
ok('gleba sem geometria', avaliarContencao(null, TALHAO).situacao === CONTENCAO.NAO_VERIFICAVEL)
ok('talhao que e ponto, nao poligono',
   avaliarContencao(dentro, pontoFeature(-20.79, -42.89)).situacao === CONTENCAO.NAO_VERIFICAVEL)
ok('glebaDentroDoTalhao devolve null, nao false',
   glebaDentroDoTalhao(dentro, null) === null)

console.log('\n=== compatibilidade: glebaDentroDoTalhao ===')
// O cadastro em lote continua usando o sim/nao, e la sao pontos.
ok('ponto dentro -> true', glebaDentroDoTalhao(pontoFeature(-20.795, -42.895), TALHAO) === true)
ok('ponto fora -> false', glebaDentroDoTalhao(pontoFeature(-20.70, -42.80), TALHAO) === false)
ok('divisa tolerada -> true', glebaDentroDoTalhao(naDivisa, TALHAO) === true)

console.log('\n=== area (nao mexemos nisso, mas nao pode quebrar) ===')
ok('poligono tem area', areaEmHectares(TALHAO) > 0, `${areaEmHectares(TALHAO)} ha`)
ok('ponto nao tem area', areaEmHectares(pontoFeature(-20.79, -42.89)) === null)

console.log('\n=== combinarGeometrias: mesclar talhões ===')
const vizinho1 = quadrado(-42.90, -20.80, -42.89, -20.79)
const vizinho2 = quadrado(-42.89, -20.80, -42.88, -20.79)
const combinada = combinarGeometrias([vizinho1, vizinho2])
ok('vira MultiPolygon com dois polígonos', combinada.geometry.type === 'MultiPolygon')
ok('um polígono por entrada', combinada.geometry.coordinates.length === 2)
ok('área é a soma das duas (não se sobrepõem)',
   Math.abs(areaEmHectares(combinada) - (areaEmHectares(vizinho1) + areaEmHectares(vizinho2))) < 0.01,
   `${areaEmHectares(combinada)} vs ${areaEmHectares(vizinho1) + areaEmHectares(vizinho2)}`)

ok('uma entrada só continua Polygon, não vira MultiPolygon à toa',
   combinarGeometrias([vizinho1]).geometry.type === 'Polygon')

const jaMulti = { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [vizinho1.geometry.coordinates, vizinho2.geometry.coordinates] } }
const vizinho3 = quadrado(-42.88, -20.80, -42.87, -20.79)
const combinadaComMulti = combinarGeometrias([jaMulti, vizinho3])
ok('achata um MultiPolygon de entrada em vez de aninhar',
   combinadaComMulti.geometry.coordinates.length === 3,
   String(combinadaComMulti.geometry.coordinates.length))

ok('lista vazia devolve null', combinarGeometrias([]) === null)
ok('só geometria nula/sem área devolve null', combinarGeometrias([null, undefined]) === null)

console.log('\n=== mesmaGeometria: a régua do mapa (6 casas) ===')
{
  const f = (coords) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } })
  const original = f([[-49.57507584109174, -9.335281629308161], [-49.5749, -9.3355], [-49.5748, -9.3353], [-49.57507584109174, -9.335281629308161]])
  // o mesmo desenho depois de passar pelo mapa (arredondado a 6 casas)
  const doMapa = f([[-49.575076, -9.335282], [-49.5749, -9.3355], [-49.5748, -9.3353], [-49.575076, -9.335282]])
  ok('a geometria relida do mapa (arredondada) é a mesma', mesmaGeometria(original, doMapa))
  const mexida = f([[-49.575076, -9.335282], [-49.5749, -9.3355], [-49.5747, -9.3353], [-49.575076, -9.335282]])
  ok('um vértice movido é detectado', !mesmaGeometria(original, mexida))
  ok('tipos diferentes são diferentes', !mesmaGeometria(original, { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }))
  ok('ausente nunca é igual', !mesmaGeometria(original, null) && !mesmaGeometria(null, null))
  const abaixoDe6 = f([[-49.5750758, -9.3352816], [-49.5749, -9.3355], [-49.5748, -9.3353], [-49.5750758, -9.3352816]])
  ok('diferença abaixo de 6 casas não conta como mexida', mesmaGeometria(original, abaixoDe6))
}

console.log('\n=== descartarPedacosMinusculos: fiapos da divisão do talhão ===')
{
  const quadrado = (x, y, lado) => [[[x, y], [x + lado, y], [x + lado, y + lado], [x, y + lado], [x, y]]]
  const feature = (poligonos) => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: poligonos } })
  // 0,01 grau = ~1,1 km (grande); 0,00002 grau = ~2 m (fiapo de ~5 m²); 0,0005 grau = ~55 m (~3.000 m²)
  const grande = quadrado(-49.58, -9.34, 0.01)
  const fiapo = quadrado(-49.5, -9.3, 0.00002)
  const real = quadrado(-49.57, -9.33, 0.0005)

  const r1 = descartarPedacosMinusculos(feature([grande, fiapo]))
  ok('tira o fiapo e o que sobra num pedaço só vira Polygon', r1.geometry.type === 'Polygon' && r1.geometry.coordinates === grande)
  const r2 = descartarPedacosMinusculos(feature([grande, real, fiapo]))
  ok('mantém os pedaços reais, mesmo pequenos (3.000 m²)', r2.geometry.type === 'MultiPolygon' && r2.geometry.coordinates.length === 2)
  const original = feature([grande, real])
  ok('nada a tirar devolve a MESMA feature (sem copiar)', descartarPedacosMinusculos(original) === original)
  const r3 = descartarPedacosMinusculos(feature([fiapo, quadrado(-49.4, -9.2, 0.00001)]))
  ok('se todos forem fiapos, fica com o maior (nunca devolve vazio)', r3.geometry.type === 'Polygon' && r3.geometry.coordinates === fiapo)
  const poligono = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: grande } }
  ok('Polygon e ponto passam direto', descartarPedacosMinusculos(poligono) === poligono)
  ok('o limite é de 100 m²', AREA_MINIMA_DO_PEDACO_M2 === 100)
}

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' FALHA(S)'}`)
process.exit(falhas === 0 ? 0 : 1)
