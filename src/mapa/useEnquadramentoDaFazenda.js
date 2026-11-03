import { useEffect, useMemo, useRef } from 'react'
import { enquadrarGeometrias } from './enquadrar.js'
import { ZOOM_PADRAO } from '../config/mapa.js'
import { guardarVista, lerVista } from './vistaDoMapa.js'

/**
 * Leva o mapa até a fazenda aberta, e só isso.
 *
 * Saiu de `useMapaDaFazenda` quando a tela de comparação precisou do
 * enquadramento sem o resto: lá o mapa é só leitura, e reusar o hook inteiro
 * levava junto o modo de marcar centro — estado, listener de clique e a
 * escrita em `definirSede` — numa tela que não escreve nada.
 *
 * Extrair foi melhor que criar um segundo hook parecido: a regra de para onde
 * o mapa vai ao abrir uma fazenda é uma só, e duas cópias divergiriam na
 * primeira correção.
 */
export function useEnquadramentoDaFazenda({
  mapa,
  fazendaSelecionada,
  talhoes,
  carregandoHierarquia,
  larguraPainel = false,
}) {
  const geometriasDosTalhoes = useMemo(
    () => talhoes.map((t) => t.geometria).filter(Boolean),
    [talhoes],
  )

  /**
   * Enquadramento de abertura, uma vez por fazenda:
   *   0. onde o mapa estava na última tela de mapa (ver `vistaDoMapa`) — assim
   *      trocar de tela não muda o lugar;
   *   1. limites de todos os talhões desenhados;
   *   2. sede marcada;
   *   3. nada — quem mostra o convite é `semReferencia`, em `useMapaDaFazenda`.
   *
   * O ref impede reenquadrar a cada render: quem deu zoom para conferir um
   * vértice não quer o mapa pulando de volta sozinho.
   */
  const ultimoEnquadrado = useRef(null)
  useEffect(() => {
    if (!mapa || !fazendaSelecionada) return
    if (ultimoEnquadrado.current === fazendaSelecionada.id) return

    // Restaurar não depende dos talhões terem carregado: esperar deixaria o
    // mapa um instante no centro padrão antes de ir para o lugar certo.
    const vista = lerVista(fazendaSelecionada.id)
    if (vista) {
      ultimoEnquadrado.current = fazendaSelecionada.id
      mapa.setView(vista.centro, vista.zoom, { animate: false })
      return
    }

    if (carregandoHierarquia) return
    ultimoEnquadrado.current = fazendaSelecionada.id

    if (enquadrarGeometrias(mapa, geometriasDosTalhoes)) return

    const { sede_lat: lat, sede_lng: lng } = fazendaSelecionada
    if (lat != null && lng != null) mapa.setView([lat, lng], ZOOM_PADRAO)
  }, [mapa, fazendaSelecionada, carregandoHierarquia, geometriasDosTalhoes])

  // Guarda para onde o mapa foi, a cada movimento — mas só depois do
  // enquadramento de abertura: antes dele o mapa ainda está no centro padrão,
  // e guardar isso apagaria a vista boa da tela anterior.
  const fazendaId = fazendaSelecionada?.id ?? null
  useEffect(() => {
    if (!mapa || !fazendaId) return
    const guardar = () => {
      if (ultimoEnquadrado.current === fazendaId) guardarVista(fazendaId, mapa)
    }
    mapa.on('moveend', guardar)
    return () => {
      mapa.off('moveend', guardar)
    }
  }, [mapa, fazendaId])

  // O painel muda a largura útil do mapa — o da barra lateral colapsando, e
  // agora o painel de gleba abrindo, fechando ou expandindo. Sem
  // invalidateSize o Leaflet continua achando que o container tem o tamanho
  // antigo e os tiles ficam desalinhados até o próximo pan. O atraso
  // acompanha a transição CSS da largura.
  useEffect(() => {
    if (!mapa) return
    const t = setTimeout(() => mapa.invalidateSize(), 220)
    return () => clearTimeout(t)
  }, [mapa, larguraPainel])

  // Devolvido porque `semReferencia` precisa saber se há desenho, e recalcular
  // a lista lá dentro criaria um segundo `useMemo` sobre os mesmos talhões.
  return { geometriasDosTalhoes }
}
