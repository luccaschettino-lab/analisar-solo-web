import { supabase, checar } from './cliente.js'
import { nomeDoArquivo } from '../lib/imagem.js'

const BUCKET = 'fotos'
const CAMPOS = 'id, gleba_id, ano_safra, profundidade, caminho, enviada_em'

/**
 * Fotos do perfil do solo da gleba: uma por safra e profundidade (0-20,
 * 20-40, 40-60). Bucket privado `fotos`, caminho fazenda/glebas/gleba/uuid.jpg
 * — a primeira pasta (a fazenda) é o que a policy do bucket lê.
 */
export async function listarFotosDaGleba(glebaId) {
  return (
    checar(
      await supabase.from('fotos_gleba').select(CAMPOS).eq('gleba_id', glebaId),
      'Falha ao carregar as fotos da gleba',
    ) ?? []
  )
}

/**
 * Sobe a foto e grava (ou substitui) a da safra e profundidade. Ordem: arquivo
 * novo → registro → apaga o antigo, para a tela nunca apontar para um arquivo
 * que não existe.
 */
export async function enviarFotoDaGleba({ fazendaId, glebaId, anoSafra, profundidade, blob, caminhoAnterior }) {
  const caminho = `${fazendaId}/glebas/${glebaId}/${nomeDoArquivo(crypto.randomUUID())}`
  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (erroUpload) throw new Error(`Falha ao enviar a foto: ${erroUpload.message}`)

  let foto
  try {
    foto = checar(
      await supabase
        .from('fotos_gleba')
        .upsert(
          { gleba_id: glebaId, ano_safra: anoSafra, profundidade, caminho, enviada_em: new Date().toISOString() },
          { onConflict: 'gleba_id,ano_safra,profundidade' },
        )
        .select(CAMPOS)
        .single(),
      'Falha ao gravar a foto na gleba',
    )
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([caminho])
    throw e
  }
  if (caminhoAnterior && caminhoAnterior !== caminho) await supabase.storage.from(BUCKET).remove([caminhoAnterior])
  return foto
}

/** Apaga a foto: o registro primeiro, o arquivo depois. */
export async function removerFotoDaGleba({ id, caminho }) {
  checar(await supabase.from('fotos_gleba').delete().eq('id', id), 'Falha ao remover a foto')
  if (caminho) await supabase.storage.from(BUCKET).remove([caminho])
}
