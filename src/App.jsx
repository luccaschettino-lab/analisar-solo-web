import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { router } from './router.jsx'

// AuthProvider por fora do RouterProvider: as rotas são renderizadas dentro
// dele, então os guards e as páginas enxergam o contexto normalmente.
export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
