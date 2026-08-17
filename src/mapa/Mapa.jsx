import { useEffect, useRef } from 'react'
import { useMapa } from './useMapa.js'

/**
 * Container do mapa. Reporta a instancia Leaflet para quem o usa, e a partir
 * dai todo desenho e feito de forma imperativa sobre ela.
 *
 * `aoCriarMapa` precisa ser estavel (useCallback no pai), senao o efeito
 * dispara a cada render.
 */
export default function Mapa({ aoCriarMapa, className = '' }) {
  const containerRef = useRef(null)
  const mapa = useMapa(containerRef)

  // Reporta também o null da desmontagem: sem isso o pai guardaria uma
  // instância já removida e tentaria desenhar sobre um mapa morto.
  useEffect(() => {
    aoCriarMapa?.(mapa)
  }, [mapa, aoCriarMapa])

  // h-full obrigatorio: o Leaflet mede o container na criacao, e um div sem
  // altura vira um mapa de 0px que nunca renderiza tile nenhum.
  return <div ref={containerRef} className={`h-full w-full ${className}`} />
}
