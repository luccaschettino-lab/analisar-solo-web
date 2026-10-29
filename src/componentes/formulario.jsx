import { useState } from 'react'
import { IconeOlho, IconeOlhoRiscado } from './icones.jsx'

/**
 * `icone` e `grande` são opt-in, usados só nas telas de login/cadastro; sem
 * eles o campo é o mesmo de sempre. Em campo `password` com `icone`, aparece o
 * botão de mostrar/ocultar a senha.
 */
export function Campo({ id, rotulo, icone, grande, acao, type, ...props }) {
  const [visivel, setVisivel] = useState(false)
  const ehSenha = type === 'password'

  const base =
    'w-full border border-slate-300 text-sm outline-none transition hover:border-slate-400 focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:hover:border-slate-300 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:hover:border-white/25 dark:focus:border-solo-500 dark:focus:ring-solo-500/30 dark:disabled:bg-white/5 dark:disabled:hover:border-white/15'
  const tamanho = grande ? 'h-14 rounded-xl text-base' : 'rounded-md py-2'
  const recuo = `${icone ? 'pl-11' : 'px-3'} ${icone && ehSenha ? 'pr-12' : icone ? 'pr-3' : ''}`

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {rotulo}
        </label>
        {acao}
      </div>
      <div className="relative">
        {icone && (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400 dark:text-slate-400">
            {icone}
          </span>
        )}
        <input
          id={id}
          type={ehSenha && visivel ? 'text' : type}
          className={`${base} ${tamanho} ${recuo}`}
          {...props}
        />
        {icone && ehSenha && (
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visivel}
            className="absolute inset-y-0 right-2 my-auto flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-solo-500/40"
          >
            {visivel ? <IconeOlhoRiscado /> : <IconeOlho />}
          </button>
        )}
      </div>
    </div>
  )
}

/** `tom="folha"` é o verde das telas de entrada; o padrão segue o azul da marca. */
export function BotaoPrincipal({ children, tom = 'solo', grande, ...props }) {
  const cores =
    tom === 'folha'
      ? 'bg-folha-700 hover:bg-folha-800 focus:ring-folha-500/40 dark:bg-folha-700 dark:hover:bg-folha-800 dark:focus:ring-folha-500/40'
      : 'bg-solo-700 hover:bg-solo-800 focus:ring-solo-100 dark:bg-solo-600 dark:hover:bg-solo-700 dark:focus:ring-solo-500/30'
  const tamanho = grande ? 'h-14 rounded-xl text-base font-semibold' : 'rounded-md px-3 py-2 text-sm font-medium'
  return (
    <button
      className={`flex w-full items-center justify-center gap-2 text-white shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 active:shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-600 ${tamanho} ${cores}`}
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

/** Cabeçalho das telas de entrada: filete verde + rótulo, título grande e apoio. */
export function CabecalhoEntrada({ rotulo, titulo, apoio }) {
  return (
    <header className="space-y-3">
      <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-folha-300">
        <span className="h-px w-8 bg-folha-300" aria-hidden="true" />
        {rotulo}
      </p>
      <h1 className="text-4xl font-extrabold tracking-tight text-white">{titulo}</h1>
      {apoio && <p className="text-base text-slate-400">{apoio}</p>}
    </header>
  )
}
