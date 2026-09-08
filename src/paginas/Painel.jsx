import { useCallback, useEffect, useState } from 'react'
import Mapa from '../mapa/Mapa.jsx'
import PainelDetalhe from './painel/PainelDetalhe.jsx'
import PainelGleba from './painel/PainelGleba.jsx'
import FiltrosMapa from './painel/FiltrosMapa.jsx'
import LegendaMapa from './painel/LegendaMapa.jsx'
import SobreposicoesDoMapa from './painel/SobreposicoesDoMapa.jsx'
import BuscaLocal from './painel/BuscaLocal.jsx'
import InfoImagem from './painel/InfoImagem.jsx'
import { useAlfineteBusca } from '../mapa/useAlfineteBusca.js'
import ModaisDoPainel from './painel/ModaisDoPainel.jsx'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import { glebasDoTalhao } from '../hooks/useHierarquia.js'
import { useAviso } from '../hooks/useAviso.js'
import { useMapaDaFazenda } from '../mapa/useMapaDaFazenda.js'
import { useCriacaoDeGeometria } from './painel/useCriacaoDeGeometria.js'
import { useItemSelecionado } from './painel/useItemSelecionado.js'
import { excluirFazenda, resumoCascataFazenda } from '../dados/fazendas.js'

/**
 * Tela do mapa.
 *
 * A árvore de talhões e a seleção de fazenda saíram daqui para a barra lateral
 * do layout. Sobrou o que é do mapa: desenho, edição, coloração e os diálogos.
 */
