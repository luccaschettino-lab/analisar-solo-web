import { supabase, checar } from './cliente.js'
import { CHAVES_PARAMETROS } from '../config/parametros.js'
import { paraNumeroOuNulo } from '../lib/numeros.js'

const CAMPOS_BASE =
  'id, gleba_id, ano_safra, data_coleta, profundidade, laboratorio, numero_amostra_lab, observacoes, origem, criado_em'

const CAMPOS = `${CAMPOS_BASE}, ${CHAVES_PARAMETROS.join(', ')}, extras`

// Para colorir o mapa basta a chave natural e os valores. Observações, extras,
// laboratório e data ficam de fora: numa fazenda com dezenas de glebas e várias
// safras, são campos de texto trafegando à toa.
const CAMPOS_MAPA = `id, gleba_id, ano_safra, profundidade, ${CHAVES_PARAMETROS.join(', ')}`

/**
 * Ordem de exibição: safra mais recente primeiro, e dentro da safra a camada
 * mais rasa primeiro — que é a ordem em que o laudo apresenta e em que o
 * produtor pensa sobre o perfil.
 */
function ordenar(a, b) {
  if (a.ano_safra !== b.ano_safra) return b.ano_safra.localeCompare(a.ano_safra)
  return String(a.profundidade).localeCompare(String(b.profundidade), 'pt-BR', { numeric: true })
}

export async function listarAnalisesDaGleba(glebaId) {
  const linhas = checar(
    await supabase.from('analises').select(CAMPOS).eq('gleba_id', glebaId),
    'Falha ao carregar análises',
  )
  return (linhas ?? []).sort(ordenar)
}

/**
 * Todas as análises da fazenda, para colorir o mapa.
 *
 * Sobe dois níveis pelo relacionamento (`analises → glebas → talhoes`) numa
 * consulta só. Uma ida por gleba transformaria a abertura do mapa em dezenas
 * de requisições, e o filtro por parâmetro precisa de tudo em memória para
 * trocar de parâmetro sem voltar ao servidor.
 */
export async function listarAnalisesDaFazenda(fazendaId) {
  const linhas = checar(
    await supabase
      .from('analises')
      .select(`${CAMPOS_MAPA}, glebas!inner(talhoes!inner(fazenda_id))`)
      .eq('glebas.talhoes.fazenda_id', fazendaId),
    'Falha ao carregar análises da fazenda',
  )
  // Descarta o objeto do join: quem consome quer a análise, não o caminho.
  return (linhas ?? []).map(({ glebas, ...analise }) => analise)
}

/**
 * Monta o payload a partir dos valores do formulário.
 *
 * Todo parâmetro ausente entra como `null` explícito, não como campo omitido:
 * numa edição, omitir a chave deixaria o valor antigo no banco, e apagar um
 * número digitado por engano ficaria impossível.
 */
export function montarPayload({
  glebaId,
  anoSafra,
  profundidade,
  dataColeta,
  laboratorio,
  numeroAmostraLab,
  observacoes,
  valores = {},
}) {
  const payload = {
    gleba_id: glebaId,
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

/**
 * A análise que já ocupa a chave natural (gleba, safra, profundidade).
 *
 * Consultada antes de gravar para o conflito virar uma pergunta ao usuário em
 * vez de um erro 23505 seco — ou, pior, de uma sobrescrita silenciosa.
 */
export async function buscarConflito({ glebaId, anoSafra, profundidade, ignorarId = null }) {
  let consulta = supabase
    .from('analises')
    .select(CAMPOS)
    .eq('gleba_id', glebaId)
    .eq('ano_safra', anoSafra.trim())
    .eq('profundidade', profundidade)

  // Ao editar, a própria linha não conta como conflito consigo mesma.
  if (ignorarId) consulta = consulta.neq('id', ignorarId)

  const linhas = checar(await consulta, 'Falha ao verificar análise existente')
  return linhas?.[0] ?? null
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
