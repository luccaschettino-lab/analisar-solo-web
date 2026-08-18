import { useCallback, useEffect, useState } from 'react'
import { useEnquadramentoDaFazenda } from './useEnquadramentoDaFazenda.js'
import { definirCentro } from '../dados/fazendas.js'

/**
 * Tudo que é do mapa em função da fazenda aberta: enquadramento inicial,
 * remedição ao recolher o painel, e o modo de marcar o centro.
 *
 * O enquadramento saiu para `useEnquadramentoDaFazenda`, que a tela de
 * comparação usa sozinho — ela é só leitura e não deveria carregar o modo de
 * marcar centro junto. Daqui a API não mudou.
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
  const [marcandoCentro, setMarcandoCentro] = useState(false)
  const [gravandoCentro, setGravandoCentro] = useState(false)

  const { geometriasDosTalhoes } = useEnquadramentoDaFazenda({
    mapa,
    fazendaSelecionada,
    talhoes,
    carregandoHierarquia,
    recolhido,
  })

  // Estado inicial: a fazenda não tem desenho nem centro, então não há para
  // onde levar o mapa. Vira convite para o usuário navegar e marcar o ponto.
  const semReferencia =
    Boolean(fazendaSelecionada) &&
    !carregandoHierarquia &&
    geometriasDosTalhoes.length === 0 &&
    fazendaSelecionada.centro_lat == null

  // Modo de marcação: o próximo clique no mapa vira o centro da fazenda.
  useEffect(() => {
    if (!mapa || !marcandoCentro || !fazendaSelecionada) return

    async function aoClicar(e) {
      setMarcandoCentro(false)
      setGravandoCentro(true)
      try {
        const atualizada = await definirCentro(
          fazendaSelecionada.id,
          // 6 casas ≈ 11 cm. Mais que suficiente para centralizar um mapa, e
          // evita gravar o ruído de ponto flutuante do clique.
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        )
        aplicarFazenda({ ...fazendaSelecionada, ...atualizada })
        mostrarAviso('Centro da fazenda gravado.')
      } catch (falha) {
        mostrarAviso(falha.message)
      } finally {
        setGravandoCentro(false)
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
  }, [mapa, marcandoCentro, fazendaSelecionada, aplicarFazenda, mostrarAviso])

  const iniciarMarcacao = useCallback(() => setMarcandoCentro(true), [])
  const cancelarMarcacao = useCallback(() => setMarcandoCentro(false), [])

  return { semReferencia, marcandoCentro, gravandoCentro, iniciarMarcacao, cancelarMarcacao }
}
