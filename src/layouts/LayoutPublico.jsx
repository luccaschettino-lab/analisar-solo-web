import { Outlet } from 'react-router-dom'
import AlternadorTema from '../componentes/AlternadorTema.jsx'
import IlustracaoFazenda from '../componentes/IlustracaoFazenda.jsx'

/**
 * Casca das telas de login/cadastro.
 *
 * Painel de marca à esquerda (só a partir de md — no celular vira uma faixa
 * baixa no topo, a ilustração inteira não cabe numa tela estreita) e o
 * cartão do formulário à direita. A ilustração é sempre escura, nos dois
 * temas: é marca, não conteúdo de leitura.
 */
export default function LayoutPublico() {
  return (
    <div className="relative flex h-full flex-col bg-slate-100 dark:bg-noite-950 md:flex-row">
      <div className="absolute right-3 top-3 z-10">
        <AlternadorTema />
      </div>

      <div className="relative h-40 shrink-0 overflow-hidden md:h-auto md:w-[55%] md:flex-1">
        <IlustracaoFazenda className="absolute inset-0 h-full w-full" />
        <div className="relative flex h-full flex-col justify-end p-6 sm:p-10 md:justify-center">
          <p className="font-marca text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
            Boss<span className="text-solo-400">-</span>Agro
          </p>
          <p className="mt-2 max-w-sm text-sm text-slate-300 sm:text-base">
            Mapa, análise e histórico do solo — talhão por talhão, safra após safra.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-noite-900">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
