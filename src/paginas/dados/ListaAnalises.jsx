import { Link } from 'react-router-dom'
import { CHAVES_PARAMETROS, TRACO } from '../../config/parametros.js'
import { formatarValor, temMedicao, parametro } from '../../lib/parametros.js'

// Quais parâmetros aparecem no resumo da linha. Trocar a lista é a única
// edição necessária — rótulo, casas decimais e alinhamento vêm do config.
const RESUMO = ['ph_h2o', 'p', 'k']

// Colunas de texto, à esquerda. As numéricas vêm de RESUMO, à direita.
const COLUNAS_TEXTO = ['Safra', 'Prof.', 'Coleta', 'Amostra', 'Laboratório']

function formatarData(iso) {
  if (!iso) return TRACO
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function contarMedidos(analise) {
  return CHAVES_PARAMETROS.filter((c) => temMedicao(analise[c])).length
}

const BOTAO =
  'rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600 disabled:cursor-not-allowed disabled:text-slate-300'

/**
 * Análises já lançadas na gleba selecionada.
 *
 * Mostra um resumo, não os 24 parâmetros: a tabela completa é a tela da
 * gleba, e repeti-la aqui só faria o formulário sumir da tela.
 */
export default function ListaAnalises({
  gleba,
  analises,
  carregando,
  erro,
  podeEditar,
  emEdicaoId,
  aoEditar,
  aoExcluir,
}) {
  if (!gleba) {
    return (
      <p className="border-t border-slate-200 px-6 py-4 text-sm text-slate-400">
        Escolha a gleba para ver as análises já lançadas.
      </p>
    )
  }

  return (
    <section className="border-t border-slate-200 px-6 py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">
          Análises da gleba {gleba.codigo}
          {gleba.nome && <span className="font-normal text-slate-500"> · {gleba.nome}</span>}
        </h2>
        {analises.length > 0 && (
          <Link
            to={`/glebas/${gleba.id}`}
            className="text-sm font-medium text-solo-700 hover:underline"
          >
            Ver tabela completa e histórico
          </Link>
        )}
      </div>

      {carregando ? (
        <p className="text-sm text-slate-400">Carregando análises…</p>
      ) : erro ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      ) : analises.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhuma análise nesta gleba ainda. Preencha o formulário acima para lançar a
          primeira.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {COLUNAS_TEXTO.map((h) => (
                  <th
                    key={h}
                    className="border-b border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600"
                  >
                    {h}
                  </th>
                ))}
                {RESUMO.map((chave) => (
                  <th
                    key={chave}
                    title={parametro(chave)?.nota ?? undefined}
                    className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600"
                  >
                    {parametro(chave)?.rotulo ?? chave}
                  </th>
                ))}
                <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600">
                  Preenchido
                </th>
                <th className="border-b border-slate-200 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {analises.map((a) => {
                const medidos = contarMedidos(a)
                const editando = a.id === emEdicaoId
                return (
                  <tr
                    key={a.id}
                    className={editando ? 'bg-solo-50' : 'even:bg-slate-50/50'}
                  >
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-medium text-slate-800">
                      {a.ano_safra}
                      {editando && (
                        <span className="ml-2 rounded bg-solo-700 px-1.5 py-0.5 text-xs font-medium text-white">
                          editando
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-slate-600">
                      {a.profundidade} cm
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-slate-500">
                      {formatarData(a.data_coleta)}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-slate-500">
                      {a.numero_amostra_lab || TRACO}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-slate-500">
                      {a.laboratorio || TRACO}
                    </td>
                    {RESUMO.map((chave) => (
                      <td
                        key={chave}
                        className={`whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right tabular-nums ${
                          temMedicao(a[chave]) ? 'text-slate-800' : 'text-slate-300'
                        }`}
                      >
                        {formatarValor(chave, a[chave])}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right text-xs text-slate-500">
                      {medidos}/24
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => aoEditar(a)}
                          disabled={!podeEditar}
                          title={podeEditar ? undefined : 'Seu papel permite apenas consulta'}
                          className={BOTAO}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => aoExcluir(a)}
                          disabled={!podeEditar}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
