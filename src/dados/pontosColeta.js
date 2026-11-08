import { supabase, checar } from './cliente.js'
import { paginarTudo } from '../lib/paginar.js'

const CAMPOS = 'id, talhao_id, geometria, propriedades, criado_em'
const CAMPOS_LISTA = `${CAMPOS}, gleba_id`

export async function listarPontosColetaDaFazenda(fazendaId) {
  const linhas = checar(
    // Em páginas: a API corta em 1.000 linhas sem avisar (auditoria P5).
    await paginarTudo(() =>
      supabase
        .from('pontos_coleta')
        .select(`${CAMPOS_LISTA}, talhoes!inner(fazenda_id)`, { count: 'exact' })
        .eq('talhoes.fazenda_id', fazendaId),
    ),
    'Falha ao carregar pontos de amostra da fazenda',
  )
  return (linhas ?? []).map(({ talhoes, ...ponto }) => ponto)
}

export async function listarPontosColetaDoTalhao(talhaoId) {
  const linhas = checar(
    await paginarTudo(() =>
      supabase.from('pontos_coleta').select(CAMPOS_LISTA, { count: 'exact' }).eq('talhao_id', talhaoId),
    ),
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

  // Ponto que já existe no talhão (mesma coordenada) é pulado, não dobrado:
  // a trava unique (talhao_id, coordenadas) do banco e o "ignorar repetidos"
  // fazem reimportar o mesmo arquivo ser seguro. Devolve só os gravados agora;
  // quem chama compara com o que mandou para saber quantos já existiam.
  return checar(
    await supabase
      .from('pontos_coleta')
      .upsert(linhas, { onConflict: 'talhao_id,coordenadas', ignoreDuplicates: true })
      .select(CAMPOS),
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

/**
 * Liga pontos de amostra a uma gleba que acabou de ser criada (importação de
 * glebas). Só toca em ponto ainda sem gleba: um ponto já usado por outra não é
 * tirado dela. Devolve quantos foram ligados.
 */
export async function vincularPontosColetaAGleba(glebaId, pontoIds) {
  if (pontoIds.length === 0) return 0
  const linhas = checar(
    await supabase
      .from('pontos_coleta')
      .update({ gleba_id: glebaId })
      .in('id', pontoIds)
      .is('gleba_id', null)
      .select('id'),
    'Falha ao ligar os pontos de amostra à gleba',
  )
  return linhas?.length ?? 0
}
