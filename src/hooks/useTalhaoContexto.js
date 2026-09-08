import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarTalhaoComContexto } from '../dados/talhoes.js'

/**
 * Talhão com a fazenda a que pertence, para o cabeçalho da tela de detalhe.
 *
 * `naoEncontrado` é estado próprio, separado de `erro`: um talhão apagado ou
 * fora do seu acesso não é falha do sistema, e merece uma tela diferente da
 * de erro de rede.
 */
export function useTalhaoContexto(talhaoId) {
  const [contexto, setContexto] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [erro, setErro] = useState('')

  const requisicaoAtual = useRef(0)

  useEffect(() => {
    if (!talhaoId) return

    const meuToken = ++requisicaoAtual.current
    setCarregando(true)
    setErro('')
    setNaoEncontrado(false)

    buscarTalhaoComContexto(talhaoId)
      .then((resultado) => {
        if (meuToken !== requisicaoAtual.current) return
        if (!resultado) setNaoEncontrado(true)
        else setContexto(resultado)
      })
      .catch((e) => {
        if (meuToken !== requisicaoAtual.current) return
        setErro(e.message)
      })
      .finally(() => {
        if (meuToken === requisicaoAtual.current) setCarregando(false)
      })
  }, [talhaoId])

  const aplicarTalhao = useCallback((campos) => {
    setContexto((atual) => (atual ? { ...atual, talhao: { ...atual.talhao, ...campos } } : atual))
  }, [])

  return { contexto, carregando, naoEncontrado, erro, aplicarTalhao }
}
