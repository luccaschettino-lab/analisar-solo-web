import {
  ESTADO,
  filtroCompleto, indexarAnalises, resolverAmostra, resolverTalhao, criarColoracao,
  faixasParaLegenda, temFaixas, anosDisponiveis, profundidadesDisponiveis,
} from '../src/lib/coloracao.js'
import { NIVEIS, CHAVES_PARAMETROS } from '../src/config/parametros.js'
import { CINZA_NEUTRO, CINZA_HACHURA } from '../src/config/mapa.js'
import { pontoFeature } from '../src/lib/geo.js'

const P = (lat, lng) => pontoFeature(lat, lng)
const A = (talhao, ano, prof, campos) => ({
  id: `${talhao}-${ano}-${prof}-${Math.random().toString(36).slice(2, 6)}`,
  talhao_id: talhao,
  ano_safra: ano,
  profundidade: prof,
  geometria: P(-20.79, -42.89),
  ...campos,
})

// t1 medido (1 ponto); t2 medido com al = 0; t3 amostrado mas sem pH; t4 sem análise nenhuma
const analises = [
  A('t1', '25-26', '0-20',  { ph_h2o: 6.0, al: 0.45, p: 18.9 }),
  A('t2', '25-26', '0-20',  { ph_h2o: 4.2, al: 0,    p: 3.1  }),
  A('t3', '25-26', '0-20',  { ph_h2o: null, al: 1.5, p: null }),
  A('t1', '24-25', '0-20',  { ph_h2o: 5.5 }),
  A('t1', '25-26', '20-40', { ph_h2o: 5.3 }),
]

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

console.log('=== filtroCompleto ===')
ok('os tres preenchidos', filtroCompleto({ anoSafra: '25-26', profundidade: '0-20', chaveParametro: 'ph_h2o' }))
ok('falta parametro', !filtroCompleto({ anoSafra: '25-26', profundidade: '0-20', chaveParametro: '' }))
ok('falta safra', !filtroCompleto({ anoSafra: '', profundidade: '0-20', chaveParametro: 'ph_h2o' }))
ok('falta profundidade', !filtroCompleto({ anoSafra: '25-26', profundidade: '', chaveParametro: 'ph_h2o' }))

console.log('\n=== indexarAnalises (recorta por safra E profundidade, agrupa por talhão) ===')
const idx = indexarAnalises(analises, { anoSafra: '25-26', profundidade: '0-20' })
ok('devolveu 3 talhoes', idx.size === 3, `size=${idx.size}`)
ok('cada talhao vira array', Array.isArray(idx.get('t1')))
ok('nao trouxe a de 24-25', idx.get('t1')[0].ph_h2o === 6.0, `ph=${idx.get('t1')[0].ph_h2o}`)
ok('nao trouxe a de 20-40', idx.get('t1').length === 1)

console.log('\n=== resolverAmostra: uma linha por vez ===')
ok('sem analise -> SEM_ANALISE', resolverAmostra(null, 'ph_h2o').estado === ESTADO.SEM_ANALISE)
ok('analise sem medicao -> SEM_MEDICAO',
   resolverAmostra(A('x', '25-26', '0-20', { ph_h2o: null }), 'ph_h2o').estado === ESTADO.SEM_MEDICAO)
const amostra1 = resolverAmostra(analises[0], 'ph_h2o')
ok('amostra medida -> COM_COR', amostra1.estado === ESTADO.COM_COR, amostra1.rotuloNivel)
ok('cor vem do config', amostra1.cor === NIVEIS[amostra1.nivel].cor)

console.log('\n=== resolverTalhao: agrega os pontos de um talhao ===')
const cor = criarColoracao(analises, { anoSafra: '25-26', profundidade: '0-20', chaveParametro: 'ph_h2o' })
const r1 = cor('t1'), r2 = cor('t2'), r3 = cor('t3'), r4 = cor('t4')

ok('t1 COM_COR', r1.estado === ESTADO.COM_COR, `${r1.valorFormatado} / ${r1.rotuloNivel} / ${r1.cor}`)
ok('t1 cor vem do config', r1.cor === NIVEIS[r1.nivel].cor)
ok('t1 nao hachurado', r1.hachurado === false)
ok('t1 tem 1 ponto', r1.pontos.length === 1)
ok('t1 ponto tem lat/lng', r1.pontos[0].lat != null && r1.pontos[0].lng != null)
ok('t2 COM_COR (pH 4,2)', r2.estado === ESTADO.COM_COR, `${r2.valorFormatado} / ${r2.rotuloNivel}`)
ok('tooltip do pH usa rotulo proprio', r1.rotuloNivel === 'Ideal' && r2.rotuloNivel === 'Muito ácido',
   `t1="${r1.rotuloNivel}" t2="${r2.rotuloNivel}"`)
ok('t3 SEM_MEDICAO', r3.estado === ESTADO.SEM_MEDICAO, `"${r3.valorFormatado}"`)
ok('t3 hachurado', r3.hachurado === true && r3.cor === CINZA_HACHURA)
ok('t3 ponto entra na lista, sem nivel', r3.pontos.length === 1 && r3.pontos[0].nivel === null)
ok('t4 SEM_ANALISE', r4.estado === ESTADO.SEM_ANALISE, `"${r4.valorFormatado}"`)
ok('t4 hachurado', r4.hachurado === true)
ok('t4 sem pontos', r4.pontos.length === 0)

