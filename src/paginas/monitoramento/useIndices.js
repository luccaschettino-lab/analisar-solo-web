import { useEffect, useState } from 'react'
import { calcularIndicesSentinel } from '../../dados/sentinel.js'
import { guardarIndicesDoTalhao } from '../../dados/indicesTalhao.js'

// Único satélite desde 18/11/2026 (o CBERS-4A saiu). A coluna `fonte` do
// banco continua, caso entre outro satélite no futuro.
export const FONTE = 'sentinel'

// Resultados (e cálculos em andamento) de cada cena, por talhão + desenho.
// Fica no módulo, não no componente: o "carregar o período", a escolha de uma
// data e a exportação usam o mesmo cálculo, e voltar a uma data já vista é na hora.
const cache = new Map()

const chaveDe = (talhaoId, cenaId, geometria) => `${talhaoId}|${cenaId}|${JSON.stringify(geometria)}`

export function resultadoGuardado(talhaoId, cenaId, geometria) {
  const r = cache.get(chaveDe(talhaoId, cenaId, geometria))
  return r && !(r instanceof Promise) ? r : null
}

/** Calcula (ou devolve o já calculado) os índices do talhão numa cena. */
export function calcularComCache(talhaoId, cenaId, geometria) {
  const chave = chaveDe(talhaoId, cenaId, geometria)
  const guardado = cache.get(chave)
  if (guardado) return guardado instanceof Promise ? guardado : Promise.resolve(guardado)
  const pedido = calcularIndicesSentinel(cenaId, geometria)
    .then((dados) => {
      cache.set(chave, dados)
      // O resumo vai para o banco: da próxima vez (e para toda a fazenda) o
      // gráfico da evolução abre sem recalcular.
      guardarIndicesDoTalhao(talhaoId, FONTE, dados)
      return dados
    })
    .catch((e) => {
      cache.delete(chave) // falhou: deixa tentar de novo
      throw e
    })
  cache.set(chave, pedido)
  return pedido
}

/** Índices do talhão na cena escolhida. */
export function useIndices(talhaoId, cenaId, geometria) {
  const [estado, setEstado] = useState({ dados: null, carregando: false, erro: null })
  const chaveGeometria = geometria ? JSON.stringify(geometria) : ''

  useEffect(() => {
    if (!talhaoId || !cenaId || !chaveGeometria) {
      setEstado({ dados: null, carregando: false, erro: null })
      return
    }
    const geo = JSON.parse(chaveGeometria)
    const pronto = resultadoGuardado(talhaoId, cenaId, geo)
    if (pronto) {
      setEstado({ dados: pronto, carregando: false, erro: null })
      return
    }
    let ativa = true
    setEstado({ dados: null, carregando: true, erro: null })
    calcularComCache(talhaoId, cenaId, geo)
      .then((dados) => ativa && setEstado({ dados, carregando: false, erro: null }))
      .catch((falha) => ativa && setEstado({ dados: null, carregando: false, erro: falha.message }))
    return () => {
      ativa = false
    }
  }, [talhaoId, cenaId, chaveGeometria])

  return estado
}
