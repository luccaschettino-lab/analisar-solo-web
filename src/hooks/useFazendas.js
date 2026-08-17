import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { listarFazendasDoUsuario } from '../dados/fazendas.js'

/**
 * Fazendas do usuario logado, com o papel dele em cada uma.
 *
 * Os mutadores locais existem para nao recarregar a lista inteira a cada
 * edicao: renomear uma fazenda nao deveria custar uma ida ao servidor mais
 * um piscar da lista.
 */
export function useFazendas() {
  const { usuario } = useAuth()
  const usuarioId = usuario?.id ?? null

  const [fazendas, setFazendas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    if (!usuarioId) {
      setFazendas([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro('')
    try {
      setFazendas(await listarFazendasDoUsuario(usuarioId))
    } catch (e) {
      setErro(e.message)
      setFazendas([])
    } finally {
      setCarregando(false)
    }
  }, [usuarioId])

  useEffect(() => {
    let ativo = true
    // Guarda contra resposta que chega depois de o usuario ter trocado:
    // sem isso, um logout durante a carga repovoaria a lista.
    ;(async () => {
      if (!usuarioId) {
        if (ativo) {
          setFazendas([])
          setCarregando(false)
        }
        return
      }
      setCarregando(true)
      setErro('')
      try {
        const lista = await listarFazendasDoUsuario(usuarioId)
        if (ativo) setFazendas(lista)
      } catch (e) {
        if (ativo) {
          setErro(e.message)
          setFazendas([])
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [usuarioId])

  const aplicarFazenda = useCallback((fazenda) => {
    setFazendas((atual) => {
      const existe = atual.some((f) => f.id === fazenda.id)
      const proxima = existe
        ? atual.map((f) => (f.id === fazenda.id ? { ...f, ...fazenda } : f))
        : [...atual, fazenda]
      return proxima.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    })
  }, [])

  const removerFazenda = useCallback((id) => {
    setFazendas((atual) => atual.filter((f) => f.id !== id))
  }, [])

  return { fazendas, carregando, erro, recarregar, aplicarFazenda, removerFazenda }
}
