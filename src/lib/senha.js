export const TAMANHO_MINIMO_SENHA = 8

/**
 * Regra de senha do cadastro: no mínimo 8 caracteres, com letra e número.
 * Devolve a mensagem do problema, ou `null` se a senha serve.
 *
 * É só a primeira barreira, no navegador — quem de fato impõe a regra é a
 * configuração de Authentication do Supabase, que precisa ter o mesmo mínimo.
 */
export function validarSenha(senha) {
  if (senha.length < TAMANHO_MINIMO_SENHA) {
    return `A senha precisa ter no mínimo ${TAMANHO_MINIMO_SENHA} caracteres.`
  }
  if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) {
    return 'A senha precisa ter letras e números.'
  }
  return null
}
