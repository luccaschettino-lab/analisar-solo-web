import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import { ZOOM_PONTO } from '../config/mapa.js'

/**
 * Leva o mapa até um resultado de busca e marca o ponto.
 *
 * O alfinete importa: sem ele, buscar uma coordenada move o mapa e o usuário
 * fica sem saber qual pixel exatamente era o alvo — justamente na hora em que
 * ele quer marcar o centro da fazenda ali.
 *
 * É uma camada própria, fora das geometrias salvas: nada aqui está no banco, e
 * misturar faria parecer cadastro.
 */
export function useAlfineteBusca(mapa) {
  const camada = useRef(null)

  useEffect(() => {
    if (!mapa) return
    return () => {
      camada.current?.remove()
      camada.current = null
    }
  }, [mapa])

  const irPara = useCallback(
    (destino) => {
      if (!mapa || !destino) return

      camada.current?.remove()

      const grupo = L.layerGroup().addTo(mapa)
      L.circleMarker([destino.lat, destino.lng], {
        radius: 9,
        color: '#0f172a',
        weight: 2,
        fillColor: '#f8fafc',
        fillOpacity: 0.9,
        interactive: false,
        // Tracejado para não ser confundido com gleba: aqui não há cadastro,
        // só um lugar que você procurou.
        dashArray: '4 3',
      }).addTo(grupo)
      camada.current = grupo

      // Município tem limites; coordenada é um ponto só. Enquadrar os limites
      // evita cair com zoom máximo no meio de uma cidade inteira.
      if (destino.limites) {
        mapa.fitBounds(destino.limites, { padding: [40, 40], maxZoom: ZOOM_PONTO })
      } else {
        mapa.setView([destino.lat, destino.lng], Math.max(mapa.getZoom(), ZOOM_PONTO))
      }
    },
    [mapa],
  )

  const limpar = useCallback(() => {
    camada.current?.remove()
    camada.current = null
  }, [])

  return { irPara, limpar }
}
