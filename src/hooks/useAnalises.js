import { useCallback, useEffect, useRef, useState } from 'react'
import { listarAnalisesDaGleba } from '../dados/analises.js'

/**
 * Análises de uma gleba.
 *
 * Os mutadores locais evitam recarregar a lista inteira a cada gravação: numa
 * tela onde o usuário lança um laudo atrás do outro, recarregar faria a
 * listagem piscar a cada linha salva.
 */
export function useAnalises(glebaId) {
  const [analises, setAnalises] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  // Descarta resposta de uma gleba que não é mais a selecionada.
  const requisicaoAtual = useRef(0)

  const carregar = useCallback(async () => {
    if (!glebaId) {
      setAnalises([])
      setErro('')
      setCarregando(false)
      return
    }

    const meuToken = ++requisicaoAtual.current
    setCarregando(true)
    setErro('')
    try {
      const lista = await listarAnalisesDaGleba(glebaId)
      if (meuToken !== requisicaoAtual.current) return
      setAnalises(lista)
    } catch (e) {
      if (meuToken !== requisicaoAtual.current) return
      setErro(e.message)
      setAnalises([])
    } finally {
      if (meuToken === requisicaoAtual.current) setCarregando(false)
    }
  }, [glebaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const aplicar = useCallback((analise) => {
    setAnalises((atual) => {
      const existe = atual.some((a) => a.id === analise.id)
      const proxima = existe
        ? atual.map((a) => (a.id === analise.id ? analise : a))
        : [...atual, analise]
      return proxima.sort((a, b) =>
        a.ano_safra !== b.ano_safra
          ? b.ano_safra.localeCompare(a.ano_safra)
          : String(a.profundidade).localeCompare(String(b.profundidade), 'pt-BR', { numeric: true }),
      )
    })
  }, [])

  const remover = useCallback((id) => {
    setAnalises((atual) => atual.filter((a) => a.id !== id))
  }, [])

  return { analises, carregando, erro, recarregar: carregar, aplicar, remover }
}

// Reexportados de lib/coloracao.js, onde a implementação vive. O mapa e a tela
// da gleba precisam da mesma lista de safras com a mesma ordenação — duas
// cópias divergiriam no dia em que alguém mudasse uma delas.
export { anosDisponiveis as anosSafra, profundidadesDisponiveis as profundidades } from '../lib/coloracao.js'
