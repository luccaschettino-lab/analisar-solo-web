import { PRAGAS_REFERENCIA, METODOS } from '../src/config/pragas.js'
import {
  listaDaFazenda,
  chaveNova,
  faseDoEstadio,
  nivelDeControle,
  valorDoRegistro,
  statusDoValor,
  resumoDaVistoria,
  piorStatus,
  formatarValor,
  valoresPorPonto,
  interpolarIdw,
  corDoCalor,
} from '../src/lib/pragas.js'

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

console.log('Lista de referência')
const chaves = PRAGAS_REFERENCIA.map((p) => p.chave)
ok('chaves únicas', new Set(chaves).size === chaves.length)
ok('chaves no formato do banco', chaves.every((c) => /^[a-z0-9-]{1,60}$/.test(c)))
ok('método conhecido', PRAGAS_REFERENCIA.every((p) => METODOS[p.metodo]))
ok('só soja e café', PRAGAS_REFERENCIA.every((p) => ['soja', 'cafe'].includes(p.cultura)))

console.log('Lista da fazenda')
const lista = listaDaFazenda([
  { chave: 'cafe-broca', cultura: 'cafe', tipo: 'praga', nome: 'Broca', metodo: 'contagem', controle: 5, ativa: true },
  { chave: 'soja-mosca-branca', cultura: 'soja', tipo: 'praga', nome: 'Mosca-branca', metodo: 'nota', controle: null, ativa: false },
  { chave: 'soja-vaquinha', cultura: 'soja', tipo: 'praga', nome: 'Vaquinha', metodo: 'pano', controle: 4 },
])
const broca = lista.find((p) => p.chave === 'cafe-broca')
ok('ajuste substitui o nível', broca.controle === 5 && broca.ajustada && broca.referencia.controle === 3)
ok('desligada continua na lista', lista.find((p) => p.chave === 'soja-mosca-branca').ativa === false)
ok('própria entra no fim', lista.at(-1).chave === 'soja-vaquinha' && lista.at(-1).propria)
ok('chave nova sem acento', chaveNova('soja', 'Lagarta-elasmo ç') === 'soja-lagarta-elasmo-c')
ok('chave nova não repete', chaveNova('soja', 'Buva', ['soja-buva']) === 'soja-buva-2')

console.log('Fase e nível')
const marrom = lista.find((p) => p.chave === 'soja-percevejo-marrom')
const desfolha = lista.find((p) => p.chave === 'soja-desfolha')
ok('R3 é reprodutivo', faseDoEstadio('soja', 'R3') === 'reprodutivo')
ok('V6 é vegetativo', faseDoEstadio('soja', 'V6') === 'vegetativo')
ok('café não muda', faseDoEstadio('cafe', 'Granação') === 'vegetativo')
ok('percevejo sem nível no vegetativo', nivelDeControle(marrom, 'vegetativo') === null)
ok('percevejo 2/m no reprodutivo', nivelDeControle(marrom, 'reprodutivo') === 2)
ok('desfolha 30% / 15%', nivelDeControle(desfolha, 'vegetativo') === 30 && nivelDeControle(desfolha, 'reprodutivo') === 15)

console.log('Valor e semáforo')
ok('pano: 6 em 2 m = 3/m', valorDoRegistro({ metodo: 'pano', valor: 6, amostra: 2 }) === 3)
ok('pano sem metros = 1 m', valorDoRegistro({ metodo: 'pano', valor: 4, amostra: null }) === 4)
ok('contagem: 6 de 200 = 3%', valorDoRegistro({ metodo: 'contagem', valor: 6, amostra: 200 }) === 3)
ok('2/m = agir', statusDoValor(2, 'pano', marrom, 'reprodutivo') === 'controle')
ok('1,5/m = atenção', statusDoValor(1.5, 'pano', marrom, 'reprodutivo') === 'alerta')
ok('1/m = tranquilo', statusDoValor(1, 'pano', marrom, 'reprodutivo') === 'ok')
ok('método diferente do nível = sem nível', statusDoValor(3, 'nota', marrom, 'reprodutivo') === 'controle'
  && statusDoValor(50, 'percentual', marrom, 'reprodutivo') === 'sem-nivel')
const asiatica = lista.find((p) => p.chave === 'soja-ferrugem-asiatica')
ok('ferrugem-asiática presente = agir', statusDoValor(1, 'presenca', asiatica, 'vegetativo') === 'controle')
ok('ferrugem-asiática ausente = tranquilo', statusDoValor(0, 'presenca', asiatica, 'vegetativo') === 'ok')

console.log('Resumo da vistoria')
// 4 pontos; percevejo em 2 deles (3/m e 2/m) → média 5/4 = 1,25/m
const registros = [
  { ponto: 1, lat: -20, lng: -45, praga: 'soja-percevejo-marrom', metodo: 'pano', valor: 3, amostra: 1 },
  { ponto: 1, lat: -20, lng: -45, praga: 'soja-buva', metodo: 'nota', valor: 2 },
  { ponto: 2, lat: -20.001, lng: -45, praga: 'soja-percevejo-marrom', metodo: 'pano', valor: 4, amostra: 2 },
  { ponto: 3, lat: -20.002, lng: -45, praga: null, metodo: null, valor: null },
  { ponto: 4, lat: -20.003, lng: -45, praga: 'soja-ferrugem-asiatica', metodo: 'presenca', valor: 1 },
]
const resumo = resumoDaVistoria(registros, lista, 'reprodutivo')
const linhaPercevejo = resumo.find((l) => l.praga === 'soja-percevejo-marrom')
ok('média com zeros', Math.abs(linhaPercevejo.valor - 1.25) < 1e-9, String(linhaPercevejo.valor))
ok('percevejo 1,25/m (abaixo de 1,4) = tranquilo', linhaPercevejo.status === 'ok')
ok('apareceu em 2 de 4 pontos', linhaPercevejo.pontosCom === 2 && linhaPercevejo.pontos === 4)
ok('mais grave primeiro', resumo[0].praga === 'soja-ferrugem-asiatica' && resumo[0].status === 'controle')
ok('pior do talhão = agir', piorStatus(resumo) === 'controle')
ok('vazio = tranquilo', piorStatus([]) === 'ok')

console.log('Texto')
ok('1,3/m', formatarValor(1.25, 'pano') === '1,3/m', formatarValor(1.25, 'pano'))
ok('12%', formatarValor(12, 'contagem') === '12%')
ok('Presente', formatarValor(1, 'presenca') === 'Presente')
ok('Médio', formatarValor(2, 'nota') === 'Médio')

console.log('Mapa de calor')
const vp = valoresPorPonto(registros, 'soja-percevejo-marrom', 'pano')
ok('um valor por ponto, zero onde não achou', vp.length === 4 && vp[0].valor === 3 && vp[1].valor === 2 && vp[2].valor === 0)
ok('IDW no ponto = valor do ponto', interpolarIdw(vp, -20, -45) === 3)
const meio = interpolarIdw(vp, -20.0005, -45)
ok('IDW entre 3 e 2 fica entre eles', meio < 3 && meio > 2, String(meio))
ok('cor no nível = vermelho', corDoCalor(2, { nivel: 2, metodo: 'pano' }).join() === '185,28,28')
ok('cor zero = verde', corDoCalor(0, { nivel: 2, metodo: 'pano' }).join() === '21,128,61')

if (falhas) {
  console.log(`\n${falhas} falha(s) em pragas`)
  process.exit(1)
}
console.log('\nPragas: tudo certo')
