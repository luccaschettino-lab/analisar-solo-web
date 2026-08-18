import { useCallback, useEffect, useState } from 'react'
import {
  listarCriterios,
  criarCriterio,
  atualizarCriterio,
  excluirCriterio,
} from '../dados/criterios.js'

/**
 * Os conjuntos de critérios que o usuário enxerga.
 *
 * A RLS já decide o que vem: os que ele criou, mais os aplicados a fazendas
 * que ele acessa. Quem não é autor recebe o conjunto para leitura — precisa
 * dele para entender a cor do próprio mapa — e a tela desabilita a edição.
 */
export function useCriterios() {
  const [criterios, setCriterios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      setCriterios(await listarCriterios())
    } catch (e) {
      setErro(e.message)
      setCriterios([])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Aplica localmente o que voltou do servidor, sem recarregar a lista.
   *
   * Escrita nunca é otimista aqui, pela mesma regra da Fase 2: o estado só
   * muda com a linha que o banco devolveu. O que se evita é a segunda ida ao
   * servidor, não a confirmação.
   */
  const aplicar = useCallback((criterio) => {
    setCriterios((atual) => {
      const existe = atual.some((c) => c.id === criterio.id)
      const proxima = existe
        ? atual.map((c) => (c.id === criterio.id ? criterio : c))
        : [...atual, criterio]
      return proxima.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    })
  }, [])

  const criar = useCallback(
    async (dados) => {
      const novo = await criarCriterio(dados)
      aplicar(novo)
      return novo
    },
    [aplicar],
  )

  const salvar = useCallback(
    async (id, campos) => {
      const atualizado = await atualizarCriterio(id, campos)
      aplicar(atualizado)
      return atualizado
    },
    [aplicar],
  )

  const excluir = useCallback(async (id) => {
    await excluirCriterio(id)
    setCriterios((atual) => atual.filter((c) => c.id !== id))
  }, [])

  return { criterios, carregando, erro, recarregar: carregar, criar, salvar, excluir }
}
