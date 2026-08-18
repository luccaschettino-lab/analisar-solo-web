import { createHashRouter } from 'react-router-dom'
import { RotaProtegida, RotaPublica } from './componentes/guards.jsx'
import LayoutPublico from './layouts/LayoutPublico.jsx'
import LayoutApp from './layouts/LayoutApp.jsx'
import Login from './paginas/Login.jsx'
import Cadastro from './paginas/Cadastro.jsx'
import Painel from './paginas/Painel.jsx'
import Dados from './paginas/Dados.jsx'
import Comparar from './paginas/Comparar.jsx'
import Criterios from './paginas/Criterios.jsx'
import GlebaDetalhe from './paginas/GlebaDetalhe.jsx'
import NaoEncontrado from './paginas/NaoEncontrado.jsx'

// Modo hash: as URLs ficam .../analisar-solo-web/#/login, então o GitHub Pages
// só precisa servir o index.html da raiz do projeto — nada de 404 em refresh.
export const router = createHashRouter([
  {
    element: <RotaPublica />,
    children: [
      {
        element: <LayoutPublico />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/cadastro', element: <Cadastro /> },
        ],
      },
    ],
  },
  {
    element: <RotaProtegida />,
    children: [
      {
        element: <LayoutApp />,
        children: [
          { path: '/', element: <Painel /> },
          { path: '/dados', element: <Dados /> },
          { path: '/comparar', element: <Comparar /> },
          { path: '/criterios', element: <Criterios /> },
          { path: '/glebas/:id', element: <GlebaDetalhe /> },
        ],
      },
    ],
  },
  { path: '*', element: <NaoEncontrado /> },
])
