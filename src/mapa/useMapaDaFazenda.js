import { useCallback, useEffect, useRef, useState } from 'react'
import { useEnquadramentoDaFazenda } from './useEnquadramentoDaFazenda.js'
import { criarMarcadorSede } from './sedeFazenda.js'
import { definirSede } from '../dados/fazendas.js'
import { ZOOM_SEDE } from '../config/mapa.js'

/**
 * Tudo que é do mapa em função da fazenda aberta: enquadramento inicial,
 * remedição ao recolher o painel, o pin da sede e o modo de marcá-la.
 *
 * O enquadramento saiu para `useEnquadramentoDaFazenda`, que a tela de
 * comparação usa sozinho — ela é só leitura e não deveria carregar o modo de
 * marcar sede junto.
 *
 * **Era "marcar centro".** O ponto gravado servia só para o mapa saber onde
 * abrir, e não aparecia na tela. Agora ele é a sede da fazenda: um lugar que
 * o produtor reconhece, marcado com pin e nome. O enquadramento de abertura
 * continua caindo nele quando não há talhão desenhado — a sede é um bom lugar
 * para o mapa abrir, mas isso virou consequência, não a definição.
 */
export function useMapaDaFazenda({
  mapa,
  fazendaSelecionada,
  talhoes,
  carregandoHierarquia,
  recolhido,
  aplicarFazenda,
  mostrarAviso,
}) {
  const [marcandoSede, setMarcandoSede] = useState(false)
  const [gravandoSede, setGravandoSede] = useState(false)

  const { geometriasDosTalhoes } = useEnquadramentoDaFazenda({
    mapa,
    fazendaSelecionada,
    talhoes,
    carregandoHierarquia,
    recolhido,
  })

  const lat = fazendaSelecionada?.sede_lat
  const lng = fazendaSelecionada?.sede_lng
  const temSede = lat != null && lng != null

  // Estado inicial: a fazenda não tem desenho nem sede, então não há para
  // onde levar o mapa. Vira convite para o usuário navegar e marcar o ponto.
  const semReferencia =
    Boolean(fazendaSelecionada) &&
    !carregandoHierarquia &&
    geometriasDosTalhoes.length === 0 &&
    !temSede

  /**
   * O pin da sede.
   *
   * Recriado quando a coordenada ou o nome mudam, e não a cada render: o
   * marcador é um objeto imperativo do Leaflet, e recriá-lo à toa faria o
   * ícone piscar a cada movimento do mapa.
   */
  const marcador = useRef(null)
  useEffect(() => {
    if (!mapa) return

    marcador.current?.remove()
    marcador.current = null

    if (!temSede) return

    marcador.current = criarMarcadorSede(lat, lng, fazendaSelecionada?.nome)
    marcador.current.addTo(mapa)

    return () => {
      marcador.current?.remove()
      marcador.current = null
    }
  }, [mapa, temSede, lat, lng, fazendaSelecionada?.nome])

  /**
   * Leva o mapa até a sede.
   *
   * `Math.max` com o zoom atual: quem já estava mais perto não deveria ser
   * afastado por pedir para ir a um lugar. Devolve `false` quando não há sede,
   * para quem chama poder avisar em vez de fingir que fez.
   */
  const irParaSede = useCallback(() => {
    if (!mapa || !temSede) return false
    mapa.setView([lat, lng], Math.max(mapa.getZoom(), ZOOM_SEDE))
    return true
  }, [mapa, temSede, lat, lng])

  // Modo de marcação: o próximo clique no mapa vira a sede da fazenda.
  useEffect(() => {
    if (!mapa || !marcandoSede || !fazendaSelecionada) return

    async function aoClicar(e) {
      setMarcandoSede(false)
      setGravandoSede(true)
      try {
        const atualizada = await definirSede(
          fazendaSelecionada.id,
          // 6 casas ≈ 11 cm. Mais que suficiente para marcar uma sede, e
          // evita gravar o ruído de ponto flutuante do clique.
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        )
        aplicarFazenda({ ...fazendaSelecionada, ...atualizada })
        mostrarAviso('Sede da fazenda gravada.')
      } catch (falha) {
        mostrarAviso(falha.message)
      } finally {
        setGravandoSede(false)
      }
    }

    mapa.on('click', aoClicar)
    const container = mapa.getContainer()
    const cursorAnterior = container.style.cursor
    container.style.cursor = 'crosshair'

    return () => {
      mapa.off('click', aoClicar)
      container.style.cursor = cursorAnterior
    }
  }, [mapa, marcandoSede, fazendaSelecionada, aplicarFazenda, mostrarAviso])

  const iniciarMarcacao = useCallback(() => setMarcandoSede(true), [])
  const cancelarMarcacao = useCallback(() => setMarcandoSede(false), [])

  return {
    semReferencia,
    temSede,
    marcandoSede,
    gravandoSede,
    iniciarMarcacao,
    cancelarMarcacao,
    irParaSede,
  }
}
