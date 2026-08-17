import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PainelDeAba } from '../componentes/Abas.jsx'
import ConfirmarExclusao from '../componentes/ConfirmarExclusao.jsx'
import ImportarPdf from '../features/importacao/pdf/ImportarPdf.jsx'
import FormAnalise from './dados/FormAnalise.jsx'
import ListaAnalises from './dados/ListaAnalises.jsx'
import { useSelecaoGleba } from './dados/useSelecaoGleba.js'
import { useAnalises } from '../hooks/useAnalises.js'
import { useAviso } from '../hooks/useAviso.js'
import { excluirAnalise } from '../dados/analises.js'

const ABAS = [
  { chave: 'manual', rotulo: 'Entrada manual' },
  { chave: 'pdf', rotulo: 'Importar laudo PDF' },
]

export default function Dados() {
  const [params, setParams] = useSearchParams()
  const abaAtiva = ABAS.some((a) => a.chave === params.get('aba')) ? params.get('aba') : 'manual'

  const selecao = useSelecaoGleba()
  const { analises, carregando, erro, aplicar, remover } = useAnalises(selecao.glebaId || null)

  const [emEdicao, setEmEdicao] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const { aviso, mostrar: mostrarAviso } = useAviso()

  const topoRef = useRef(null)

  function trocarAba(chave) {
    // `replace` para não empilhar uma entrada de histórico por clique de aba.
    setParams(chave === 'manual' ? {} : { aba: chave }, { replace: true })
  }

  function editar(analise) {
    setEmEdicao(analise)
    // O formulário fica acima da listagem; sem rolar, o usuário clica em
    // "Editar" e a tela não muda visivelmente.
    topoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function aoSalvar(analise, acao, idRemovido) {
    aplicar(analise)
    // Substituição que moveu uma análise para uma chave ocupada remove a origem.
    if (idRemovido) remover(idRemovido)
    setEmEdicao(null)
    mostrarAviso(`Análise ${analise.ano_safra} · ${analise.profundidade} cm ${acao}.`)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 pt-4">
        <h1 className="text-base font-semibold text-slate-900">Dados de análise</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Lance os laudos do laboratório para acompanhar a evolução de cada gleba.
        </p>
        {/* Sem abas: a barra lateral já leva às duas formas de entrada. */}
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          {abaAtiva === 'pdf' ? 'Importar laudo PDF' : 'Entrada manual'}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div ref={topoRef} />

        <PainelDeAba chave="manual" ativa={abaAtiva}>
          <FormAnalise
            selecao={selecao}
            emEdicao={emEdicao}
            aoSalvar={aoSalvar}
            aoCancelarEdicao={() => setEmEdicao(null)}
          />

          <ListaAnalises
            gleba={selecao.gleba}
            analises={analises}
            carregando={carregando}
            erro={erro}
            podeEditar={selecao.podeLancar}
            emEdicaoId={emEdicao?.id ?? null}
            aoEditar={editar}
            aoExcluir={setExcluindo}
          />
        </PainelDeAba>

        <PainelDeAba chave="pdf" ativa={abaAtiva}>
          <ImportarPdf />
        </PainelDeAba>
      </div>

      {excluindo && (
        <ConfirmarExclusao
          titulo={`Excluir a análise de ${excluindo.ano_safra}?`}
          descricao={`Profundidade ${excluindo.profundidade} cm. Os valores desse laudo serão perdidos e a série histórica da gleba fica com um ano a menos. Não há como desfazer.`}
          aoFechar={() => setExcluindo(null)}
          aoConfirmar={async () => {
            await excluirAnalise(excluindo.id)
            remover(excluindo.id)
            // Excluir a análise aberta no formulário deixaria a edição órfã.
            if (emEdicao?.id === excluindo.id) setEmEdicao(null)
            setExcluindo(null)
            mostrarAviso('Análise excluída.')
          }}
        />
      )}

      {aviso && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[1100] -translate-x-1/2 rounded-md bg-slate-900/85 px-3 py-2 text-sm text-white shadow"
        >
          {aviso}
        </div>
      )}
    </div>
  )
}
