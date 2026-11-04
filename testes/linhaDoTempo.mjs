import assert from 'node:assert/strict'
import { diasDasCenas, posicoesNaBarra, indiceMaisProximo, diasDesdeAAnterior, faixaDeNuvem } from '../src/lib/linhaDoTempo.js'

const cena = (data) => ({ id: data, data: `${data}T13:00:00Z` })

// Datas IRREGULARES de propósito: 0, 10, 20 e 100 dias. É isso que a barra por
// índice escondia (as quatro pareciam igualmente espaçadas).
const cenas = [cena('2026-01-01'), cena('2026-01-11'), cena('2026-01-21'), cena('2026-04-11')]
const dias = diasDasCenas(cenas)
assert.deepEqual(dias, [0, 10, 20, 100])

// posição = tempo de verdade, não a ordem
assert.deepEqual(posicoesNaBarra(dias), [0, 0.1, 0.2, 1])
assert.equal(posicoesNaBarra(dias)[3] - posicoesNaBarra(dias)[2], 0.8, 'o buraco de 80 dias ocupa 80% da barra')

// uma cena só, ou várias no mesmo instante: tudo no meio, sem dividir por zero
assert.deepEqual(posicoesNaBarra(diasDasCenas([cena('2026-01-01')])), [0.5])
assert.deepEqual(posicoesNaBarra([0, 0]), [0.5, 0.5])
assert.deepEqual(diasDasCenas([]), [])
assert.deepEqual(posicoesNaBarra([]), [])

// ao arrastar, encaixa na cena mais próxima
assert.equal(indiceMaisProximo(dias, 0), 0)
assert.equal(indiceMaisProximo(dias, 4), 0)
assert.equal(indiceMaisProximo(dias, 6), 1)
assert.equal(indiceMaisProximo(dias, 19), 2)
assert.equal(indiceMaisProximo(dias, 59), 2, 'no meio do buraco vale a mais perto')
assert.equal(indiceMaisProximo(dias, 61), 3)
assert.equal(indiceMaisProximo(dias, 5), 0, 'empate exato fica com a mais antiga (escolha estável)')
assert.equal(indiceMaisProximo(dias, -50), 0, 'antes do começo encaixa na primeira')
assert.equal(indiceMaisProximo(dias, 9999), 3, 'depois do fim encaixa na última')
assert.equal(indiceMaisProximo([], 5), -1)
assert.equal(indiceMaisProximo(dias, Number.NaN), -1, 'valor inválido não escolhe cena nenhuma')

// intervalo real até a cena anterior
assert.equal(diasDesdeAAnterior(dias, 0), null, 'a primeira não tem anterior')
assert.equal(diasDesdeAAnterior(dias, 1), 10)
assert.equal(diasDesdeAAnterior(dias, 3), 80)

// cor da marca pela nuvem
assert.equal(faixaDeNuvem(0), 'pouca')
assert.equal(faixaDeNuvem(20), 'pouca')
assert.equal(faixaDeNuvem(21), 'media')
assert.equal(faixaDeNuvem(60), 'media')
assert.equal(faixaDeNuvem(61), 'muita')
assert.equal(faixaDeNuvem(null), 'desconhecida', 'sem dado de nuvem não vira "sem nuvem"')
assert.equal(faixaDeNuvem(undefined), 'desconhecida')

console.log('linha do tempo: posição pelo tempo real, encaixe na cena mais próxima e cor pela nuvem OK')
