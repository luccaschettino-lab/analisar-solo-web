import {
  MAX_LADO,
  dimensoesAlvo,
  nomeDoArquivo,
  formatarTamanho,
} from '../src/lib/imagem.js'

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

// Proporcao com tolerancia: arredondar para pixel inteiro move a razao um
// pouquinho, e exigir igualdade exata reprovaria um resultado correto.
const razao = (d) => d.largura / d.altura

console.log('=== REGRA: nunca amplia ===')
const pequena = dimensoesAlvo(800, 600)
ok('imagem menor que o limite passa intacta', pequena.largura === 800 && pequena.altura === 600,
   `${pequena.largura}x${pequena.altura}`)
ok('imagem exatamente no limite passa intacta',
   dimensoesAlvo(MAX_LADO, 900).largura === MAX_LADO)
ok('um pixel acima ja reduz', dimensoesAlvo(MAX_LADO + 1, 900).largura === MAX_LADO)

console.log('\n=== limite no maior lado, nos dois sentidos ===')
const paisagem = dimensoesAlvo(4032, 3024)
ok('paisagem: largura vai ao limite', paisagem.largura === MAX_LADO, `${paisagem.largura}x${paisagem.altura}`)
ok('paisagem: altura acompanha', paisagem.altura === 1200, String(paisagem.altura))

const retrato = dimensoesAlvo(3024, 4032)
ok('retrato: altura vai ao limite', retrato.altura === MAX_LADO, `${retrato.largura}x${retrato.altura}`)
ok('retrato: largura acompanha', retrato.largura === 1200, String(retrato.largura))

console.log('\n=== proporcao preservada ===')
ok('paisagem mantem 4:3', Math.abs(razao(paisagem) - 4032 / 3024) < 0.01, String(razao(paisagem)))
ok('retrato mantem 3:4', Math.abs(razao(retrato) - 3024 / 4032) < 0.01, String(razao(retrato)))
const quadrada = dimensoesAlvo(3000, 3000)
ok('quadrada continua quadrada', quadrada.largura === quadrada.altura && quadrada.largura === MAX_LADO)

console.log('\n=== casos degenerados nao produzem lado zero ===')
// Uma panoramica muito alongada: 20000x50 reduzida por 1600/20000 daria
// altura 4; e 20000x5 daria 0,4 -> arredondaria para zero, e canvas com
// altura zero recusa a operacao inteira.
const alongada = dimensoesAlvo(20000, 5)
ok('lado menor nunca chega a zero', alongada.altura >= 1, `${alongada.largura}x${alongada.altura}`)
ok('lado maior respeita o limite', alongada.largura === MAX_LADO)

console.log('\n=== entrada invalida devolve null, nao NaN ===')
ok('zero', dimensoesAlvo(0, 100) === null)
ok('negativo', dimensoesAlvo(-10, 100) === null)
ok('indefinido', dimensoesAlvo(undefined, 100) === null)
ok('NaN', dimensoesAlvo(NaN, NaN) === null)
ok('texto', dimensoesAlvo('800', 600) === null)

console.log('\n=== maxLado customizado ===')
ok('respeita o limite passado', dimensoesAlvo(4000, 2000, 400).largura === 400)
ok('e a proporcao junto', dimensoesAlvo(4000, 2000, 400).altura === 200)

console.log('\n=== nome do arquivo ===')
// Sempre .jpg: a saida e sempre JPEG, qualquer que seja a entrada. Guardar
// um PNG com nome .png e conteudo JPEG confundiria quem baixasse depois.
ok('extensao sempre jpg', nomeDoArquivo('abc-123') === 'abc-123.jpg')

console.log('\n=== tamanho legivel ===')
ok('bytes', formatarTamanho(800) === '800 B')
ok('kilobytes', formatarTamanho(310 * 1024) === '310 KB')
ok('megabytes', formatarTamanho(4.2 * 1024 * 1024) === '4,2 MB', formatarTamanho(4.2 * 1024 * 1024))
ok('invalido devolve null', formatarTamanho(undefined) === null)

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' FALHA(S)'}`)
process.exit(falhas === 0 ? 0 : 1)
