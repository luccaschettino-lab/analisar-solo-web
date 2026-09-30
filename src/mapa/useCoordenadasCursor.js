import { useEffect, useState } from 'react'

/**
 * Posição do cursor sobre o mapa, em latitude/longitude e em pixel do
 * container — a segunda serve para posicionar um rótulo flutuante perto do
 * cursor, sem depender de CSS que siga o mouse por fora do React.
 *
 * Só escuta o mapa enquanto `ativo`: fora da criação de gleba, o listener de
 * `mousemove` não serve para nada e só custaria um re-render por pixel.
 */
export function useCoordenadasCursor(mapa, ativo) {
  const [posicao, setPosicao] = useState(null)

  useEffect(() => {
    if (!mapa || !ativo) {
      setPosicao(null)
      return
    }

    function aoMover(e) {
      setPosicao({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        x: e.containerPoint.x,
        y: e.containerPoint.y,
      })
    }

    mapa.on('mousemove', aoMover)
    return () => {
      mapa.off('mousemove', aoMover)
      setPosicao(null)
    }
  }, [mapa, ativo])

  return posicao
}
