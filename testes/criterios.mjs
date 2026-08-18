import {
  ORIGEM,
  origemDasFaixas, faixasEfetivas, deltaMinimoEfetivo, parametroEfetivo,
  criterioTemAlgo, validarFaixas, validarDeltaMinimo, validarCriterio, faixasIniciais,
} from '../src/lib/criterios.js'
import { PARAMETROS, NIVEIS } from '../src/config/parametros.js'
import { parametro } from '../src/lib/parametros.js'

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

// Conjunto de exemplo: sobrescreve o pH, apaga a classificacao do Ca,
// define delta_minimo do K sem mexer nas faixas dele, e nao fala do Mg.
const CRITERIO = {
  ph_h2o: {
    faixas: [
      { ate: 5.0, nivel: 'baixo', rotulo: 'Acido' },
      { ate: 6.5, nivel: 'bom', rotulo: 'Ideal' },
      { ate: null, nivel: 'medio', rotulo: 'Alcalino' },
    ],
  },
  ca: { faixas: null },
  k: { delta_minimo: 3 },
}

console.log('=== as tres origens ===')
ok('faixas declaradas -> CRITERIO', origemDasFaixas('ph_h2o', CRITERIO) === ORIGEM.CRITERIO)
ok('faixas: null -> SEM_CLASSIFICACAO', origemDasFaixas('ca', CRITERIO) === ORIGEM.SEM_CLASSIFICACAO)
ok('parametro nao citado -> CONFIG', origemDasFaixas('mg', CRITERIO) === ORIGEM.CONFIG)
ok('so delta_minimo nao muda a origem das faixas', origemDasFaixas('k', CRITERIO) === ORIGEM.CONFIG)
ok('sem conjunto nenhum -> CONFIG', origemDasFaixas('mg', null) === ORIGEM.CONFIG)

console.log('\n=== REGRA: o config e semente, nao verdade ===')
ok('pH usa as faixas do conjunto', faixasEfetivas('ph_h2o', CRITERIO).length === 3,
   `${faixasEfetivas('ph_h2o', CRITERIO).length} faixas`)
ok('pH do conjunto difere do config', faixasEfetivas('ph_h2o', CRITERIO).length !== parametro('ph_h2o').faixas.length)
ok('Mg cai no config', faixasEfetivas('mg', CRITERIO) === parametro('mg').faixas)
ok('sem conjunto, tudo vem do config',
   faixasEfetivas('ph_h2o', null) === parametro('ph_h2o').faixas)

console.log('\n=== REGRA: "sem classificacao" e afirmacao, nao omissao ===')
ok('Ca fica sem faixa mesmo tendo no config', faixasEfetivas('ca', CRITERIO) === null)
ok('e o config continua tendo a dele', parametro('ca').faixas.length === 5)
// A diferenca entre "nao falou" e "falou que nao tem" so aparece na origem:
// para quem classifica, os dois casos sao o mesmo (nao ha faixa).
ok('P sem faixa no config tambem devolve null', faixasEfetivas('p', CRITERIO) === null)
ok('mas a origem distingue os dois',
   origemDasFaixas('ca', CRITERIO) !== origemDasFaixas('p', CRITERIO),
   `ca=${origemDasFaixas('ca', CRITERIO)} p=${origemDasFaixas('p', CRITERIO)}`)

console.log('\n=== delta_minimo ===')
ok('do conjunto', deltaMinimoEfetivo('k', CRITERIO) === 3)
ok('nao declarado em lugar nenhum -> undefined', deltaMinimoEfetivo('mg', CRITERIO) === undefined)
ok('conjunto com delta null -> undefined', deltaMinimoEfetivo('mg', { mg: { delta_minimo: null } }) === undefined)
ok('sem conjunto -> o do config (hoje nenhum)', deltaMinimoEfetivo('k', null) === undefined)

