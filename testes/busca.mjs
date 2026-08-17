import { interpretarBusca } from '../src/lib/busca.js'

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

console.log('=== coordenadas em graus decimais ===')
for (const [texto, esperado] of [
  ['-20.7546, -42.8825', [-20.7546, -42.8825]],
  ['-20.7546,-42.8825', [-20.7546, -42.8825]],
  ['-20.7546 -42.8825', [-20.7546, -42.8825]],
  ['-20,7546 -42,8825', [-20.7546, -42.8825]], // vírgula decimal, separado por espaço
  ['-20,7546;-42,8825', [-20.7546, -42.8825]], // formato do Excel pt-BR
  ['  -20.7546 ,  -42.8825  ', [-20.7546, -42.8825]],
]) {
  const r = interpretarBusca(texto)
  const bate = r.tipo === 'coordenada' && r.lat === esperado[0] && r.lng === esperado[1]
  ok(`"${texto}"`.padEnd(28), bate, bate ? '' : JSON.stringify(r))
}

console.log('\n=== nome de lugar ===')
for (const t of ['Viçosa MG', 'Ponte Nova', 'Rodovia MG-280 km 12', 'São José do Triunfo']) {
  const r = interpretarBusca(t)
  ok(`"${t}"`.padEnd(28), r.tipo === 'lugar' && r.consulta === t, r.tipo)
}

console.log('\n=== coordenada invertida (erro mais comum ao colar) ===')
const inv = interpretarBusca('-42.8825, -20.7546')
ok('detecta inversao provavel', inv.tipo === 'coordenada' && inv.invertidaProvavel === true)
const certa = interpretarBusca('-20.7546, -42.8825')
ok('nao acusa quando esta certa', certa.invertidaProvavel === false)

console.log('\n=== fora de faixa ===')
ok('latitude 200', interpretarBusca('200, -42').tipo === 'erro', interpretarBusca('200, -42').motivo)
ok('longitude -400', interpretarBusca('-20, -400').tipo === 'erro')

console.log('\n=== grau/minuto/segundo avisa em vez de falhar calado ===')
for (const t of ['20°45\'16"S 42°52\'57"W', "20º45'16'' S"]) {
  const r = interpretarBusca(t)
  ok(`"${t}"`.padEnd(28), r.tipo === 'erro' && /decimais/.test(r.motivo))
}

console.log('\n=== vazio ===')
ok('string vazia', interpretarBusca('').tipo === 'erro')
ok('so espacos', interpretarBusca('   ').tipo === 'erro')

console.log('\n=== nao confunde numero solto com coordenada ===')
ok('"280" vira lugar', interpretarBusca('280').tipo === 'lugar')
ok('"MG 280" vira lugar', interpretarBusca('MG 280').tipo === 'lugar', interpretarBusca('MG 280').tipo)

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' FALHA(S)'}`)
process.exit(falhas === 0 ? 0 : 1)
