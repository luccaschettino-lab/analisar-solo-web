import { supabase, checar } from './cliente.js'
import { nomeDoArquivo } from '../lib/imagem.js'

const BUCKET = 'fotos'
const CAMPOS_VISTORIA = 'id, talhao_id, data, cultura, estadio, observacao, criado_por, criado_em'
const CAMPOS_REGISTRO = 'id, vistoria_id, ponto, lat, lng, praga, metodo, valor, amostra, foto, observacao, criado_em'

// ---------- Lista de pragas da fazenda ----------

export async function listarAjustesDePragas(fazendaId) {
  return (
    checar(
      await supabase
        .from('pragas_da_fazenda')
        .select('chave, cultura, tipo, nome, metodo, controle, controle_reprodutivo, ativa')
        .eq('fazenda_id', fazendaId),
      'Falha ao carregar a lista de pragas',
    ) ?? []
  )
}

/** Grava (ou substitui) o ajuste de uma praga na fazenda. */
export async function salvarAjusteDePraga(fazendaId, praga) {
  return checar(
    await supabase
      .from('pragas_da_fazenda')
      .upsert(
        {
          fazenda_id: fazendaId,
          chave: praga.chave,
          cultura: praga.cultura,
          tipo: praga.tipo,
          nome: praga.nome.trim(),
          metodo: praga.metodo,
          controle: praga.controle,
          controle_reprodutivo: praga.controle_reprodutivo,
          ativa: praga.ativa,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'fazenda_id,chave' },
      )
      .select('chave')
      .single(),
    'Falha ao salvar a praga',
  )
}

/** Tira o ajuste: a praga de referência volta ao padrão; a própria some. */
export async function removerAjusteDePraga(fazendaId, chave) {
  checar(
    await supabase.from('pragas_da_fazenda').delete().eq('fazenda_id', fazendaId).eq('chave', chave),
    'Falha ao remover a praga',
  )
}

// ---------- Vistorias ----------

/** Vistorias de vários talhões (a fazenda toda), mais recentes primeiro. */
export async function listarVistorias(talhaoIds) {
  if (talhaoIds.length === 0) return []
  return (
    checar(
      await supabase
        .from('vistorias')
        .select(CAMPOS_VISTORIA)
        .in('talhao_id', talhaoIds)
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false }),
      'Falha ao carregar as vistorias',
    ) ?? []
  )
}

/** Registros de várias vistorias, em blocos (a URL do PostgREST tem limite). */
export async function listarRegistros(vistoriaIds) {
  const todos = []
  for (let i = 0; i < vistoriaIds.length; i += 100) {
    const bloco = vistoriaIds.slice(i, i + 100)
    const linhas = checar(
      await supabase.from('vistoria_registros').select(CAMPOS_REGISTRO).in('vistoria_id', bloco).order('ponto'),
      'Falha ao carregar os pontos das vistorias',
    )
    todos.push(...(linhas ?? []))
  }
  return todos
}

export async function criarVistoria({ talhaoId, data, cultura, estadio, observacao }) {
  return checar(
    await supabase
      .from('vistorias')
      .insert({ talhao_id: talhaoId, data, cultura, estadio: estadio || null, observacao: observacao || null })
      .select(CAMPOS_VISTORIA)
      .single(),
    'Falha ao criar a vistoria',
  )
}

export async function editarVistoria(id, { data, cultura, estadio, observacao }) {
  return checar(
    await supabase
      .from('vistorias')
      .update({ data, cultura, estadio: estadio || null, observacao: observacao || null })
      .eq('id', id)
      .select(CAMPOS_VISTORIA)
      .single(),
    'Falha ao salvar a vistoria',
  )
}

/** Apaga a vistoria (os registros vão junto) e depois as fotos. */
export async function removerVistoria(id, fotos = []) {
  checar(await supabase.from('vistorias').delete().eq('id', id), 'Falha ao excluir a vistoria')
  if (fotos.length) await supabase.storage.from(BUCKET).remove(fotos)
}

/**
 * Grava um ponto: todos os registros dele de uma vez. `registros` sem praga
 * = "nada encontrado" (um registro com praga nula).
 */
export async function salvarPonto(vistoriaId, { ponto, lat, lng, registros, foto, observacao }) {
  const base = { vistoria_id: vistoriaId, ponto, lat, lng, foto: foto ?? null, observacao: observacao || null }
  const linhas = registros.length
    ? registros.map((r) => ({
        ...base,
        praga: r.praga,
        metodo: r.metodo,
        valor: r.valor,
        amostra: r.amostra ?? null,
      }))
    : [{ ...base, praga: null, metodo: null, valor: null, amostra: null }]
  return checar(
    await supabase.from('vistoria_registros').insert(linhas).select(CAMPOS_REGISTRO),
    'Falha ao gravar o ponto',
  )
}

/** Apaga um ponto inteiro (todos os registros com o mesmo número). */
export async function removerPonto(vistoriaId, ponto, fotos = []) {
  checar(
    await supabase.from('vistoria_registros').delete().eq('vistoria_id', vistoriaId).eq('ponto', ponto),
    'Falha ao excluir o ponto',
  )
  if (fotos.length) await supabase.storage.from(BUCKET).remove(fotos)
}

// ---------- Fotos ----------

/** Sobe a foto do ponto e devolve o caminho (fazenda/pragas/vistoria/uuid.jpg). */
export async function enviarFotoDoPonto(fazendaId, vistoriaId, blob) {
  const caminho = `${fazendaId}/pragas/${vistoriaId}/${nomeDoArquivo(crypto.randomUUID())}`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(`Falha ao enviar a foto: ${error.message}`)
  return caminho
}

export async function apagarFoto(caminho) {
  if (caminho) await supabase.storage.from(BUCKET).remove([caminho])
}

/** Link temporário (1 h) para ver a foto. */
export async function urlDaFoto(caminho) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 3600)
  if (error) throw new Error(`Falha ao abrir a foto: ${error.message}`)
  return data.signedUrl
}
