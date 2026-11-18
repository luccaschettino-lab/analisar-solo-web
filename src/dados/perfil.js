import { supabase, checar } from './cliente.js'

/**
 * Progresso do tutorial, guardado no perfil da pessoa (vale em qualquer
 * aparelho): `{ boasVindasEm, dicas: { [tela]: true }, passosFechadosEm }`.
 */
export async function lerTutorial(usuarioId) {
  const linha = checar(
    await supabase.from('perfis').select('tutorial').eq('id', usuarioId).maybeSingle(),
    'Falha ao carregar o tutorial',
  )
  return linha?.tutorial ?? {}
}

export async function salvarTutorial(usuarioId, tutorial) {
  checar(await supabase.from('perfis').update({ tutorial }).eq('id', usuarioId), 'Falha ao salvar o tutorial')
}
