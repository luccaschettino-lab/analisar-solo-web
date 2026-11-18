import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ConfirmarPular from './ConfirmarPular.jsx'
import { useTutorial } from '../../context/TutorialContext.jsx'
import { useFazendaAtual } from '../../context/FazendaContext.jsx'
import { marcarFazendaComoExemplo, receberLaudoExemplo, excluirGlebas } from '../../dados/fazendaExemplo.js'
import { excluirFazenda } from '../../dados/fazendas.js'
import { criarCriterio, aplicarCriterioNaFazenda } from '../../dados/criterios.js'
import { origemPelaSede, kmlDosTalhoes, geojsonDosPontos, ANALISE_GUIADA, amostrasDoLaudoExemplo, SAFRAS_EXEMPLO } from '../../lib/fazendaExemplo.js'
import { laudoExemploPdf } from '../../lib/laudoExemplo.js'
import { ehPonto } from '../../lib/geo.js'

export const TOTAL_FASES = 11

// O laudo PDF do tutorial traz esta safra; a anterior chega depois, sozinha.
const SAFRA_DO_PDF = SAFRAS_EXEMPLO[1]
const SAFRA_ANTERIOR = SAFRAS_EXEMPLO[0]

// Baixa um texto como arquivo, sem servidor: o arquivo nasce no navegador.
function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Botao({ onClick, children, principal = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
        principal
          ? 'bg-solo-700 text-white hover:bg-solo-800 dark:bg-solo-600 dark:hover:bg-solo-700'
          : 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Tutorial guiado, como fases de jogo: um cartão no canto com a missão da
 * fase, o botão certo da tela piscando, e a fase só avança quando o sistema
 * vê que a tarefa foi feita de verdade (fazenda criada, talhões importados,
 * glebas criadas…). A pessoa monta a fazenda de exemplo com as próprias mãos.
 *
 * Os alvos que piscam são os elementos com `data-tutorial="<alvo>"`; o
 * destaque é um atributo posto aqui (não pelo React), reaplicado quando a
 * tela redesenha.
 */
export default function MissaoTutorial() {
  const { missao, atualizarMissao, encerrarMissao, marcarDica } = useTutorial()
  const {
    fazendas,
    carregandoFazendas,
    fazendaSelecionada,
    selecionarFazenda,
    aplicarFazenda,
    removerFazenda,
    talhoes,
    glebas,
    carregando: carregandoHierarquia,
    removerGleba,
    selecionado,
    filtro,
    analisesDaFazenda,
    recarregarAnalises,
    setFormFazenda,
  } = useFazendaAtual()
  const { pathname } = useLocation()
  const navegar = useNavigate()

  const [minimizado, setMinimizado] = useState(false)
  const [comemorando, setComemorando] = useState(false)
  const [querPular, setQuerPular] = useState(false)
  const [ocupado, setOcupado] = useState('')
  const [erro, setErro] = useState('')
  const marcando = useRef(false)

  const fase = missao?.fase ?? 0
  const naFazenda = Boolean(missao?.fazendaId) && fazendaSelecionada?.id === missao?.fazendaId
  const glebasDeArea = glebas.filter((g) => !ehPonto(g.geometria)).length
  const glebasPonto = glebas.filter((g) => ehPonto(g.geometria))
  const analisesDoPdf = analisesDaFazenda.filter((a) => a.ano_safra === SAFRA_DO_PDF).length

  // Fase concluída: comemora um instante e passa para a próxima.
  function concluirFase(proxima, extra = {}) {
    setErro('')
    setComemorando(true)
    setMinimizado(false)
    setTimeout(() => {
      setComemorando(false)
      atualizarMissao({ fase: proxima, ...extra })
    }, 1400)
  }

  // ---- Detecção de cada fase ----
  useEffect(() => {
    if (!missao || comemorando) return

    // Fase 1: aparece uma fazenda nova (que não existia ao começar).
    if (fase === 1 && !carregandoFazendas && !marcando.current) {
      const nova = fazendas.find((f) => !(missao.idsAntes ?? []).includes(f.id) && f.papel === 'proprietario')
      if (nova) {
        marcando.current = true
        marcarFazendaComoExemplo(nova.id)
          .then((marcada) => {
            aplicarFazenda({ ...nova, ...marcada })
            selecionarFazenda(nova.id)
            concluirFase(2, { fazendaId: nova.id })
          })
          .catch((e) => setErro(e.message))
          .finally(() => {
            marcando.current = false
          })
      }
      return
    }

    if (fase < 2 || !naFazenda) return
    if (fase === 2 && fazendaSelecionada.sede_lat != null) concluirFase(3)
    else if (fase === 3 && talhoes.length >= 4) concluirFase(4)
    else if (fase === 4 && selecionado?.tipo === 'talhao' && pathname === '/') concluirFase(5)
    // Glebas de ÁREA, criadas a partir dos pontos de amostra. Importar o
    // arquivo de pontos por "Importar glebas" cria uma gleba-ponto por coleta
    // (120), sem ponto de amostra ligado — não conta.
    else if (fase === 5 && glebasDeArea >= 24) concluirFase(6)
    else if (fase >= 6 && fase <= 9 && glebasDeArea < 24 && !carregandoHierarquia) atualizarMissao({ fase: 5 })
    else if (fase === 6 && analisesDaFazenda.length >= 1) concluirFase(7)
    // Fase 7: importou o laudo PDF; fica nela até receber a safra anterior.
    // Fase 8: critério aplicado e a tela de Critérios aberta (efeito abaixo).
    else if (fase === 9 && filtro?.anoSafra && filtro?.profundidade && filtro?.chaveParametro) {
      marcarDica('filtros')
      concluirFase(10)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missao, fase, comemorando, fazendas, carregandoFazendas, naFazenda, fazendaSelecionada, talhoes, glebas, selecionado, pathname, analisesDaFazenda, filtro, glebasDeArea, carregandoHierarquia])

  // Fases 8 e 9: basta abrir a tela e olhar por alguns segundos.
  useEffect(() => {
    if (!missao || comemorando || !naFazenda) return
    const alvo = fase === 8 ? '/criterios' : fase === 10 ? '/comparar' : fase === 11 ? '/monitoramento' : null
    if (!alvo || pathname !== alvo) return
    if (fase === 8 && !fazendaSelecionada?.criterio_id) return
    const t = setTimeout(() => concluirFase(fase + 1), 6000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missao, fase, comemorando, naFazenda, pathname, fazendaSelecionada?.criterio_id])

  // Fase 6: a análise digitada é gravada pela tela de Dados, que não avisa o
  // mapa; confere de tempos em tempos.
  useEffect(() => {
    const esperando = (fase === 6 && analisesDaFazenda.length === 0) || (fase === 7 && analisesDoPdf < 20)
    if (!esperando || !naFazenda) return
    const intervalo = setInterval(() => recarregarAnalises?.(), 4000)
    return () => clearInterval(intervalo)
  }, [fase, naFazenda, analisesDaFazenda.length, analisesDoPdf, recarregarAnalises])

  // A fazenda do tutorial foi excluída no meio: recomeça da fase 1.
  useEffect(() => {
    if (!missao?.fazendaId || carregandoFazendas) return
    if (!fazendas.some((f) => f.id === missao.fazendaId)) {
      atualizarMissao({ fase: 1, fazendaId: null, idsAntes: fazendas.map((f) => f.id), laudoRecebido: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missao?.fazendaId, fazendas, carregandoFazendas])

  // ---- Destaque piscando no botão da fase ----
  const alvos =
    !missao || comemorando || (fase >= 2 && !naFazenda)
      ? []
      : {
          1: ['nova-fazenda'],
          2: ['marcar-sede'],
          3: pathname === '/' ? ['importar-talhoes'] : ['mapa', 'importar-talhoes'],
          5: pathname === '/dados' ? ['dados-pontos', 'importar-pontos', 'criar-glebas'] : ['dados'],
          6: pathname === '/dados' ? ['dados-manual'] : ['dados'],
          7: analisesDoPdf >= 20 ? [] : pathname === '/dados' ? ['dados-pdf', 'importar-pdf', 'gravar-laudo'] : ['dados'],
          8: fazendaSelecionada?.criterio_id ? ['criterios'] : [],
          9: ['filtros'],
          10: ['comparar'],
          11: ['monitoramento'],
        }[fase] ?? []
  const chaveAlvos = alvos.join(' ')

  useEffect(() => {
    const lista = chaveAlvos ? chaveAlvos.split(' ') : []
    const aplicar = () => {
      document.querySelectorAll('[data-destaque-tutorial]').forEach((el) => {
        if (!lista.includes(el.getAttribute('data-tutorial'))) el.removeAttribute('data-destaque-tutorial')
      })
      for (const alvo of lista) {
        document.querySelectorAll(`[data-tutorial="${alvo}"]`).forEach((el) => {
          if (!el.hasAttribute('data-destaque-tutorial')) el.setAttribute('data-destaque-tutorial', '')
        })
      }
    }
    aplicar()
    if (lista.length === 0) return
    let pendente = false
    const observador = new MutationObserver(() => {
      if (pendente) return
      pendente = true
      requestAnimationFrame(() => {
        pendente = false
        aplicar()
      })
    })
    observador.observe(document.body, { childList: true, subtree: true })
    return () => {
      observador.disconnect()
      document.querySelectorAll('[data-destaque-tutorial]').forEach((el) => el.removeAttribute('data-destaque-tutorial'))
    }
  }, [chaveAlvos])

  if (!missao) return null

  // ---- Ações ----
  const sede = fazendaSelecionada?.sede_lat != null ? { lat: Number(fazendaSelecionada.sede_lat), lng: Number(fazendaSelecionada.sede_lng) } : null

  async function receberLaudo() {
    setErro('')
    setOcupado('Recebendo o laudo…')
    try {
      await receberLaudoExemplo(missao.fazendaId, talhoes, glebas, (feitas, total) => setOcupado(`Lançando análises (${feitas} de ${total})…`), {
        safra: SAFRA_ANTERIOR,
      })
      await recarregarAnalises?.()
      setOcupado('')
      concluirFase(8, { laudoRecebido: true })
    } catch (e) {
      setErro(e.message)
      setOcupado('')
    }
  }

  async function excluirEFechar() {
    setOcupado('Excluindo…')
    try {
      await excluirFazenda(missao.fazendaId)
      removerFazenda(missao.fazendaId)
    } catch (e) {
      setErro(e.message)
    }
    setOcupado('')
    encerrarMissao('concluido')
  }

  async function desfazerGlebasPonto() {
    setErro('')
    setOcupado('Apagando…')
    try {
      await excluirGlebas(glebasPonto.map((g) => g.id))
      glebasPonto.forEach((g) => removerGleba(g.id))
    } catch (e) {
      setErro(e.message)
    }
    setOcupado('')
  }

  function baixarLaudo() {
    const codigoDoTalhao = new Map(talhoes.map((t) => [t.id, t.codigo]))
    const amostras = amostrasDoLaudoExemplo(
      glebas.filter((g) => !ehPonto(g.geometria)).map((g) => ({ codigo: g.codigo, codigoTalhao: codigoDoTalhao.get(g.talhao_id), geometria: g.geometria })),
      SAFRA_DO_PDF,
    )
    const pdf = laudoExemploPdf({ amostras, entrada: '15/09/2025', identificacao: `${fazendaSelecionada?.nome ?? 'Fazenda do tutorial'} (dados fictícios)` })
    baixar('laudo-tutorial.pdf', pdf, 'application/pdf')
  }

  async function criarCriterioDoExemplo() {
    setErro('')
    setOcupado('Criando…')
    try {
      const conjunto = await criarCriterio({
        nome: 'Critério do exemplo (fictício)',
        descricao: 'Tabela de referência do sistema, criada pelo tutorial só para a fazenda de exemplo.',
        parametros: {},
      })
      await aplicarCriterioNaFazenda(missao.fazendaId, conjunto.id)
      // Trocar o criterio_id já faz o contexto carregar o conjunto novo.
      aplicarFazenda({ ...fazendaSelecionada, criterio_id: conjunto.id })
    } catch (e) {
      setErro(e.message)
    }
    setOcupado('')
  }

  function pular() {
    setQuerPular(false)
    encerrarMissao('pulado')
  }

  // ---- Conteúdo de cada fase ----
  const voltarParaFazenda = fase >= 2 && !naFazenda && missao.fazendaId
  let titulo
  let corpo
  if (fase === 12) {
    titulo = '🏁 Tutorial concluído!'
    corpo = (
      <>
        <p>Você montou uma fazenda inteira: talhões, glebas, análises, mapa, comparação e satélite. É o mesmo caminho para a sua.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao
            principal
            onClick={() => {
              encerrarMissao('concluido')
              setFormFazenda('nova')
              navegar('/')
            }}
          >
            Cadastrar a minha fazenda
          </Botao>
          <Botao onClick={() => encerrarMissao('concluido')}>Ficar com o exemplo</Botao>
          <Botao onClick={() => void excluirEFechar()} disabled={Boolean(ocupado)}>
            Excluir o exemplo
          </Botao>
        </div>
      </>
    )
  } else if (voltarParaFazenda) {
    titulo = 'Volte para a fazenda do tutorial'
    corpo = (
      <>
        <p>O tutorial continua na fazenda que você criou nele.</p>
        <div className="mt-3">
          <Botao principal onClick={() => selecionarFazenda(missao.fazendaId)}>
            Voltar para ela
          </Botao>
        </div>
      </>
    )
  } else if (fase === 1) {
    titulo = 'Crie a fazenda'
    corpo = (
      <p>
        Na barra lateral, clique em <strong>+ Nova fazenda</strong> (piscando). Dê o nome que quiser, por exemplo "Fazenda Tutorial", e
        salve.
      </p>
    )
  } else if (fase === 2) {
    titulo = 'Marque a sede'
    corpo = (
      <p>
        Leve o mapa até uma região de lavoura (arraste e use o zoom, ou a busca do mapa). Depois clique em{' '}
        <strong>Marcar sede</strong>, na barra lateral, e clique no mapa onde fica a sede. Os talhões vão aparecer logo ao lado.
      </p>
    )
  } else if (fase === 3) {
    titulo = 'Importe os talhões'
    corpo = (
      <>
        <p>
          Os talhões da sua fazenda você não precisa desenhar: eles saem prontos do programa onde já estão. O{' '}
          <strong>Google Earth</strong>, o <strong>QGIS</strong> e os sistemas de agricultura de precisão (como o Climate FieldView e
          o John Deere Operations Center) exportam os talhões em <strong>KML/KMZ</strong> ou <strong>shapefile (.zip)</strong>.
        </p>
        <p className="mt-2">
          Aqui, use o arquivo de exemplo: baixe-o abaixo, clique em <strong>Mapa</strong> na barra lateral e depois em{' '}
          <strong>Importar talhões</strong>. Escolha o arquivo, confira a lista e confirme.
        </p>
        <div className="mt-3">
          <Botao principal onClick={() => baixar('talhoes-tutorial.kml', kmlDosTalhoes(origemPelaSede(sede)), 'application/vnd.google-earth.kml+xml')}>
            ⬇ Baixar talhões (.kml)
          </Botao>
        </div>
      </>
    )
  } else if (fase === 4) {
    titulo = 'Abra um talhão'
    corpo = (
      <p>
        {pathname === '/' ? 'Clique' : 'Volte ao Mapa e clique'} em qualquer um dos quatro talhões. O painel mostra a área, as
        glebas e os dados dele.
      </p>
    )
  } else if (fase === 5) {
    titulo = 'Importe os pontos de amostra'
    corpo =
      glebasPonto.length > 0 ? (
        <>
          <p>
            O arquivo de pontos entrou por <strong>Importar glebas</strong>, e cada coleta virou uma gleba solta (
            {glebasPonto.length}). Pontos de amostra entram por outro caminho: <strong>Dados → Pontos de amostra</strong>, que junta
            as 5 coletas de cada amostra numa gleba só.
          </p>
          <div className="mt-3">
            <Botao principal onClick={() => void desfazerGlebasPonto()} disabled={Boolean(ocupado)}>
              {ocupado || `Desfazer: apagar as ${glebasPonto.length} glebas soltas`}
            </Botao>
          </div>
        </>
      ) : (
        <>
          <p>
            Pontos de amostra são as coletas no campo: as 5 de uma mesma amostra têm o mesmo número e viram uma gleba. Baixe o
            arquivo, vá em <strong>Dados → Pontos de amostra</strong> (não em "Importar glebas"), escolha o arquivo, clique em
            importar e, em seguida, em <strong>Criar 24 glebas</strong>.
          </p>
          <div className="mt-3">
            <Botao principal onClick={() => baixar('pontos-tutorial.geojson', geojsonDosPontos(origemPelaSede(sede)), 'application/geo+json')}>
              ⬇ Baixar pontos (.geojson)
            </Botao>
          </div>
        </>
      )
  } else if (fase === 6) {
    titulo = 'Digite uma análise'
    corpo = (
      <>
        <p>
          Em <strong>Dados → Entrada manual</strong>, escolha esta fazenda e o <strong>talhão {ANALISE_GUIADA.talhao}</strong> e marque o
          ponto no mapa (clicando ou digitando as coordenadas). O valor de cada campo aparece <strong>em amarelo, em cima dele</strong>;
          vira verde quando está certo.
        </p>
        <p className="mt-2 text-xs">Os outros campos podem ficar vazios. No fim, clique em salvar.</p>
      </>
    )
  } else if (fase === 7 && analisesDoPdf < 20) {
    titulo = 'Importe o laudo em PDF'
    corpo = (
      <>
        <p>
          Digitar análise por análise cansa: o normal é importar o <strong>laudo em PDF</strong> que o laboratório manda. Baixe o laudo
          de exemplo (fictício, no formato da UFV), vá em <strong>Dados → Importar laudo PDF</strong> e escolha o arquivo.
        </p>
        <p className="mt-2">
          Confira a tabela: cada amostra já vem ligada à sua gleba pelo número ("Gleba 5" → gleba 1-5) e a safra sai da data do
          laudo (<strong>{SAFRA_DO_PDF}</strong>). Depois clique em <strong>Gravar</strong>.
        </p>
        <div className="mt-3">
          <Botao principal onClick={baixarLaudo}>⬇ Baixar laudo (.pdf)</Botao>
        </div>
      </>
    )
  } else if (fase === 7) {
    titulo = 'Chegou o laudo do ano passado'
    corpo = (
      <>
        <p>
          Laudo importado! Para comparar safras, falta o ano anterior: o laboratório mandou o de <strong>{SAFRA_ANTERIOR}</strong>, e
          este entra com um clique.
        </p>
        <div className="mt-3">
          <Botao principal onClick={() => void receberLaudo()} disabled={Boolean(ocupado)}>
            {ocupado || `Receber o laudo de ${SAFRA_ANTERIOR}`}
          </Botao>
        </div>
      </>
    )
  } else if (fase === 8) {
    titulo = 'Critérios: o que é bom ou ruim'
    corpo = fazendaSelecionada?.criterio_id ? (
      <>
        <p>
          Critério aplicado. Abra <strong>Critérios</strong> (piscando) e veja o conjunto em vigor: para cada parâmetro, as faixas de
          muito baixo a muito alto. No laboratório da sua fazenda, é o agrônomo quem ajusta essas faixas e clica em{' '}
          <strong>Aplicar nesta fazenda</strong>.
        </p>
      </>
    ) : (
      <>
        <p>
          O sistema <strong>não decide sozinho</strong> o que é baixo, ideal ou alto: isso depende da cultura, do solo e do
          laboratório. Por isso, numa fazenda nova o mapa fica <strong>sem cores</strong> até um agrônomo criar um conjunto de
          critérios em <strong>Critérios</strong> e aplicá-lo à fazenda.
        </p>
        <p className="mt-2">
          <strong>Só para a fazenda de exemplo</strong>, criamos um pronto, com a tabela de referência do sistema.
        </p>
        <div className="mt-3">
          <Botao principal onClick={() => void criarCriterioDoExemplo()} disabled={Boolean(ocupado)}>
            {ocupado || 'Criar o critério do exemplo'}
          </Botao>
        </div>
      </>
    )
  } else if (fase === 9) {
    titulo = 'Pinte o mapa'
    corpo = (
      <p>
        Abra <strong>Filtros</strong> e escolha safra <strong>25-26</strong>, profundidade <strong>0-20</strong> e o parâmetro{' '}
        <strong>pH</strong>. Verde é o ideal; listrado é onde não há análise.
      </p>
    )
  } else if (fase === 10) {
    titulo = 'Compare as safras'
    corpo = (
      <p>
        Abra <strong>Comparar anos</strong> e escolha as safras 24-25 e 25-26 com o pH. O talhão 2 recebeu calcário entre as
        duas: veja onde o pH subiu.
      </p>
    )
  } else if (fase === 11) {
    titulo = 'Veja a lavoura pelo satélite'
    corpo = (
      <p>
        Abra <strong>Monitoramento</strong>, escolha um talhão e uma data com bolinha verde (pouca nuvem). O NDVI mostra o vigor
        da vegetação; "Sem filtro" mostra só a imagem.
      </p>
    )
  }

  const progresso = Math.min(fase - 1, TOTAL_FASES) / TOTAL_FASES

  if (querPular) return <ConfirmarPular aoContinuar={() => setQuerPular(false)} aoPular={pular} />

  if (minimizado) {
    return (
      <button
        type="button"
        onClick={() => setMinimizado(false)}
        className="fixed bottom-4 right-4 z-[1500] flex items-center gap-2 rounded-full bg-solo-700 px-4 py-2 text-sm font-semibold text-white shadow-painel hover:bg-solo-800 dark:bg-solo-600"
      >
        🎯 {fase > TOTAL_FASES ? 'Tutorial concluído' : `Fase ${fase} de ${TOTAL_FASES}`}
      </button>
    )
  }

  return (
    <section
      aria-label="Tutorial guiado"
      aria-live="polite"
      className="vidro-forte fixed bottom-4 left-4 right-4 z-[1500] overflow-hidden rounded-xl border border-solo-300 shadow-painel dark:border-solo-500/40 sm:left-auto sm:w-[22rem]"
    >
      <div className="h-1.5 bg-slate-200 dark:bg-white/10">
        <div className="h-full bg-gradient-to-r from-solo-600 to-solo-400 transition-all duration-700" style={{ width: `${progresso * 100}%` }} />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-solo-700 dark:text-solo-400">
            {fase > TOTAL_FASES ? 'Tutorial guiado' : `Fase ${fase} de ${TOTAL_FASES}`}
          </p>
          <button
            type="button"
            onClick={() => setMinimizado(true)}
            aria-label="Minimizar o tutorial"
            title="Minimizar"
            className="rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            –
          </button>
        </div>

        {comemorando ? (
          <div className="py-4 text-center motion-safe:animate-modal-entrada">
            <p className="text-3xl" aria-hidden="true">✅</p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">Fase concluída!</p>
          </div>
        ) : (
          <>
            <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
            <div className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{corpo}</div>
            {erro && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">{erro}</p>}
            {fase <= TOTAL_FASES && (
              <div className="mt-3 text-right">
                <button
                  type="button"
                  onClick={() => setQuerPular(true)}
                  className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:text-slate-500 dark:hover:text-slate-300"
                >
                  Sair do tutorial
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
