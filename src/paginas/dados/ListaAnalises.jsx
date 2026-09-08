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
  'rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600 disabled:cursor-not-allowed disabled:text-slate-300 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10 dark:disabled:text-slate-600'

/**
 * Análises já lançadas no talhão selecionado.
 *
 * Mostra um resumo, não os 24 parâmetros: a tabela completa é a tela do
 * talhão, e repeti-la aqui só faria o formulário sumir da tela. Um talhão
 * pode ter várias linhas na mesma safra/profundidade — uma por ponto de
 * coleta, e cada uma é uma amostra própria, não uma repetição.
 */
export default function ListaAnalises({
  talhao,
  analises,
  carregando,
  erro,
  podeEditar,
  emEdicaoId,
  aoEditar,
  aoExcluir,
}) {
  if (!talhao) {
    return (
      <p className="border-t border-slate-200 px-6 py-4 text-sm text-slate-400 dark:border-white/10 dark:text-slate-500">
        Escolha o talhão para ver as análises já lançadas.
      </p>
    )
  }

  return (
    <section className="border-t border-slate-200 px-6 py-4 dark:border-white/10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Análises do talhão {talhao.codigo}
          {talhao.nome && <span className="font-normal text-slate-500 dark:text-slate-400"> · {talhao.nome}</span>}
        </h2>
        {analises.length > 0 && (
          <Link
            to={`/talhoes/${talhao.id}`}
            className="text-sm font-medium text-solo-700 hover:underline dark:text-solo-400"
          >
            Ver tabela completa e histórico
          </Link>
        )}
      </div>

      {carregando ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Carregando análises…</p>
      ) : erro ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
          {erro}
        </p>
      ) : analises.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma análise neste talhão ainda. Preencha o formulário acima para lançar a
          primeira.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr>
                {COLUNAS_TEXTO.map((h) => (
                  <th
                    key={h}
                    className="border-b border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-400"
                  >
                    {h}
                  </th>
                ))}
                {RESUMO.map((chave) => (
                  <th
                    key={chave}
                    title={parametro(chave)?.nota ?? undefined}
                    className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-400"
                  >
                    {parametro(chave)?.rotulo ?? chave}
                  </th>
                ))}
                <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-400">
                  Preenchido
                </th>
                <th className="border-b border-slate-200 px-3 py-2 dark:border-white/10" />
              </tr>
            </thead>
            <tbody>
              {analises.map((a) => {
                const medidos = contarMedidos(a)
                const editando = a.id === emEdicaoId
                return (
                  <tr
                    key={a.id}
                    className={editando ? 'bg-solo-50 dark:bg-solo-500/10' : 'even:bg-slate-50/50 dark:even:bg-white/5'}
                  >
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-medium text-slate-800 dark:border-white/10 dark:text-slate-200">
                      {a.ano_safra}
                      {editando && (
                        <span className="ml-2 rounded bg-solo-700 px-1.5 py-0.5 text-xs font-medium text-white">
                          editando
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-slate-600 dark:border-white/10 dark:text-slate-400">
                      {a.profundidade} cm
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-slate-500 dark:border-white/10 dark:text-slate-400">
                      {formatarData(a.data_coleta)}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-slate-500 dark:border-white/10 dark:text-slate-400">
                      {a.numero_amostra_lab || TRACO}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-slate-500 dark:border-white/10 dark:text-slate-400">
                      {a.laboratorio || TRACO}
                    </td>
                    {RESUMO.map((chave) => (
                      <td
                        key={chave}
                        className={`whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right tabular-nums dark:border-white/10 ${
                          temMedicao(a[chave]) ? 'text-slate-800 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'
                        }`}
                      >
                        {formatarValor(chave, a[chave])}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                      {medidos}/24
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right dark:border-white/10">
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
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/10 dark:disabled:border-white/10 dark:disabled:text-slate-600"
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
