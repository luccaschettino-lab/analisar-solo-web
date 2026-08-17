import { useCallback, useEffect, useRef, useState } from 'react'
import { listarTalhoes, compararCodigo } from '../dados/talhoes.js'
import { listarGlebasDaFazenda } from '../dados/glebas.js'

/**
 * Talhoes e glebas de uma fazenda.
 *
 * As duas consultas saem em paralelo: sao independentes, e sequenciar
 * dobraria o tempo de abertura do mapa sem ganho nenhum.
 */
export function useHierarquia(fazendaId) {
  const [talhoes, setTalhoes] = useState([])
  const [glebas, setGlebas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  // Descarta resposta de uma fazenda que nao e mais a selecionada. Trocar de
  // fazenda rapido no seletor, sem isso, pinta o mapa com a hierarquia errada
  // se a primeira resposta chegar depois da segunda.
  const requisicaoAtual = useRef(0)

  const carregar = useCallback(async () => {
    if (!fazendaId) {
      setTalhoes([])
      setGlebas([])
      setErro('')
      setCarregando(false)
      return
    }

    const meuToken = ++requisicaoAtual.current
    setCarregando(true)
    setErro('')
    try {
      const [ts, gs] = await Promise.all([
        listarTalhoes(fazendaId),
        listarGlebasDaFazenda(fazendaId),
      ])
      if (meuToken !== requisicaoAtual.current) return
      setTalhoes(ts)
      setGlebas(gs)
    } catch (e) {
      if (meuToken !== requisicaoAtual.current) return
      setErro(e.message)
      setTalhoes([])
      setGlebas([])
    } finally {
      if (meuToken === requisicaoAtual.current) setCarregando(false)
    }
  }, [fazendaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const aplicarTalhao = useCallback((talhao) => {
    setTalhoes((atual) => {
      const existe = atual.some((t) => t.id === talhao.id)
      const proxima = existe
        ? atual.map((t) => (t.id === talhao.id ? { ...t, ...talhao } : t))
        : [...atual, talhao]
      return proxima.sort(compararCodigo)
    })
  }, [])

  const removerTalhao = useCallback((id) => {
    setTalhoes((atual) => atual.filter((t) => t.id !== id))
    // Espelha a cascata do banco no estado local. Sem isso, as glebas do
    // talhao apagado continuariam desenhadas no mapa ate o proximo recarregar.
    setGlebas((atual) => atual.filter((g) => g.talhao_id !== id))
  }, [])

  const aplicarGlebas = useCallback((novas) => {
    setGlebas((atual) => {
      const porId = new Map(atual.map((g) => [g.id, g]))
      for (const g of novas) porId.set(g.id, { ...porId.get(g.id), ...g })
      return [...porId.values()].sort(compararCodigo)
    })
  }, [])

  const aplicarGleba = useCallback((gleba) => aplicarGlebas([gleba]), [aplicarGlebas])

  const removerGleba = useCallback((id) => {
    setGlebas((atual) => atual.filter((g) => g.id !== id))
  }, [])

  return {
    talhoes,
    glebas,
    carregando,
    erro,
    recarregar: carregar,
    aplicarTalhao,
    removerTalhao,
    aplicarGleba,
    aplicarGlebas,
    removerGleba,
  }
}

// Glebas de um talhao, para a arvore e para o contador.
export function glebasDoTalhao(glebas, talhaoId) {
  return glebas.filter((g) => g.talhao_id === talhaoId)
}
