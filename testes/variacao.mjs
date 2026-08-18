import {
  LADO, VARIACAO, FRACAO_PADRAO,
  amplitudeDasFaixas, limiarDe, compararAnos, criarColoracaoVariacao,
  filtroComparacaoCompleto, anosRepetidos, contarEstados,
} from '../src/lib/variacao.js'
import {
  escalaDivergente, corDaVariacao, fracaoNaEscala, interpolarCor,
} from '../src/lib/escalaDivergente.js'
import { textoDaAusencia } from '../src/lib/textosVariacao.js'
import { COLUNAS, ordenarLinhas } from '../src/lib/ordenarVariacao.js'
import { PARAMETROS, CHAVES_PARAMETROS } from '../src/config/parametros.js'
import { CINZA_NEUTRO, CINZA_HACHURA, ESCALA_DIVERGENTE } from '../src/config/mapa.js'

const A = (gleba, ano, prof, campos) => ({ gleba_id: gleba, ano_safra: ano, profundidade: prof, ...campos })
const G = (id, codigo) => ({ id, codigo, nome: null })

const ANO_A = '24-25'
const ANO_B = '25-26'
const FILTRO = { anoA: ANO_A, anoB: ANO_B, profundidade: '0-20', chaveParametro: 'ca' }

// Ca tem faixas de 0,4 a 4,0 — amplitude 3,6, limiar padrao 0,18.
const glebas = [G('g1', 'A-01'), G('g2', 'A-02'), G('g3', 'A-03'), G('g4', 'A-04'),
                G('g5', 'A-05'), G('g6', 'A-06'), G('g7', 'A-07')]

const analises = [
  // g1 sobe 1,0 · g2 cai 2,0 (o maior |delta|) · g3 mexe 0,1, abaixo do limiar
  A('g1', ANO_A, '0-20', { ca: 2.0 }),   A('g1', ANO_B, '0-20', { ca: 3.0 }),
  A('g2', ANO_A, '0-20', { ca: 3.0 }),   A('g2', ANO_B, '0-20', { ca: 1.0 }),
  A('g3', ANO_A, '0-20', { ca: 1.0 }),   A('g3', ANO_B, '0-20', { ca: 1.1 }),
  // g4 so tem o ano A · g5 foi amostrada no ano A mas o laboratorio nao mediu Ca
  A('g4', ANO_A, '0-20', { ca: 1.5 }),
  A('g5', ANO_A, '0-20', { ca: null }),  A('g5', ANO_B, '0-20', { ca: 2.0 }),
  // g6 nao aparece em ano nenhum · g7 parte de zero
  A('g7', ANO_A, '0-20', { ca: 0 }),     A('g7', ANO_B, '0-20', { ca: 0.5 }),
  // ruido: outra profundidade e outro ano nao podem entrar na conta
  A('g1', ANO_B, '20-40', { ca: 99 }),
  A('g1', '23-24', '0-20', { ca: 99 }),
]

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}
const perto = (a, b, tol = 1e-9) => Math.abs(a - b) < tol

console.log('=== limiar: config, senao 5% da amplitude, senao zero ===')
ok('amplitude do Ca e 3,6', perto(amplitudeDasFaixas('ca'), 3.6), String(amplitudeDasFaixas('ca')))
ok('limiar do Ca e 0,18', perto(limiarDe('ca'), 3.6 * FRACAO_PADRAO), String(limiarDe('ca')))
ok('limiar do K e 5,25', perto(limiarDe('k'), 5.25), String(limiarDe('k')))
ok('limiar do pH e 0,125', perto(limiarDe('ph_h2o'), 0.125), String(limiarDe('ph_h2o')))
ok('parametro sem faixas tem amplitude nula', amplitudeDasFaixas('p') === null)
ok('REGRA: sem faixas, limiar ZERO', limiarDe('p') === 0, String(limiarDe('p')))
ok('chave inexistente nao explode', limiarDe('nao_existe') === 0)
ok('todos os 24 tem limiar finito e nao negativo',
   CHAVES_PARAMETROS.every((c) => Number.isFinite(limiarDe(c)) && limiarDe(c) >= 0))

