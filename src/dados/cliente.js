import { supabase } from '../lib/supabase.js'

export { supabase }

// O PostgREST devolve o codigo do Postgres em error.code. Traduzimos so o que
// o usuario pode resolver; o resto sobe com a mensagem original, que e melhor
// que um "erro desconhecido" generico na hora de depurar.
function traduzir(erro, contexto) {
  const codigo = erro?.code
  const msg = erro?.message ?? ''

  if (codigo === '23505') {
    // unique_violation. As tres constraints do schema sao de codigo duplicado.
    if (msg.includes('talhoes')) return 'Já existe um talhão com esse código nesta fazenda.'
    if (msg.includes('glebas')) return 'Já existe uma gleba com esse código neste talhão.'
    if (msg.includes('analises')) return 'Já existe uma análise para essa gleba, safra e profundidade.'
    return 'Esse registro já existe.'
  }
  if (codigo === '23503') return 'O registro depende de outro que não existe mais. Recarregue a página.'
  if (codigo === '23514') return 'Algum valor está fora do formato aceito.'
  if (codigo === '42501' || erro?.status === 403) {
    return 'Você não tem permissão para essa ação nesta fazenda.'
  }
  if (/failed to fetch|networkerror/i.test(msg)) return 'Sem conexão com o servidor.'

  return contexto ? `${contexto}: ${msg}` : msg || 'Não foi possível concluir a operação.'
}

// Envolve toda resposta do supabase-js. Sem isso, cada chamada repetiria o
// mesmo `if (error) throw`, e um esquecimento vira falha silenciosa — a tela
// mostra lista vazia em vez de dizer que a consulta falhou.
export function checar({ data, error }, contexto) {
  if (error) throw new Error(traduzir(error, contexto))
  return data
}

// Para consultas com { count: 'exact', head: true }: nesse modo o PostgREST
// nao devolve linhas, e `data` vem null. A contagem chega em `count`, no
// envelope da resposta — usar `data.length` aqui daria zero sempre.
export function checarContagem({ count, error }, contexto) {
  if (error) throw new Error(traduzir(error, contexto))
  return count ?? 0
}
