import assert from 'node:assert/strict'
import { NIVEIS, NIVEL_LEGADO, PARAMETROS } from '../src/config/parametros.js'
import { criarColoracao, gradienteDeNiveis, posicaoDoNivel, faixasParaLegenda } from '../src/lib/coloracao.js'
import { faixasEfetivas } from '../src/lib/criterios.js'
import { NIVEIS_VIGOR, FAIXAS_VIGOR, nivelDoIndice } from '../src/lib/indicesVegetacao.js'

/**
 * A escala de interpretação: o ideal é o do MEIO; pouco demais e muito demais
 * são ruins. Exceção declarada: Al e m, onde menos é sempre melhor.
 */

// --- a escala em si ---
assert.deepEqual(Object.keys(NIVEIS), ['muito_baixo', 'baixo', 'medio', 'alto', 'muito_alto'], 'do menos ao mais')
assert.equal(NIVEIS.muito_baixo.cor, NIVEIS.muito_alto.cor, 'as duas pontas têm a mesma cor')
assert.equal(NIVEIS.baixo.cor, NIVEIS.alto.cor, 'os vizinhos do ideal têm a mesma cor')
assert.notEqual(NIVEIS.muito_baixo.cor, NIVEIS.baixo.cor, 'a ponta é pior que o vizinho do ideal')
const verdes = Object.values(NIVEIS).filter((n) => n.cor === NIVEIS.medio.cor)
assert.equal(verdes.length, 1, 'o ideal é o único verde')
assert.match(NIVEIS.medio.rotulo, /ideal/i, 'o rótulo diz que o médio é o ideal')

// O mapa de calor interpola por posição na escala: simétrico, com o verde no centro.
const gradiente = gradienteDeNiveis()
assert.deepEqual(
  Object.keys(gradiente).map(Number).sort((a, b) => a - b),
  [0, 0.25, 0.375, 0.5, 0.625, 0.75, 1],
  'cinco níveis + um amarelo de passagem de cada lado do ideal',
)
assert.equal(gradiente[0], gradiente[1])
assert.equal(gradiente[0.25], gradiente[0.75])
assert.equal(gradiente[0.5], NIVEIS.medio.cor)
assert.equal(gradiente[0.375], gradiente[0.625], 'a passagem também é simétrica')
assert.notEqual(gradiente[0.375], NIVEIS.baixo.cor, 'o amarelo de passagem não é uma cor da legenda')
assert.ok(!Object.values(NIVEIS).some((n) => n.cor === gradiente[0.375]), 'nenhum nível usa o amarelo: ele só existe no degradê')
assert.equal(posicaoDoNivel('medio'), 0.5)
assert.equal(posicaoDoNivel('bom'), null, 'o nome antigo não é mais um nível')

// --- classificação: os números de hoje não mudaram, só o que cada faixa significa ---
const K = PARAMETROS.find((p) => p.chave === 'k')
assert.deepEqual(K.faixas.map((f) => f.ate), [15, 40, 70, 120, null], 'os limites do K são os de antes')

function nivelDe(chave, valor, criterio = null) {
  const analises = [{ talhao_id: 't', ano_safra: '25-26', profundidade: '0-20', [chave]: valor }]
  return criarColoracao(analises, { anoSafra: '25-26', profundidade: '0-20', chaveParametro: chave }, criterio)('t')
}

// K: pouco é ruim, o do meio é o ideal, muito é ruim
assert.equal(nivelDe('k', 10).nivel, 'muito_baixo')
assert.equal(nivelDe('k', 30).nivel, 'baixo')
const kIdeal = nivelDe('k', 55)
assert.equal(kIdeal.nivel, 'medio')
assert.equal(kIdeal.cor, NIVEIS.medio.cor, 'K ideal é verde')
assert.equal(nivelDe('k', 100).nivel, 'alto', 'o que era "Bom" agora é excesso')
assert.equal(nivelDe('k', 100).cor, NIVEIS.baixo.cor, 'e fica laranja, como o lado do "pouco"')
assert.equal(nivelDe('k', 150).nivel, 'muito_alto')
assert.equal(nivelDe('k', 150).cor, nivelDe('k', 10).cor, 'muito demais e pouco demais têm a mesma cor')

