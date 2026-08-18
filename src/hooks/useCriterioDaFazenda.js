import { useCallback, useEffect, useRef, useState } from 'react'
import { criterioDaFazenda } from '../dados/criterios.js'

/**
 * O conjunto de critérios em vigor na fazenda aberta.
 *
 * `null` significa "padrão do sistema" — as faixas de `config/parametros.js`.
 * É o estado de toda fazenda que ainda não teve um conjunto aplicado, e não um
 * erro.
 *
 * **Enquanto carrega, `criterio` fica `null`.** Isso quer dizer que o mapa
 * pinta pelo padrão do sistema por uma fração de segundo antes de trocar para
 * o conjunto do consultor. A alternativa — segurar a coloração até o conjunto
 * chegar — deixaria o mapa cinza a cada troca de fazenda. Piscar entre duas
 * classificações válidas é menos ruim que piscar entre classificação e nada,
 * mas quem exibe deve usar `carregando` para não afirmar a autoria errada na
 * legenda nesse intervalo.
 */
export function useCriterioDaFazenda(criterioId) {
  const [criterio, setCriterio] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  // Descarta resposta de uma fazenda que não é mais a selecionada, como em
  // useAnalisesDaFazenda: trocar de fazenda rápido não pode pintar o mapa com
  // o critério da anterior.
  const requisicaoAtual = useRef(0)

  const carregar = useCallback(async () => {
    if (!criterioId) {
      setCriterio(null)
      setErro('')
      setCarregando(false)
      return
    }

    const meuToken = ++requisicaoAtual.current
    setCarregando(true)
    setErro('')

    try {
      const encontrado = await criterioDaFazenda(criterioId)
      if (meuToken !== requisicaoAtual.current) return
      setCriterio(encontrado)
    } catch (e) {
      if (meuToken !== requisicaoAtual.current) return
      setErro(e.message)
      // Cai no padrão do sistema em vez de deixar o mapa sem classificação.
      // O erro aparece na tela; a cor não desaparece.
      setCriterio(null)
    } finally {
      if (meuToken === requisicaoAtual.current) setCarregando(false)
    }
  }, [criterioId])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { criterio, carregando, erro, recarregar: carregar }
}
