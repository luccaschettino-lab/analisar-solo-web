import { useEffect, useRef, useState } from 'react'
import { buscarGlebaComContexto } from '../dados/glebas.js'

/**
 * Gleba com talhão e fazenda, para o cabeçalho da tela de detalhe.
 *
 * `naoEncontrada` é estado próprio, separado de `erro`: uma gleba apagada ou
 * fora do seu acesso não é falha do sistema, e merece uma tela diferente da
 * de erro de rede.
 */
export function useGlebaContexto(glebaId) {
  const [contexto, setContexto] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [erro, setErro] = useState('')

  const requisicaoAtual = useRef(0)

  useEffect(() => {
    if (!glebaId) return

    const meuToken = ++requisicaoAtual.current
    setCarregando(true)
    setErro('')
    setNaoEncontrada(false)

    buscarGlebaComContexto(glebaId)
      .then((resultado) => {
        if (meuToken !== requisicaoAtual.current) return
        if (!resultado) setNaoEncontrada(true)
        else setContexto(resultado)
      })
      .catch((e) => {
        if (meuToken !== requisicaoAtual.current) return
        setErro(e.message)
      })
      .finally(() => {
        if (meuToken === requisicaoAtual.current) setCarregando(false)
      })
  }, [glebaId])

  return { contexto, carregando, naoEncontrada, erro }
}
