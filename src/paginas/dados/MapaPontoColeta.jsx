import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import Mapa from '../../mapa/Mapa.jsx'
import { paraFeature } from '../../lib/geo.js'
import { focarGeometria } from '../../mapa/enquadrar.js'
import { ESTILO_CONTORNO_TALHAO } from '../../config/mapa.js'

/**
 * Mapa pequeno pra marcar onde uma amostra foi coletada dentro do talhão.
 *
 * Clique no mapa larga o ponto (ou arrasta o já existente) — sem Geoman,
 * sem modo de desenho: é só um marcador, e o clique nativo do Leaflet já
 * basta. Centraliza no talhão assim que ele é escolhido; trocar de talhão
 * recentraliza, mas não apaga um ponto já marcado — só o próprio clique faz
 * isso, pra não perder o que a pessoa já marcou por engano.
 */
export default function MapaPontoColeta({ talhao, ponto, aoEscolherPonto }) {
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
    focarGeometria(mapa, talhao.geometria)
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
    marcadorRef.current = L.marker([ponto.lat, ponto.lng], { draggable: true })
      .addTo(mapa)
      .on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng()
        aoEscolherRef.current?.({ lat, lng })
      })
  }, [mapa, ponto])

  return (
    <div className="h-56 overflow-hidden rounded-md border border-slate-300 dark:border-white/15">
      <Mapa aoCriarMapa={setMapa} />
    </div>
  )
}
