import { supabase, checar } from './cliente.js'

/**
 * Resumo guardado dos índices de satélite de um talhão (estatísticas dos
 * quatro índices e qualidade, por imagem). O mapa pixel a pixel não é
 * guardado: é recalculado ao escolher a data.
 */
export async function listarIndicesDoTalhao(talhaoId, fonte) {
  return (
    checar(
      await supabase
        .from('indices_talhao')
        .select('cena_id, data, estatisticas, qualidade')
        .eq('talhao_id', talhaoId)
        .eq('fonte', fonte)
        .order('data'),
      'Falha ao carregar os índices guardados do talhão',
    ) ?? []
  )
}

/**
 * Guarda o resumo de um cálculo. Sem esperar nem avisar em caso de falha: quem
 * só lê a fazenda não pode gravar (RLS), e o cálculo já está na tela de
 * qualquer jeito — guardar é só para a próxima vez abrir mais rápido.
 */
export function guardarIndicesDoTalhao(talhaoId, fonte, dados) {
  if (!dados?.cena?.id || !dados?.estatisticas || !dados?.qualidade) return
  supabase
    .from('indices_talhao')
    .upsert(
      {
        talhao_id: talhaoId,
        fonte,
        cena_id: dados.cena.id,
        data: dados.cena.data,
        estatisticas: dados.estatisticas,
        qualidade: dados.qualidade,
        calculado_em: new Date().toISOString(),
      },
      { onConflict: 'talhao_id,fonte,cena_id' },
    )
    .then(
      () => {},
      () => {},
    )
}
