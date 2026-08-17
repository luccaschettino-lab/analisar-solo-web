import { useEffect, useRef } from 'react'

/**
 * Diálogo modal simples. Fecha no Esc e no clique fora.
 *
 * Não usa <dialog> nativo porque ele renderiza na top layer, acima de tudo —
 * inclusive dos controles do Leaflet — e o mapa precisa continuar visível e
 * clicável atrás em alguns fluxos (marcar centro, conferir o desenho).
 */
export default function Modal({ titulo, aoFechar, children, largura = 'max-w-md' }) {
  const caixaRef = useRef(null)

  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  useEffect(() => {
    // Foco no primeiro campo: quem abriu o modal pelo teclado não deveria
    // precisar tabular até lá.
    const alvo = caixaRef.current?.querySelector('input, select, textarea, button')
    alvo?.focus()
  }, [])

  // z-[2000] fica acima de 1000, que é o z-index dos containers de controle
  // do Leaflet (.leaflet-top / .leaflet-bottom). Empatar deixaria o seletor
  // de camadas por cima do diálogo.
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => {
        // mouseDown e não click: um arraste que começa dentro e termina fora
        // não deve fechar o diálogo.
        if (e.target === e.currentTarget) aoFechar()
      }}
    >
      <div
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`w-full ${largura} rounded-xl border border-slate-200 bg-white p-5 shadow-lg`}
      >
        <h2 className="mb-4 text-base font-semibold text-slate-900">{titulo}</h2>
        {children}
      </div>
    </div>
  )
}
