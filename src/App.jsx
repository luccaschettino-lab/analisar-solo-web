import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { router } from './router.jsx'

// ThemeProvider por fora de tudo: login e cadastro também são tema, não só as
// telas autenticadas. AuthProvider por fora do RouterProvider porque as rotas
// são renderizadas dentro dele, e os guards e páginas enxergam o contexto
// normalmente.
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  )
}