console.log('\n=== parametroEfetivo: fato do config + juizo do conjunto ===')
const efetivo = parametroEfetivo('ph_h2o', CRITERIO)
ok('mantem o rotulo do config', efetivo.rotulo === parametro('ph_h2o').rotulo)
ok('mantem casas decimais', efetivo.casas === parametro('ph_h2o').casas)
ok('mantem a faixa plausivel', efetivo.plausivel.min === parametro('ph_h2o').plausivel.min)
ok('troca as faixas', efetivo.faixas.length === 3)
ok('carrega a origem', efetivo.origem === ORIGEM.CRITERIO)
ok('chave inexistente devolve null', parametroEfetivo('nao_existe', CRITERIO) === null)

console.log('\n=== criterioTemAlgo ===')
ok('conjunto com faixas', criterioTemAlgo(CRITERIO) === true)
ok('conjunto vazio', criterioTemAlgo({}) === false)
ok('so delta_minimo nao conta como classificacao', criterioTemAlgo({ k: { delta_minimo: 3 } }) === false)
ok('null', criterioTemAlgo(null) === false)

console.log('\n=== REGRA CRITICA: a ultima faixa tem que ser aberta ===')
// Sem isso, um valor acima do ultimo teto nao casa com faixa nenhuma e a
// gleba sai sem classificacao — sem erro, sem aviso, sem ninguem perceber.
const fechada = validarFaixas('ca', [{ ate: 1, nivel: 'baixo' }, { ate: 2, nivel: 'bom' }])
ok('ultima fechada e erro', fechada.erros.length === 1, fechada.erros[0])
const abertaNoMeio = validarFaixas('ca', [{ ate: null, nivel: 'baixo' }, { ate: null, nivel: 'bom' }])
ok('aberta no meio e erro', abertaNoMeio.erros.length > 0, abertaNoMeio.erros[0])
const boa = validarFaixas('ca', [{ ate: 1, nivel: 'baixo' }, { ate: null, nivel: 'bom' }])
ok('duas faixas, ultima aberta, passa', boa.erros.length === 0, JSON.stringify(boa.erros))
ok('uma faixa aberta so tambem passa', validarFaixas('ca', [{ ate: null, nivel: 'bom' }]).erros.length === 0)

console.log('\n=== validacao das faixas ===')
ok('nivel inexistente reprova',
   validarFaixas('ca', [{ ate: null, nivel: 'otimo' }]).erros.some((e) => e.includes('otimo')))
ok('limite fora de ordem reprova',
   validarFaixas('ca', [{ ate: 3, nivel: 'baixo' }, { ate: 1, nivel: 'medio' }, { ate: null, nivel: 'bom' }])
     .erros.some((e) => e.includes('maior que')))
ok('limite igual ao anterior reprova',
   validarFaixas('ca', [{ ate: 1, nivel: 'baixo' }, { ate: 1, nivel: 'medio' }, { ate: null, nivel: 'bom' }])
     .erros.length > 0)
ok('limite nao numerico reprova',
   validarFaixas('ca', [{ ate: 'muito', nivel: 'baixo' }, { ate: null, nivel: 'bom' }]).erros.length > 0)
ok('lista vazia reprova', validarFaixas('ca', []).erros.length === 1)
ok('nao-lista reprova', validarFaixas('ca', { ate: 1 }).erros.length === 1)
ok('rotulo nao-texto reprova',
   validarFaixas('ca', [{ ate: null, nivel: 'bom', rotulo: 7 }]).erros.length > 0)
ok('null e valido (sem classificacao)', validarFaixas('ca', null).erros.length === 0)
ok('undefined e valido (nao declarado)', validarFaixas('ca', undefined).erros.length === 0)

console.log('\n=== avisos: nao impedem salvar ===')
// Bug do pH na Fase 4: "Baixo" duas vezes na legenda, com a mesma cor,
// significando acido demais e alcalino demais.
const repetido = validarFaixas('ph_h2o', [
  { ate: 5, nivel: 'baixo' },
  { ate: 6, nivel: 'bom' },
  { ate: null, nivel: 'baixo' },
])
ok('rotulo repetido e aviso, nao erro', repetido.erros.length === 0 && repetido.avisos.length > 0,
   repetido.avisos[0])
ok('rotulo proprio resolve o aviso',
   validarFaixas('ph_h2o', [
     { ate: 5, nivel: 'baixo', rotulo: 'Acido' },
     { ate: 6, nivel: 'bom', rotulo: 'Ideal' },
     { ate: null, nivel: 'baixo', rotulo: 'Alcalino' },
   ]).avisos.length === 0)

