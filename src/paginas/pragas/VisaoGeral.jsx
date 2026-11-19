import { CULTURAS } from '../../config/pragas.js'
import { STATUS, formatarValor } from '../../lib/pragas.js'
import { ChipStatus, dataBr, diasDesde, textoDias, rotuloTalhao } from './comum.jsx'

/** Vistoria com mais de 14 dias: o semáforo pode não valer mais. */
const DIAS_VELHA = 14

/**
 * Visão da fazenda: cada talhão com o semáforo da última vistoria e as
 * pragas que mais pesam. Os piores primeiro.
 */
export default function VisaoGeral({ talhoes, vistorias, resumos, aoAbrir }) {
  const ultima = new Map()
  for (const v of vistorias) if (!ultima.has(v.talhao_id)) ultima.set(v.talhao_id, v) // já vêm da mais recente

  const itens = talhoes
    .map((t) => {
      const v = ultima.get(t.id) ?? null
      const r = v ? resumos.get(v.id) : null
      return { talhao: t, vistoria: v, resumo: r, ordem: r ? STATUS[r.pior].ordem : -1 }
    })
    .sort((a, b) => b.ordem - a.ordem || String(a.talhao.codigo).localeCompare(String(b.talhao.codigo), 'pt-BR', { numeric: true }))

  const contagem = { controle: 0, alerta: 0, ok: 0, sem: 0 }
  for (const i of itens) {
    if (!i.resumo) contagem.sem++
    else if (i.resumo.pior === 'controle') contagem.controle++
    else if (i.resumo.pior === 'alerta') contagem.alerta++
    else contagem.ok++
  }

  if (talhoes.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Esta fazenda ainda não tem talhões.</p>
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['controle', 'Agir', contagem.controle],
          ['alerta', 'Atenção', contagem.alerta],
          ['ok', 'Tranquilo', contagem.ok],
          [null, 'Sem vistoria', contagem.sem],
        ].map(([status, rotulo, n]) => (
          <div key={rotulo} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {status && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[status].cor }} />}
              {rotulo}
            </dt>
            <dd className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {n} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{n === 1 ? 'talhão' : 'talhões'}</span>
            </dd>
          </div>
        ))}
      </dl>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {itens.map(({ talhao, vistoria, resumo }) => {
          const dias = vistoria ? diasDesde(vistoria.data) : null
          const principais = resumo ? resumo.linhas.filter((l) => l.status !== 'ok' || l.valor > 0).slice(0, 3) : []
          return (
            <li key={talhao.id}>
              <button
                type="button"
                onClick={() => aoAbrir(talhao.id)}
                className="h-full w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-solo-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500 dark:border-white/10 dark:bg-white/5 dark:hover:border-solo-500/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Talhão {rotuloTalhao(talhao)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {vistoria
                        ? `${CULTURAS.find((c) => c.chave === vistoria.cultura)?.rotulo ?? ''}${vistoria.estadio ? ` · ${vistoria.estadio}` : ''} · ${dataBr(vistoria.data)} (${textoDias(dias)})`
                        : 'Nenhuma vistoria ainda'}
                    </p>
                  </div>
                  {resumo && <ChipStatus status={resumo.pior} />}
                </div>
                {vistoria && dias > DIAS_VELHA && (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">Última vistoria há mais de {DIAS_VELHA} dias.</p>
                )}
                {principais.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {principais.map((l) => (
                      <li key={`${l.praga}|${l.metodo}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-slate-700 dark:text-slate-200">{l.nome}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="tabular-nums text-slate-600 dark:text-slate-300">{formatarValor(l.valor, l.metodo)}</span>
                          <ChipStatus status={l.status} pequeno />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  vistoria && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Nada encontrado na última vistoria.</p>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
