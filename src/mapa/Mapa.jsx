import { useEffect, useRef } from 'react'
import { useMapa } from './useMapa.js'

/**
 * Container do mapa. Reporta a instância Leaflet e a camada base ativa para
 * quem o usa, e a partir daí todo desenho é feito de forma imperativa.
 *
 * `aoCriarMapa` precisa ser estável (useCallback no pai), senão o efeito
 * dispara a cada render.
 */
export default function Mapa({ aoCriarMapa, aoTrocarCamada, className = '' }) {
  const containerRef = useRef(null)
  const { mapa, camadaAtiva } = useMapa(containerRef)

  // Reporta também o null da desmontagem: sem isso o pai guardaria uma
  // instância já removida e tentaria desenhar sobre um mapa morto.
  useEffect(() => {
    aoCriarMapa?.(mapa)
  }, [mapa, aoCriarMapa])

  useEffect(() => {
    aoTrocarCamada?.(camadaAtiva)
  }, [camadaAtiva, aoTrocarCamada])

  // h-full obrigatório: o Leaflet mede o container na criação, e um div sem
  // altura vira um mapa de 0px que nunca renderiza tile nenhum.
  return <div ref={containerRef} className={`h-full w-full ${className}`} />
}
