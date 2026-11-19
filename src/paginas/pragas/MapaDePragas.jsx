import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import Mapa from '../../mapa/Mapa.jsx'
import { paraFeature, bboxDaGeometria } from '../../lib/geo.js'
import { interpolarIdw, corDoCalor, STATUS, statusDoValor } from '../../lib/pragas.js'

const MUNDO = [
  [-85, -180],
  [-85, 180],
  [85, 180],
  [85, -180],
]

function aneisLatLng(geometry) {
  const poligonos =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  return poligonos.flatMap((aneis) => aneis.map((anel) => anel.map(([lng, lat]) => [lat, lng])))
}

/**
 * Mapa de calor da praga dentro do talhão, como imagem: uma grade de ~160
 * células no lado maior, cada uma com o valor interpolado (IDW) dos pontos.
 * Fora do talhão fica transparente.
 */
function imagemDoCalor(feature, valores, opcoes) {
  const [oeste, sul, leste, norte] = bboxDaGeometria(feature)
  const kx = Math.cos((((sul + norte) / 2) * Math.PI) / 180)
  const larguraM = (leste - oeste) * kx
  const alturaM = norte - sul
  const lado = 160
  const w = Math.max(8, Math.round(larguraM >= alturaM ? lado : (lado * larguraM) / alturaM))
  const h = Math.max(8, Math.round(alturaM >= larguraM ? lado : (lado * alturaM) / larguraM))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(w, h)
  for (let j = 0; j < h; j++) {
    const lat = norte - ((j + 0.5) / h) * (norte - sul)
    for (let i = 0; i < w; i++) {
      const lng = oeste + ((i + 0.5) / w) * (leste - oeste)
      if (!booleanPointInPolygon([lng, lat], feature)) continue
      const v = interpolarIdw(valores, lat, lng)
      if (v == null) continue
      const [r, g, b] = corDoCalor(v, opcoes)
      const k = (j * w + i) * 4
      img.data[k] = r
      img.data[k + 1] = g
      img.data[k + 2] = b
      img.data[k + 3] = 165
    }
  }
  ctx.putImageData(img, 0, 0)
  return { url: canvas.toDataURL(), limites: [[sul, oeste], [norte, leste]] }
}

function iconeDoPonto(numero, cor, destaque) {
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${cor};color:#fff;font:600 11px/1 Manrope,system-ui,sans-serif;border:2px solid ${destaque ? '#facc15' : '#fff'};box-shadow:0 1px 3px rgba(0,0,0,.4)">${numero}</span>`,
  })
}

/**
 * Mapa do talhão com os pontos da vistoria e, se uma praga estiver
 * escolhida, o mapa de calor dela. `marcando`: o clique no mapa marca o
 * lugar do próximo ponto (`aoMarcar`).
 *
 * `pontos`: [{ ponto, lat, lng, valor? }]. `calor`: { praga, metodo, nivel,
 * maximo, fase, pragaInfo } ou null.
 */
