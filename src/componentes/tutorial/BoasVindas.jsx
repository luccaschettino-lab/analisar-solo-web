import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../Modal.jsx'
import { useTutorial } from '../../context/TutorialContext.jsx'
import { useFazendaAtual } from '../../context/FazendaContext.jsx'
import { criarFazendaExemplo } from '../../dados/fazendaExemplo.js'
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
      <p>Em 1 minuto mostramos como tudo se encaixa. Dá para pular e rever depois em <strong>Ajuda → Ver o tutorial de novo</strong>.</p>
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
      <p>
        Em <strong>Comparar anos</strong> você vê o que mudou entre safras, e em <strong>Monitoramento</strong> o vigor da
        lavoura pelo satélite.
      </p>
    </div>
  )
}

function Passo4({ temExemplo, criando, progresso, erro, aoCriarExemplo, aoAbrirExemplo, aoCadastrar }) {
  return (
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
      <p>Como você quer começar?</p>
      <button
        type="button"
        onClick={temExemplo ? aoAbrirExemplo : aoCriarExemplo}
        disabled={criando}
        className="w-full rounded-lg border-2 border-solo-600 bg-solo-50 px-4 py-3 text-left transition hover:bg-solo-100 disabled:opacity-70 dark:border-solo-500 dark:bg-solo-500/10 dark:hover:bg-solo-500/20"
      >
        <span className="block font-semibold text-solo-800 dark:text-solo-300">
          {criando ? 'Montando a fazenda de exemplo…' : temExemplo ? 'Abrir a fazenda de exemplo' : 'Explorar uma fazenda de exemplo'}
        </span>
        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">
          {criando
            ? progresso
            : 'Quatro talhões com análises de duas safras, todos fictícios, para você mexer à vontade. Dá para excluir quando quiser.'}
        </span>
      </button>
      <button
        type="button"
        onClick={aoCadastrar}
        disabled={criando}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-left transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
      >
        <span className="block font-semibold text-slate-800 dark:text-slate-100">Cadastrar a minha fazenda</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          A lista de primeiros passos, na barra lateral, vai guiando você.
        </span>
      </button>
      {erro && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
          {erro}
        </p>
      )}
    </div>
  )
}

const TITULOS = ['Bem-vindo ao Moinho', 'Como funciona', 'Lendo o mapa', 'Por onde começar']

/** Boas-vindas do primeiro acesso, em quatro telas curtas. */
export default function BoasVindas() {
  const { boasVindasAberta, concluirBoasVindas } = useTutorial()
  const { fazendas, aplicarFazenda, selecionarFazenda, setFormFazenda } = useFazendaAtual()
  const navegar = useNavigate()
  const [passo, setPasso] = useState(0)
  const [criando, setCriando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState('')

  if (!boasVindasAberta) return null

  const exemplo = fazendas.find((f) => f.exemplo)

  function encerrar() {
    setPasso(0)
    setErro('')
    concluirBoasVindas()
  }

  // Esc, clique fora, "Pular": não interrompe a criação do exemplo no meio.
  function fechar() {
    if (!criando) encerrar()
  }

  async function criarExemplo() {
    setErro('')
    setCriando(true)
    try {
      const fazenda = await criarFazendaExemplo(setProgresso)
      aplicarFazenda(fazenda)
      selecionarFazenda(fazenda.id)
      setCriando(false)
      navegar('/')
      encerrar()
    } catch (e) {
      setErro(e.message)
      setCriando(false)
    }
  }

  function abrirExemplo() {
    selecionarFazenda(exemplo.id)
    navegar('/')
    encerrar()
  }

  function cadastrar() {
    setFormFazenda('nova')
    navegar('/')
    encerrar()
  }

  const ultimo = passo === TITULOS.length - 1

  return (
    <Modal titulo={TITULOS[passo]} aoFechar={fechar} largura="max-w-lg">
      <div className="min-h-[13rem]">
        {passo === 0 && <Passo1 />}
        {passo === 1 && <Passo2 />}
        {passo === 2 && <Passo3 />}
        {passo === 3 && (
          <Passo4
            temExemplo={Boolean(exemplo)}
            criando={criando}
            progresso={progresso}
            erro={erro}
            aoCriarExemplo={criarExemplo}
            aoAbrirExemplo={abrirExemplo}
            aoCadastrar={cadastrar}
          />
        )}
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
        <div className="flex gap-2">
          {passo === 0 ? (
            <button type="button" onClick={fechar} className="rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
              Pular
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPasso((p) => p - 1)}
              disabled={criando}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Voltar
            </button>
          )}
          {ultimo ? (
            <button
              type="button"
              onClick={fechar}
              disabled={criando}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10"
            >
              Agora não
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
        </div>
      </div>
    </Modal>
  )
}
