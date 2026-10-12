import { Outlet } from 'react-router-dom'
import AlternadorTema from '../componentes/AlternadorTema.jsx'
import logoCompleto from '../assets/marca/moinho-completo.jpg'

/**
 * Casca das telas de login/cadastro: a logo do Moinho no alto e o cartão do
 * formulário logo abaixo, centralizados.
 */
export default function LayoutPublico() {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center bg-slate-100 p-4 dark:bg-noite-950 sm:p-8">
      <div className="absolute right-3 top-3 z-10">
        <AlternadorTema />
      </div>

      {/* Plaquinha clara atrás da logo: a arte é sobre fundo branco, feita
          pra superfície clara — no tema escuro ela sumiria sem isso. */}
      <div className="mb-6 rounded-xl bg-white px-5 py-4 shadow-sm">
        <img src={logoCompleto} alt="Moinho Soluções Agronômicas" className="h-28 w-auto sm:h-32" />
      </div>

      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-noite-900">
        <Outlet />
      </div>
    </div>
  )
}
