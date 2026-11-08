import { supabase, checar, checarContagem } from './cliente.js'

const CAMPOS = 'id, fazenda_id, codigo, nome, geometria, area_ha, cor, criado_em'

export async function listarTalhoes(fazendaId) {
  const linhas = checar(
    await supabase.from('talhoes').select(CAMPOS).eq('fazenda_id', fazendaId),
    'Falha ao carregar talhões',
  )
  // Ordena numericamente quando o codigo e numero ("8" antes de "12"), e
  // alfabeticamente quando nao e. Ordenar no banco daria "12" antes de "8",
  // porque a coluna e text — e o codigo vem da planilha, onde e numero.
  return (linhas ?? []).sort(compararCodigo)
}

export function compararCodigo(a, b) {
  const na = Number(a.codigo)
  const nb = Number(b.codigo)
  const ambosNumericos = Number.isFinite(na) && Number.isFinite(nb)
  if (ambosNumericos) return na - nb
  return String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true })
}

export async function criarTalhao({ fazendaId, codigo, nome, geometria, areaHa, cor }) {
  return checar(
    await supabase
      .from('talhoes')
      .insert({
        fazenda_id: fazendaId,
        codigo: codigo.trim(),
        nome: nome?.trim() || null,
        geometria,
        area_ha: areaHa,
        cor,
      })
      .select(CAMPOS)
      .single(),
    'Falha ao criar talhão',
  )
}

export async function atualizarTalhao(id, campos) {
  const patch = {}
  if (campos.codigo !== undefined) patch.codigo = campos.codigo.trim()
  if (campos.nome !== undefined) patch.nome = campos.nome?.trim() || null
  if (campos.cor !== undefined) patch.cor = campos.cor
  // Geometria e area andam juntas: gravar uma sem a outra deixa a area
  // mentindo sobre o desenho.
  if (campos.geometria !== undefined) {
    patch.geometria = campos.geometria
    patch.area_ha = campos.areaHa ?? null
  }

  return checar(
    await supabase.from('talhoes').update(patch).eq('id', id).select(CAMPOS).single(),
    'Falha ao salvar talhão',
  )
}

/**
 * Junta os talhões `absorvidos` no talhão `baseId`, numa transação no banco
 * (função `mesclar_talhoes`). Glebas, análises e pontos de coleta dos
 * absorvidos passam para a base antes de eles serem apagados; se algo falhar,
 * nada muda. Devolve o talhão final e quantos registros mudaram de talhão.
 */
export async function mesclarTalhoes({ baseId, absorvidos, codigo, nome, cor, geometria, areaHa }) {
  const resultado = checar(
    await supabase.rpc('mesclar_talhoes', {
      p_base_id: baseId,
      p_absorvidos: absorvidos,
      p_codigo: codigo.trim(),
      p_nome: nome?.trim() || null,
      p_cor: cor,
      p_geometria: geometria,
      p_area_ha: areaHa,
    }),
    'Falha ao mesclar talhões',
  )
  const t = resultado.talhao
  return {
    talhao: {
      id: t.id, fazenda_id: t.fazenda_id, codigo: t.codigo, nome: t.nome,
      geometria: t.geometria, area_ha: t.area_ha, cor: t.cor, criado_em: t.criado_em,
    },
    glebasMovidas: resultado.glebas_movidas,
    analisesMovidas: resultado.analises_movidas,
    pontosMovidos: resultado.pontos_movidos,
  }
}

export async function excluirTalhao(id) {
  checar(await supabase.from('talhoes').delete().eq('id', id), 'Falha ao excluir talhão')
}

// Glebas e analises que a cascata levara junto. Alimenta a confirmacao.
export async function resumoCascataTalhao(id) {
  const [glebas, analises] = await Promise.all([
    supabase.from('glebas').select('id', { count: 'exact', head: true }).eq('talhao_id', id),
    supabase.from('analises').select('id', { count: 'exact', head: true }).eq('talhao_id', id),
  ])

  return {
    glebas: checarContagem(glebas, 'Falha ao contar glebas'),
    analises: checarContagem(analises, 'Falha ao contar análises'),
  }
}
