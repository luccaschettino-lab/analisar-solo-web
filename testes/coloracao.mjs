import {
  ESTADO, CINZA_NEUTRO, CINZA_HACHURA,
  filtroCompleto, indexarAnalises, resolverGleba, criarColoracao,
  faixasParaLegenda, temFaixas, anosDisponiveis, profundidadesDisponiveis,
} from '../src/lib/coloracao.js'
import { NIVEIS, CHAVES_PARAMETROS } from '../src/config/parametros.js'

const A = (gleba, ano, prof, campos) => ({ gleba_id: gleba, ano_safra: ano, profundidade: prof, ...campos })

// g1 medido; g2 medido com al = 0; g3 amostrada mas sem pH; g4 sem análise nenhuma
const analises = [
  A('g1', '25-26', '0-20',  { ph_h2o: 6.0, al: 0.45, p: 18.9 }),
  A('g2', '25-26', '0-20',  { ph_h2o: 4.2, al: 0,    p: 3.1  }),
  A('g3', '25-26', '0-20',  { ph_h2o: null, al: 1.5, p: null }),
  A('g1', '24-25', '0-20',  { ph_h2o: 5.5 }),
  A('g1', '25-26', '20-40', { ph_h2o: 5.3 }),
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

console.log('\n=== indexarAnalises (recorta por safra E profundidade) ===')
const idx = indexarAnalises(analises, { anoSafra: '25-26', profundidade: '0-20' })
ok('devolveu 3 glebas', idx.size === 3, `size=${idx.size}`)
ok('nao trouxe a de 24-25', idx.get('g1').ph_h2o === 6.0, `ph=${idx.get('g1').ph_h2o}`)
ok('nao trouxe a de 20-40', idx.get('g1').ph_h2o !== 5.3)

console.log('\n=== os quatro estados ===')
const cor = criarColoracao(analises, { anoSafra: '25-26', profundidade: '0-20', chaveParametro: 'ph_h2o' })
const r1 = cor('g1'), r2 = cor('g2'), r3 = cor('g3'), r4 = cor('g4')

ok('g1 COM_COR', r1.estado === ESTADO.COM_COR, `${r1.valorFormatado} / ${r1.rotuloNivel} / ${r1.cor}`)
ok('g1 cor vem do config', r1.cor === NIVEIS[r1.nivel].cor)
ok('g1 nao hachurado', r1.hachurado === false)
ok('g2 COM_COR (pH 4,2)', r2.estado === ESTADO.COM_COR, `${r2.valorFormatado} / ${r2.rotuloNivel}`)
ok('tooltip do pH usa rotulo proprio', r1.rotuloNivel === 'Ideal' && r2.rotuloNivel === 'Muito ácido',
   `g1="${r1.rotuloNivel}" g2="${r2.rotuloNivel}"`)
ok('g3 SEM_MEDICAO', r3.estado === ESTADO.SEM_MEDICAO, `"${r3.valorFormatado}"`)
ok('g3 hachurado', r3.hachurado === true && r3.cor === CINZA_HACHURA)
ok('g4 SEM_ANALISE', r4.estado === ESTADO.SEM_ANALISE, `"${r4.valorFormatado}"`)
ok('g4 hachurado', r4.hachurado === true)

console.log('\n=== REGRA: zero e dado, nao ausencia ===')
const corAl = criarColoracao(analises, { anoSafra: '25-26', profundidade: '0-20', chaveParametro: 'al' })
const al2 = corAl('g2')
ok('al = 0 nao vira SEM_MEDICAO', al2.estado === ESTADO.COM_COR, `estado=${al2.estado}`)
ok('al = 0 recebe cor', al2.cor === NIVEIS['muito_bom'].cor, `${al2.valorFormatado} / ${al2.rotuloNivel}`)
ok('al = 0 tem valor 0', al2.valor === 0)

console.log('\n=== REGRA: sem dado nao vira zero nem faixa vizinha ===')
ok('g4 valor e null', r4.valor === null)
ok('g4 sem nivel', r4.nivel === null && r4.rotuloNivel === null)
ok('g3 valor e null', r3.valor === null)
ok('g3 sem nivel', r3.nivel === null)

console.log('\n=== REGRA: parametro sem faixa nao recebe cor ===')
const corP = criarColoracao(analises, { anoSafra: '25-26', profundidade: '0-20', chaveParametro: 'p' })
const p1 = corP('g1')
ok('p com valor -> SEM_FAIXA', p1.estado === ESTADO.SEM_FAIXA, `${p1.valorFormatado}`)
ok('p em cinza neutro', p1.cor === CINZA_NEUTRO)
ok('p mostra valor no tooltip', p1.valorFormatado.includes('18,9'))
ok('p sem classificacao', p1.rotuloNivel === null)
ok('p sem analise ainda hachura', corP('g4').hachurado === true)

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
