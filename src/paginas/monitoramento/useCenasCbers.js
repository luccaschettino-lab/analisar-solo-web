import { useEffect, useState } from 'react'
import { bboxDaGeometria, listarCenasCbers } from '../../dados/cbers.js'

export function useCenasCbers(talhaoId, geometria) {
  const bbox = bboxDaGeometria(geometria)
  const chaveBbox = bbox?.join(',') ?? ''
  const chaveGeometria = geometria ? JSON.stringify(geometria) : ''
  const [cenas, setCenas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
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

    listarCenasCbers(chaveBbox.split(',').map(Number), JSON.parse(chaveGeometria), controle.signal)
      .then((resultado) => {
        if (ativa) setCenas(resultado)
      })
      .catch((falha) => {
        if (!ativa || falha.name === 'AbortError') return
        setCenas([])
        setErro(falha.message || 'Não foi possível consultar o catálogo CBERS do INPE.')
      })
      .finally(() => {
        if (ativa) setCarregando(false)
      })

    return () => {
      ativa = false
      controle.abort()
    }
  }, [talhaoId, chaveBbox, chaveGeometria])

  return { cenas, carregando, erro }
}
