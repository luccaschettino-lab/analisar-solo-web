import { useEffect, useRef, useState } from 'react'
import { listarPontosColetaDaFazenda } from '../dados/pontosColeta.js'

export function usePontosAmostraDaFazenda(fazendaId, habilitado) {
  const [pontos, setPontos] = useState([])
  const [fazendaCarregada, setFazendaCarregada] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const requisicaoAtual = useRef(0)

  useEffect(() => {
    const token = ++requisicaoAtual.current
    if (!fazendaId || !habilitado) {
      setPontos([])
      setFazendaCarregada(null)
      setCarregando(false)
      setErro('')
      return
    }

    setCarregando(true)
    setErro('')
    listarPontosColetaDaFazenda(fazendaId)
      .then((resultado) => {
        if (token !== requisicaoAtual.current) return
        setPontos(resultado)
        setFazendaCarregada(fazendaId)
      })
      .catch((falha) => {
        if (token !== requisicaoAtual.current) return
        setPontos([])
        setFazendaCarregada(fazendaId)
        setErro(falha.message)
      })
      .finally(() => {
        if (token === requisicaoAtual.current) setCarregando(false)
      })

    return () => {
      requisicaoAtual.current += 1
    }
  }, [fazendaId, habilitado])

  return {
    pontos: fazendaCarregada === fazendaId && habilitado ? pontos : [],
    carregando,
    erro: fazendaCarregada === fazendaId && habilitado ? erro : '',
  }
}
