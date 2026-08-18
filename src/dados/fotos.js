import { supabase, checar } from './cliente.js'
import { nomeDoArquivo } from '../lib/imagem.js'

const BUCKET = 'fotos'

/**
 * Foto do solo de uma gleba. Uma por gleba, substituível.
 *
 * O caminho é `fazenda_id/gleba_id/uuid.jpg`, e a primeira pasta não é
 * organização: é o que a policy do bucket lê para decidir quem vê e quem
 * escreve, chamando as mesmas funções que governam o resto do banco.
 *
 * O uuid no fim existe para o navegador não mostrar a foto antiga do cache
 * depois de substituir — caminho novo, URL nova.
 */

/** Segundos de validade da URL assinada. */
export const VALIDADE_URL = 60 * 60

function caminhoDaFoto(fazendaId, glebaId) {
  return `${fazendaId}/${glebaId}/${nomeDoArquivo(crypto.randomUUID())}`
}

/**
 * URL temporária para exibir a foto.
 *
 * O bucket é privado, então não há endereço permanente. Quem exibe precisa
 * renovar quando expira — é o que `useFotoDaGleba` faz.
 */
export async function urlAssinada(caminho) {
  if (!caminho) return null

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, VALIDADE_URL)
  if (error) throw new Error('Falha ao carregar a foto')
  return data?.signedUrl ?? null
}

/**
 * Sobe a foto e aponta a gleba para ela.
 *
 * A ordem importa e não é acidental:
 *   1. sobe o arquivo novo;
 *   2. grava o caminho na gleba;
 *   3. só então apaga o antigo.
 *
 * Invertida, uma falha no meio deixaria a gleba apontando para um arquivo que
 * não existe mais — a foto sumiria da tela sem ninguém ter pedido. Nesta
 * ordem, a falha no passo 3 deixa um arquivo órfão ocupando espaço, que é o
 * problema menor: ninguém perde imagem.
 */
export async function enviarFoto({ fazendaId, glebaId, blob, caminhoAnterior }) {
  const caminho = caminhoDaFoto(fazendaId, glebaId)

  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, blob, {
    contentType: 'image/jpeg',
    // Sem upsert: o caminho é novo a cada envio, e aceitar sobrescrita
    // esconderia um bug de geração de uuid em vez de deixá-lo aparecer.
    upsert: false,
  })
  if (erroUpload) throw new Error(`Falha ao enviar a foto: ${erroUpload.message}`)

  let gleba
  try {
    gleba = checar(
      await supabase
        .from('glebas')
        .update({ foto_path: caminho, foto_em: new Date().toISOString() })
        .eq('id', glebaId)
        .select('id, foto_path, foto_em')
        .single(),
      'Falha ao gravar a foto na gleba',
    )
  } catch (e) {
    // O arquivo subiu mas a gleba não aceitou o ponteiro. Sem esta limpeza,
    // sobraria um arquivo que nada referencia e ninguém consegue achar.
    await supabase.storage.from(BUCKET).remove([caminho])
    throw e
  }

  if (caminhoAnterior && caminhoAnterior !== caminho) {
    // Órfão aqui é aceitável: a foto nova já está no lugar e visível.
    await supabase.storage.from(BUCKET).remove([caminhoAnterior])
  }

  return gleba
}

/**
 * Remove a foto da gleba.
 *
 * Limpa o ponteiro primeiro, o arquivo depois — pelo mesmo motivo do envio: a
 * tela nunca deve apontar para um arquivo inexistente.
 */
export async function removerFoto({ glebaId, caminho }) {
  const gleba = checar(
    await supabase
      .from('glebas')
      .update({ foto_path: null, foto_em: null })
      .eq('id', glebaId)
      .select('id, foto_path, foto_em')
      .single(),
    'Falha ao remover a foto da gleba',
  )

  if (caminho) await supabase.storage.from(BUCKET).remove([caminho])
  return gleba
}
