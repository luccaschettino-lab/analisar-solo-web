import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const CHAVE_ARMAZENAMENTO = 'analisar-solo:tema'

/**
 * Tema padrão é claro. Quem já escolheu um tema antes mantém a escolha
 * (guardada em localStorage); o escuro continua a um clique no alternador.
 */
function lerTemaSalvo() {
  if (typeof window === 'undefined') return 'claro'
  const salvo = window.localStorage.getItem(CHAVE_ARMAZENAMENTO)
  return salvo === 'claro' || salvo === 'escuro' ? salvo : 'claro'
}

/**
 * Tema claro/escuro do app inteiro.
 *
 * A classe `dark` no `<html>` é o que o Tailwind usa para os utilitários
 * `dark:*` — por isso o efeito mora aqui, não em cada componente. Persiste em
 * localStorage para a escolha sobreviver a um F5 ou a uma nova aba.
 */
export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(lerTemaSalvo)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro')
    window.localStorage.setItem(CHAVE_ARMAZENAMENTO, tema)
  }, [tema])

  const valor = useMemo(
    () => ({
      tema,
      setTema,
      alternar: () => setTema((atual) => (atual === 'escuro' ? 'claro' : 'escuro')),
    }),
    [tema],
  )

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>
}

export function useTema() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTema precisa estar dentro de <ThemeProvider>')
  return ctx
}
