import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import Mapa from '../../mapa/Mapa.jsx'
import { paraFeature } from '../../lib/geo.js'
import { imagemDoIndice } from '../../lib/rasterIndice.js'

// Anéis do talhão em [lat, lng], para a máscara: contorno externo e buracos
// de cada parte. Com o preenchimento par-ímpar do SVG, o buraco do talhão
// volta a ser coberto, como tudo que está fora dele.
function aneisLatLng(geometry) {
  const poligonos =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  return poligonos.flatMap((aneis) => aneis.map((anel) => anel.map(([lng, lat]) => [lat, lng])))
}

// Talhão inteiro na tela, com folga em cima para a escolha do índice, que
// flutua no canto superior.
function enquadrar(mapa, contorno) {
  mapa.fitBounds(contorno.getBounds(), { paddingTopLeft: [24, 64], paddingBottomRight: [24, 24], animate: false })
}

// Limites da projeção do mapa (Web Mercator vai até ~85°).
const MUNDO = [
  [-85, -180],
  [-85, 180],
  [85, 180],
  [85, -180],
]

/**
 * Mapa só do talhão escolhido: o contorno e, por cima, o índice da cena em
 * pixels (16 m cada). Nenhum outro talhão ou gleba é desenhado aqui, e o que
 * está fora do talhão fica coberto por uma máscara da cor do fundo — sobra só
 * o talhão recortado.
 */
export default function MapaDoTalhao({ geometria, dados, indice, children }) {
  const [mapa, setMapa] = useState(null)
  const camadas = useRef({ contorno: null, raster: null, mascara: null })
  const aoCriarMapa = useCallback((m) => setMapa(m), [])

  // Mapa fixo: mostra o talhão inteiro e não se mexe — nem arrastar, nem zoom
  // (roda, toque, duplo clique, teclado). Zoom fracionário para o talhão
  // preencher o espaço em vez de pular para o nível inteiro de baixo.
  useEffect(() => {
    if (!mapa) return
    for (const controle of ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom', 'boxZoom', 'keyboard']) {
      mapa[controle]?.disable()
    }
    mapa.options.zoomSnap = 0
  }, [mapa])

  // Contorno, máscara e enquadramento: refeitos só quando troca o talhão.
  useEffect(() => {
    if (!mapa) return
    camadas.current.contorno?.remove()
    camadas.current.contorno = null
    camadas.current.mascara?.remove()
    camadas.current.mascara = null
    const feature = paraFeature(geometria)
    if (!feature?.geometry) return
    const aneis = aneisLatLng(feature.geometry)
    if (aneis.length > 0) {
      camadas.current.mascara = L.polygon([MUNDO, ...aneis], {
        stroke: false,
        fillRule: 'evenodd',
        className: 'mascara-talhao',
        interactive: false,
      }).addTo(mapa)
    }
    const contorno = L.geoJSON(feature, {
      // Cinza médio: o branco de antes sumia contra a máscara clara.
      style: { color: '#64748b', weight: 2, fill: false, interactive: false },
      interactive: false,
    }).addTo(mapa)
    camadas.current.contorno = contorno
    mapa.invalidateSize()
    enquadrar(mapa, contorno)
  }, [mapa, geometria])

  // O container muda de tamanho depois de o mapa nascer (layout da página,
  // painel lateral, janela redimensionada). Sem reenquadrar, o talhão ficava
  // pequeno e num canto, enquadrado para o tamanho de antes.
  useEffect(() => {
    if (!mapa || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(() => {
      mapa.invalidateSize()
      if (camadas.current.contorno) enquadrar(mapa, camadas.current.contorno)
    })
    observador.observe(mapa.getContainer())
    return () => observador.disconnect()
  }, [mapa])

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

  // `children`: o que flutua sobre o mapa (escolha do índice, legenda, aviso
  // de cálculo), posicionado por quem usa.
  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <Mapa aoCriarMapa={aoCriarMapa} className="mapa-fixo" />
      {children}
    </div>
  )
}
