import {
  CONTENCAO, TOLERANCIA_FORA,
  avaliarContencao, glebaDentroDoTalhao, pontoFeature, areaEmHectares,
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

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' FALHA(S)'}`)
process.exit(falhas === 0 ? 0 : 1)
