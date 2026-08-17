import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  CAMADAS_BASE,
  CAMADA_PADRAO,
  CENTRO_PADRAO,
  ZOOM_PADRAO,
} from '../config/mapa.js'

/**
 * Cria a instancia Leaflet dentro do container e devolve quando estiver pronta.
 *
 * O Leaflet e imperativo: manipula o DOM por fora do React. Por isso o mapa
 * vive num ref e o componente so expoe a instancia — nao ha re-render do React
 * envolvido em pan, zoom ou troca de camada.
 */
export function useMapa(containerRef) {
  const [mapa, setMapa] = useState(null)
  const instancia = useRef(null)

  useEffect(() => {
    if (!containerRef.current || instancia.current) return

    const m = L.map(containerRef.current, {
      center: CENTRO_PADRAO,
      zoom: ZOOM_PADRAO,
      zoomControl: true,
      // Sem isso o Leaflet escreve "Leaflet" no canto; a atribuicao das duas
      // fontes de tile vem das opcoes de cada camada e e obrigatoria.
      attributionControl: true,
    })

    const camadas = {}
    for (const [chave, cfg] of Object.entries(CAMADAS_BASE)) {
      const camada = L.tileLayer(cfg.url, cfg.opcoes)
      camadas[cfg.rotulo] = camada
      if (chave === CAMADA_PADRAO) camada.addTo(m)
    }

    L.control.layers(camadas, {}, { position: 'topright', collapsed: false }).addTo(m)
    // Escala metrica: referencia rapida para conferir se o poligono desenhado
    // tem o tamanho que o produtor espera. Sem imperial, que aqui so atrapalha.
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(m)

    instancia.current = m
    setMapa(m)

    return () => {
      // Obrigatorio: sem remove(), o StrictMode remonta o efeito e o Leaflet
      // recusa com "Map container is already initialized".
      m.remove()
      instancia.current = null
      setMapa(null)
    }
  }, [containerRef])

  return mapa
}
