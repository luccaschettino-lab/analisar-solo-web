import { supabase, checar } from './cliente.js'
import { paginarTudo } from '../lib/paginar.js'
import { listarAnalisesCompletasDaFazenda } from './analises.js'
import { listarPontosColetaDaFazenda } from './pontosColeta.js'

/**
 * Tudo o que a exportação precisa de uma fazenda, numa ida: análises
 * completas, pontos de amostra, resumos de satélite e a lista de fotos do
 * perfil. Talhões, glebas e o critério já estão no contexto da tela.
 */
export async function carregarDadosParaExportar(fazendaId) {
  const [analises, pontos, indices, fotos] = await Promise.all([
    listarAnalisesCompletasDaFazenda(fazendaId),
    listarPontosColetaDaFazenda(fazendaId),
    paginarTudo(() =>
      supabase
        .from('indices_talhao')
        .select('talhao_id, fonte, cena_id, data, estatisticas, qualidade, talhoes!inner(fazenda_id)', { count: 'exact' })
        .eq('talhoes.fazenda_id', fazendaId)
        .order('data'),
    ),
    paginarTudo(() =>
      supabase
        .from('fotos_gleba')
        .select('gleba_id, ano_safra, profundidade, caminho, enviada_em, glebas!inner(talhao_id, talhoes!inner(fazenda_id))', { count: 'exact' })
        .eq('glebas.talhoes.fazenda_id', fazendaId),
    ),
  ])
  return {
    analises,
    pontos,
    indices: (checar(indices, 'Falha ao carregar os índices de satélite') ?? []).map(({ talhoes, ...i }) => i),
    fotos: (checar(fotos, 'Falha ao carregar a lista de fotos') ?? []).map(({ glebas, ...f }) => f),
  }
}

/** Baixa o arquivo de uma foto do bucket privado. */
export async function baixarFoto(caminho) {
  const { data, error } = await supabase.storage.from('fotos').download(caminho)
  if (error) throw new Error(`Falha ao baixar a foto ${caminho}`)
  return data
}
