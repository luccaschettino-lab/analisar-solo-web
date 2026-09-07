import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FazendaProvider } from '../context/FazendaContext.jsx'
import AlternadorTema from '../componentes/AlternadorTema.jsx'
import BarraLateral from './BarraLateral.jsx'

export default function LayoutApp() {
  const { usuario, sair } = useAuth()
  const [saindo, setSaindo] = useState(false)
  const [erro, setErro] = useState('')
  // Só no celular: em tela larga a barra é fixa e não recolhe.
  const [gavetaAberta, setGavetaAberta] = useState(false)

  const identificacao = usuario?.user_metadata?.nome || usuario?.email

  async function aoSair() {
    setErro('')
    setSaindo(true)
    try {
      await sair()
      // Em caso de sucesso o botão não volta a ficar habilitado: o
      // onAuthStateChange derruba a sessão e o guard troca de tela.
    } catch (e) {
      setErro(e.message)
      setSaindo(false)
    }
  }

  return (
    <FazendaProvider>
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-noite-950 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setGavetaAberta(true)}
              aria-label="Abrir navegação"
              className="min-h-11 min-w-11 rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 md:hidden"
            >
              ☰
            </button>
            <span className="truncate text-sm font-semibold text-solo-700 dark:text-solo-500">Analisar Solo</span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {erro && (
              <span role="alert" className="text-sm text-red-700 dark:text-red-400">
                {erro}
              </span>
            )}
            <span className="hidden max-w-[16ch] truncate text-sm text-slate-500 dark:text-slate-400 sm:inline">
              {identificacao}
            </span>
            <AlternadorTema />
            <button
              onClick={() => aoSair()}
              disabled={saindo}
              className="min-h-11 px-2 text-sm font-medium text-slate-600 transition hover:text-solo-700 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-slate-300 dark:hover:text-solo-500 dark:disabled:text-slate-600 sm:min-h-0 sm:px-0"
            >
              {saindo ? 'Saindo…' : 'Sair'}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Coluna fixa a partir de md. */}
          <aside className="hidden w-56 shrink-0 border-r border-slate-200 dark:border-white/10 dark:bg-noite-900 md:block">
            <BarraLateral />
          </aside>

          {/* Gaveta no celular. */}
          {gavetaAberta && (
            <>
              <div
                onClick={() => setGavetaAberta(false)}
                aria-hidden="true"
                className="fixed inset-0 z-[1900] bg-slate-900/30 md:hidden"
              />
              <aside className="fixed inset-y-0 left-0 z-[1950] w-[85%] max-w-xs border-r border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-noite-900 md:hidden">
                <BarraLateral aoNavegar={() => setGavetaAberta(false)} />
              </aside>
            </>
          )}

          {/* min-h-0 e min-w-0 deixam o filho encolher dentro do flex; sem
              isso o mapa e as tabelas largas estouram o container. */}
          <main className="min-h-0 min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </FazendaProvider>
  )
}
