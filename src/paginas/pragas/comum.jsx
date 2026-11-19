import { STATUS } from '../../lib/pragas.js'

export const SELECT =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:text-slate-400 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30'
export const INPUT = SELECT
export const BOTAO =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5'
export const BOTAO_PRINCIPAL =
  'rounded-lg bg-solo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-solo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-solo-600 dark:hover:bg-solo-500'
export const BOTAO_PERIGO =
  'rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-500/10'

export function Cartao({ titulo, acao, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 ${className}`}>
      {(titulo || acao) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {titulo && <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  )
}

const ICONE = { controle: '▲', alerta: '●', ok: '✓', 'sem-nivel': '–' }

const ESTILO = {
  controle: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
  alerta: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  ok: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200',
  'sem-nivel': 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
}

/** Semáforo com ícone e texto: a cor nunca vai sozinha. */
export function ChipStatus({ status, pequeno = false }) {
  const s = STATUS[status] ?? STATUS['sem-nivel']
  return (
    <span
      title={s.descricao}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${pequeno ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'} ${ESTILO[status] ?? ESTILO['sem-nivel']}`}
    >
      <span aria-hidden="true">{ICONE[status]}</span>
      {s.rotulo}
    </span>
  )
}

export function Aviso({ tipo = 'erro', children }) {
  const cores =
    tipo === 'erro'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300'
      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200'
  return (
    <p role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${cores}`}>
      {children}
    </p>
  )
}

export const dataBr = (iso) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export function diasDesde(iso) {
  if (!iso) return null
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  return Math.round((hoje - new Date(`${iso.slice(0, 10)}T12:00:00`)) / 86400000)
}

export function textoDias(dias) {
  if (dias == null) return ''
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias} dias`
}

export const hojeIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const rotuloTalhao = (t) => (t ? (t.nome ? `${t.codigo} · ${t.nome}` : t.codigo) : '')