// Guarda da documentacao: o config diz que nenhum parametro declara
// delta_minimo hoje. Se algum passar a declarar, a doc precisa mudar junto.
const declaram = PARAMETROS.filter((p) => p.delta_minimo !== undefined).map((p) => p.chave)
ok('nenhum parametro declara delta_minimo (doc do config)', declaram.length === 0, declaram.join(','))

console.log('\n=== filtro: os dois anos nao podem ser iguais ===')
ok('quatro campos e anos diferentes', filtroComparacaoCompleto(FILTRO))
ok('anos iguais reprova', !filtroComparacaoCompleto({ ...FILTRO, anoB: ANO_A }))
ok('anosRepetidos detecta', anosRepetidos({ anoA: ANO_A, anoB: ANO_A }))
ok('anosRepetidos nao acusa com um vazio', !anosRepetidos({ anoA: ANO_A, anoB: '' }))
ok('falta profundidade reprova', !filtroComparacaoCompleto({ ...FILTRO, profundidade: '' }))
ok('falta parametro reprova', !filtroComparacaoCompleto({ ...FILTRO, chaveParametro: '' }))
ok('compararAnos devolve null com anos iguais', compararAnos(analises, glebas, { ...FILTRO, anoB: ANO_A }) === null)

console.log('\n=== os cinco estados ===')
const comp = compararAnos(analises, glebas, FILTRO)
const por = Object.fromEntries(comp.linhas.map((l) => [l.glebaId, l]))

ok('g1 ALTA', por.g1.estado === VARIACAO.ALTA, `delta=${por.g1.delta}`)
ok('g2 QUEDA', por.g2.estado === VARIACAO.QUEDA, `delta=${por.g2.delta}`)
ok('g3 ESTAVEL (0,1 < limiar 0,18)', por.g3.estado === VARIACAO.ESTAVEL, `delta=${por.g3.delta.toFixed(4)}`)
ok('g4 SEM_UM_ANO', por.g4.estado === VARIACAO.SEM_UM_ANO)
ok('g5 SEM_UM_ANO', por.g5.estado === VARIACAO.SEM_UM_ANO)
ok('g6 SEM_OS_DOIS', por.g6.estado === VARIACAO.SEM_OS_DOIS)

console.log('\n=== o filtro recorta safra E profundidade ===')
ok('g1 usou 2,0 -> 3,0, nao o 99 de outra profundidade', perto(por.g1.delta, 1.0), `delta=${por.g1.delta}`)
ok('delta e sempre B menos A', por.g1.a.valor === 2.0 && por.g1.b.valor === 3.0)
ok('percentual e (B-A)/|A|', perto(por.g1.percentual, 50), String(por.g1.percentual))

console.log('\n=== REGRA: zero e dado, nao ausencia ===')
ok('g7 lado A com valor 0 esta MEDIDO', por.g7.a.estado === LADO.MEDIDO && por.g7.a.valor === 0)
ok('g7 formata o zero, nao apaga', por.g7.a.formatado === '0,00', `"${por.g7.a.formatado}"`)
ok('g7 e comparavel', por.g7.estado === VARIACAO.ALTA && perto(por.g7.delta, 0.5))
ok('base zero: percentual null, tipo absoluta',
   por.g7.percentual === null && por.g7.tipoDiferenca === 'absoluta')

console.log('\n=== REGRA: faltar um ano nunca vira zero nem cor de variacao ===')
for (const chave of ['g4', 'g5']) {
  const l = por[chave]
  ok(`${chave} delta null`, l.delta === null)
  ok(`${chave} percentual null`, l.percentual === null)
  ok(`${chave} hachurado, cor de hachura`, l.cor === CINZA_HACHURA)
  ok(`${chave} nao e ESTAVEL`, l.estado !== VARIACAO.ESTAVEL)
}
ok('g4: falta o ano B, e diz que nao foi amostrada',
   por.g4.b.estado === LADO.SEM_ANALISE && textoDaAusencia(por.g4.b.estado) === 'não amostrada')
