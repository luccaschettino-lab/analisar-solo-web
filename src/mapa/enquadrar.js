import L from 'leaflet'
import { paraFeature, ehPonto, latLngDoPonto } from '../lib/geo.js'
import { PADDING_FIT, ZOOM_PONTO } from '../config/mapa.js'

/**
 * Bounds que cobre todas as geometrias passadas.
 *
 * Devolve null quando nada tem geometria — caso comum numa fazenda recém
 * criada, e quem chama precisa distinguir isso de "bounds vazio".
 */
export function boundsDeGeometrias(geometrias) {
  const bounds = L.latLngBounds([])

  for (const geo of geometrias) {
    const f = paraFeature(geo)
    if (!f?.geometry) continue
    try {
      bounds.extend(L.geoJSON(f).getBounds())
    } catch {
      // Geometria malformada não derruba o enquadramento das outras.
    }
  }

  return bounds.isValid() ? bounds : null
}

// Enquadra a fazenda inteira. O padding evita que o desenho encoste na borda
// e some atrás do painel lateral.
export function enquadrarGeometrias(mapa, geometrias) {
  const bounds = boundsDeGeometrias(geometrias)
  if (!bounds) return false
  mapa.fitBounds(bounds, { padding: PADDING_FIT })
  return true
}

/**
 * Centraliza numa geometria só, ao clicar num item da árvore.
 *
 * Ponto não tem extensão: fitBounds sobre ele levaria ao zoom máximo, que
 * no satélite vira borrão. Por isso ponto usa setView com zoom fixo.
 */
export function focarGeometria(mapa, geometria) {
  const f = paraFeature(geometria)
  if (!f?.geometry) return false

  if (ehPonto(f)) {
    const latlng = latLngDoPonto(f)
    if (!latlng) return false
    mapa.setView(latlng, Math.max(mapa.getZoom(), ZOOM_PONTO))
    return true
  }

  return enquadrarGeometrias(mapa, [f])
}
