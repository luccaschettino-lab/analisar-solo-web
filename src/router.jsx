import { lazy, Suspense } from 'react'
import { createHashRouter } from 'react-router-dom'
import { RotaProtegida, RotaPublica } from './componentes/guards.jsx'
import LayoutPublico from './layouts/LayoutPublico.jsx'
import Login from './paginas/Login.jsx'
import Cadastro from './paginas/Cadastro.jsx'
import EsqueciSenha from './paginas/EsqueciSenha.jsx'
import NovaSenha from './paginas/NovaSenha.jsx'
import NaoEncontrado from './paginas/NaoEncontrado.jsx'
import ErroDeRota from './componentes/ErroDeRota.jsx'

// As telas de entrada vão no pacote inicial: são leves e são a primeira coisa
// que aparece. O resto (mapa, gráficos, leitores de arquivo) só é baixado
// quando a pessoa entra no sistema e abre a tela (auditoria P11): antes,
// 1,7 MB de código chegavam antes até do login.
const LayoutApp = lazy(() => import('./layouts/LayoutApp.jsx'))
const Painel = lazy(() => import('./paginas/Painel.jsx'))
const Filtros = lazy(() => import('./paginas/Filtros.jsx'))
const Dados = lazy(() => import('./paginas/Dados.jsx'))
const Comparar = lazy(() => import('./paginas/Comparar.jsx'))
const Monitoramento = lazy(() => import('./paginas/Monitoramento.jsx'))
const Criterios = lazy(() => import('./paginas/Criterios.jsx'))
const GlebaDetalhe = lazy(() => import('./paginas/GlebaDetalhe.jsx'))

function Carregando() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="text-sm text-slate-400">Carregando…</span>
    </div>
  )
}

const comEspera = (Componente) => (
  <Suspense fallback={<Carregando />}>
    <Componente />
  </Suspense>
)

// Modo hash: as URLs ficam .../analisar-solo-web/#/login, então o GitHub Pages
// só precisa servir o index.html da raiz do projeto — nada de 404 em refresh.
export const router = createHashRouter([
  {
    element: <RotaPublica />,
    errorElement: <ErroDeRota />,
    children: [
      {
        element: <LayoutPublico />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/cadastro', element: <Cadastro /> },
          { path: '/esqueci-senha', element: <EsqueciSenha /> },
        ],
      },
    ],
  },
  // Fora das duas guardas: quem abre o link do e-mail já está logado (a
  // RotaPublica o mandaria ao mapa) mas ainda não escolheu a senha nova.
  {
    element: <LayoutPublico />,
    errorElement: <ErroDeRota />,
    children: [{ path: '/nova-senha', element: <NovaSenha /> }],
  },
  {
    element: <RotaProtegida />,
    errorElement: <ErroDeRota />,
    children: [
      {
        element: comEspera(LayoutApp),
        children: [
          { path: '/', element: comEspera(Painel) },
          { path: '/filtros', element: comEspera(Filtros) },
          { path: '/dados', element: comEspera(Dados) },
          { path: '/comparar', element: comEspera(Comparar) },
          { path: '/monitoramento', element: comEspera(Monitoramento) },
          { path: '/criterios', element: comEspera(Criterios) },
          { path: '/glebas/:id', element: comEspera(GlebaDetalhe) },
        ],
      },
    ],
  },
  { path: '*', element: <NaoEncontrado /> },
])
