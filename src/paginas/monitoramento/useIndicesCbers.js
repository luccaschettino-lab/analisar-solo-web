import { useEffect, useState } from 'react'
import { calcularIndicesCbers } from '../../dados/indicesCbers.js'
import { calcularIndicesSentinel } from '../../dados/sentinel.js'

const CALCULAR = { cbers: calcularIndicesCbers, sentinel: calcularIndicesSentinel }

// Resultados (e cálculos em andamento) de cada cena, por satélite + talhão +
// desenho. Fica no módulo, não no componente: o "carregar o mês" e a escolha
// de uma data usam o mesmo cálculo, e voltar a uma data já vista é na hora.
const cache = new Map()

const chaveDe = (fonte, talhaoId, cenaId, geometria) => `${fonte}|${talhaoId}|${cenaId}|${JSON.stringify(geometria)}`

export function resultadoGuardado(fonte, talhaoId, cenaId, geometria) {
  const r = cache.get(chaveDe(fonte, talhaoId, cenaId, geometria))
  return r && !(r instanceof Promise) ? r : null
}

/** Calcula (ou devolve o já calculado) os índices do talhão numa cena. */
export function calcularComCache(fonte, talhaoId, cenaId, geometria) {
  const chave = chaveDe(fonte, talhaoId, cenaId, geometria)
  const guardado = cache.get(chave)
  if (guardado) return guardado instanceof Promise ? guardado : Promise.resolve(guardado)
  const pedido = (CALCULAR[fonte] ?? calcularIndicesSentinel)(cenaId, geometria)
    .then((dados) => {
      cache.set(chave, dados)
      return dados
    })
    .catch((e) => {
      cache.delete(chave) // falhou: deixa tentar de novo
      throw e
    })
  cache.set(chave, pedido)
  return pedido
}

/** Índices do talhão na cena escolhida, do satélite escolhido. */
export function useIndicesCbers(talhaoId, cenaId, geometria, fonte = 'sentinel') {
  const [estado, setEstado] = useState({ dados: null, carregando: false, erro: null })
  const chaveGeometria = geometria ? JSON.stringify(geometria) : ''

  useEffect(() => {
    if (!talhaoId || !cenaId || !chaveGeometria) {
      setEstado({ dados: null, carregando: false, erro: null })
      return
    }
    const geo = JSON.parse(chaveGeometria)
    const pronto = resultadoGuardado(fonte, talhaoId, cenaId, geo)
    if (pronto) {
      setEstado({ dados: pronto, carregando: false, erro: null })
      return
    }
    let ativa = true
    setEstado({ dados: null, carregando: true, erro: null })
    calcularComCache(fonte, talhaoId, cenaId, geo)
      .then((dados) => ativa && setEstado({ dados, carregando: false, erro: null }))
      .catch((falha) => ativa && setEstado({ dados: null, carregando: false, erro: falha.message }))
    return () => {
      ativa = false
    }
  }, [talhaoId, cenaId, chaveGeometria, fonte])

  return estado
}
