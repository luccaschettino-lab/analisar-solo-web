import { useCallback, useEffect, useRef, useState } from 'react'
import { listarTalhoes, compararCodigo } from '../dados/talhoes.js'

/**
 * Talhões de uma fazenda.
 *
 * Gleba saiu daqui — o cadastro continua no banco (histórico), mas o app não
 * lê mais essa tabela: talhão é a unidade que o mapa mostra, seleciona e
 * analisa agora.
 */
export function useHierarquia(fazendaId) {
  const [talhoes, setTalhoes] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  // Descarta resposta de uma fazenda que nao e mais a selecionada. Trocar de
  // fazenda rapido no seletor, sem isso, pinta o mapa com a hierarquia errada
  // se a primeira resposta chegar depois da segunda.
  const requisicaoAtual = useRef(0)

  const carregar = useCallback(async () => {
    if (!fazendaId) {
      setTalhoes([])
      setErro('')
      setCarregando(false)
      return
    }

    const meuToken = ++requisicaoAtual.current
    setCarregando(true)
    setErro('')
    try {
      const ts = await listarTalhoes(fazendaId)
      if (meuToken !== requisicaoAtual.current) return
      setTalhoes(ts)
    } catch (e) {
      if (meuToken !== requisicaoAtual.current) return
      setErro(e.message)
      setTalhoes([])
    } finally {
      if (meuToken === requisicaoAtual.current) setCarregando(false)
    }
  }, [fazendaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const aplicarTalhoes = useCallback((novos) => {
    setTalhoes((atual) => {
      const porId = new Map(atual.map((t) => [t.id, t]))
      for (const t of novos) porId.set(t.id, { ...porId.get(t.id), ...t })
      return [...porId.values()].sort(compararCodigo)
    })
  }, [])

  const aplicarTalhao = useCallback((talhao) => aplicarTalhoes([talhao]), [aplicarTalhoes])

  const removerTalhao = useCallback((id) => {
    setTalhoes((atual) => atual.filter((t) => t.id !== id))
  }, [])

  return {
    talhoes,
    carregando,
    erro,
    recarregar: carregar,
    aplicarTalhao,
    aplicarTalhoes,
    removerTalhao,
  }
}
