import { useCallback, useEffect, useState } from 'react'
import { anosRepetidos, filtroComparacaoCompleto } from '../../lib/variacao.js'

const VAZIO = { anoA: '', anoB: '', profundidade: '', chaveParametro: '' }

/**
 * Estado dos quatro seletores da tela de comparação.
 *
 * Começa vazio, como os filtros do mapa da Fase 4 e pelo mesmo motivo: abrir
 * já comparando dois anos escolhidos por nós afirmaria algo sobre a terra sem
 * ninguém ter pedido — e aqui a afirmação é ainda mais forte, porque a tela
 * diz o que melhorou e o que piorou.
 *
 * A fazenda não mora aqui: vem do `FazendaContext`, que já lembra a última
 * selecionada entre visitas.
 */
export function useFiltroComparacao(anosDisponiveis) {
  const [filtro, setFiltro] = useState(VAZIO)

  /**
   * Trocar de fazenda pode invalidar um dos anos, ou os dois — a fazenda nova
   * pode não ter laudo daquela safra. Só os anos inválidos são limpos;
   * profundidade e parâmetro seguem, porque são preferência de leitura e não
   * dependem da fazenda. Mesma regra do filtro do mapa.
   */
  useEffect(() => {
    setFiltro((atual) => {
      const anoA = atual.anoA && !anosDisponiveis.includes(atual.anoA) ? '' : atual.anoA
      const anoB = atual.anoB && !anosDisponiveis.includes(atual.anoB) ? '' : atual.anoB
      if (anoA === atual.anoA && anoB === atual.anoB) return atual
      return { ...atual, anoA, anoB }
    })
  }, [anosDisponiveis])

  const mudar = useCallback((campo, valor) => {
    setFiltro((atual) => ({ ...atual, [campo]: valor }))
  }, [])

  /**
   * Troca os dois anos de lugar.
   *
   * Comparar 24-25 → 25-26 e 25-26 → 24-25 são leituras diferentes da mesma
   * dupla, e sem isso o usuário teria que reescolher os dois seletores para
   * inverter o sentido. Não é atalho: é a mesma pergunta pelo outro lado.
   */
  const inverter = useCallback(() => {
    setFiltro((atual) => ({ ...atual, anoA: atual.anoB, anoB: atual.anoA }))
  }, [])

  const limpar = useCallback(() => setFiltro(VAZIO), [])

  /**
   * Erro de validação, ou string vazia.
   *
   * Só existe um: os dois anos iguais. É checado aqui e não dentro do cálculo
   * porque a tela precisa dizer o que houve — `compararAnos` devolveria `null`,
   * que é indistinguível de "ainda não escolheu tudo".
   */
  const erro = anosRepetidos(filtro)
    ? 'Escolha dois anos-safra diferentes. Comparar um ano com ele mesmo não diz nada.'
    : ''

  return {
    filtro,
    mudar,
    inverter,
    limpar,
    erro,
    completo: filtroComparacaoCompleto(filtro),
  }
}