// pH: continua com rótulo próprio, agora com o ideal no nível do meio
const legendaPh = faixasParaLegenda('ph_h2o')
assert.deepEqual(legendaPh.map((f) => f.rotulo), ['Muito ácido', 'Ácido', 'Ideal', 'Pouco ácido', 'Alcalino'])
assert.deepEqual(legendaPh.map((f) => f.nivel), ['muito_baixo', 'baixo', 'medio', 'alto', 'muito_alto'])
assert.equal(nivelDe('ph_h2o', 5.8).cor, NIVEIS.medio.cor, 'pH 5,8 é o ideal, em verde')
assert.equal(nivelDe('ph_h2o', 8).cor, nivelDe('ph_h2o', 4).cor, 'muito alcalino e muito ácido são igualmente ruins')

// Al e m: menos é SEMPRE melhor — pouco não é problema
for (const [chave, pouco, muito] of [['al', 0, 3], ['m', 5, 90]]) {
  const baixo = nivelDe(chave, pouco)
  const alto = nivelDe(chave, muito)
  assert.equal(baixo.cor, NIVEIS.medio.cor, `${chave} baixo é verde (bom), não vermelho`)
  assert.equal(baixo.rotuloNivel, 'Muito baixo', `${chave} baixo lê "Muito baixo" sem virar problema`)
  assert.equal(alto.cor, NIVEIS.muito_alto.cor, `${chave} alto é vermelho`)
  assert.equal(alto.rotuloNivel, 'Muito alto')
  const cores = faixasParaLegenda(chave).map((f) => f.cor)
  assert.deepEqual(cores, [NIVEIS.medio.cor, NIVEIS.medio.cor, NIVEIS.alto.cor, NIVEIS.muito_alto.cor, NIVEIS.muito_alto.cor], `${chave}: do verde ao vermelho, nunca volta`)
}

// Todo parâmetro com faixas só usa níveis que existem, e a última faixa é aberta
for (const p of PARAMETROS.filter((x) => x.faixas)) {
  assert.ok(p.faixas.every((f) => NIVEIS[f.nivel]), `${p.chave}: nível inexistente`)
  assert.equal(p.faixas.at(-1).ate, null, `${p.chave}: a última faixa precisa ser aberta`)
}
// Os nutrientes de 5 faixas (menos é pior) seguem a ordem da escala, sem o verde nas pontas
for (const chave of ['k', 'ca', 'mg', 'v', 'mo']) {
  const niveis = PARAMETROS.find((p) => p.chave === chave).faixas.map((f) => f.nivel)
  assert.deepEqual(niveis, ['muito_baixo', 'baixo', 'medio', 'alto', 'muito_alto'], chave)
}

// --- critérios salvos antes da mudança continuam funcionando ---
assert.deepEqual(NIVEL_LEGADO, { bom: 'alto', muito_bom: 'muito_alto' })
const criterioAntigo = {
  ca: {
    faixas: [
      { ate: 1, nivel: 'baixo' },
      { ate: 3, nivel: 'bom' },
      { ate: null, nivel: 'muito_bom' },
    ],
  },
}
assert.deepEqual(faixasEfetivas('ca', criterioAntigo).map((f) => f.nivel), ['baixo', 'alto', 'muito_alto'], 'bom/muito_bom viram alto/muito_alto')
const cor = nivelDe('ca', 5, criterioAntigo)
assert.equal(cor.nivel, 'muito_alto', 'o critério antigo classifica sem quebrar o mapa')
assert.equal(cor.cor, NIVEIS.muito_alto.cor)
assert.equal(faixasEfetivas('ca', { ca: { faixas: null } }), null, '"sem classificação" declarada continua sendo "sem classificação"')

// --- o NDVI não herda esta escala: quanto maior, melhor ---
assert.equal(NIVEIS_VIGOR.muito_baixo.cor, '#b91c1c')
assert.equal(NIVEIS_VIGOR.muito_bom.cor, '#15803d')
assert.notEqual(NIVEIS_VIGOR.muito_baixo.cor, NIVEIS_VIGOR.muito_bom.cor, 'no vigor, o topo não é ruim')
assert.ok(FAIXAS_VIGOR.every((f) => NIVEIS_VIGOR[f.nivel]), 'as faixas do vigor usam a paleta do vigor')
assert.equal(nivelDoIndice(0.9), 'muito_bom')

console.log('escala: ideal no meio, pontas ruins, Al e m "menos é melhor", critérios antigos e NDVI OK')
