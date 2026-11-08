import { paginarTudo } from '../src/lib/paginar.js'

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

/**
 * Imita o PostgREST: devolve no máximo `maxRows` linhas por pedido, e a
 * contagem total quando pedida. Registra cada pedido.
 */
function servidorFalso(total, { maxRows = 1000, comContagem = true, erroNaPagina = null } = {}) {
  const linhas = Array.from({ length: total }, (_, i) => ({ id: String(i).padStart(6, '0') }))
  const pedidos = []
  const consulta = () => {
    const q = { ordem: null, de: 0, ate: 0 }
    const construtor = {
      order(coluna) {
        q.ordem = coluna
        return construtor
      },
      range(de, ate) {
        q.de = de
        q.ate = ate
        pedidos.push({ ...q })
        if (erroNaPagina !== null && pedidos.length === erroNaPagina) {
          return Promise.resolve({ data: null, error: { message: 'falhou' }, count: null })
        }
        const fim = Math.min(ate + 1, de + maxRows, total)
        return Promise.resolve({ data: linhas.slice(de, fim), error: null, count: comContagem ? total : null })
      },
    }
    return construtor
  }
  return { consulta, pedidos }
}

console.log('Paginação das leituras grandes')

{
  const s = servidorFalso(810)
  const r = await paginarTudo(s.consulta)
  ok('810 linhas: um pedido só', r.data.length === 810 && s.pedidos.length === 1, `${s.pedidos.length} pedido(s)`)
  ok('pede ordenado por id', s.pedidos[0].ordem === 'id')
}
{
  const s = servidorFalso(1600)
  const r = await paginarTudo(s.consulta)
  ok('1.600 linhas: vêm todas (antes viriam 1.000)', r.data.length === 1600, `${r.data.length}`)
  ok('1.600 linhas: dois pedidos', s.pedidos.length === 2)
  ok('sem repetir nem pular linha', new Set(r.data.map((l) => l.id)).size === 1600)
}
{
  const s = servidorFalso(1000)
  const r = await paginarTudo(s.consulta)
  ok('exatamente 1.000: um pedido, sem pedido vazio a mais', r.data.length === 1000 && s.pedidos.length === 1)
}
{
  const s = servidorFalso(1600, { maxRows: 500 })
  const r = await paginarTudo(s.consulta)
  ok('"Max rows" do projeto menor (500): ainda vêm todas', r.data.length === 1600, `${r.data.length} em ${s.pedidos.length} pedidos`)
}
{
  const s = servidorFalso(0)
  const r = await paginarTudo(s.consulta)
  ok('nenhuma linha: lista vazia, sem erro', Array.isArray(r.data) && r.data.length === 0 && r.error === null)
}
{
  const s = servidorFalso(1600, { comContagem: false })
  const r = await paginarTudo(s.consulta)
  ok('sem contagem: pára na página vazia e traz todas', r.data.length === 1600)
}
{
  const s = servidorFalso(2500, { erroNaPagina: 2 })
  const r = await paginarTudo(s.consulta)
  ok('erro no meio: devolve o erro, não uma lista pela metade', r.data === null && r.error?.message === 'falhou')
}

if (falhas) {
  console.log(`\n${falhas} falha(s)`)
  process.exit(1)
}
console.log('\nTudo certo.')
