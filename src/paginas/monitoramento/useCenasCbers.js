import { useEffect, useState } from 'react'
import { bboxDaGeometria, listarCenasCbers } from '../../dados/cbers.js'
import { listarCenasSentinel } from '../../dados/sentinel.js'

/** Satélites do Monitoramento. A chave é o que vai na URL/estado. */
export const SATELITES = {
  sentinel: { chave: 'sentinel', nome: 'Sentinel-2', resumo: 'a cada 2–5 dias · 10 m', listar: listarCenasSentinel },
  cbers: { chave: 'cbers', nome: 'CBERS-4A', resumo: 'mensal · 16 m', listar: listarCenasCbers },
}

/** Datas com imagem do satélite escolhido sobre o talhão. */
export function useCenasCbers(talhaoId, geometria, fonte = 'sentinel') {
  const bbox = bboxDaGeometria(geometria)
  const chaveBbox = bbox?.join(',') ?? ''
  const chaveGeometria = geometria ? JSON.stringify(geometria) : ''
  const [cenas, setCenas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    const satelite = SATELITES[fonte] ?? SATELITES.sentinel
    if (!talhaoId || !chaveBbox || !chaveGeometria) {
      setCenas([])
      setErro(null)
      setCarregando(false)
      return
    }

    const controle = new AbortController()
    let ativa = true
    setCarregando(true)
    setErro(null)
    setCenas([])

    satelite
      .listar(chaveBbox.split(',').map(Number), JSON.parse(chaveGeometria), controle.signal)
      .then((resultado) => {
        if (ativa) setCenas(resultado)
      })
      .catch((falha) => {
        if (!ativa || falha.name === 'AbortError') return
        setCenas([])
        setErro(falha.message || `Não foi possível consultar o catálogo do ${satelite.nome}.`)
      })
      .finally(() => {
        if (ativa) setCarregando(false)
      })

    return () => {
      ativa = false
      controle.abort()
    }
  }, [talhaoId, chaveBbox, chaveGeometria, fonte])

  return { cenas, carregando, erro }
}