ok('g5: falta o ano A, e diz que nao foi medida',
   por.g5.a.estado === LADO.SEM_MEDICAO && textoDaAusencia(por.g5.a.estado) === 'não medida')
ok('g4 mantem o valor do ano que tem', por.g4.a.valor === 1.5 && por.g4.a.formatado === '1,50')

console.log('\n=== REGRA: sem dado nos dois anos fica cinza neutro, e nao some ===')
ok('g6 cinza neutro, sem hachura', por.g6.cor === CINZA_NEUTRO)
ok('g6 sem valor dos dois lados', por.g6.a.valor === null && por.g6.b.valor === null)
ok('nenhuma gleba sumiu do mapa', comp.linhas.length === glebas.length, `${comp.linhas.length}/${glebas.length}`)

console.log('\n=== coloracao entregue ao mapa ===')
const colorir = criarColoracaoVariacao(comp)
ok('g4 hachurado = true', colorir('g4').hachurado === true)
ok('g6 hachurado = false', colorir('g6').hachurado === false)
ok('g2 nao hachurado e com cor da rampa', colorir('g2').hachurado === false && colorir('g2').cor === ESCALA_DIVERGENTE.queda.forte)
ok('gleba desconhecida cai em cinza neutro', colorir('nao_existe').cor === CINZA_NEUTRO)
ok('sem comparacao, sem coloracao', criarColoracaoVariacao(null) === null)

console.log('\n=== REGRA: escala simetrica, ancorada no maior |delta| ===')
ok('max e 2,0 (a queda da g2)', perto(comp.max, 2.0), String(comp.max))
ok('escalaDivergente devolve min = -max', perto(escalaDivergente(comp.linhas).min, -2.0))
ok('a maior variacao vai a ponta forte', por.g2.cor === ESCALA_DIVERGENTE.queda.forte, por.g2.cor)
ok('alta de 1,0 nao chega a ponta forte', por.g1.cor !== ESCALA_DIVERGENTE.alta.forte, por.g1.cor)

// O ponto da simetria: mesma magnitude dos dois lados = mesma intensidade.
const sintetica = (delta) => ({ estado: delta > 0 ? VARIACAO.ALTA : VARIACAO.QUEDA, delta, limiar: 0.18 })
ok('+2 e -2 ancoram no mesmo extremo',
   corDaVariacao(sintetica(2), 2) === ESCALA_DIVERGENTE.alta.forte &&
   corDaVariacao(sintetica(-2), 2) === ESCALA_DIVERGENTE.queda.forte)
ok('+0,5 e -0,5 tem a mesma fracao na escala',
   perto(fracaoNaEscala(0.5, 0.18, 2), fracaoNaEscala(0.5, 0.18, 2)))
ok('fracao cresce com a magnitude', fracaoNaEscala(0.5, 0.18, 2) < fracaoNaEscala(1.5, 0.18, 2))
ok('fracao nunca passa de 1', fracaoNaEscala(99, 0.18, 2) === 1)
ok('fracao nunca fica negativa', fracaoNaEscala(0, 0.18, 2) === 0)
ok('unica variacao significativa vai ao extremo', fracaoNaEscala(0.5, 0.5, 0.5) === 1)
ok('estavel usa o neutro, nao a rampa',
   corDaVariacao({ estado: VARIACAO.ESTAVEL, delta: 0.01, limiar: 0.18 }, 2) === ESCALA_DIVERGENTE.estavel)
ok('interpolarCor devolve os extremos exatos',
   interpolarCor('#f4a582', '#b2182b', 0) === '#f4a582' && interpolarCor('#f4a582', '#b2182b', 1) === '#b2182b')

console.log('\n=== ordenacao ===')
const padrao = ordenarLinhas(comp.linhas, COLUNAS.MODULO, 'desc')
ok('padrao: maior variacao absoluta no topo', padrao[0].glebaId === 'g2', padrao.map((l) => l.glebaId).join(' '))
ok('padrao: segunda e a alta de 1,0', padrao[1].glebaId === 'g1')

