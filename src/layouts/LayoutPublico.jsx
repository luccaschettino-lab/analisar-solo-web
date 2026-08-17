import { Outlet } from 'react-router-dom'

// Casca das telas de login/cadastro: cartão centralizado, sem navegação.
export default function LayoutPublico() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Outlet />
      </div>
    </div>
  )
}
