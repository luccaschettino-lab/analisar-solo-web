import { useCallback, useEffect, useState } from 'react'
import Mapa from '../mapa/Mapa.jsx'
import PainelDetalhe from './painel/PainelDetalhe.jsx'
import FiltrosMapa from './painel/FiltrosMapa.jsx'
import LegendaMapa from './painel/LegendaMapa.jsx'
import SobreposicoesDoMapa from './painel/SobreposicoesDoMapa.jsx'
import BuscaLocal from './painel/BuscaLocal.jsx'
import InfoImagem from './painel/InfoImagem.jsx'
import { useAlfineteBusca } from '../mapa/useAlfineteBusca.js'
import ModaisDoPainel from './painel/ModaisDoPainel.jsx'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import { useAviso } from '../hooks/useAviso.js'
import { useMapaDaFazenda } from '../mapa/useMapaDaFazenda.js'
import { useItemSelecionado } from './painel/useItemSelecionado.js'
import { excluirFazenda, resumoCascataFazenda } from '../dados/fazendas.js'

/**
 * Tela do mapa.
 *
 * A árvore de talhões e a seleção de fazenda saíram daqui para a barra lateral
 * do layout. Sobrou o que é do mapa: edição, coloração e os diálogos.
 */
export default function Painel() {
  const ctx = useFazendaAtual()
  const {
    fazendaSelecionada, idSelecionada, selecionarFazenda, editor,
    talhoes, aplicarTalhao, aplicarTalhoes,
    removerTalhao, carregando: carregandoHierarquia,
    aplicarFazenda, removerFazenda,
    anos, filtro, definirFiltro, coloracao, carregandoAnalises, erroAnalises, criterio,
    selecionado, setSelecionado,
    formFazenda, setFormFazenda, pedidoDeAcao, setPedidoDeAcao,
  } = ctx

  const [mapa, setMapa] = useState(null)
  const [confirmandoFazenda, setConfirmandoFazenda] = useState(null)
  const [carregandoExclusaoFazenda, setCarregandoExclusaoFazenda] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [visualizacaoAberta, setVisualizacaoAberta] = useState(false)
  const [mostrarCor, setMostrarCor] = useState(true)
  const [importandoArquivo, setImportandoArquivo] = useState(false)
  const [mesclandoTalhoes, setMesclandoTalhoes] = useState(false)
  const [camadaAtiva, setCamadaAtiva] = useState(null)
  // Ponto usado para consultar a data da imagem. Só muda quando o mapa para
  // de se mover — consultar a cada pixel de arrasto seria abuso do serviço.
  const [centroEstavel, setCentroEstavel] = useState(null)

  const { aviso, mostrar: mostrarAviso } = useAviso()

  const item = useItemSelecionado({
    mapa,
    idFazenda: idSelecionada,
    talhoes,
    editor,
    aplicarTalhao,
    removerTalhao,
    mostrarAviso,
    coloracao,
    filtro,
    mostrarCor,
    selecionado,
    setSelecionado,
  })

  const mapaDaFazenda = useMapaDaFazenda({
    mapa,
    fazendaSelecionada,
    talhoes,
    carregandoHierarquia,
    aplicarFazenda,
    mostrarAviso,
  })

  const aoCriarMapa = useCallback((instancia) => setMapa(instancia), [])
  const aoTrocarCamada = useCallback((chave) => setCamadaAtiva(chave), [])
  const alfinete = useAlfineteBusca(mapa)

  /**
   * O centro do mapa só é atualizado quando o movimento termina, e só se
   * andou o bastante para mudar a resposta. A data da imagem varia por
   * região, não por pixel — consultar a cada arrasto castigaria o serviço do
   * Esri sem informar nada de novo.
   */
  useEffect(() => {
    if (!mapa) return

    function registrar() {
      const c = mapa.getCenter()
      setCentroEstavel((anterior) => {
        if (anterior && Math.abs(anterior.lat - c.lat) < 0.02 && Math.abs(anterior.lng - c.lng) < 0.02) {
          return anterior
        }
        return { lat: c.lat, lng: c.lng }
      })
    }

    registrar()
    mapa.on('moveend', registrar)
    return () => mapa.off('moveend', registrar)
  }, [mapa])

  // Selecionar pela barra lateral também leva o mapa até a geometria.
  useEffect(() => {
    if (!selecionado) return
    item.focarSelecionado()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado, mapa])

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
   * A barra lateral pede ("Marcar sede", "Ir para a sede", "Importar",
   * "Mesclar talhões", "Excluir fazenda") e aqui o pedido vira a ação de
   * fato — diálogo aberto ou, nos dois primeiros, uma chamada ao mapa.
   *
   * Marcar/ir para a sede dependem do mapa já ter montado: se `pedidoDeAcao`
   * chegar antes disso (troca de rota mais lenta que o clique), o efeito só
   * limpa o pedido quando `mapa` também estiver pronto — por isso o `return`
   * sem `setPedidoDeAcao(null)` nesses dois casos.
   */
  useEffect(() => {
    if (!pedidoDeAcao) return
    switch (pedidoDeAcao) {
      case 'marcar-sede':
        if (!mapa) return
        mapaDaFazenda.iniciarMarcacao()
        break
      case 'ir-para-sede':
        if (!mapa) return
        mapaDaFazenda.irParaSede()
        break
      case 'importar-arquivo':
        setImportandoArquivo(true)
        break
      case 'mesclar-talhoes':
        setMesclandoTalhoes(true)
        break
      case 'excluir-fazenda':
        abrirExclusaoFazenda()
        break
      default:
        break
    }
    setPedidoDeAcao(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoDeAcao, mapa])

  return (
    <div className="relative flex h-full">
      <div className="relative min-h-0 min-w-0 flex-1">
        <Mapa aoCriarMapa={aoCriarMapa} aoTrocarCamada={aoTrocarCamada} />

        <InfoImagem camadaAtiva={camadaAtiva} centro={centroEstavel} />

        {/* Só o que é de fato "ver o mapa agora": localizar um lugar e ligar a
            coloração por parâmetro. O resto (editar fazenda, marcar sede,
            importar, mesclar talhões, excluir) mora na barra lateral, perto
            do seletor de fazenda — são ações sobre o cadastro, não sobre o
            que está sendo olhado no mapa neste instante. Ver `pedidoDeAcao`. */}
        <div className="absolute left-3 top-3 z-[1100] flex flex-wrap gap-2">
          {fazendaSelecionada && (
            <button
              // Um de cada vez: todos abrem no mesmo canto.
              onClick={() => {
                setFiltrosAbertos((a) => !a)
                setBuscaAberta(false)
                setVisualizacaoAberta(false)
              }}
              aria-expanded={filtrosAbertos}
              className="vidro rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-painel hover:bg-slate-100 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10"
            >
              🔽 Filtro
            </button>
          )}
          {/* Buscar não depende de fazenda selecionada: é justamente o que se usa
              para achar a propriedade antes de existir qualquer cadastro. */}
          <button
            onClick={() => {
              setBuscaAberta((a) => !a)
              setFiltrosAbertos(false)
              setVisualizacaoAberta(false)
            }}
            aria-expanded={buscaAberta}
            className="vidro rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-painel hover:bg-slate-100 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10"
          >
            🔍 Buscar
          </button>
          {fazendaSelecionada && (
            <button
              onClick={() => {
                setVisualizacaoAberta((a) => !a)
                setFiltrosAbertos(false)
                setBuscaAberta(false)
              }}
              aria-expanded={visualizacaoAberta}
              className="vidro rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-painel hover:bg-slate-100 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10"
            >
              👁 Visualização
            </button>
          )}
        </div>

        {buscaAberta && (
          <div className="absolute left-3 top-14 z-[1100]">
            <BuscaLocal aoIrPara={alfinete.irPara} />
          </div>
        )}

        {filtrosAbertos && fazendaSelecionada && (
          <div className="vidro-forte absolute left-3 top-14 z-[1100] w-64 rounded-lg border border-slate-200 shadow-painel dark:border-white/15">
            <FiltrosMapa
              filtro={filtro}
              aoMudar={definirFiltro}
              anos={anos}
              carregando={carregandoAnalises}
              erro={erroAnalises}
            />
          </div>
        )}

        {visualizacaoAberta && fazendaSelecionada && (
          <div className="vidro-forte absolute left-3 top-14 z-[1100] w-56 rounded-lg border border-slate-200 p-3 shadow-painel dark:border-white/15">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={mostrarCor}
                onChange={(e) => setMostrarCor(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-solo-600 focus:ring-solo-500 dark:border-white/20"
              />
              Cor de preenchimento
            </label>
            {/* As linhas de divisão e o código de cada talhão continuam de
                qualquer jeito — isto só tira a cor de dentro delas. */}
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              A grade e o código continuam aparecendo mesmo sem cor.
            </p>
          </div>
        )}

        {item.itemSelecionado && (
          <div className="vidro-forte absolute inset-x-0 bottom-0 z-[1100] border-t border-slate-200 shadow-painel dark:border-white/15 sm:inset-x-auto sm:bottom-6 sm:left-3 sm:w-52 sm:rounded-lg sm:border">
            <PainelDetalhe
              item={item.itemSelecionado}
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
          </div>
        )}

        {coloracao && (
          <LegendaMapa
            chaveParametro={filtro.chaveParametro}
            anoSafra={filtro.anoSafra}
            profundidade={filtro.profundidade}
            elevada={Boolean(item.itemSelecionado)}
            criterio={criterio}
          />
        )}

        <SobreposicoesDoMapa
          semReferencia={mapaDaFazenda.semReferencia}
          editor={editor}
          marcandoSede={mapaDaFazenda.marcandoSede}
          gravandoSede={mapaDaFazenda.gravandoSede}
          aviso={aviso}
          aoMarcarSede={mapaDaFazenda.iniciarMarcacao}
          aoCancelarMarcacao={mapaDaFazenda.cancelarMarcacao}
        />

        <ModaisDoPainel
          fazendaSelecionada={fazendaSelecionada}
          talhoes={talhoes}
          item={item}
          aplicarFazenda={aplicarFazenda}
          aplicarTalhao={aplicarTalhao}
          aplicarTalhoes={aplicarTalhoes}
          removerTalhao={removerTalhao}
          mostrarAviso={mostrarAviso}
          formFazenda={formFazenda}
          aoFecharFormFazenda={() => setFormFazenda(null)}
          aoSelecionarFazenda={selecionarFazenda}
          confirmandoFazenda={confirmandoFazenda}
          aoFecharConfirmacaoFazenda={() => setConfirmandoFazenda(null)}
          aoConfirmarExclusaoFazenda={confirmarExclusaoFazenda}
          importandoArquivo={importandoArquivo}
          aoFecharImportarArquivo={() => setImportandoArquivo(false)}
          mesclandoTalhoes={mesclandoTalhoes}
          aoFecharMesclarTalhoes={() => setMesclandoTalhoes(false)}
        />
      </div>
    </div>
  )
}
