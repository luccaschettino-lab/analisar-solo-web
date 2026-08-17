import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { COR_GLEBA } from '../config/mapa.js'

/**
 * Desenha os pontos do lote como prévia, antes de gravar.
 *
 * Camada temporária própria: nada aqui existe no banco ainda, e misturar com
 * as glebas salvas faria o usuário achar que já gravou.
 */
export function usePreviaLote(mapa, itens) {
  const contagemAnterior = useRef(0)

  useEffect(() => {
    if (!mapa || itens.length === 0) {
      contagemAnterior.current = 0
      return
    }

    const grupo = L.layerGroup().addTo(mapa)

    for (const item of itens) {
      L.circleMarker([item.lat, item.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: COR_GLEBA,
        fillOpacity: 0.9,
        // Prévia não é clicável: o alvo do clique aqui continua sendo o mapa.
        interactive: false,
        dashArray: '3 3',
      })
        .bindTooltip(item.codigo, { permanent: true, direction: 'top', offset: [0, -6] })
        .addTo(grupo)
    }

    // Enquadra só quando a quantidade muda. Reenquadrar a cada tecla digitada
    // faria o mapa saltar enquanto o usuário ainda está colando o texto.
    if (contagemAnterior.current !== itens.length) {
      contagemAnterior.current = itens.length
      const bounds = L.latLngBounds(itens.map((i) => [i.lat, i.lng]))
      if (bounds.isValid()) {
        // Folga maior à esquerda: é onde o painel do lote cobre o mapa.
        mapa.fitBounds(bounds, {
          paddingTopLeft: [440, 60],
          paddingBottomRight: [60, 60],
          maxZoom: 17,
        })
      }
    }

    return () => grupo.remove()
  }, [mapa, itens])
}
