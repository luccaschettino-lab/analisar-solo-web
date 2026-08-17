import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { enquadrarGeometrias } from './enquadrar.js'
import { definirCentro } from '../dados/fazendas.js'
import { ZOOM_PADRAO } from '../config/mapa.js'

/**
 * Tudo que é do mapa em função da fazenda aberta: enquadramento inicial,
 * remedição ao recolher o painel, e o modo de marcar o centro.
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

  const geometriasDosTalhoes = useMemo(
    () => talhoes.map((t) => t.geometria).filter(Boolean),
    [talhoes],
  )

  // Estado inicial: a fazenda não tem desenho nem centro, então não há para
  // onde levar o mapa. Vira convite para o usuário navegar e marcar o ponto.
  const semReferencia =
    Boolean(fazendaSelecionada) &&
    !carregandoHierarquia &&
    geometriasDosTalhoes.length === 0 &&
    fazendaSelecionada.centro_lat == null

  /**
   * Enquadramento de abertura, uma vez por fazenda:
   *   1. limites de todos os talhões desenhados;
   *   2. centro gravado;
   *   3. nada — quem mostra o convite é `semReferencia`.
   *
   * O ref impede reenquadrar a cada render: quem deu zoom para conferir um
   * vértice não quer o mapa pulando de volta sozinho.
   */
  const ultimoEnquadrado = useRef(null)
  useEffect(() => {
    if (!mapa || !fazendaSelecionada || carregandoHierarquia) return
    if (ultimoEnquadrado.current === fazendaSelecionada.id) return
    ultimoEnquadrado.current = fazendaSelecionada.id

    if (enquadrarGeometrias(mapa, geometriasDosTalhoes)) return

    const { centro_lat: lat, centro_lng: lng } = fazendaSelecionada
    if (lat != null && lng != null) mapa.setView([lat, lng], ZOOM_PADRAO)
  }, [mapa, fazendaSelecionada, carregandoHierarquia, geometriasDosTalhoes])

  // O painel muda a largura útil do mapa; sem invalidateSize o Leaflet continua
  // achando que o container tem o tamanho antigo e os tiles ficam desalinhados
  // até o próximo pan. O atraso acompanha a troca de layout.
  useEffect(() => {
    if (!mapa) return
    const t = setTimeout(() => mapa.invalidateSize(), 220)
    return () => clearTimeout(t)
  }, [mapa, recolhido])

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
