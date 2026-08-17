import { useCallback, useEffect, useState } from 'react'

const VAZIO = { anoSafra: '', profundidade: '', chaveParametro: '' }

/**
 * Estado dos filtros de coloração do mapa.
 *
 * Começa vazio: o mapa abre em cinza neutro. Escolher uma safra e um parâmetro
 * sozinho já pintaria o mapa com uma afirmação sobre o solo, e essa afirmação
 * deve ser sempre uma escolha explícita de quem olha.
 */
export function useFiltroMapa(anosDisponiveis) {
  const [filtro, setFiltro] = useState(VAZIO)

  /**
   * Trocar de fazenda pode invalidar a safra escolhida — a fazenda nova pode
   * não ter laudo daquele ano. Nesse caso só a safra é limpa; profundidade e
   * parâmetro seguem, porque são preferência de leitura e não dependem da
   * fazenda. Quem estava olhando pH em 0-20 continua olhando pH em 0-20.
   */
  useEffect(() => {
    if (!filtro.anoSafra) return
    if (anosDisponiveis.includes(filtro.anoSafra)) return
    setFiltro((atual) => ({ ...atual, anoSafra: '' }))
  }, [anosDisponiveis, filtro.anoSafra])

  const limpar = useCallback(() => setFiltro(VAZIO), [])

  return { filtro, definirFiltro: setFiltro, limpar }
}