console.log('\n=== REGRA: media de varios pontos no mesmo talhao ===')
const doisPontos = [
  A('t5', '25-26', '0-20', { ph_h2o: 5.0 }),
  A('t5', '25-26', '0-20', { ph_h2o: 7.0 }),
]
const corMedia = criarColoracao(doisPontos, { anoSafra: '25-26', profundidade: '0-20', chaveParametro: 'ph_h2o' })
const r5 = corMedia('t5')
ok('media de 5,0 e 7,0 e 6,0', r5.media === 6.0, String(r5.media))
ok('dois pontos na lista', r5.pontos.length === 2)
ok('um ponto medido e outro sem medicao nao derruba a media', (() => {
  const misto = [A('t6', '25-26', '0-20', { ph_h2o: 6.0 }), A('t6', '25-26', '0-20', { ph_h2o: null })]
  const rm = criarColoracao(misto, { anoSafra: '25-26', profundidade: '0-20', chaveParametro: 'ph_h2o' })('t6')
  return rm.media === 6.0 && rm.pontos.length === 2
})())

console.log('\n=== REGRA: zero e dado, nao ausencia ===')
const corAl = criarColoracao(analises, { anoSafra: '25-26', profundidade: '0-20', chaveParametro: 'al' })
const al2 = corAl('t2')
ok('al = 0 nao vira SEM_MEDICAO', al2.estado === ESTADO.COM_COR, `estado=${al2.estado}`)
ok('al = 0 recebe cor', al2.cor === NIVEIS['muito_bom'].cor, `${al2.valorFormatado} / ${al2.rotuloNivel}`)
ok('al = 0 tem media 0', al2.media === 0)

console.log('\n=== REGRA: sem dado nao vira zero nem faixa vizinha ===')
ok('t4 media e null', r4.media === null)
ok('t4 sem nivel', r4.nivel === null && r4.rotuloNivel === null)
ok('t3 media e null', r3.media === null)
ok('t3 sem nivel', r3.nivel === null)

console.log('\n=== REGRA: parametro sem faixa nao recebe cor ===')
const corP = criarColoracao(analises, { anoSafra: '25-26', profundidade: '0-20', chaveParametro: 'p' })
const p1 = corP('t1')
ok('p com valor -> SEM_FAIXA', p1.estado === ESTADO.SEM_FAIXA, `${p1.valorFormatado}`)
ok('p em cinza neutro', p1.cor === CINZA_NEUTRO)
ok('p mostra valor no tooltip', p1.valorFormatado.includes('18,9'))
ok('p sem classificacao', p1.rotuloNivel === null)
ok('p sem analise ainda hachura', corP('t4').hachurado === true)

console.log('\n=== filtro incompleto desliga a coloracao ===')
ok('sem parametro -> null', criarColoracao(analises, { anoSafra: '25-26', profundidade: '0-20', chaveParametro: '' }) === null)
ok('sem safra -> null', criarColoracao(analises, { anoSafra: '', profundidade: '0-20', chaveParametro: 'ph_h2o' }) === null)

console.log('\n=== legenda ===')
const legPh = faixasParaLegenda('ph_h2o')
ok('pH tem 5 faixas', legPh.length === 5, `n=${legPh.length}`)
console.log('    ' + legPh.map((f) => `${f.rotulo}: ${f.texto}`).join('\n    '))
ok('primeira e "ate"', legPh[0].texto.startsWith('até'))
ok('ultima e "acima de"', legPh[4].texto.startsWith('acima de'))
ok('cores vem do config', legPh.every((f) => f.cor === NIVEIS[f.nivel].cor))
ok('rotulos da legenda sao unicos', new Set(legPh.map((f) => f.rotulo)).size === legPh.length,
   legPh.map((f) => f.rotulo).join(' / '))
ok('extremo acido tem rotulo proprio', legPh[1].rotulo === 'Ácido')
ok('extremo alcalino tem rotulo proprio', legPh[4].rotulo === 'Alcalino')
ok('acido e alcalino compartilham o nivel', legPh[1].nivel === legPh[4].nivel && legPh[1].cor === legPh[4].cor)
ok('parametro sem rotulo proprio usa o do nivel', faixasParaLegenda('v')[0].rotulo === NIVEIS['muito_baixo'].rotulo)
ok('p nao tem legenda', faixasParaLegenda('p').length === 0)
ok('temFaixas(ph)', temFaixas('ph_h2o') === true)
ok('temFaixas(p)', temFaixas('p') === false)

console.log('\n=== invariante: nenhuma legenda com rotulo repetido ===')
// Foi o bug do pH: "Baixo" aparecia em 4,5-5,4 e acima de 7,0, com a mesma
// cor, significando acido demais e alcalino demais. Ilegivel na legenda.
const repetidos = CHAVES_PARAMETROS.map((chave) => {
  const l = faixasParaLegenda(chave)
  const rotulos = l.map((f) => f.rotulo)
  return { chave, duplicado: rotulos.length !== new Set(rotulos).size, rotulos }
}).filter((r) => r.duplicado)
ok('todos os 24 com rotulos unicos', repetidos.length === 0,
   repetidos.length ? repetidos.map((r) => `${r.chave}: ${r.rotulos.join('/')}`).join(' | ') : '')

console.log('\n=== opcoes dos seletores ===')
ok('anos do mais novo ao mais velho', JSON.stringify(anosDisponiveis(analises)) === '["25-26","24-25"]', anosDisponiveis(analises).join(','))
ok('profundidades da mais rasa', JSON.stringify(profundidadesDisponiveis(analises)) === '["0-20","20-40"]', profundidadesDisponiveis(analises).join(','))

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' FALHA(S)'}`)
process.exit(falhas === 0 ? 0 : 1)
