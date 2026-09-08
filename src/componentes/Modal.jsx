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
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
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
        className={`vidro-forte w-full ${largura} motion-safe:animate-modal-entrada overflow-hidden rounded-xl border border-slate-200 shadow-painel dark:border-white/10`}
      >
        <div className="h-1 bg-gradient-to-r from-solo-600 to-solo-400" aria-hidden="true" />
        <div className="p-5">
          <h2 className="mb-4 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {titulo}
          </h2>
          {children}
        </div>
      </div>
    </div>
  )
}
