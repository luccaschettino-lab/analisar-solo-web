import { supabase, checar } from './cliente.js'
import { CHAVES_PARAMETROS } from '../config/parametros.js'
import { paraNumeroOuNulo } from '../lib/numeros.js'

const CAMPOS_BASE =
  'id, talhao_id, geometria, ano_safra, data_coleta, profundidade, laboratorio, numero_amostra_lab, observacoes, origem, criado_em'

const CAMPOS = `${CAMPOS_BASE}, ${CHAVES_PARAMETROS.join(', ')}, extras`

// Para colorir o mapa basta a chave natural e os valores. Observações, extras,
// laboratório e data ficam de fora: numa fazenda com dezenas de talhões e
// várias safras, são campos de texto trafegando à toa.
const CAMPOS_MAPA = `id, talhao_id, geometria, ano_safra, profundidade, ${CHAVES_PARAMETROS.join(', ')}`

/**
 * Ordem de exibição: safra mais recente primeiro, e dentro da safra a camada
 * mais rasa primeiro — que é a ordem em que o laudo apresenta e em que o
 * produtor pensa sobre o perfil.
 */
function ordenar(a, b) {
  if (a.ano_safra !== b.ano_safra) return b.ano_safra.localeCompare(a.ano_safra)
  return String(a.profundidade).localeCompare(String(b.profundidade), 'pt-BR', { numeric: true })
}

/**
 * As análises de um talhão — um talhão pode ter várias por safra/profundidade,
 * uma por ponto de coleta. A ordenação não desempata entre pontos do mesmo
 * dia: quem consome decide como agrupar (ver `lib/historico.js`).
 */
export async function listarAnalisesDoTalhao(talhaoId) {
  const linhas = checar(
    await supabase.from('analises').select(CAMPOS).eq('talhao_id', talhaoId),
    'Falha ao carregar análises',
  )
  return (linhas ?? []).sort(ordenar)
}

/**
 * Todas as análises da fazenda, para colorir o mapa.
 *
 * Um join só (`analises → talhoes`), agora que a análise aponta pro talhão
 * direto. Uma ida por talhão transformaria a abertura do mapa em dezenas de
 * requisições, e o filtro por parâmetro precisa de tudo em memória para
 * trocar de parâmetro sem voltar ao servidor.
 */
export async function listarAnalisesDaFazenda(fazendaId) {
  const linhas = checar(
    await supabase
      .from('analises')
      .select(`${CAMPOS_MAPA}, talhoes!inner(fazenda_id)`)
      .eq('talhoes.fazenda_id', fazendaId),
    'Falha ao carregar análises da fazenda',
  )
  // Descarta o objeto do join: quem consome quer a análise, não o caminho.
  return (linhas ?? []).map(({ talhoes, ...analise }) => analise)
}

/**
 * Monta o payload a partir dos valores do formulário.
 *
 * Todo parâmetro ausente entra como `null` explícito, não como campo omitido:
 * numa edição, omitir a chave deixaria o valor antigo no banco, e apagar um
 * número digitado por engano ficaria impossível.
 */
export function montarPayload({
  talhaoId,
  geometria,
  anoSafra,
  profundidade,
  dataColeta,
  laboratorio,
  numeroAmostraLab,
  observacoes,
  valores = {},
}) {
  const payload = {
    talhao_id: talhaoId,
    geometria,
    ano_safra: anoSafra.trim(),
    profundidade,
    data_coleta: dataColeta || null,
    laboratorio: laboratorio?.trim() || null,
    numero_amostra_lab: numeroAmostraLab?.trim() || null,
    observacoes: observacoes?.trim() || null,
    origem: 'manual',
  }

  for (const chave of CHAVES_PARAMETROS) {
    payload[chave] = paraNumeroOuNulo(valores[chave])
  }

  return payload
}

export async function criarAnalise(payload) {
  return checar(
    await supabase.from('analises').insert(payload).select(CAMPOS).single(),
    'Falha ao salvar análise',
  )
}

export async function atualizarAnalise(id, payload) {
  return checar(
    await supabase.from('analises').update(payload).eq('id', id).select(CAMPOS).single(),
    'Falha ao salvar análise',
  )
}

export async function excluirAnalise(id) {
  checar(await supabase.from('analises').delete().eq('id', id), 'Falha ao excluir análise')
}
