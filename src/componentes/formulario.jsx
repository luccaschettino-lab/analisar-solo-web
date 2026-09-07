export function Campo({ id, rotulo, ...props }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {rotulo}
      </label>
      <input
        id={id}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30 dark:disabled:bg-white/5"
        {...props}
      />
    </div>
  )
}

export function BotaoPrincipal({ children, ...props }) {
  return (
    <button
      className="w-full rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-solo-800 focus:outline-none focus:ring-2 focus:ring-solo-100 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-solo-600 dark:hover:bg-solo-700 dark:focus:ring-solo-500/30 dark:disabled:bg-slate-600"
      {...props}
    >
      {children}
    </button>
  )
}

// role="alert" para que leitores de tela anunciem o erro sem mover o foco.
export function Aviso({ tipo = 'erro', children }) {
  if (!children) return null
  const estilos =
    tipo === 'erro'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300'
      : 'border-solo-100 bg-solo-50 text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300'
  return (
    <p role="alert" className={`rounded-md border px-3 py-2 text-sm ${estilos}`}>
      {children}
    </p>
  )
}
