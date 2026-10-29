import { supabase, checar } from './cliente.js'

const CAMPOS = 'id, talhao_id, geometria, propriedades, criado_em'
const CAMPOS_LISTA = `${CAMPOS}, gleba_id`

export async function listarPontosColetaDaFazenda(fazendaId) {
  const linhas = checar(
    await supabase
      .from('pontos_coleta')
      .select(`${CAMPOS_LISTA}, talhoes!inner(fazenda_id)`)
      .eq('talhoes.fazenda_id', fazendaId),
    'Falha ao carregar pontos de amostra da fazenda',
  )
  return (linhas ?? []).map(({ talhoes, ...ponto }) => ponto)
}

export async function listarPontosColetaDoTalhao(talhaoId) {
  const linhas = checar(
    await supabase.from('pontos_coleta').select(CAMPOS_LISTA).eq('talhao_id', talhaoId),
    'Falha ao carregar pontos de amostra',
  )
  return linhas ?? []
}

export async function criarPontosColetaEmLote(talhaoId, itens) {
  const linhas = itens.map((item) => ({
    talhao_id: talhaoId,
    geometria: item.geometria,
    propriedades: item.propriedades ?? {},
  }))

  return checar(
    await supabase.from('pontos_coleta').insert(linhas).select(CAMPOS),
    'Falha ao importar pontos de amostra',
  )
}

export async function criarGlebaComPontosColeta({
  talhaoId,
  codigo,
  nome,
  geometria,
  areaHa,
  pontosColetaIds,
}) {
  return checar(
    await supabase.rpc('criar_gleba_com_pontos', {
      p_talhao_id: talhaoId,
      p_codigo: codigo.trim(),
      p_nome: nome?.trim() || null,
      p_geometria: geometria,
      p_area_ha: areaHa ?? null,
      p_ponto_ids: pontosColetaIds,
    }),
    'Falha ao criar gleba com pontos de amostra',
  )
}
