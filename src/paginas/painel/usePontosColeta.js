import { useCallback, useEffect, useRef, useState } from 'react'
import { listarPontosColetaDoTalhao } from '../../dados/pontosColeta.js'

export function usePontosColeta(talhaoId) {
  const [pontos, setPontos] = useState([])
  const [talhaoCarregado, setTalhaoCarregado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const requisicaoAtual = useRef(0)

  const carregar = useCallback(async () => {
    if (!talhaoId) {
      setPontos([])
      setTalhaoCarregado(null)
      setErro('')
      setCarregando(false)
      return
    }

    const token = ++requisicaoAtual.current
    setCarregando(true)
    setErro('')
    try {
      const resultado = await listarPontosColetaDoTalhao(talhaoId)
      if (token === requisicaoAtual.current) {
        setPontos(resultado)
        setTalhaoCarregado(talhaoId)
      }
    } catch (falha) {
      if (token !== requisicaoAtual.current) return
      setPontos([])
      setTalhaoCarregado(talhaoId)
      setErro(falha.message)
    } finally {
      if (token === requisicaoAtual.current) setCarregando(false)
    }
  }, [talhaoId])

  useEffect(() => {
    carregar()
    return () => {
      requisicaoAtual.current += 1
    }
  }, [carregar])

  return {
    pontos: talhaoCarregado === talhaoId ? pontos : [],
    carregando,
    erro: talhaoCarregado === talhaoId ? erro : '',
    recarregar: carregar,
  }
}
