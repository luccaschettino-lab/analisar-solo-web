import { useCallback, useEffect, useRef, useState } from 'react'
import { useDesenho } from '../../mapa/useDesenho.js'

/**
 * Máquina de criação de geometria: escolher o tipo, desenhar, e segurar o
 * resultado até o formulário ser preenchido.
 *
 * Nada é gravado aqui — o hook entrega a geometria pendente e quem salva é o
 * formulário. Assim um desenho abandonado no meio não deixa lixo no banco.
 */
export function useCriacaoDeGeometria({ mapa, editor, talhoes, aoLimparSelecao }) {
  // null | { tipo:'talhao' } | { tipo:'gleba', talhaoId, forma }
  const [desenhando, setDesenhando] = useState(null)
  // Geometria desenhada esperando o formulário: { tipo, talhaoId?, geometria }
  const [pendente, setPendente] = useState(null)
  const [escolhendoGleba, setEscolhendoGleba] = useState(null) // talhaoId
  const [loteAberto, setLoteAberto] = useState(null) // talhaoId

  // O callback do Geoman é registrado uma vez; o contexto do desenho em curso
  // vem de um ref para não recriar o listener a cada mudança de estado.
  const desenhandoRef = useRef(null)
  useEffect(() => {
    desenhandoRef.current = desenhando
  }, [desenhando])

  const aoConcluirDesenho = useCallback((geoJson) => {
    const contexto = desenhandoRef.current
    setDesenhando(null)
    if (!contexto) return
    setPendente({ ...contexto, geometria: geoJson })
  }, [])

  const {
    desenharPoligono,
    desenharPonto,
    cancelar: cancelarDesenho,
  } = useDesenho(mapa, aoConcluirDesenho)

  const iniciarTalhao = useCallback(() => {
    if (!editor) return
    aoLimparSelecao?.()
    setDesenhando({ tipo: 'talhao' })
    desenharPoligono()
  }, [editor, aoLimparSelecao, desenharPoligono])

  const iniciarGleba = useCallback(
    (talhaoId) => {
      if (!editor) return
      setEscolhendoGleba(talhaoId)
    },
    [editor],
  )

  // A forma escolhida decide a ferramenta: ponto usa marcador, sub-área usa
  // polígono, lote nem chega a desenhar. Por isso a pergunta vem antes.
  const escolherForma = useCallback(
    (forma) => {
      const talhaoId = escolhendoGleba
      setEscolhendoGleba(null)

      if (forma === 'lote') {
        setLoteAberto(talhaoId)
        return
      }

      setDesenhando({ tipo: 'gleba', talhaoId, forma })
      if (forma === 'ponto') desenharPonto()
      else desenharPoligono()
    },
    [escolhendoGleba, desenharPonto, desenharPoligono],
  )

  const abortar = useCallback(() => {
    cancelarDesenho()
    setDesenhando(null)
  }, [cancelarDesenho])

  // Resolvidos aqui para os diálogos nunca receberem um talhão inexistente —
  // possível se ele for apagado em outra aba no meio do fluxo.
  const acharTalhao = (id) => (id ? (talhoes.find((t) => t.id === id) ?? null) : null)

  return {
    desenhando,
    pendente,
    talhaoDaEscolha: acharTalhao(escolhendoGleba),
    talhaoPendente: pendente?.tipo === 'gleba' ? acharTalhao(pendente.talhaoId) : null,
    talhaoDoLote: acharTalhao(loteAberto),
    iniciarTalhao,
    iniciarGleba,
    escolherForma,
    abortar,
    fecharEscolha: useCallback(() => setEscolhendoGleba(null), []),
    fecharPendente: useCallback(() => setPendente(null), []),
    fecharLote: useCallback(() => setLoteAberto(null), []),
  }
}
