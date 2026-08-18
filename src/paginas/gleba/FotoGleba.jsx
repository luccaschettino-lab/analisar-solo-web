import { useRef } from 'react'
import { useFotoDaGleba } from '../../hooks/useFotoDaGleba.js'
import { formatarTamanho } from '../../lib/imagem.js'

const BOTAO =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300'
const BOTAO_PRIMARIO =
  'rounded-md bg-solo-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300'

function dataLegivel(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Foto do solo da gleba.
 *
 * Uma por gleba, substituível. O que ela serve para mostrar — cor, textura,
 * estrutura, presença de pedra ou raiz — não precisa de galeria nem de
 * resolução de impressão; precisa estar lá e carregar no campo.
 *
 * A data de envio aparece junto e não é detalhe: num produto que existe para
 * comparar anos, uma foto de três safras atrás passando por retrato de hoje
 * seria pior que não ter foto.
 */
export default function FotoGleba({ fazendaId, gleba, editor, aoAtualizar }) {
  const entrada = useRef(null)

  const { url, carregando, enviando, erro, ultimaReducao, enviar, remover } = useFotoDaGleba({
    fazendaId,
    glebaId: gleba.id,
    caminho: gleba.foto_path,
    foto_em: gleba.foto_em,
    aoAtualizar,
  })

  function escolher(e) {
    const arquivo = e.target.files?.[0]
    // Limpa o input para que escolher o MESMO arquivo de novo dispare o evento
    // outra vez — comum depois de um envio que falhou.
    e.target.value = ''
    if (arquivo) enviar(arquivo)
  }

  const temFoto = Boolean(gleba.foto_path)

  return (
    <div className="p-3 sm:p-4">
      {erro && (
        <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      {temFoto ? (
        <figure className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {carregando && !url ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-500">
              Carregando foto…
            </div>
          ) : url ? (
            <img
              src={url}
              alt={`Solo da gleba ${gleba.codigo}${gleba.nome ? ` — ${gleba.nome}` : ''}`}
              // A altura limitada evita que uma foto em retrato empurre os
              // botões para fora da tela no celular.
              className="max-h-[60vh] w-full bg-slate-100 object-contain"
            />
          ) : (
            <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-slate-500">
              A foto está registrada nesta gleba, mas não foi possível carregá-la agora.
            </div>
          )}

          <figcaption className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            {gleba.foto_em ? `Enviada em ${dataLegivel(gleba.foto_em)}` : 'Data de envio não registrada'}
          </figcaption>
        </figure>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Esta gleba ainda não tem foto do solo.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Uma foto do perfil ou da superfície ajuda a lembrar o que os números não dizem: cor,
            textura, pedra, raiz, encharcamento.
          </p>
        </div>
      )}

      {editor ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            // No celular, abre a câmera traseira direto em vez do seletor de
            // arquivos — que é o gesto certo para quem está em pé na gleba.
            capture="environment"
            onChange={escolher}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={enviando}
            className={BOTAO_PRIMARIO}
          >
            {enviando ? 'Enviando…' : temFoto ? 'Substituir foto' : 'Adicionar foto'}
          </button>

          {temFoto && (
            <button type="button" onClick={remover} disabled={enviando} className={BOTAO}>
              Remover
            </button>
          )}

          {ultimaReducao && (
            // Explica a espera de um jeito que barra de progresso não explica.
            <span className="text-xs text-slate-500">
              {formatarTamanho(ultimaReducao.tamanhoOriginal)} →{' '}
              {formatarTamanho(ultimaReducao.tamanhoFinal)} ({ultimaReducao.largura}×
              {ultimaReducao.altura})
            </span>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Você tem acesso de leitura nesta fazenda, então não pode alterar a foto.
        </p>
      )}

      {editor && (
        <p className="mt-2 text-xs text-slate-400">
          A foto é reduzida no seu aparelho antes de subir, para funcionar na conexão do campo.
          Substituir apaga a anterior.
        </p>
      )}
    </div>
  )
}
