import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PainelDeAba } from '../componentes/Abas.jsx'
import TrilhaNavegacao from './gleba/TrilhaNavegacao.jsx'
import TabelaAnalises from './gleba/TabelaAnalises.jsx'
import HistoricoGraficos from './gleba/HistoricoGraficos.jsx'
import PerfilDoSolo from '../componentes/PerfilDoSolo.jsx'
import { useGlebaContexto } from '../hooks/useGlebaContexto.js'
import { useAnalises } from '../hooks/useAnalises.js'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import { podeEditar } from '../lib/permissoes.js'

const ABAS = [
  { chave: 'analises', rotulo: 'AnÃ¡lises' },
  { chave: 'historico', rotulo: 'HistÃ³rico' },
  { chave: 'foto', rotulo: 'Foto' },
]

function Centralizado({ children }) {
  return <div className="flex h-full items-center justify-center p-6 text-sm">{children}</div>
}

export default function GlebaDetalhe() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const abaAtiva = ABAS.some((a) => a.chave === params.get('aba')) ? params.get('aba') : 'analises'

  const { contexto, carregando, naoEncontrada, erro } = useGlebaContexto(id)
  // O papel sai da lista de fazendas que o contexto ja carregou â€” evita uma
  // ida ao servidor so para descobrir se esta pessoa pode trocar a foto.
  const { fazendas } = useFazendaAtual()
  const {
    analises,
    carregando: carregandoAnalises,
    erro: erroAnalises,
  } = useAnalises(id)

  if (carregando) return <Centralizado>Carregando glebaâ€¦</Centralizado>

  if (erro) {
    return (
      <Centralizado>
        <span role="alert" className="text-red-700 dark:text-red-300">
          {erro}
        </span>
      </Centralizado>
    )
  }

  if (naoEncontrada) {
    return (
      <Centralizado>
        <div className="text-center">
          <p className="font-medium text-slate-700 dark:text-slate-300">Gleba nÃ£o encontrada.</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Ela pode ter sido apagada, ou vocÃª nÃ£o tem acesso a esta fazenda.
          </p>
          <Link to="/" className="mt-3 inline-block font-medium text-solo-700 hover:underline dark:text-solo-400">
            Voltar ao mapa
          </Link>
        </div>
      </Centralizado>
    )
  }

  const { fazenda, talhao, gleba } = contexto
  const papel = fazendas.find((f) => f.id === fazenda.id)?.papel
  const editor = podeEditar(papel)

  function trocarAba(chave) {
    // `replace` para nÃ£o empilhar uma entrada de histÃ³rico por clique de aba.
    setParams(chave === 'analises' ? {} : { aba: chave }, { replace: true })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sem abas: a barra lateral jÃ¡ leva a AnÃ¡lises e HistÃ³rico. Aqui fica
          sÃ³ a trilha, que diz onde se estÃ¡. */}
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 dark:border-white/10 dark:bg-noite-900">
        <TrilhaNavegacao fazenda={fazenda} talhao={talhao} gleba={gleba} />
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {abaAtiva === 'historico' && 'HistÃ³rico'}
          {abaAtiva === 'foto' && 'Perfil do solo'}
          {abaAtiva === 'analises' && `AnÃ¡lises Â· ${analises.length}`}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {/* A foto fica fora do bloco que depende das anÃ¡lises: gleba recÃ©m
            cadastrada nÃ£o tem laudo nenhum, e Ã© justamente onde a foto do
            solo mais serve. Antes, a mensagem de "nenhuma anÃ¡lise" trocava o
            conteÃºdo inteiro e engolia esta aba. */}
        <PainelDeAba chave="foto" ativa={abaAtiva}>
          <div className="mx-auto max-w-xl p-4 sm:p-6">
            <PerfilDoSolo gleba={gleba} fazendaId={fazenda.id} editor={editor} grande />
          </div>
        </PainelDeAba>

        {abaAtiva !== 'foto' &&
          (carregandoAnalises ? (
          <p className="p-6 text-sm text-slate-400 dark:text-slate-500">Carregando anÃ¡lisesâ€¦</p>
        ) : erroAnalises ? (
          <p role="alert" className="m-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
            {erroAnalises}
          </p>
        ) : analises.length === 0 ? (
          <div className="p-6 text-sm">
            <p className="font-medium text-slate-700 dark:text-slate-300">Nenhuma anÃ¡lise nesta gleba ainda.</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Lance o primeiro laudo para comeÃ§ar a acompanhar a evoluÃ§Ã£o do solo.
            </p>
            <Link
              to="/dados"
              className="mt-3 inline-block rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800"
            >
              LanÃ§ar anÃ¡lise
            </Link>
          </div>
        ) : (
          <>
            <PainelDeAba chave="analises" ativa={abaAtiva}>
              <TabelaAnalises analises={analises} />
            </PainelDeAba>

            <PainelDeAba chave="historico" ativa={abaAtiva}>
              <HistoricoGraficos analises={analises} />
            </PainelDeAba>
          </>
          ))}
      </div>
    </div>
  )
}
