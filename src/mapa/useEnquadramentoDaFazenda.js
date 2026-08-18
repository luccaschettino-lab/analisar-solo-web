import { useEffect, useMemo, useRef } from 'react'
import { enquadrarGeometrias } from './enquadrar.js'
import { ZOOM_PADRAO } from '../config/mapa.js'

/**
 * Leva o mapa até a fazenda aberta, e só isso.
 *
 * Saiu de `useMapaDaFazenda` quando a tela de comparação precisou do
 * enquadramento sem o resto: lá o mapa é só leitura, e reusar o hook inteiro
 * levava junto o modo de marcar centro — estado, listener de clique e a
 * escrita em `definirCentro` — numa tela que não escreve nada.
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
  recolhido = false,
}) {
  const geometriasDosTalhoes = useMemo(
    () => talhoes.map((t) => t.geometria).filter(Boolean),
    [talhoes],
  )

  /**
   * Enquadramento de abertura, uma vez por fazenda:
   *   1. limites de todos os talhões desenhados;
   *   2. centro gravado;
   *   3. nada — quem mostra o convite é `semReferencia`, em `useMapaDaFazenda`.
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

  // Devolvido porque `semReferencia` precisa saber se há desenho, e recalcular
  // a lista lá dentro criaria um segundo `useMemo` sobre os mesmos talhões.
  return { geometriasDosTalhoes }
}