export default function Painel() {
  const ctx = useFazendaAtual()
  const {
    fazendaSelecionada, idSelecionada, selecionarFazenda, editor,
    talhoes, glebas, aplicarTalhao, aplicarTalhoes, aplicarGleba, aplicarGlebas,
    removerTalhao, removerGleba, carregando: carregandoHierarquia,
    aplicarFazenda, removerFazenda,
    anos, filtro, definirFiltro, coloracao, carregandoAnalises, erroAnalises, criterio,
    selecionado, setSelecionado, pedidoDeDesenho, setPedidoDeDesenho,
    formFazenda, setFormFazenda,
  } = ctx

  const [mapa, setMapa] = useState(null)
  const [confirmandoFazenda, setConfirmandoFazenda] = useState(null)
  const [carregandoExclusaoFazenda, setCarregandoExclusaoFazenda] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [importandoKml, setImportandoKml] = useState(false)
  const [mesclandoTalhoes, setMesclandoTalhoes] = useState(false)
  const [camadaAtiva, setCamadaAtiva] = useState(null)
  // Ponto usado para consultar a data da imagem. Só muda quando o mapa para
  // de se mover — consultar a cada pixel de arrasto seria abuso do serviço.
  const [centroEstavel, setCentroEstavel] = useState(null)
  // Preferência de largura do painel de gleba. Persiste entre seleções de
  // propósito: quem abriu largo para ler o histórico não quer reabrir estreito
  // a cada clique numa gleba diferente.
  const [painelExpandido, setPainelExpandido] = useState(false)

  const { aviso, mostrar: mostrarAviso } = useAviso()

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
    selecionado,
    setSelecionado,
  })

  const criacao = useCriacaoDeGeometria({
    mapa,
    editor,
    talhoes,
    aoLimparSelecao: item.limparSelecao,
    aoAvisar: mostrarAviso,
  })

  // A gleba selecionada é quem abre o painel lateral de conteúdo — talhão não
  // tem análise nem foto, então não tem o que mostrar lá.
  const glebaSelecionada = selecionado?.tipo === 'gleba' ? item.itemSelecionado : null

  const mapaDaFazenda = useMapaDaFazenda({
    mapa,
    fazendaSelecionada,
    talhoes,
    carregandoHierarquia,
    // Muda quando o painel abre, fecha ou troca de largura — é só isso que
    // dispara o invalidateSize do mapa em `useEnquadramentoDaFazenda`.
    larguraPainel: glebaSelecionada ? (painelExpandido ? 'expandido' : 'compacto') : 'fechado',
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

  /**
   * A barra lateral pede o desenho pelo contexto; aqui o pedido é consumido e
   * limpo. A barra não tem acesso ao Leaflet, e dar acesso a ela seria pior
   * que carregar a intenção por estado.
   */
  useEffect(() => {
    if (!pedidoDeDesenho || !mapa) return
    if (pedidoDeDesenho.tipo === 'talhao') criacao.iniciarTalhao()
    else criacao.iniciarGleba(pedidoDeDesenho.talhaoId)
    setPedidoDeDesenho(null)
  }, [pedidoDeDesenho, mapa, criacao, setPedidoDeDesenho])

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

  return (
    <div className="relative flex h-full">
      <div className="relative min-h-0 min-w-0 flex-1">
        <Mapa aoCriarMapa={aoCriarMapa} aoTrocarCamada={aoTrocarCamada} />

        <InfoImagem camadaAtiva={camadaAtiva} centro={centroEstavel} />

        {/* Ações da fazenda, no canto oposto ao dos controles do mapa.
            "Nova fazenda" mora na barra lateral agora, perto do seletor. */}
        <div className="absolute left-3 top-3 z-[1100] flex flex-wrap gap-2">
          {fazendaSelecionada && editor && (
            <>
              <button
                onClick={() => setFormFazenda('editar')}
                className="vidro rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-painel hover:bg-slate-100 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10"
              >
                Editar
              </button>
              <button
                onClick={mapaDaFazenda.iniciarMarcacao}
                className="vidro rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-painel hover:bg-slate-100 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10"
              >
                Marcar sede
              </button>
            </>
          )}
          {/* Fora do bloco de editor: ir ate a sede e leitura, nao edicao.
              Um consultor com papel de leitor tambem precisa se localizar. */}
          {fazendaSelecionada && mapaDaFazenda.temSede && (
            <button
              onClick={mapaDaFazenda.irParaSede}
              title="Centralizar o mapa na sede da fazenda"
              className="vidro rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-painel hover:bg-slate-100 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10"
            >
              <span aria-hidden="true">⌂</span> Ir para a sede
            </button>
          )}
          {fazendaSelecionada && (
            <button
              // Um de cada vez: os dois abrem no mesmo canto.
              onClick={() => {
                setFiltrosAbertos((a) => !a)
                setBuscaAberta(false)
              }}
              aria-expanded={filtrosAbertos}
              className="vidro rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-painel hover:bg-slate-100 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10"
            >
              🔽 Filtro
            </button>
          )}
          {fazendaSelecionada && editor && (
            <button
              onClick={() => setImportandoKml(true)}
              className="vidro rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-painel hover:bg-slate-100 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10"
            >
              Importar
            </button>
          )}
          {fazendaSelecionada && editor && talhoes.length >= 2 && (
            <button
              onClick={() => setMesclandoTalhoes(true)}
              className="vidro rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-painel hover:bg-slate-100 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10"
            >
              Mesclar talhões
            </button>
          )}
          {/* Buscar não depende de fazenda selecionada: é justamente o que se usa
              para achar a propriedade antes de existir qualquer cadastro. */}
          <button
            onClick={() => {
              setBuscaAberta((a) => !a)
              setFiltrosAbertos(false)
            }}
            aria-expanded={buscaAberta}
            className="vidro rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-painel hover:bg-slate-100 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10"
          >
            🔍 Buscar
          </button>
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

        {item.itemSelecionado && (
          <div className="vidro-forte absolute inset-x-0 bottom-0 z-[1100] border-t border-slate-200 shadow-painel dark:border-white/15 sm:inset-x-auto sm:bottom-6 sm:left-3 sm:w-52 sm:rounded-lg sm:border">
            <PainelDetalhe
              item={item.itemSelecionado}
              tipo={selecionado.tipo}
              talhaoPai={item.talhaoPai}
              quantidadeGlebas={
                selecionado.tipo === 'talhao' ? glebasDoTalhao(glebas, selecionado.id).length : 0
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
          desenhando={criacao.desenhando}
          aviso={aviso}
          aoMarcarSede={mapaDaFazenda.iniciarMarcacao}
          aoCancelarMarcacao={mapaDaFazenda.cancelarMarcacao}
          aoAbortarDesenho={criacao.abortar}
        />

        <ModaisDoPainel
          fazendaSelecionada={fazendaSelecionada}
          talhoes={talhoes}
          glebas={glebas}
          mapa={mapa}
          criacao={criacao}
          item={item}
          aplicarFazenda={aplicarFazenda}
          aplicarTalhao={aplicarTalhao}
          aplicarTalhoes={aplicarTalhoes}
          removerTalhao={removerTalhao}
          aplicarGleba={aplicarGleba}
          aplicarGlebas={aplicarGlebas}
          mostrarAviso={mostrarAviso}
          formFazenda={formFazenda}
          aoFecharFormFazenda={() => setFormFazenda(null)}
          aoSelecionarFazenda={selecionarFazenda}
          confirmandoFazenda={confirmandoFazenda}
          aoFecharConfirmacaoFazenda={() => setConfirmandoFazenda(null)}
          aoConfirmarExclusaoFazenda={confirmarExclusaoFazenda}
          importandoKml={importandoKml}
          aoFecharImportarKml={() => setImportandoKml(false)}
          mesclandoTalhoes={mesclandoTalhoes}
          aoFecharMesclarTalhoes={() => setMesclandoTalhoes(false)}
        />
      </div>

      {glebaSelecionada && (
        <PainelGleba
          gleba={glebaSelecionada}
          talhao={item.talhaoPai}
          fazendaId={fazendaSelecionada.id}
          editor={editor}
          expandido={painelExpandido}
          aoAlternarExpandido={() => setPainelExpandido((e) => !e)}
          aoFechar={item.limparSelecao}
          aoAtualizarGleba={aplicarGleba}
        />
      )}
    </div>
  )
}
