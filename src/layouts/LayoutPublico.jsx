import { Outlet } from 'react-router-dom'
import AlternadorTema from '../componentes/AlternadorTema.jsx'

// Casca das telas de login/cadastro: cartão centralizado, sem navegação.
export default function LayoutPublico() {
  return (
    <div className="relative flex h-full items-center justify-center bg-slate-100 p-4 dark:bg-noite-950">
      <div className="absolute right-3 top-3">
        <AlternadorTema />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-noite-900">
        <Outlet />
      </div>
    </div>
  )
}
