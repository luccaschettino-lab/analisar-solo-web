import { supabase, checar } from './cliente.js'

/**
 * Equipe da fazenda: membros (com nome e e-mail, só para o proprietário),
 * convites por link e a função `convite`, que é quem coloca a pessoa na
 * fazenda (e cria a conta dela, se for nova).
 */

export async function listarEquipe(fazendaId) {
  return checar(await supabase.rpc('equipe_da_fazenda', { f_id: fazendaId }), 'Falha ao carregar a equipe') ?? []
}

export async function mudarCargo(fazendaId, usuarioId, papel) {
  checar(
    await supabase.from('fazenda_membros').update({ papel }).eq('fazenda_id', fazendaId).eq('usuario_id', usuarioId),
    'Não foi possível mudar o cargo',
  )
}

export async function removerDaEquipe(fazendaId, usuarioId) {
  checar(
    await supabase.from('fazenda_membros').delete().eq('fazenda_id', fazendaId).eq('usuario_id', usuarioId),
    'Não foi possível tirar o acesso',
  )
}

export async function listarConvites(fazendaId) {
  return (
    checar(
      await supabase
        .from('fazenda_convites')
        .select('id, papel, para, token, criado_em, expira_em, usado_em')
        .eq('fazenda_id', fazendaId)
        .order('criado_em', { ascending: false }),
      'Falha ao carregar os convites',
    ) ?? []
  )
}

export async function criarConvite(fazendaId, papel, para) {
  return checar(
    await supabase
      .from('fazenda_convites')
      .insert({ fazenda_id: fazendaId, papel, para: para?.trim() || null })
      .select('id, papel, para, token, criado_em, expira_em, usado_em')
      .single(),
    'Não foi possível criar o convite',
  )
}

export async function cancelarConvite(id) {
  checar(await supabase.from('fazenda_convites').delete().eq('id', id), 'Não foi possível cancelar o convite')
}

/** Endereço que a pessoa abre (o site usa rotas com #). */
export function linkDoConvite(token) {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/convite/${token}`
}

async function chamarConvite(corpo) {
  const { data, error } = await supabase.functions.invoke('convite', { body: corpo })
  if (error) {
    let mensagem = 'Não foi possível falar com o servidor. Tente de novo.'
    try {
      const resposta = await error.context?.json?.()
      if (resposta?.erro) mensagem = resposta.erro
    } catch {
      // Sem corpo legível: fica a mensagem genérica.
    }
    throw new Error(mensagem)
  }
  if (data?.erro) throw new Error(data.erro)
  return data
}

export const verConvite = (token) => chamarConvite({ acao: 'ver', token })
export const aceitarConvite = (token) => chamarConvite({ acao: 'aceitar', token })
export const criarContaPorConvite = (token, { nome, email, senha }) => chamarConvite({ acao: 'criar-conta', token, nome, email, senha })
