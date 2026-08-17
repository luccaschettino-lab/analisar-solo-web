import { supabase, checar, checarContagem } from './cliente.js'

/**
 * Fazendas que o usuario acessa, ja com o papel dele em cada uma.
 *
 * Consultamos a partir de fazenda_membros, nao de fazendas: e uma ida so ao
 * servidor e devolve o papel junto, que e o que decide se as ferramentas de
 * desenho aparecem. Buscar as duas coisas separadamente abriria uma janela em
 * que a fazenda ja carregou mas o papel ainda nao, e a UI piscaria as
 * ferramentas para um leitor.
 */
export async function listarFazendasDoUsuario(usuarioId) {
  const linhas = checar(
    await supabase
      .from('fazenda_membros')
      .select('papel, fazendas(id, nome, municipio, uf, centro_lat, centro_lng, criado_em)')
      .eq('usuario_id', usuarioId),
    'Falha ao carregar fazendas',
  )

  return (linhas ?? [])
    .filter((l) => l.fazendas) // defensivo: fazenda apagada por outra sessao
    .map((l) => ({ ...l.fazendas, papel: l.papel }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function criarFazenda({ nome, municipio, uf }) {
  // criado_por tem default auth.uid() no banco, e o trigger ao_criar_fazenda
  // registra o criador como proprietario. Nao mandamos nem uma coisa nem outra.
  const linha = checar(
    await supabase
      .from('fazendas')
      .insert({ nome: nome.trim(), municipio: municipio?.trim() || null, uf: uf?.trim() || null })
      .select()
      .single(),
    'Falha ao criar fazenda',
  )
  return { ...linha, papel: 'proprietario' }
}

export async function atualizarFazenda(id, { nome, municipio, uf }) {
  return checar(
    await supabase
      .from('fazendas')
      .update({ nome: nome.trim(), municipio: municipio?.trim() || null, uf: uf?.trim() || null })
      .eq('id', id)
      .select()
      .single(),
    'Falha ao salvar fazenda',
  )
}

// Centro do mapa na abertura. Gravado quando o usuario marca o ponto na
// fazenda ainda sem talhoes.
export async function definirCentro(id, lat, lng) {
  return checar(
    await supabase
      .from('fazendas')
      .update({ centro_lat: lat, centro_lng: lng })
      .eq('id', id)
      .select()
      .single(),
    'Falha ao gravar o centro da fazenda',
  )
}

export async function excluirFazenda(id) {
  checar(await supabase.from('fazendas').delete().eq('id', id), 'Falha ao excluir fazenda')
}

// Quantos filhos serao perdidos junto. Alimenta o dialogo de confirmacao.
export async function resumoCascataFazenda(id) {
  const [talhoes, glebas, analises] = await Promise.all([
    supabase.from('talhoes').select('id', { count: 'exact', head: true }).eq('fazenda_id', id),
    supabase
      .from('glebas')
      .select('id, talhoes!inner(fazenda_id)', { count: 'exact', head: true })
      .eq('talhoes.fazenda_id', id),
    supabase
      .from('analises')
      .select('id, glebas!inner(talhoes!inner(fazenda_id))', { count: 'exact', head: true })
      .eq('glebas.talhoes.fazenda_id', id),
  ])

  return {
    talhoes: checarContagem(talhoes, 'Falha ao contar talhões'),
    glebas: checarContagem(glebas, 'Falha ao contar glebas'),
    analises: checarContagem(analises, 'Falha ao contar análises'),
  }
}
