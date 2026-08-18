import { useCallback, useEffect, useRef, useState } from 'react'
import { urlAssinada, enviarFoto, removerFoto, VALIDADE_URL } from '../dados/fotos.js'
import { reduzirImagem } from '../lib/imagem.js'

// Renova um pouco antes de expirar. Sem folga, a imagem quebraria na tela de
// quem deixou a aba aberta exatamente na virada.
const FOLGA_MS = 5 * 60 * 1000

/**
 * A foto de uma gleba: URL para exibir, envio e remoção.
 *
 * O bucket é privado, então não existe endereço permanente — o que se tem é
 * uma URL assinada com validade. Deixar a aba aberta mais que isso quebraria a
 * imagem, então o hook reagenda a renovação sozinho.
 */
export function useFotoDaGleba({ fazendaId, glebaId, caminho, foto_em, aoAtualizar }) {
  const [url, setUrl] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  // Último resultado da redução, para a tela poder dizer "4,2 MB → 310 KB".
  const [ultimaReducao, setUltimaReducao] = useState(null)

  const requisicaoAtual = useRef(0)

  const assinar = useCallback(async () => {
    if (!caminho) {
      setUrl(null)
      setErro('')
      setCarregando(false)
      return
    }

    const meuToken = ++requisicaoAtual.current
    setCarregando(true)
    setErro('')
    try {
      const nova = await urlAssinada(caminho)
      if (meuToken !== requisicaoAtual.current) return
      setUrl(nova)
    } catch (e) {
      if (meuToken !== requisicaoAtual.current) return
      setErro(e.message)
      setUrl(null)
    } finally {
      if (meuToken === requisicaoAtual.current) setCarregando(false)
    }
  }, [caminho])

  useEffect(() => {
    assinar()
  }, [assinar])

  // Reassina antes de a URL vencer, enquanto a aba estiver aberta.
  useEffect(() => {
    if (!url) return
    const t = setTimeout(assinar, VALIDADE_URL * 1000 - FOLGA_MS)
    return () => clearTimeout(t)
  }, [url, assinar])

  /**
   * Reduz no navegador e envia.
   *
   * A redução vem antes de qualquer ida ao servidor: é ela que transforma uma
   * foto de 4 MB em 300 KB, e é o passo que decide se o envio termina numa
   * conexão de campo.
   */
  const enviar = useCallback(
    async (arquivo) => {
      if (!arquivo || enviando) return
      setEnviando(true)
      setErro('')
      try {
        const reducao = await reduzirImagem(arquivo)
        setUltimaReducao(reducao)

        const gleba = await enviarFoto({
          fazendaId,
          glebaId,
          blob: reducao.blob,
          caminhoAnterior: caminho,
        })
        aoAtualizar?.(gleba)
      } catch (e) {
        setErro(e.message)
      } finally {
        setEnviando(false)
      }
    },
    [enviando, fazendaId, glebaId, caminho, aoAtualizar],
  )

  const remover = useCallback(async () => {
    if (enviando) return
    setEnviando(true)
    setErro('')
    try {
      const gleba = await removerFoto({ glebaId, caminho })
      setUltimaReducao(null)
      aoAtualizar?.(gleba)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }, [enviando, glebaId, caminho, aoAtualizar])

  return { url, carregando, enviando, erro, ultimaReducao, enviar, remover, foto_em }
}
