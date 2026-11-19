import { useState } from 'react'

/**
 * Baixa a imagem do que está na tela (talhão, índice e data) em JPG de
 * relatório: foto de satélite de fundo, índice, legenda, logo do Moinho.
 */
export default function BaixarImagem({ fazenda, talhao, dados, indice, data, desativado }) {
  const [estado, setEstado] = useState(null) // null | 'gerando' | mensagem de erro

  async function baixar() {
    setEstado('gerando')
    try {
      const { prepararFundo, desenharImagemDoTalhao, nomeDaImagem } = await import('../../lib/exportar/imagemDoTalhao.js')
      const fundo = await prepararFundo(talhao.geometria)
      const blob = await desenharImagemDoTalhao({ fazenda, talhao, fundo, dados: indice ? dados : null, indice, data: indice ? data : null })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nomeDaImagem(talhao, indice, indice ? data : null)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setEstado(null)
    } catch (e) {
      setEstado(e.message || 'Não foi possível gerar a imagem.')
    }
  }

  const gerando = estado === 'gerando'
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={baixar}
        disabled={desativado || gerando}
        title="Baixar esta visão do talhão em JPG, com legenda e a logo do Moinho"
        className="vidro flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 shadow transition hover:text-solo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500 disabled:opacity-50 dark:text-slate-100 dark:hover:text-white"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {gerando ? 'Gerando…' : 'Baixar imagem'}
      </button>
      {estado && !gerando && <p role="alert" className="vidro rounded-md px-2 py-1 text-xs text-red-700 shadow dark:text-red-300">{estado}</p>}
    </div>
  )
}
