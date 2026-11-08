/**
 * Busca TODAS as linhas de uma consulta do Supabase, em páginas.
 *
 * A API do Supabase devolve no máximo "Max rows" linhas por pedido (1.000 por
 * padrão) e corta o resto em silêncio: a resposta vem sem erro, só menor. Uma
 * fazenda com 1.600 pontos de coleta apareceria com 1.000 (auditoria P5).
 *
 * `consulta` é uma função que monta a consulta do zero a cada página (o
 * construtor do supabase-js só serve para um pedido) e pede a contagem:
 * `() => supabase.from('t').select('…', { count: 'exact' }).eq(…)`.
 *
 * Pára quando já tem `count` linhas. Não confia no tamanho da página para
 * saber se acabou: se o "Max rows" do projeto for menor que `tamanho`, a
 * página vem menor sem ser a última. Ordena por `id` para as páginas não se
 * sobreporem nem pularem linhas.
 *
 * Devolve `{ data, error }`, no formato do supabase-js, para passar a `checar`.
 */
export async function paginarTudo(consulta, { tamanho = 1000, ordem = 'id' } = {}) {
  const linhas = []
  let total = null
  for (;;) {
    const inicio = linhas.length
    const { data, error, count } = await consulta()
      .order(ordem, { ascending: true })
      .range(inicio, inicio + tamanho - 1)
    if (error) return { data: null, error }
    // Sem contagem (consulta montada sem `count`), pára na primeira página vazia.
    if (total === null) total = typeof count === 'number' ? count : Infinity
    if (!data || data.length === 0) break
    linhas.push(...data)
    if (linhas.length >= total) break
  }
  return { data: linhas, error: null }
}
