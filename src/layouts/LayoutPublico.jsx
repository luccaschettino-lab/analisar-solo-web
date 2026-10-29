import { Link, Outlet, useLocation } from 'react-router-dom'
import AlternadorTema from '../componentes/AlternadorTema.jsx'
import { IconeMapa, IconeFrasco, IconeAjustes } from '../componentes/icones.jsx'
import logoCompleto from '../assets/marca/moinho-completo.jpg'

const DESTAQUES = [
  { Icone: IconeMapa, texto: 'Mapas por gleba' },
  { Icone: IconeFrasco, texto: 'Análise de solo' },
  { Icone: IconeAjustes, texto: 'Taxa variável' },
]

/** Órbitas finas atrás da logo, com dois pontos fixos e um que pulsa. */
function Orbitas() {
  return (
    <svg
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full text-solo-700/40 dark:text-solo-300/25"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <ellipse cx="400" cy="330" rx="330" ry="215" transform="rotate(-8 400 330)" />
        <ellipse cx="400" cy="330" rx="250" ry="150" transform="rotate(-14 400 330)" />
        <ellipse cx="400" cy="330" rx="470" ry="290" transform="rotate(-4 400 330)" opacity="0.6" />
      </g>
      <circle cx="560" cy="205" r="9" className="fill-solo-700 dark:fill-solo-400" />
      <circle cx="170" cy="470" r="7" className="fill-solo-500" />
      <circle cx="745" cy="300" r="5" className="fill-solo-400" />
      <circle cx="560" cy="205" r="9" className="animate-pulso-anel fill-solo-500/50 motion-reduce:hidden" style={{ transformOrigin: '560px 205px' }} />
    </svg>
  )
}

/** Curvas de plantio no canto inferior: um arco verde com linhas de cultivo. */
function Plantio() {
  return (
    <svg
      viewBox="0 0 520 300"
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 left-0 w-[52%] max-w-[560px]"
      preserveAspectRatio="xMinYMax meet"
    >
      <circle cx="-30" cy="520" r="520" className="fill-folha-700" />
      <g fill="none" strokeWidth="5" className="stroke-folha-300">
        <circle cx="-30" cy="520" r="470" />
        <circle cx="-30" cy="520" r="415" />
        <circle cx="-30" cy="520" r="360" />
        <circle cx="-30" cy="520" r="305" />
      </g>
    </svg>
  )
}

/**
 * Casca das telas de entrada: à esquerda a marca e a promessa do produto, à
 * direita o formulário. O painel do formulário é sempre escuro — a classe
 * `dark` nele liga as variantes `dark:` dos campos mesmo com o tema claro.
 * No celular só o painel do formulário aparece, com a logo no alto.
 */
export default function LayoutPublico() {
  const { pathname } = useLocation()
  const noCadastro = pathname === '/cadastro'

  return (
    <div className="grid min-h-full lg:grid-cols-[64fr_36fr]">
      <section className="relative hidden flex-col items-center justify-center overflow-hidden bg-[#edf3fb] px-10 pb-40 pt-12 dark:bg-noite-900 lg:flex">
        <Orbitas />
        <div className="relative z-10 flex max-w-xl flex-col items-center text-center">
          <img
            src={logoCompleto}
            alt="Moinho Soluções Agronômicas"
            className="h-72 w-auto rounded-2xl mix-blend-multiply dark:bg-white dark:p-4 dark:mix-blend-normal xl:h-80"
          />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-noite-800 dark:text-white">
            Do solo à máquina, com precisão.
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Fazendas, talhões e glebas organizados com análise de solo e recomendação em taxa variável.
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-3">
            {DESTAQUES.map(({ Icone, texto }) => (
              <li
                key={texto}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-solo-800 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                <Icone className="h-4 w-4" />
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <Plantio />
      </section>

      <section className="dark flex min-h-full flex-col bg-noite-950 px-6 py-6 text-slate-200 sm:px-12 lg:px-14">
        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <div className="rounded-lg bg-white px-3 py-2 lg:hidden">
            <img src={logoCompleto} alt="Moinho Soluções Agronômicas" className="h-12 w-auto" />
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <p>
              {noCadastro ? 'Já tem conta? ' : 'Novo por aqui? '}
              <Link to={noCadastro ? '/login' : '/cadastro'} className="font-bold text-solo-300 hover:underline">
                {noCadastro ? 'Entrar' : 'Criar conta'}
              </Link>
            </p>
            <div className="rounded-lg border border-white/10 bg-white/5 p-1.5">
              <AlternadorTema />
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Outlet />
        </div>

        <footer className="text-sm text-slate-400">© {new Date().getFullYear()} Moinho Soluções Agronômicas</footer>
      </section>
    </div>
  )
}
