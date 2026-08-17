import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './componentes/ErrorBoundary.jsx'
import ErroFatal from './componentes/ErroFatal.jsx'
import { erroConfiguracao } from './lib/supabase.js'
import './index.css'

// Configuracao ausente e checada antes de montar o App: sem cliente Supabase
// nenhuma tela funciona, e o error boundary nao alcancaria uma falha ocorrida
// durante o import dos modulos.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {erroConfiguracao ? (
      <ErroFatal titulo="Configuração incompleta" detalhe={erroConfiguracao} />
    ) : (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )}
  </React.StrictMode>,
)
