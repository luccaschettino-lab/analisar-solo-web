import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PainelDeAba } from '../componentes/Abas.jsx'
import TrilhaNavegacao from './gleba/TrilhaNavegacao.jsx'
import TabelaAnalises from './gleba/TabelaAnalises.jsx'
import HistoricoGraficos from './gleba/HistoricoGraficos.jsx'
import { useGlebaContexto } from '../hooks/useGlebaContexto.js'
import { useAnalises } from '../hooks/useAnalises.js'

const ABAS = [
  { chave: 'analises', rotulo: 'Análises' },
  { chave: 'historico', rotulo: 'Histórico' },
]

function Centralizado({ children }) {
  return <div className="flex h-full items-center justify-center p-6 text-sm">{children}</div>
}

export default function GlebaDetalhe() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const abaAtiva = ABAS.some((a) => a.chave === params.get('aba')) ? params.get('aba') : 'analises'

  const { contexto, carregando, naoEncontrada, erro } = useGlebaContexto(id)
  const {
    analises,
    carregando: carregandoAnalises,
    erro: erroAnalises,
  } = useAnalises(id)

  if (carregando) return <Centralizado>Carregando gleba…</Centralizado>

  if (erro) {
    return (
      <Centralizado>
        <span role="alert" className="text-red-700">
          {erro}
        </span>
      </Centralizado>
    )
  }

  if (naoEncontrada) {
    return (
      <Centralizado>
        <div className="text-center">
          <p className="font-medium text-slate-700">Gleba não encontrada.</p>
          <p className="mt-1 text-slate-500">
            Ela pode ter sido apagada, ou você não tem acesso a esta fazenda.
          </p>
          <Link to="/" className="mt-3 inline-block font-medium text-solo-700 hover:underline">
            Voltar ao mapa
          </Link>
        </div>
      </Centralizado>
    )
  }

  const { fazenda, talhao, gleba } = contexto

  function trocarAba(chave) {
    // `replace` para não empilhar uma entrada de histórico por clique de aba.
    setParams(chave === 'analises' ? {} : { aba: chave }, { replace: true })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sem abas: a barra lateral já leva a Análises e Histórico. Aqui fica
          só a trilha, que diz onde se está. */}
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <TrilhaNavegacao fazenda={fazenda} talhao={talhao} gleba={gleba} />
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          {abaAtiva === 'historico' ? 'Histórico' : `Análises · ${analises.length}`}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {carregandoAnalises ? (
          <p className="p-6 text-sm text-slate-400">Carregando análises…</p>
        ) : erroAnalises ? (
          <p role="alert" className="m-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erroAnalises}
          </p>
        ) : analises.length === 0 ? (
          <div className="p-6 text-sm">
            <p className="font-medium text-slate-700">Nenhuma análise nesta gleba ainda.</p>
            <p className="mt-1 text-slate-500">
              Lance o primeiro laudo para começar a acompanhar a evolução do solo.
            </p>
            <Link
              to="/dados"
              className="mt-3 inline-block rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800"
            >
              Lançar análise
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
        )}
      </div>
    </div>
  )
}
