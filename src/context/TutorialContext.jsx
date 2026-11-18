import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { lerTutorial, salvarTutorial } from '../dados/perfil.js'

const TutorialContext = createContext(null)

/**
 * Estado do tutorial de primeiro acesso: boas-vindas, dicas de cada tela e a
 * lista de primeiros passos. Mora no perfil (banco), não no navegador: quem
 * já viu no computador não revê no celular.
 *
 * Gravação otimista: a tela muda na hora e o banco é atualizado em seguida.
 * Se gravar falhar, o tutorial só reaparece no próximo acesso — incômodo, não
 * perda de dado, então não vale travar a tela por isso.
 */
export function TutorialProvider({ children }) {
  const { usuario } = useAuth()
  const usuarioId = usuario?.id ?? null
  const [tutorial, setTutorial] = useState(null) // null = carregando
  const [boasVindasAberta, setBoasVindasAberta] = useState(false)
  const atual = useRef({})

  useEffect(() => {
    let ativo = true
    setTutorial(null)
    if (!usuarioId) return
    lerTutorial(usuarioId)
      .then((t) => {
        if (!ativo) return
        atual.current = t
        setTutorial(t)
        if (!t.boasVindasEm) setBoasVindasAberta(true)
      })
      .catch(() => {
        // Sem conseguir ler, não insiste em mostrar o tutorial a cada tela.
        if (ativo) setTutorial({ boasVindasEm: 'indisponivel', dicas: {}, passosFechadosEm: 'indisponivel' })
      })
    return () => {
      ativo = false
    }
  }, [usuarioId])

  const atualizar = useCallback(
    (mudar) => {
      const proximo = mudar(atual.current)
      atual.current = proximo
      setTutorial(proximo)
      if (usuarioId) salvarTutorial(usuarioId, proximo).catch(() => {})
    },
    [usuarioId],
  )

  const valor = useMemo(
    () => ({
      carregado: tutorial !== null,
      boasVindasAberta,
      abrirBoasVindas: () => setBoasVindasAberta(true),
      concluirBoasVindas: () => {
        setBoasVindasAberta(false)
        atualizar((t) => ({ ...t, boasVindasEm: t.boasVindasEm || new Date().toISOString() }))
      },
      dicaVista: (chave) => Boolean(tutorial?.dicas?.[chave]),
      marcarDica: (chave) => atualizar((t) => ({ ...t, dicas: { ...(t.dicas ?? {}), [chave]: true } })),
      passosFechados: Boolean(tutorial?.passosFechadosEm),
      fecharPassos: () => atualizar((t) => ({ ...t, passosFechadosEm: new Date().toISOString() })),
      // "Ver tutorial de novo": dicas e primeiros passos voltam, e as
      // boas-vindas abrem na hora.
      recomecar: () => {
        atualizar((t) => ({ ...t, dicas: {}, passosFechadosEm: null }))
        setBoasVindasAberta(true)
      },
    }),
    [tutorial, boasVindasAberta, atualizar],
  )

  return <TutorialContext.Provider value={valor}>{children}</TutorialContext.Provider>
}

export function useTutorial() {
  const contexto = useContext(TutorialContext)
  if (!contexto) throw new Error('useTutorial precisa estar dentro de TutorialProvider')
  return contexto
}
