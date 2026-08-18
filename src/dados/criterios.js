import { supabase, checar } from './cliente.js'

const CAMPOS = 'id, nome, descricao, parametros, criado_por, autor_nome, criado_em, atualizado_em'

/**
 * Conjuntos de critérios de interpretação.
 *
 * A RLS decide o que aparece: os que o usuário criou, mais os que estão
 * aplicados a alguma fazenda que ele acessa. Um produtor enxerga o conjunto do
 * consultor — precisa, porque é ele que está pintando o mapa da fazenda dele —
 * mas não os outros conjuntos daquele consultor.
 */

export async function listarCriterios() {
  const linhas = checar(
    await supabase.from('criterios').select(CAMPOS).order('nome'),
    'Falha ao carregar os critérios',
  )
  return linhas ?? []
}

/**
 * `criado_por` e `autor_nome` não são enviados: o primeiro tem
 * `default auth.uid()` e o segundo é preenchido por trigger. Mandar do cliente
 * deixaria a assinatura à mercê de quem chama.
 */
export async function criarCriterio({ nome, descricao, parametros = {} }) {
  return checar(
    await supabase
      .from('criterios')
      .insert({ nome: nome.trim(), descricao: descricao?.trim() || null, parametros })
      .select(CAMPOS)
      .single(),
    'Falha ao criar o conjunto de critérios',
  )
}

export async function atualizarCriterio(id, campos) {
  const patch = {}
  if (campos.nome !== undefined) patch.nome = campos.nome.trim()
  if (campos.descricao !== undefined) patch.descricao = campos.descricao?.trim() || null
  if (campos.parametros !== undefined) patch.parametros = campos.parametros

  return checar(
    await supabase.from('criterios').update(patch).eq('id', id).select(CAMPOS).single(),
    'Falha ao salvar o conjunto de critérios',
  )
}

/**
 * Cópia de um conjunto, com nome novo e o mesmo conteúdo.
 *
 * É como se começa na prática: parte-se do padrão do sistema ou do conjunto de
 * outra safra e ajusta-se o que difere. Digitar 24 parâmetros do zero seria o
 * caminho mais curto para ninguém usar a tela.
 *
 * A cópia nasce do usuário atual, não do autor original — os `default` e o
 * trigger cuidam disso. É uma cópia assinada por quem copiou, e é o correto:
 * quem passa a responder pelos números é ele.
 */
export async function duplicarCriterio({ nome, descricao, parametros }) {
  return criarCriterio({ nome, descricao, parametros })
}

/**
 * Apagar não derruba a fazenda: `criterio_id` tem `on delete set null`, e ela
 * volta ao padrão do sistema.
 */
export async function excluirCriterio(id) {
  checar(
    await supabase.from('criterios').delete().eq('id', id),
    'Falha ao excluir o conjunto de critérios',
  )
}

/** Quantas fazendas usam este conjunto. Mostrado antes de apagar. */
export async function contarFazendasComCriterio(id) {
  const { count, error } = await supabase
    .from('fazendas')
    .select('id', { count: 'exact', head: true })
    .eq('criterio_id', id)

  if (error) throw new Error('Falha ao verificar as fazendas que usam este conjunto')
  return count ?? 0
}

/**
 * Aplica um conjunto na fazenda, ou o remove com `null`.
 *
 * O banco só aceita conjunto do próprio usuário — a regra está num trigger, e
 * o motivo (adivinhar um uuid e passar a enxergar o conjunto alheio) está na
 * migração. O erro `42501` que ele levanta chega aqui como mensagem do
 * Postgres; `checar` já o traduz.
 */
export async function aplicarCriterioNaFazenda(fazendaId, criterioId) {
  return checar(
    await supabase
      .from('fazendas')
      .update({ criterio_id: criterioId })
      .eq('id', fazendaId)
      .select('id, criterio_id')
      .single(),
    'Falha ao aplicar o conjunto de critérios na fazenda',
  )
}

/**
 * O conjunto em vigor numa fazenda, ou `null` para o padrão do sistema.
 *
 * Uma ida ao servidor por fazenda aberta. Poderia vir embutido em
 * `listarFazendasDoUsuario`, mas ali são todas as fazendas do usuário e o
 * `parametros` de cada conjunto é um jsonb inteiro — carregaríamos dezenas de
 * tabelas de faixas para usar uma.
 */
export async function criterioDaFazenda(criterioId) {
  if (!criterioId) return null

  const linhas = checar(
    await supabase.from('criterios').select(CAMPOS).eq('id', criterioId).limit(1),
    'Falha ao carregar os critérios da fazenda',
  )
  // Sem `.single()`: o conjunto pode ter sido apagado por outra sessão entre a
  // leitura da fazenda e esta consulta, e `single()` trataria isso como erro.
  // Cair no padrão do sistema é a resposta certa, não uma falha de tela.
  return linhas?.[0] ?? null
}
