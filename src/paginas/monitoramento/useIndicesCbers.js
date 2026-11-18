import { useEffect, useRef, useState } from 'react'
import { calcularIndicesCbers } from '../../dados/indicesCbers.js'
import { calcularIndicesSentinel } from '../../dados/sentinel.js'

const CALCULAR = { cbers: calcularIndicesCbers, sentinel: calcularIndicesSentinel }

/**
 * Índices do talhão na cena escolhida, do satélite escolhido. Guarda o
 * resultado de cada cena visitada, para voltar a uma data já vista sem pedir
 * de novo ao servidor.
 */
export function useIndicesCbers(talhaoId, cenaId, geometria, fonte = 'sentinel') {
  const cache = useRef(new Map())
  const [estado, setEstado] = useState({ dados: null, carregando: false, erro: null })
  const chaveGeometria = geometria ? JSON.stringify(geometria) : ''

  useEffect(() => {
    if (!talhaoId || !cenaId || !chaveGeometria) {
      setEstado({ dados: null, carregando: false, erro: null })
      return
    }
    const chave = `${fonte}|${talhaoId}|${cenaId}|${chaveGeometria}`
    const guardado = cache.current.get(chave)
    if (guardado) {
      setEstado({ dados: guardado, carregando: false, erro: null })
      return
    }
    let ativa = true
    setEstado({ dados: null, carregando: true, erro: null })
    ;(CALCULAR[fonte] ?? calcularIndicesSentinel)(cenaId, JSON.parse(chaveGeometria))
      .then((dados) => {
        cache.current.set(chave, dados)
        if (ativa) setEstado({ dados, carregando: false, erro: null })
      })
      .catch((falha) => {
        if (ativa) setEstado({ dados: null, carregando: false, erro: falha.message })
      })
    return () => {
      ativa = false
    }
  }, [talhaoId, cenaId, chaveGeometria, fonte])

  return estado
}
