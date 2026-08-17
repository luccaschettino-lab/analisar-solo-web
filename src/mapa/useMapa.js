import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  CAMADAS_BASE,
  CAMADA_PADRAO,
  CENTRO_PADRAO,
  ZOOM_PADRAO,
} from '../config/mapa.js'

/**
 * Cria a instancia Leaflet dentro do container e devolve quando estiver pronta.
 *
 * O Leaflet e imperativo: manipula o DOM por fora do React. Por isso o mapa
 * vive num ref e o componente so expoe a instancia — nao ha re-render do React
 * envolvido em pan, zoom ou troca de camada.
 */
export function useMapa(containerRef) {
  const [mapa, setMapa] = useState(null)
  const instancia = useRef(null)

  useEffect(() => {
    if (!containerRef.current || instancia.current) return

    const m = L.map(containerRef.current, {
      center: CENTRO_PADRAO,
      zoom: ZOOM_PADRAO,
      // Desligado aqui para ser recriado à direita. O padrão do Leaflet é o
      // canto superior esquerdo, que é justamente onde o painel lateral fica —
      // os botões + e − nasciam embaixo dele.
      zoomControl: false,
      // Sem isso o Leaflet escreve "Leaflet" no canto; a atribuicao das duas
      // fontes de tile vem das opcoes de cada camada e e obrigatoria.
      attributionControl: true,
    })

    const camadas = {}
    for (const [chave, cfg] of Object.entries(CAMADAS_BASE)) {
      const camada = L.tileLayer(cfg.url, cfg.opcoes)
      camadas[cfg.rotulo] = camada
      if (chave === CAMADA_PADRAO) camada.addTo(m)
    }

    // Zoom à direita, longe do painel. Adicionado antes do seletor de camadas
    // para ficar acima dele na pilha.
    L.control.zoom({ position: 'topright' }).addTo(m)

    // Expandido em tela larga, onde não atrapalha; recolhido no celular, onde
    // as duas opções abertas comem o canto do mapa. O Leaflet já recolhe ao
    // detectar toque, mas o corte por largura também pega notebook em janela
    // estreita.
    const telaEstreita = window.matchMedia('(max-width: 767px)').matches
    L.control
      .layers(camadas, {}, { position: 'topright', collapsed: telaEstreita })
      .addTo(m)
    // Escala metrica: referencia rapida para conferir se o poligono desenhado
    // tem o tamanho que o produtor espera. Sem imperial, que aqui so atrapalha.
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(m)

    instancia.current = m
    setMapa(m)

    return () => {
      // Obrigatorio: sem remove(), o StrictMode remonta o efeito e o Leaflet
      // recusa com "Map container is already initialized".
      m.remove()
      instancia.current = null
      setMapa(null)
    }
  }, [containerRef])

  return mapa
}
