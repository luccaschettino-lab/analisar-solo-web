import { useCallback, useMemo, useState } from 'react'
import Mapa from '../mapa/Mapa.jsx'
import PainelLateral from './painel/PainelLateral.jsx'
import ArvoreHierarquia from './painel/ArvoreHierarquia.jsx'
import FiltrosMapa from './painel/FiltrosMapa.jsx'
import LegendaMapa from './painel/LegendaMapa.jsx'
import PainelDetalhe from './painel/PainelDetalhe.jsx'
import SobreposicoesDoMapa from './painel/SobreposicoesDoMapa.jsx'
import ModaisDoPainel from './painel/ModaisDoPainel.jsx'
import { useFazendas } from '../hooks/useFazendas.js'
import { useHierarquia, glebasDoTalhao } from '../hooks/useHierarquia.js'
import { useAnalisesDaFazenda } from '../hooks/useAnalisesDaFazenda.js'
import { useFiltroMapa } from './painel/useFiltroMapa.js'
import { anosDisponiveis, criarColoracao } from '../lib/coloracao.js'
import { useAviso } from '../hooks/useAviso.js'
import { useSelecaoFazenda } from '../hooks/useSelecaoFazenda.js'
import { useMapaDaFazenda } from '../mapa/useMapaDaFazenda.js'
import { useCriacaoDeGeometria } from './painel/useCriacaoDeGeometria.js'
import { useItemSelecionado } from './painel/useItemSelecionado.js'
import { excluirFazenda, resumoCascataFazenda } from '../dados/fazendas.js'
import { podeEditar } from '../lib/permissoes.js'

/**
 * Tela do mapa. Só compõe: cada responsabilidade vive num hook próprio, e o
 * JSX aqui é a montagem — mapa, painel lateral, sobreposições e diálogos.
 */
