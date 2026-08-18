import { createContext, useContext, useMemo, useState } from 'react'
import { useFazendas } from '../hooks/useFazendas.js'
import { useSelecaoFazenda } from '../hooks/useSelecaoFazenda.js'
import { useHierarquia } from '../hooks/useHierarquia.js'
import { useAnalisesDaFazenda } from '../hooks/useAnalisesDaFazenda.js'
import { useCriterioDaFazenda } from '../hooks/useCriterioDaFazenda.js'
import { useFiltroMapa } from '../paginas/painel/useFiltroMapa.js'
import { anosDisponiveis, criarColoracao } from '../lib/coloracao.js'
import { podeEditar } from '../lib/permissoes.js'

const FazendaContext = createContext(null)

/**
 * Estado da fazenda aberta, compartilhado entre a barra lateral e as páginas.
 *
 * Antes isso vivia dentro do `Painel`. Com a navegação em cascata, a barra
 * lateral — que fica no layout, acima das rotas — precisa da mesma árvore de
 * talhões e glebas que o mapa desenha. Duas cópias divergiriam: criar um
 * talhão no mapa não apareceria na barra.
 */
export function FazendaProvider({ children }) {
  const {
    fazendas,
    carregando: carregandoFazendas,
    erro: erroFazendas,
    aplicarFazenda,
    removerFazenda,
  } = useFazendas()

  const { idSelecionada, fazendaSelecionada, selecionarFazenda } = useSelecaoFazenda(
    fazendas,
    carregandoFazendas,
  )

  const hierarquia = useHierarquia(fazendaSelecionada?.id ?? null)

  const {
    analises: analisesDaFazenda,
    carregando: carregandoAnalises,
    erro: erroAnalises,
  } = useAnalisesDaFazenda(fazendaSelecionada?.id ?? null)

  /**
   * Conjunto de critérios em vigor. `null` = padrão do sistema.
   *
   * Mora aqui, e não em cada tela, porque o mapa, a comparação e a tela da
   * gleba precisam do mesmo — duas leituras separadas poderiam pintar o mapa
   * por um critério e a tabela por outro.
   */
  const {
    criterio,
    carregando: carregandoCriterio,
    erro: erroCriterio,
    recarregar: recarregarCriterio,
  } = useCriterioDaFazenda(fazendaSelecionada?.criterio_id ?? null)

  // O que a classificação consome é o mapa de parâmetros, não o registro.
  const parametrosDoCriterio = criterio?.parametros ?? null

  const anos = useMemo(() => anosDisponiveis(analisesDaFazenda), [analisesDaFazenda])
  const { filtro, definirFiltro } = useFiltroMapa(anos)

  const coloracao = useMemo(
    () => criarColoracao(analisesDaFazenda, filtro, parametrosDoCriterio),
    [analisesDaFazenda, filtro, parametrosDoCriterio],
  )

  /**
   * Item destacado no mapa. Mora aqui porque a barra lateral seleciona e o
   * mapa reage — se cada um tivesse o seu, clicar na árvore não destacaria a
   * geometria.
   */
  const [selecionado, setSelecionado] = useState(null)

  /**
   * Pedido de desenho feito pela barra ("+ Talhão", "+ Gleba").
   *
   * A barra não tem acesso ao mapa; ela registra a intenção e a página do mapa
   * consome e limpa. É um evento carregado por estado — feio, mas honesto:
   * a alternativa seria a barra segurar uma referência ao Leaflet.
   */
  const [pedidoDeDesenho, setPedidoDeDesenho] = useState(null)

  const valor = useMemo(
    () => ({
      fazendas,
      carregandoFazendas,
      erroFazendas,
      aplicarFazenda,
      removerFazenda,

      idSelecionada,
      fazendaSelecionada,
      selecionarFazenda,
      editor: podeEditar(fazendaSelecionada?.papel),

      ...hierarquia,

      analisesDaFazenda,
      carregandoAnalises,
      erroAnalises,
      anos,

      criterio,
      parametrosDoCriterio,
      carregandoCriterio,
      erroCriterio,
      recarregarCriterio,

      filtro,
      definirFiltro,
      coloracao,

      selecionado,
      setSelecionado,
      pedidoDeDesenho,
      setPedidoDeDesenho,
    }),
    [
      fazendas, carregandoFazendas, erroFazendas, aplicarFazenda, removerFazenda,
      idSelecionada, fazendaSelecionada, selecionarFazenda, hierarquia,
      analisesDaFazenda, carregandoAnalises, erroAnalises, anos,
      criterio, parametrosDoCriterio, carregandoCriterio, erroCriterio, recarregarCriterio,
      filtro, definirFiltro, coloracao, selecionado, pedidoDeDesenho,
    ],
  )

  return <FazendaContext.Provider value={valor}>{children}</FazendaContext.Provider>
}

export function useFazendaAtual() {
  const ctx = useContext(FazendaContext)
  if (!ctx) throw new Error('useFazendaAtual precisa estar dentro de <FazendaProvider>.')
  return ctx
}