export default function MapaDePragas({ geometria, pontos, calor, marcando, novoPonto, minhaPosicao, pontoEmFoco, aoMarcar, aoEscolherPonto }) {
  const [mapa, setMapa] = useState(null)
  const camadas = useRef({ contorno: null, mascara: null, calor: null, pontos: null, novo: null, eu: null })
  const aoCriarMapa = useCallback((m) => setMapa(m), [])
  const callbacks = useRef({ aoMarcar, aoEscolherPonto, marcando })
  callbacks.current = { aoMarcar, aoEscolherPonto, marcando }

  // Contorno, máscara e enquadramento: só quando troca o talhão.
  useEffect(() => {
    if (!mapa) return
    camadas.current.contorno?.remove()
    camadas.current.mascara?.remove()
    camadas.current.contorno = camadas.current.mascara = null
    const feature = paraFeature(geometria)
    if (!feature?.geometry) return
    const aneis = aneisLatLng(feature.geometry)
    if (aneis.length) {
      camadas.current.mascara = L.polygon([MUNDO, ...aneis], {
        stroke: false,
        fillRule: 'evenodd',
        className: 'mascara-talhao',
        interactive: false,
      }).addTo(mapa)
    }
    camadas.current.contorno = L.geoJSON(feature, { style: { color: '#64748b', weight: 2, fill: false }, interactive: false }).addTo(mapa)
    mapa.invalidateSize()
    mapa.fitBounds(camadas.current.contorno.getBounds(), { padding: [24, 24], animate: false })
  }, [mapa, geometria])

  useEffect(() => {
    if (!mapa || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(() => mapa.invalidateSize())
    observador.observe(mapa.getContainer())
    return () => observador.disconnect()
  }, [mapa])

  // Clique: marca o novo ponto quando está marcando.
  useEffect(() => {
    if (!mapa) return
    const aoClicar = (e) => {
      if (callbacks.current.marcando) callbacks.current.aoMarcar?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
    mapa.on('click', aoClicar)
    return () => mapa.off('click', aoClicar)
  }, [mapa])

  useEffect(() => {
    if (!mapa) return
    mapa.getContainer().style.cursor = marcando ? 'crosshair' : ''
  }, [mapa, marcando])

  // Mapa de calor.
  useEffect(() => {
    if (!mapa) return
    camadas.current.calor?.remove()
    camadas.current.calor = null
    const feature = paraFeature(geometria)
    if (!calor || !feature?.geometry || pontos.length === 0) return
    const { url, limites } = imagemDoCalor(feature, pontos, calor)
    camadas.current.calor = L.imageOverlay(url, limites, { opacity: 1, interactive: false }).addTo(mapa)
    camadas.current.contorno?.bringToFront()
  }, [mapa, geometria, pontos, calor])

  // Pontos numerados (cor do semáforo quando há praga escolhida).
  useEffect(() => {
    if (!mapa) return
    camadas.current.pontos?.remove()
    const grupo = L.layerGroup()
    for (const p of pontos) {
      let cor = '#334155'
      if (calor) {
        const s = statusDoValor(p.valor, calor.metodo, calor.pragaInfo, calor.fase)
        cor = s === 'sem-nivel' ? (p.valor > 0 ? '#4338ca' : '#64748b') : STATUS[s].cor
      }
      const m = L.marker([p.lat, p.lng], { icon: iconeDoPonto(p.ponto, cor, p.ponto === pontoEmFoco), keyboard: false })
      m.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        callbacks.current.aoEscolherPonto?.(p.ponto)
      })
      grupo.addLayer(m)
    }
    grupo.addTo(mapa)
    camadas.current.pontos = grupo
  }, [mapa, pontos, calor, pontoEmFoco])

  // Lugar do ponto que está sendo lançado.
  useEffect(() => {
    if (!mapa) return
    camadas.current.novo?.remove()
    camadas.current.novo = null
    if (!novoPonto) return
    camadas.current.novo = L.circleMarker([novoPonto.lat, novoPonto.lng], {
      radius: 11,
      color: '#facc15',
      weight: 3,
      fillColor: '#0f172a',
      fillOpacity: 0.35,
      interactive: false,
    }).addTo(mapa)
  }, [mapa, novoPonto])

  // Onde a pessoa está (GPS), com o círculo da precisão.
  useEffect(() => {
    if (!mapa) return
    camadas.current.eu?.remove()
    camadas.current.eu = null
    if (!minhaPosicao) return
    const g = L.layerGroup([
      L.circle([minhaPosicao.lat, minhaPosicao.lng], {
        radius: Math.min(minhaPosicao.precisao ?? 0, 200),
        color: '#2563eb',
        weight: 1,
        fillOpacity: 0.12,
        interactive: false,
      }),
      L.circleMarker([minhaPosicao.lat, minhaPosicao.lng], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#2563eb',
        fillOpacity: 1,
        interactive: false,
      }),
    ]).addTo(mapa)
    camadas.current.eu = g
  }, [mapa, minhaPosicao])

  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <Mapa aoCriarMapa={aoCriarMapa} />
    </div>
  )
}
