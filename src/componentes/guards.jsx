import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function Carregando() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="text-sm text-slate-400">Carregando…</span>
    </div>
  )
}

// Área autenticada. Enquanto a sessão não foi resolvida não redireciona:
// decidir cedo demais expulsaria um usuário logado a cada F5.
export function RotaProtegida() {
  const { sessao, carregando } = useAuth()
  const local = useLocation()

  if (carregando) return <Carregando />
  if (!sessao) {
    // Guarda a rota tentada para voltar a ela depois do login.
    return <Navigate to="/login" replace state={{ de: local.pathname }} />
  }
  return <Outlet />
}

// Login e cadastro: quem já tem sessão não deveria ver estas telas.
export function RotaPublica() {
  const { sessao, carregando } = useAuth()

  if (carregando) return <Carregando />
  if (sessao) return <Navigate to="/" replace />
  return <Outlet />
}
