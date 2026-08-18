import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { COR_GLEBA, SNAP_DISTANCIA } from '../config/mapa.js'

/**
 * O Geoman desenha marcador com o L.Icon.Default, cuja imagem não resolve sob
 * bundler — apareceria um ícone quebrado seguindo o cursor. Um divIcon é HTML
 * puro, não depende de arquivo, e já sai na cor que a gleba terá no mapa.
 */
const ICONE_PONTO = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:${COR_GLEBA};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

/**
 * Desenho de novas geometrias com o Geoman.
 *
 * A barra de ferramentas do Geoman fica desligada de propósito. Um polígono
 * desenhado por ela seria ambíguo — talhão ou gleba? — e gleba ainda exige um
 * talhão pai selecionado. Por isso o desenho parte sempre dos botões do
 * painel, que carregam essa intenção. Os controles de edição e remoção de
 * geometria já salva entram depois, onde o alvo é inequívoco.
 */
export function useDesenho(mapa, aoConcluir) {
  const aoConcluirRef = useRef(aoConcluir)
  useEffect(() => {
    aoConcluirRef.current = aoConcluir
  }, [aoConcluir])

  useEffect(() => {
    if (!mapa) return

    mapa.pm.setLang('pt_br')

    function aoCriar(e) {
      mapa.doubleClickZoom.enable()
      const geoJson = e.layer.toGeoJSON()
      // Remove a camada temporária que o Geoman deixa no mapa. Quem desenha
      // a geometria definitiva é o useGeometrias, depois de salva — manter as
      // duas mostraria o mesmo polígono duplicado e desalinhado.
      e.layer.remove()
      mapa.pm.disableDraw()
      aoConcluirRef.current?.(geoJson)
    }

    mapa.on('pm:create', aoCriar)
    return () => {
      mapa.off('pm:create', aoCriar)
      // Sair da tela no meio de um desenho não pode deixar o mapa preso no
      // modo de desenho nem com o duplo clique desligado.
      if (mapa.pm.globalDrawModeEnabled?.()) mapa.pm.disableDraw()
      mapa.doubleClickZoom.enable()
    }
  }, [mapa])

  const desenharPoligono = useCallback(() => {
    if (!mapa) return
    // O duplo clique que fecha o polígono também dispararia o zoom nativo do
    // Leaflet, e o talhão terminaria com a tela saltando. Religado ao concluir
    // ou ao cancelar.
    mapa.doubleClickZoom.disable()
    mapa.pm.enableDraw('Polygon', {
      snappable: true,
      snapDistance: SNAP_DISTANCIA,
      // Sem isto o Geoman só fecha o polígono ao clicar de volta no primeiro
      // vértice, que num talhão grande já está fora da tela.
      finishOn: 'dblclick',
    })
  }, [mapa])

  const desenharPonto = useCallback(() => {
    if (!mapa) return
    mapa.pm.enableDraw('Marker', {
      snappable: false,
      markerStyle: { icon: ICONE_PONTO },
    })
  }, [mapa])

  const cancelar = useCallback(() => {
    if (!mapa) return
    mapa.pm.disableDraw()
    mapa.doubleClickZoom.enable()
  }, [mapa])

  return { desenharPoligono, desenharPonto, cancelar }
}
