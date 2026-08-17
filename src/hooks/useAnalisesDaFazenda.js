import { useEffect, useRef, useState } from 'react'
import { listarAnalisesDaFazenda } from '../dados/analises.js'

/**
 * Todas as análises da fazenda aberta, para a coloração do mapa.
 *
 * Carrega uma vez por fazenda e mantém em memória. Trocar de parâmetro, de
 * safra ou de profundidade nos filtros é recorte do que já está aqui — nenhuma
 * dessas trocas volta ao servidor, o que importa numa conexão de campo.
 */
export function useAnalisesDaFazenda(fazendaId) {
  const [analises, setAnalises] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  // Descarta resposta de uma fazenda que não é mais a selecionada.
  const requisicaoAtual = useRef(0)

  useEffect(() => {
    if (!fazendaId) {
      setAnalises([])
      setErro('')
      setCarregando(false)
      return
    }

    const meuToken = ++requisicaoAtual.current
    setCarregando(true)
    setErro('')

    listarAnalisesDaFazenda(fazendaId)
      .then((lista) => {
        if (meuToken !== requisicaoAtual.current) return
        setAnalises(lista)
      })
      .catch((e) => {
        if (meuToken !== requisicaoAtual.current) return
        setErro(e.message)
        setAnalises([])
      })
      .finally(() => {
        if (meuToken === requisicaoAtual.current) setCarregando(false)
      })
  }, [fazendaId])

  return { analises, carregando, erro }
}
