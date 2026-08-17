import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const LINKS = [
  { para: '/', rotulo: 'Mapa' },
  { para: '/dados', rotulo: 'Dados' },
]

function classeDoLink({ isActive }) {
  const base =
    'rounded-md px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600'
  return isActive
    ? `${base} bg-solo-50 text-solo-800`
    : `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900`
}

export default function LayoutApp() {
  const { usuario, sair } = useAuth()
  const [saindo, setSaindo] = useState(false)
  const [erro, setErro] = useState('')

  // Nome vem do metadado gravado no cadastro; e-mail e o fallback.
  const identificacao = usuario?.user_metadata?.nome || usuario?.email

  async function aoSair() {
    setErro('')
    setSaindo(true)
    try {
      await sair()
      // Em caso de sucesso nao devolvemos "saindo" para false: o
      // onAuthStateChange derruba a sessao e o guard troca de tela.
      // Reabilitar o botao aqui so criaria um piscar antes do redirect.
    } catch (e) {
      setErro(e.message)
      setSaindo(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          {/* O nome do produto some no celular: os dois links de navegação
              valem mais que a marca numa tela de 360 px. */}
          <span className="hidden text-sm font-semibold text-solo-700 sm:inline">
            Analisar Solo
          </span>
          <nav className="flex items-center gap-1">
            {LINKS.map((l) => (
              // `end` só na raiz: sem isso "/" ficaria ativo em toda rota,
              // porque toda rota começa com barra.
              <NavLink key={l.para} to={l.para} end={l.para === '/'} className={classeDoLink}>
                {l.rotulo}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {erro && (
            <span role="alert" className="text-sm text-red-700">
              {erro}
            </span>
          )}
          {/* Quem está logado importa pouco quando só há uma conta no aparelho,
              e ocupa metade da largura de um celular. */}
          <span className="hidden max-w-[16ch] truncate text-sm text-slate-500 sm:inline">
            {identificacao}
          </span>
          <button
            onClick={() => aoSair()}
            disabled={saindo}
            // min-h-11 ≈ 44 px: alvo de toque mínimo confortável.
            className="min-h-11 px-2 text-sm font-medium text-slate-600 transition hover:text-solo-700 disabled:cursor-not-allowed disabled:text-slate-300 sm:min-h-0 sm:px-0"
          >
            {saindo ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </header>

      {/* min-h-0 deixa o filho encolher dentro do flex; sem isso o mapa
          estoura a altura da janela. A rolagem passa a ser de cada página —
          o mapa não rola, ele redimensiona. */}
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
