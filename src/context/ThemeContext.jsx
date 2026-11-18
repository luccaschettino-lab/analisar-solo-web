import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const CHAVE_ARMAZENAMENTO = 'analisar-solo:tema'

/**
 * Tema padrão é o escuro (pedido de 2026-11-18). Quem já escolheu um tema
 * antes mantém a escolha (guardada em localStorage); o claro continua a um
 * clique no alternador do topo. O index.html aplica o mesmo padrão antes do
 * React carregar, para a tela não piscar branca.
 */
function lerTemaSalvo() {
  if (typeof window === 'undefined') return 'escuro'
  try {
    const salvo = window.localStorage.getItem(CHAVE_ARMAZENAMENTO)
    return salvo === 'claro' || salvo === 'escuro' ? salvo : 'escuro'
  } catch {
    return 'escuro'
  }
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
    try {
      window.localStorage.setItem(CHAVE_ARMAZENAMENTO, tema)
    } catch {
      // Sem storage (aba anônima restrita): o tema vale só nesta visita.
    }
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
