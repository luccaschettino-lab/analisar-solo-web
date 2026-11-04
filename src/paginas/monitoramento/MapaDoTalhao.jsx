import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import Mapa from '../../mapa/Mapa.jsx'
import { paraFeature } from '../../lib/geo.js'
import { imagemDoIndice } from '../../lib/rasterIndice.js'

/**
 * Mapa só do talhão escolhido: o contorno e, por cima, o índice da cena em
 * pixels (16 m cada). Nenhum outro talhão ou gleba é desenhado aqui.
 */
export default function MapaDoTalhao({ geometria, dados, indice }) {
  const [mapa, setMapa] = useState(null)
  const camadas = useRef({ contorno: null, raster: null })
  const aoCriarMapa = useCallback((m) => setMapa(m), [])

  // Contorno e enquadramento: refeitos só quando troca o talhão.
  useEffect(() => {
    if (!mapa) return
    camadas.current.contorno?.remove()
    camadas.current.contorno = null
    const feature = paraFeature(geometria)
    if (!feature?.geometry) return
    const contorno = L.geoJSON(feature, {
      style: { color: '#ffffff', weight: 2.5, fill: false, interactive: false },
      interactive: false,
    }).addTo(mapa)
    camadas.current.contorno = contorno
    mapa.invalidateSize()
    mapa.fitBounds(contorno.getBounds(), { padding: [32, 32], animate: false })
  }, [mapa, geometria])

  // Camada do índice: refeita ao trocar de cena ou de índice.
  useEffect(() => {
    if (!mapa) return
    camadas.current.raster?.remove()
    camadas.current.raster = null
    if (!dados) return
    const [oeste, sul, leste, norte] = dados.janela.bbox
    const raster = L.imageOverlay(imagemDoIndice(dados, indice), [[sul, oeste], [norte, leste]], {
      opacity: 0.9,
      interactive: false,
      className: 'raster-pixelado',
    }).addTo(mapa)
    camadas.current.raster = raster
    camadas.current.contorno?.bringToFront()
  }, [mapa, dados, indice])

  return (
    <div className="h-96 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
      <Mapa aoCriarMapa={aoCriarMapa} />
    </div>
  )
}