export default function Painel() {
  const { fazendas, carregando, erro, aplicarFazenda, removerFazenda } = useFazendas()
  const { idSelecionada, fazendaSelecionada, selecionarFazenda } = useSelecaoFazenda(
    fazendas,
    carregando,
  )
  const editor = podeEditar(fazendaSelecionada?.papel)

  const [mapa, setMapa] = useState(null)
  const [recolhido, setRecolhido] = useState(false)
  const [formFazenda, setFormFazenda] = useState(null) // null | 'nova' | 'editar'
  const [confirmandoFazenda, setConfirmandoFazenda] = useState(null)
  const [carregandoExclusaoFazenda, setCarregandoExclusaoFazenda] = useState(false)

  const { aviso, mostrar: mostrarAviso } = useAviso()

  const {
    talhoes,
    glebas,
    carregando: carregandoHierarquia,
    erro: erroHierarquia,
    aplicarTalhao,
    aplicarGleba,
    aplicarGlebas,
    removerTalhao,
    removerGleba,
  } = useHierarquia(fazendaSelecionada?.id ?? null)

  // Análises de toda a fazenda, para colorir o mapa. Carregadas uma vez por
  // fazenda; trocar de filtro é recorte do que já está em memória.
  const {
    analises: analisesDaFazenda,
    carregando: carregandoAnalises,
    erro: erroAnalises,
  } = useAnalisesDaFazenda(fazendaSelecionada?.id ?? null)

  const anos = useMemo(() => anosDisponiveis(analisesDaFazenda), [analisesDaFazenda])
  const { filtro, definirFiltro } = useFiltroMapa(anos)

  // `null` quando o filtro está incompleto — é o sinal para o mapa manter as
  // glebas em cinza neutro, sem afirmar nada sobre o solo.
  const coloracao = useMemo(
    () => criarColoracao(analisesDaFazenda, filtro),
    [analisesDaFazenda, filtro],
  )

  const item = useItemSelecionado({
    mapa,
    idFazenda: idSelecionada,
    talhoes,
    glebas,
    editor,
    aplicarTalhao,
    aplicarGleba,
    removerTalhao,
    removerGleba,
    mostrarAviso,
    coloracao,
    filtro,
  })

  const criacao = useCriacaoDeGeometria({
    mapa,
    editor,
    talhoes,
    aoLimparSelecao: item.limparSelecao,
  })

  const mapaDaFazenda = useMapaDaFazenda({
    mapa,
    fazendaSelecionada,
    talhoes,
    carregandoHierarquia,
    recolhido,
    aplicarFazenda,
    mostrarAviso,
  })

  const aoCriarMapa = useCallback((instancia) => setMapa(instancia), [])

  /**
   * No celular o painel cobre o mapa, então escolher um item e continuar com a
   * gaveta aberta esconde justamente o que se quer ver. Recolhe ao selecionar.
   *
   * O corte usa a mesma largura do `md:` do Tailwind (768px), para o
   * comportamento bater com o layout. Acima disso o painel é coluna fixa e
   * fechar seria perda de contexto.
   */
  function selecionarEFecharNoCelular(alvo) {
    item.selecionarEFocar(alvo)
    if (window.matchMedia('(max-width: 767px)').matches) setRecolhido(true)
  }

  async function abrirExclusaoFazenda() {
    if (!fazendaSelecionada || carregandoExclusaoFazenda) return
    setCarregandoExclusaoFazenda(true)
    try {
      setConfirmandoFazenda(await resumoCascataFazenda(fazendaSelecionada.id))
    } catch (e) {
      mostrarAviso(e.message)
    } finally {
      setCarregandoExclusaoFazenda(false)
    }
  }

  async function confirmarExclusaoFazenda() {
    await excluirFazenda(fazendaSelecionada.id)
    removerFazenda(fazendaSelecionada.id)
    selecionarFazenda('')
    setConfirmandoFazenda(null)
  }

  /**
   * O detalhe do item selecionado aparece em dois lugares, um por vez.
   *
   * Em telas largas, no rodapé do painel. No celular, como barra sobre o mapa —
   * porque lá a gaveta fecha ao selecionar, e o detalhe iria junto, levando os
   * botões de editar, excluir e ver análises.
   *
   * `PainelDetalhe` não tem estado, então renderizar nos dois lugares é seguro:
   * o CSS mostra só um.
   */
  const detalhe = item.itemSelecionado ? (
    <PainelDetalhe
      item={item.itemSelecionado}
      tipo={item.selecionado.tipo}
      talhaoPai={item.talhaoPai}
      quantidadeGlebas={
        item.selecionado.tipo === 'talhao'
          ? glebasDoTalhao(glebas, item.selecionado.id).length
          : 0
      }
      editor={editor}
      editandoGeometria={item.editandoGeometria}
      gravandoGeometria={item.gravandoGeometria}
      carregandoExclusao={item.carregandoExclusao}
      aoEditarDados={item.abrirEdicaoDados}
      aoEditarGeometria={item.iniciarEdicaoGeometria}
      aoSalvarGeometria={item.salvarGeometria}
      aoCancelarGeometria={item.cancelarGeometria}
      aoExcluir={item.abrirExclusao}
      aoFechar={item.limparSelecao}
    />
  ) : null

  return (
    <div className="relative h-full">
      <Mapa aoCriarMapa={aoCriarMapa} />

      {/* Só no celular, e só com a gaveta fechada — senão apareceria duplicado
          por cima dela. */}
      {detalhe && recolhido && (
        <div className="absolute inset-x-0 bottom-0 z-[1100] border-t border-slate-200 bg-white shadow-lg md:hidden">
          {detalhe}
        </div>
      )}

      <PainelLateral
        fazendas={fazendas}
        carregando={carregando}
        erro={erro}
        fazendaSelecionada={fazendaSelecionada}
        aoSelecionar={selecionarFazenda}
        aoNovaFazenda={() => setFormFazenda('nova')}
        aoEditarFazenda={() => setFormFazenda('editar')}
        aoExcluirFazenda={abrirExclusaoFazenda}
        carregandoExclusao={carregandoExclusaoFazenda}
        aoMarcarCentro={mapaDaFazenda.iniciarMarcacao}
        recolhido={recolhido}
        aoAlternar={() => setRecolhido((r) => !r)}
        filtros={
          fazendaSelecionada && (
            <FiltrosMapa
              filtro={filtro}
              aoMudar={definirFiltro}
              anos={anos}
              carregando={carregandoAnalises}
              erro={erroAnalises}
            />
          )
        }
        detalhe={detalhe}
      >
        {fazendaSelecionada && (
          <ArvoreHierarquia
            talhoes={talhoes}
            glebas={glebas}
            selecionado={item.selecionado}
            aoSelecionar={selecionarEFecharNoCelular}
            aoNovoTalhao={criacao.iniciarTalhao}
            aoNovaGleba={criacao.iniciarGleba}
            editor={editor}
            carregando={carregandoHierarquia}
            erro={erroHierarquia}
          />
        )}
      </PainelLateral>

      {/* Só com o filtro completo: a legenda explica uma coloração que
          precisa estar acontecendo. */}
      {coloracao && (
        <LegendaMapa
          chaveParametro={filtro.chaveParametro}
          anoSafra={filtro.anoSafra}
          profundidade={filtro.profundidade}
          elevada={Boolean(detalhe && recolhido)}
        />
      )}

      <SobreposicoesDoMapa
        semReferencia={mapaDaFazenda.semReferencia}
        editor={editor}
        marcandoCentro={mapaDaFazenda.marcandoCentro}
        gravandoCentro={mapaDaFazenda.gravandoCentro}
        desenhando={criacao.desenhando}
        aviso={aviso}
        aoMarcarCentro={mapaDaFazenda.iniciarMarcacao}
        aoCancelarMarcacao={mapaDaFazenda.cancelarMarcacao}
        aoAbortarDesenho={criacao.abortar}
      />

      <ModaisDoPainel
        fazendaSelecionada={fazendaSelecionada}
        glebas={glebas}
        mapa={mapa}
        criacao={criacao}
        item={item}
        aplicarFazenda={aplicarFazenda}
        aplicarTalhao={aplicarTalhao}
        aplicarGleba={aplicarGleba}
        aplicarGlebas={aplicarGlebas}
        mostrarAviso={mostrarAviso}
        formFazenda={formFazenda}
        aoFecharFormFazenda={() => setFormFazenda(null)}
        aoSelecionarFazenda={selecionarFazenda}
        confirmandoFazenda={confirmandoFazenda}
        aoFecharConfirmacaoFazenda={() => setConfirmandoFazenda(null)}
        aoConfirmarExclusaoFazenda={confirmarExclusaoFazenda}
      />
    </div>
  )
}
