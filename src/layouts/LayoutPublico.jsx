import { Outlet } from 'react-router-dom'
import AlternadorTema from '../componentes/AlternadorTema.jsx'
import logoCompleto from '../assets/marca/moinho-completo.jpg'
// Trigo ao pôr do sol — Unsplash, licença Unsplash (uso comercial livre, sem
// atribuição exigida). https://unsplash.com/photos/AtC1boy0w_I, Wayne Hollman.
import fundoLogin from '../assets/marca/login-fundo.jpg'

/**
 * Casca das telas de login/cadastro.
 *
 * Painel de marca à esquerda (só a partir de md — no celular vira uma faixa
 * baixa no topo, a foto inteira não cabe numa tela estreita) e o cartão do
 * formulário à direita.
 */
export default function LayoutPublico() {
  return (
    <div className="relative flex h-full flex-col bg-slate-100 dark:bg-noite-950 md:flex-row">
      <div className="absolute right-3 top-3 z-10">
        <AlternadorTema />
      </div>

      <div className="relative h-40 shrink-0 overflow-hidden md:h-auto md:w-[55%] md:flex-1">
        <img
          src={fundoLogin}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Escurece a foto o bastante pra logo e o texto claro lerem em cima
            dela — forte embaixo, onde o conteúdo fica ancorado nas duas
            larguras (centralizar no meio do painel em telas grandes caía bem
            no ponto mais fraco do degradê, e o texto quase sumia). */}
        <div className="absolute inset-0 bg-gradient-to-t from-noite-950/95 via-noite-950/55 to-noite-950/10" />
        <div className="relative flex h-full flex-col justify-end p-6 sm:p-10 md:p-14">
          {/* Plaquinha clara atrás da logo: a arte é sobre fundo branco,
              feita pra superfície clara — direto sobre a foto ela sumiria. */}
          <div className="inline-block w-fit rounded-xl bg-white/95 px-5 py-4 shadow-painel">
            <img src={logoCompleto} alt="Moinho Soluções Agronômicas" className="h-28 w-auto sm:h-36 md:h-44" />
          </div>
          <p className="mt-4 max-w-sm text-base font-medium text-white drop-shadow-md sm:text-lg">
            Mapa, análise e histórico do solo — talhão por talhão, safra após safra.
          </p>
        </div>
      </div>

      {/* items-start no celular: centralizar na sobra depois de um banner de
          160px deixava um vão enorme antes do cartão. A partir de md o
          painel de marca já ocupa a altura toda, então centralizar de novo
          faz sentido. */}
      <div className="flex flex-1 items-start justify-center p-4 pt-10 sm:p-8 md:items-center md:pt-8">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-noite-900">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
