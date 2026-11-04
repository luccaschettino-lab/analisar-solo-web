import { supabase } from '../lib/supabase.js'

/**
 * Pede à função `cbers-indice` os índices do talhão numa cena. A conta pesada
 * (ler as bandas do INPE) acontece no servidor, que guarda o e-mail do cadastro.
 */
export async function calcularIndicesCbers(cenaId, geometria) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase.functions.invoke('cbers-indice', { body: { cenaId, geometria } })
  if (error) {
    let mensagem = 'Não foi possível calcular os índices desta cena.'
    try {
      const corpo = await error.context?.json?.()
      if (corpo?.erro) mensagem = corpo.erro
    } catch {
      // Sem corpo legível: fica a mensagem genérica.
    }
    throw new Error(mensagem)
  }
  if (data?.erro) throw new Error(data.erro)
  return data
}
