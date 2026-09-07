import { useTema } from '../context/ThemeContext.jsx'

/**
 * Alterna entre tema claro e escuro. Mora no header porque é a única barra
 * presente em toda tela autenticada — um lugar só de configuração, sem
 * precisar de uma página dedicada para uma escolha binária.
 */
export default function AlternadorTema() {
  const { tema, alternar } = useTema()
  const escuro = tema === 'escuro'

  return (
    <button
      onClick={alternar}
      role="switch"
      aria-checked={escuro}
      aria-label={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={escuro ? 'Tema escuro' : 'Tema claro'}
      className="flex min-h-11 min-w-11 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100 sm:min-h-0 sm:min-w-0 sm:p-1.5"
    >
      <span aria-hidden="true">{escuro ? '☀' : '☾'}</span>
    </button>
  )
}
