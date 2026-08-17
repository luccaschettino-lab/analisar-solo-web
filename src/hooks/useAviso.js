import { useCallback, useEffect, useState } from 'react'

const DURACAO_PADRAO_MS = 4000

/**
 * Aviso efêmero (toast) com limpeza automática.
 *
 * O estado carrega um `id` além do texto porque repetir a mesma mensagem é
 * comum — gravar duas geometrias seguidas mostra "Geometria gravada." duas
 * vezes. Com string pura o React não veria mudança de estado, o efeito não
 * redispararia, e o segundo aviso herdaria o cronômetro do primeiro, sumindo
 * antes do tempo.
 */
export function useAviso(duracaoMs = DURACAO_PADRAO_MS) {
  const [estado, setEstado] = useState({ texto: '', id: 0 })

  useEffect(() => {
    if (!estado.texto) return
    const t = setTimeout(() => setEstado((atual) => ({ ...atual, texto: '' })), duracaoMs)
    return () => clearTimeout(t)
  }, [estado, duracaoMs])

  const mostrar = useCallback((texto) => {
    setEstado((atual) => ({ texto, id: atual.id + 1 }))
  }, [])

  const limpar = useCallback(() => {
    setEstado((atual) => ({ ...atual, texto: '' }))
  }, [])

  return { aviso: estado.texto, mostrar, limpar }
}
