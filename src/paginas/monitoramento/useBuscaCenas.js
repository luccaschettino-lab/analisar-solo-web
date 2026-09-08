import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

/**
 * Cenas do Planet cobrindo um ponto, dos últimos 120 dias.
 *
 * Só busca — a conta ainda não tem permissão de asset (ver Edge Function
 * `planet-mosaicos`), então isto é o único dado real que dá pra mostrar
 * hoje: data e nuvem de cada cena, sem imagem nenhuma.
 */
export function useBuscaCenas(lat, lng) {
  const [cenas, setCenas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (lat == null || lng == null) {
      setCenas([])
      setErro(null)
      setCarregando(false)
      return
    }

    let cancelado = false
    setCarregando(true)
    setErro(null)

    supabase.functions
      .invoke('planet-buscar-cenas', { body: { lat, lng } })
      .then(({ data, error }) => {
        if (cancelado) return
        if (error || data?.erro) {
          setErro(typeof data?.erro === 'string' ? data.erro : 'Não foi possível consultar o Planet agora.')
          setCenas([])
          return
        }
        setCenas(data?.cenas ?? [])
      })
      .catch(() => {
        if (!cancelado) {
          setErro('Não foi possível consultar o Planet agora.')
          setCenas([])
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [lat, lng])

  return { cenas, carregando, erro }
}