const implausivel = validarFaixas('ph_h2o', [{ ate: 99, nivel: 'baixo' }, { ate: null, nivel: 'bom' }])
ok('limite fora do plausivel e aviso', implausivel.erros.length === 0 && implausivel.avisos.some((a) => a.includes('plausível')),
   implausivel.avisos.join(' | '))

// O config deixou o fosforo sem faixa de proposito, e a nota diz por que.
const fosforo = validarFaixas('p', [{ ate: 10, nivel: 'baixo' }, { ate: null, nivel: 'bom' }])
ok('definir faixa para P avisa o motivo registrado',
   fosforo.erros.length === 0 && fosforo.avisos.some((a) => a.includes('P-Rem')),
   fosforo.avisos.find((a) => a.includes('P-Rem'))?.slice(0, 60))
ok('parametro que tem faixa no config nao gera esse aviso',
   !validarFaixas('ca', [{ ate: null, nivel: 'bom' }]).avisos.some((a) => a.includes('de propósito')))

console.log('\n=== delta_minimo: validacao ===')
ok('numero positivo passa', validarDeltaMinimo(0.2).erros.length === 0)
ok('zero passa', validarDeltaMinimo(0).erros.length === 0)
ok('negativo reprova', validarDeltaMinimo(-1).erros.length === 1)
ok('texto reprova', validarDeltaMinimo('muito').erros.length === 1)
ok('ausente passa', validarDeltaMinimo(undefined).erros.length === 0)

console.log('\n=== validarCriterio: o conjunto inteiro ===')
ok('conjunto de exemplo e valido', validarCriterio(CRITERIO).valido === true,
   JSON.stringify(validarCriterio(CRITERIO).porParametro))
ok('conjunto vazio e valido', validarCriterio({}).valido === true)
const desconhecido = validarCriterio({ nitrogenio: { faixas: null } })
ok('parametro inexistente reprova', desconhecido.valido === false)
ok('e diz qual', desconhecido.porParametro.nitrogenio.erros[0].includes('nitrogenio'))
const misto = validarCriterio({
  ca: { faixas: [{ ate: 1, nivel: 'baixo' }] }, // ultima fechada: erro
  mg: { faixas: [{ ate: null, nivel: 'bom' }] }, // ok
})
ok('um parametro ruim invalida o conjunto', misto.valido === false)
ok('o parametro bom nao entra na lista de problemas', misto.porParametro.mg === undefined)
ok('nao-objeto reprova com erro geral', validarCriterio(null).valido === false)
ok('so avisos nao invalidam',
   validarCriterio({ p: { faixas: [{ ate: 10, nivel: 'baixo' }, { ate: null, nivel: 'bom' }] } }).valido === true)

console.log('\n=== faixasIniciais: copia, nao referencia ===')
const copia = faixasIniciais('ca')
copia[0].ate = 999
ok('mexer na copia nao contamina o config', parametro('ca').faixas[0].ate !== 999,
   `config=${parametro('ca').faixas[0].ate}`)
ok('parametro sem faixa devolve null', faixasIniciais('p') === null)

console.log('\n=== invariante: as faixas do config passam na propria validacao ===')
// Se a semente nao passasse, o editor abriria ja reprovando o que o sistema
// vinha usando desde a Fase 4.
const reprovados = PARAMETROS.filter((p) => p.faixas)
  .map((p) => ({ chave: p.chave, erros: validarFaixas(p.chave, p.faixas).erros }))
  .filter((r) => r.erros.length > 0)
ok('nenhum dos 14 parametros com faixa reprova', reprovados.length === 0,
   reprovados.map((r) => `${r.chave}: ${r.erros.join('; ')}`).join(' | '))
ok('todos os niveis do config existem em NIVEIS',
   PARAMETROS.filter((p) => p.faixas).every((p) => p.faixas.every((f) => NIVEIS[f.nivel])))

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' FALHA(S)'}`)
process.exit(falhas === 0 ? 0 : 1)
