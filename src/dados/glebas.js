import { supabase, checar } from './cliente.js'
import { paginarTudo } from '../lib/paginar.js'
import { compararCodigo } from './talhoes.js'

const CAMPOS = 'id, talhao_id, codigo, nome, geometria, area_ha, foto_path, foto_em, criado_em'

/**
 * Todas as glebas da fazenda, de uma vez.
 *
 * O filtro sobe pelo relacionamento (`talhoes!inner`) em vez de fazermos uma
 * consulta por talhao. Uma fazenda pode ter dezenas de talhoes; uma ida por
 * talhao transformaria a abertura do mapa em dezenas de requisicoes.
 */
export async function listarGlebasDaFazenda(fazendaId) {
  const linhas = checar(
    await paginarTudo(() =>
      supabase
        .from('glebas')
        .select(`${CAMPOS}, talhoes!inner(fazenda_id)`, { count: 'exact' })
        .eq('talhoes.fazenda_id', fazendaId),
    ),
    'Falha ao carregar glebas',
  )
  // Descarta o objeto do join: quem consome quer a gleba, nao o vinculo.
  return (linhas ?? []).map(({ talhoes, ...gleba }) => gleba).sort(compararCodigo)
}

/**
 * Uma gleba com o talhão e a fazenda a que pertence, para a trilha de
 * navegação. Sobe a hierarquia numa consulta só — três idas ao servidor para
 * montar um cabeçalho seria desperdício.
 *
 * Devolve `null` quando a gleba não existe ou a RLS não deixa ver. Os dois
 * casos são indistinguíveis do lado do cliente, e é assim que deve ser: dizer
 * "existe mas você não pode ver" já é vazar informação.
 */
export async function buscarGlebaComContexto(glebaId) {
  const linha = checar(
    await supabase
      .from('glebas')
      .select(
        `${CAMPOS}, talhoes!inner(id, codigo, nome, area_ha, cor, fazendas!inner(id, nome, municipio, uf))`,
      )
      .eq('id', glebaId)
      .maybeSingle(),
    'Falha ao carregar a gleba',
  )

  if (!linha) return null

  const { talhoes, ...gleba } = linha
  const { fazendas, ...talhao } = talhoes
  return { gleba, talhao, fazenda: fazendas }
}

export async function criarGleba({ talhaoId, codigo, nome, geometria, areaHa }) {
  return checar(
    await supabase
      .from('glebas')
      .insert({
        talhao_id: talhaoId,
        codigo: codigo.trim(),
        nome: nome?.trim() || null,
        geometria,
        area_ha: areaHa ?? null,
      })
      .select(CAMPOS)
      .single(),
    'Falha ao criar gleba',
  )
}

/**
 * Insercao em lote, uma ida ao servidor.
 *
 * Nao usa upsert: se algum codigo ja existir, o insert inteiro falha por
 * unique_violation e nada e gravado. E o comportamento desejado — meio lote
 * gravado deixaria o usuario sem saber onde parou.
 */
export async function criarGlebasEmLote(talhaoId, itens) {
  const linhas = itens.map((i) => ({
    talhao_id: talhaoId,
    codigo: String(i.codigo).trim(),
    nome: i.nome?.trim() || null,
    geometria: i.geometria,
    // O lote de pontos nao manda area (ponto nao tem); a importacao de glebas
    // de arquivo manda a dos poligonos. Ausente = nulo, nunca zero.
    area_ha: i.areaHa ?? null,
  }))

  return checar(
    await supabase.from('glebas').insert(linhas).select(CAMPOS),
    'Falha ao criar glebas em lote',
  )
}

export async function atualizarGleba(id, campos) {
  const patch = {}
  if (campos.codigo !== undefined) patch.codigo = campos.codigo.trim()
  if (campos.nome !== undefined) patch.nome = campos.nome?.trim() || null
  if (campos.talhaoId !== undefined) patch.talhao_id = campos.talhaoId
  if (campos.geometria !== undefined) {
    patch.geometria = campos.geometria
    patch.area_ha = campos.areaHa ?? null
  }

  return checar(
    await supabase.from('glebas').update(patch).eq('id', id).select(CAMPOS).single(),
    'Falha ao salvar gleba',
  )
}

/**
 * Grava geometria e área de várias glebas numa transação (função
 * `salvar_geometrias_glebas`): se uma falhar, nenhuma muda. Para mudanças de
 * desenho que envolvem mais de uma gleba — a divisa compartilhada e o
 * "Ajustar glebas ao talhão" (auditoria P9).
 *
 * `itens`: [{ id, geometria, areaHa }]. Devolve as glebas gravadas.
 */
export async function salvarGeometriasDeGlebas(itens) {
  const linhas = checar(
    await supabase.rpc('salvar_geometrias_glebas', {
      p_itens: itens.map(({ id, geometria, areaHa }) => ({ id, geometria, area_ha: areaHa ?? null })),
    }),
    'Falha ao gravar as glebas',
  )
  return linhas ?? []
}

export async function excluirGleba(id) {
  checar(await supabase.from('glebas').delete().eq('id', id), 'Falha ao excluir gleba')
}