const semDado = new Set(['g4', 'g5', 'g6'])
const ultimas = padrao.slice(-3).map((l) => l.glebaId)
ok('REGRA: sem dado afunda no desc', ultimas.every((id) => semDado.has(id)), ultimas.join(' '))
const asc = ordenarLinhas(comp.linhas, COLUNAS.MODULO, 'asc')
ok('REGRA: sem dado afunda tambem no asc', asc.slice(-3).every((l) => semDado.has(l.glebaId)),
   asc.map((l) => l.glebaId).join(' '))
ok('asc: menor variacao no topo', asc[0].glebaId === 'g3')

const porDelta = ordenarLinhas(comp.linhas, COLUNAS.DELTA, 'asc')
ok('delta com sinal: maior queda no topo', porDelta[0].glebaId === 'g2')
ok('delta com sinal desc: maior alta no topo', ordenarLinhas(comp.linhas, COLUNAS.DELTA, 'desc')[0].glebaId === 'g1')

const porGleba = ordenarLinhas(comp.linhas, COLUNAS.GLEBA, 'asc')
ok('por gleba: todas entram, nenhuma afunda', porGleba.length === glebas.length && porGleba[0].gleba.codigo === 'A-01')

const porClasse = ordenarLinhas(comp.linhas, COLUNAS.CLASSIFICACAO, 'asc')
ok('classificacao ordena do mais pobre ao mais rico', porClasse[0].nivelB === 'baixo',
   porClasse.map((l) => l.nivelB).join(' '))
// A prova de que nao e alfabetico: "Bom" vem antes de "Medio" no alfabeto, mas
// medio e o nivel mais rico dos dois e tem que vir depois.
const iMedio = porClasse.findIndex((l) => l.glebaId === 'g5')
const iBom = porClasse.findIndex((l) => l.glebaId === 'g1')
ok('classificacao nao ordena por alfabeto', iMedio < iBom, `medio=${iMedio} bom=${iBom}`)
ok('classificacao: g4 (sem valor em B) afunda', porClasse[porClasse.length - 1].nivelB === null)
ok('ordenar nao muta a lista original', comp.linhas[0].glebaId === 'g1')

console.log('\n=== classificacao mostrada e a do ano B ===')
ok('g1 classifica 3,0 e nao 2,0', por.g1.rotuloNivelB === 'Bom', `${por.g1.b.valor} -> ${por.g1.rotuloNivelB}`)
ok('g4 sem ano B nao tem classificacao', por.g4.nivelB === null && por.g4.rotuloNivelB === null)

console.log('\n=== parametro sem faixa: limiar zero, nada e estavel a esmo ===')
const compP = compararAnos(
  [A('g1', ANO_A, '0-20', { p: 10 }), A('g1', ANO_B, '0-20', { p: 10.1 }),
   A('g2', ANO_A, '0-20', { p: 10 }), A('g2', ANO_B, '0-20', { p: 10 })],
  [G('g1', 'A-01'), G('g2', 'A-02')],
  { ...FILTRO, chaveParametro: 'p' },
)
const pPor = Object.fromEntries(compP.linhas.map((l) => [l.glebaId, l]))
ok('mudanca minima aparece como alta', pPor.g1.estado === VARIACAO.ALTA, `delta=${pPor.g1.delta.toFixed(4)}`)
ok('so delta exatamente zero e estavel', pPor.g2.estado === VARIACAO.ESTAVEL && pPor.g2.delta === 0)

console.log('\n=== contagem do resumo ===')
const c = contarEstados(comp.linhas)
ok('conta os cinco estados', c.alta === 2 && c.queda === 1 && c.estavel === 1 && c.sem_um_ano === 2 && c.sem_os_dois === 1,
   JSON.stringify(c))
ok('a soma bate com o total de glebas',
   Object.values(c).reduce((s, n) => s + n, 0) === glebas.length)

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' FALHA(S)'}`)
process.exit(falhas === 0 ? 0 : 1)
