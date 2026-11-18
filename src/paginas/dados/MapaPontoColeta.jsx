import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import Mapa from '../../mapa/Mapa.jsx'
import { paraFeature } from '../../lib/geo.js'
import { ESTILO_CONTORNO_TALHAO } from '../../config/mapa.js'

const ICONE_PONTO = L.divIcon({
  className: '',
  html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#16a34a;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35),0 2px 6px rgba(0,0,0,.45)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

/**
 * Mapa pequeno pra marcar onde uma amostra foi coletada dentro do talhão.
 *
 * Clique no mapa larga o ponto (ou arrasta o já existente) — sem Geoman,
 * sem modo de desenho: é só um marcador, e o clique nativo do Leaflet já
 * basta. Centraliza no talhão assim que ele é escolhido; trocar de talhão
 * recentraliza, mas não apaga um ponto já marcado — só o próprio clique faz
 * isso, pra não perder o que a pessoa já marcou por engano.
 */
export default function MapaPontoColeta({ talhao, ponto, aoEscolherPonto, className = 'h-56' }) {
  const [mapa, setMapa] = useState(null)
  const marcadorRef = useRef(null)
  const contornoRef = useRef(null)
  const aoEscolherRef = useRef(aoEscolherPonto)
  useEffect(() => {
    aoEscolherRef.current = aoEscolherPonto
  }, [aoEscolherPonto])

  // Contorno do talhão, só pra referência visual — sem preenchimento, pra
  // não esconder o satélite embaixo do ponto que se está tentando marcar.
  useEffect(() => {
    if (!mapa) return
    contornoRef.current?.remove()
    contornoRef.current = null

    const f = talhao?.geometria ? paraFeature(talhao.geometria) : null
    if (!f?.geometry) return

    contornoRef.current = L.geoJSON(f, { style: { ...ESTILO_CONTORNO_TALHAO, fill: false } }).addTo(mapa)
    mapa.invalidateSize()
    mapa.fitBounds(contornoRef.current.getBounds(), { padding: [32, 32], animate: false })
  }, [mapa, talhao])

  useEffect(() => {
    if (!mapa) return
    function aoClicar(e) {
      aoEscolherRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
    mapa.on('click', aoClicar)
    return () => mapa.off('click', aoClicar)
  }, [mapa])

  useEffect(() => {
    if (!mapa) return
    marcadorRef.current?.remove()
    marcadorRef.current = null

    if (!ponto) return
    // Ícone próprio (bolinha), não o padrão do Leaflet: o padrão é uma imagem
    // que o build não publica, e no site aparecia quebrada, com o texto
    // "Marker" no lugar.
    marcadorRef.current = L.marker([ponto.lat, ponto.lng], { draggable: true, icon: ICONE_PONTO, title: 'Ponto da amostra (arraste para ajustar)' })
      .addTo(mapa)
      .on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng()
        aoEscolherRef.current?.({ lat, lng })
      })
  }, [mapa, ponto])

  // O container muda de tamanho depois de o mapa nascer (layout em duas
  // colunas): reenquadra o talhão, senão ele fica pequeno num canto.
  useEffect(() => {
    if (!mapa || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(() => {
      mapa.invalidateSize()
      if (contornoRef.current) mapa.fitBounds(contornoRef.current.getBounds(), { padding: [32, 32], animate: false })
    })
    observador.observe(mapa.getContainer())
    return () => observador.disconnect()
  }, [mapa])

  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-300 dark:border-white/15 ${className}`}>
      <Mapa aoCriarMapa={setMapa} />
      {talhao && (
        <p className="vidro pointer-events-none absolute left-3 top-3 z-[1000] rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 shadow dark:text-slate-200">
          {ponto ? 'Ponto marcado · arraste para ajustar' : 'Clique no talhão para marcar o ponto'}
        </p>
      )}
    </div>
  )
}
