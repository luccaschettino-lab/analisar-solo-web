import { supabase, checar } from './cliente.js'
import { nomeDoArquivo } from '../lib/imagem.js'

const BUCKET = 'fotos'
const CAMPOS = 'id, talhao_id, ano_safra, profundidade, caminho, enviada_em'

/**
 * Fotos do perfil do solo do talhão: uma por safra e profundidade (0-20,
 * 20-40, 40-60). Mesmo bucket privado e mesma regra de acesso das fotos de
 * gleba — a primeira pasta do caminho é a fazenda.
 */
export async function listarFotosDoTalhao(talhaoId) {
  return (
    checar(
      await supabase.from('fotos_talhao').select(CAMPOS).eq('talhao_id', talhaoId),
      'Falha ao carregar as fotos do talhão',
    ) ?? []
  )
}

/**
 * Sobe a foto e grava (ou substitui) a da safra e profundidade. Mesma ordem
 * da foto de gleba: arquivo novo → registro → apaga o antigo, para a tela
 * nunca apontar para um arquivo que não existe.
 */
export async function enviarFotoDoTalhao({ fazendaId, talhaoId, anoSafra, profundidade, blob, caminhoAnterior }) {
  const caminho = `${fazendaId}/talhoes/${talhaoId}/${nomeDoArquivo(crypto.randomUUID())}`
  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (erroUpload) throw new Error(`Falha ao enviar a foto: ${erroUpload.message}`)

  let foto
  try {
    foto = checar(
      await supabase
        .from('fotos_talhao')
        .upsert(
          { talhao_id: talhaoId, ano_safra: anoSafra, profundidade, caminho, enviada_em: new Date().toISOString() },
          { onConflict: 'talhao_id,ano_safra,profundidade' },
        )
        .select(CAMPOS)
        .single(),
      'Falha ao gravar a foto no talhão',
    )
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([caminho])
    throw e
  }
  if (caminhoAnterior && caminhoAnterior !== caminho) await supabase.storage.from(BUCKET).remove([caminhoAnterior])
  return foto
}

/** Apaga a foto: o registro primeiro, o arquivo depois. */
export async function removerFotoDoTalhao({ id, caminho }) {
  checar(await supabase.from('fotos_talhao').delete().eq('id', id), 'Falha ao remover a foto')
  if (caminho) await supabase.storage.from(BUCKET).remove([caminho])
}
