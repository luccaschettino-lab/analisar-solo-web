import { Link } from 'react-router-dom'

function formatarArea(ha) {
  if (ha == null) return null
  return `${ha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
}

const BOTAO =
  'rounded border border-slate-300 px-1.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10'

/**
 * Detalhe do talhão selecionado, no rodapé do painel.
 *
 * Fica na coluna do painel em vez de flutuar sobre o mapa: um cartão sobre o
 * mapa taparia justamente a geometria que o usuário acabou de clicar.
 */
export default function PainelDetalhe({
  item,
  editor,
  editandoGeometria,
  gravandoGeometria,
  carregandoExclusao,
  aoEditarDados,
  aoEditarGeometria,
  aoSalvarGeometria,
  aoCancelarGeometria,
  aoExcluir,
  aoFechar,
}) {
  if (!item) return null

  const area = formatarArea(item.area_ha)

  return (
    <div className="px-2.5 py-2">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Talhão
          </p>
          <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
            {item.codigo}
            {item.nome && <span className="font-normal text-slate-500 dark:text-slate-400"> · {item.nome}</span>}
          </p>
        </div>
        <button
          onClick={aoFechar}
          aria-label="Fechar detalhe"
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      <dl className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
        <div className="flex justify-between">
          <dt>Área</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">{area ?? 'sem geometria'}</dd>
        </div>
      </dl>

      {/* Fora do bloco de permissão: consultar análises é leitura, e um
          leitor tem tanto direito a isso quanto um proprietário. */}
      <Link
        to={`/talhoes/${item.id}`}
        className="mt-1.5 block rounded bg-solo-600 px-2 py-1 text-center text-[11px] font-medium text-white transition hover:bg-solo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500"
      >
        Ver análises
      </Link>

      {!editor ? (
        <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          Seu papel nesta fazenda permite apenas consulta.
        </p>
      ) : editandoGeometria ? (
        <div className="mt-1.5 space-y-1.5">
          <p className="rounded border border-solo-100 bg-solo-50 px-1.5 py-1 text-[11px] text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300">
            Arraste os vértices. Clique num vértice para removê-lo.
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={aoSalvarGeometria}
              disabled={gravandoGeometria}
              className="flex-1 rounded bg-solo-600 px-1.5 py-1 text-[11px] font-medium text-white hover:bg-solo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
            >
              {gravandoGeometria ? 'Gravando…' : 'Gravar geometria'}
            </button>
            <button onClick={aoCancelarGeometria} disabled={gravandoGeometria} className={BOTAO}>
              Descartar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button onClick={aoEditarDados} className={BOTAO}>
            Editar dados
          </button>
          <button onClick={aoEditarGeometria} className={BOTAO}>
            Editar geometria
          </button>
          <button
            onClick={aoExcluir}
            disabled={carregandoExclusao}
            className="rounded border border-red-200 px-1.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:border-red-400/30 dark:text-red-400 dark:hover:bg-red-500/10 dark:disabled:border-white/10 dark:disabled:text-slate-500"
          >
            {carregandoExclusao ? 'Verificando…' : 'Excluir'}
          </button>
        </div>
      )}
    </div>
  )
}
