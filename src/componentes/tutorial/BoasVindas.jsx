import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../Modal.jsx'
import ConfirmarPular from './ConfirmarPular.jsx'
import { useTutorial } from '../../context/TutorialContext.jsx'
import { useFazendaAtual } from '../../context/FazendaContext.jsx'
import { NIVEIS } from '../../config/parametros.js'

const FLUXO = [
  ['Fazenda', 'nome e sede'],
  ['Talhões', 'desenhados ou importados (KML, KMZ, shapefile)'],
  ['Pontos de amostra', 'viram as glebas sozinhos'],
  ['Análises', 'laudo em PDF ou digitadas'],
  ['Mapa', 'manchas de cada nutriente'],
]

function Passo1() {
  return (
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
      <p>
        O Moinho transforma as análises de solo da sua fazenda em <strong>mapas</strong>: você vê, talhão por talhão, onde
        falta ou sobra cada nutriente, compara safras e acompanha a lavoura pelo satélite.
      </p>
      <p>
        Prefere a tela clara? O botão <span aria-hidden="true">☀</span> no canto superior direito troca entre tema escuro e
        claro.
      </p>
      <p>Primeiro, uma visão rápida de como tudo se encaixa. Depois, você mesmo monta uma fazenda de exemplo, fase por fase.</p>
    </div>
  )
}

function Passo2() {
  return (
    <div className="text-sm text-slate-600 dark:text-slate-300">
      <p className="mb-3">Tudo segue esta ordem, e cada passo usa o anterior:</p>
      <ol className="space-y-2">
        {FLUXO.map(([titulo, detalhe], i) => (
          <li key={titulo} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-solo-700 text-xs font-semibold text-white dark:bg-solo-600">
              {i + 1}
            </span>
            <span>
              <strong className="text-slate-800 dark:text-slate-100">{titulo}</strong> · {detalhe}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Gleba é cada área de uma amostra composta: os pontos com o mesmo número no arquivo formam uma gleba.
      </p>
    </div>
  )
}

function Passo3() {
  const cores = [NIVEIS.muito_baixo, NIVEIS.baixo, NIVEIS.medio, NIVEIS.alto, NIVEIS.muito_alto]
  return (
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
      <p>
        No mapa, escolha em <strong>Filtros</strong> a safra, a profundidade e o parâmetro (pH, P, K…). O talhão ganha as
        cores do nível:
      </p>
      <div className="flex overflow-hidden rounded-md text-center text-xs font-medium text-white">
        {cores.map((n, i) => (
          <span key={i} className="flex-1 py-1.5" style={{ background: n.cor }}>
            {n.rotulo.replace(' (ideal)', '')}
          </span>
        ))}
      </div>
      <p>
        <strong>Verde é o ideal</strong>; laranja e vermelho afastam do ideal, para menos ou para mais. Área{' '}
        <strong>listrada</strong> é onde não há medição: o sistema não inventa valor.
      </p>
    </div>
  )
}

function Passo4() {
  return (
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
      <p>
        Agora é com você. Em <strong>10 fases</strong>, você monta uma fazenda de exemplo com dados fictícios: cria a fazenda,
        importa os talhões e os pontos de amostra, lança uma análise, importa um laudo em PDF e lê o mapa.
      </p>
      <p>
        Um cartão no canto da tela diz o que fazer em cada fase, e o botão certo fica piscando. A fase só avança quando você
        conclui a tarefa. Leva uns 10 minutos.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Os arquivos de que você precisa o próprio tutorial entrega.</p>
    </div>
  )
}

const TITULOS = ['Bem-vindo ao Moinho', 'Como funciona', 'Lendo o mapa', 'Tutorial guiado']

/**
 * Boas-vindas do primeiro acesso: três telas de visão geral e o convite para
 * o tutorial guiado. Pular (botão, Esc ou clique fora) passa antes por um
 * aviso que recomenda continuar.
 */
export default function BoasVindas() {
  const { boasVindasAberta, concluirBoasVindas, iniciarMissao } = useTutorial()
  const { fazendas, carregandoFazendas } = useFazendaAtual()
  const navegar = useNavigate()
  const [passo, setPasso] = useState(0)
  const [querPular, setQuerPular] = useState(false)

  if (!boasVindasAberta) return null

  function encerrar() {
    setPasso(0)
    setQuerPular(false)
    concluirBoasVindas()
  }

  function comecar() {
    iniciarMissao(fazendas.map((f) => f.id))
    navegar('/')
    encerrar()
  }

  if (querPular) {
    return <ConfirmarPular aoContinuar={() => setQuerPular(false)} aoPular={encerrar} />
  }

  const ultimo = passo === TITULOS.length - 1

  return (
    <Modal titulo={TITULOS[passo]} aoFechar={() => setQuerPular(true)} largura="max-w-lg">
      <div className="min-h-[13rem]">
        {passo === 0 && <Passo1 />}
        {passo === 1 && <Passo2 />}
        {passo === 2 && <Passo3 />}
        {passo === 3 && <Passo4 />}
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <div className="flex gap-1.5" aria-label={`Passo ${passo + 1} de ${TITULOS.length}`}>
          {TITULOS.map((t, i) => (
            <span
              key={t}
              aria-hidden="true"
              className={`h-1.5 rounded-full transition-all ${i === passo ? 'w-5 bg-solo-600' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`}
            />
          ))}
        </div>
        {/* O botão de avançar vem primeiro no código: é o que recebe o foco
            ao abrir, então Enter avança em vez de pular. */}
        <div className="flex flex-row-reverse gap-2">
          {ultimo ? (
            // Só com a lista de fazendas carregada: ela é o "antes", e a fazenda
            // nova que aparecer depois é a do tutorial.
            <button
              type="button"
              onClick={comecar}
              disabled={carregandoFazendas}
              className="rounded-md bg-solo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-solo-800 disabled:opacity-60 dark:bg-solo-600 dark:hover:bg-solo-700"
            >
              Começar o tutorial
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPasso((p) => p + 1)}
              className="rounded-md bg-solo-700 px-4 py-2 text-sm font-medium text-white hover:bg-solo-800 dark:bg-solo-600 dark:hover:bg-solo-700"
            >
              Próximo
            </button>
          )}
          {passo > 0 && (
            <button
              type="button"
              onClick={() => setPasso((p) => p - 1)}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            onClick={() => setQuerPular(true)}
            className="rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          >
            Pular
          </button>
        </div>
      </div>
    </Modal>
  )
}
