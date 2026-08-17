/**
 * Abas acessíveis.
 *
 * A aba ativa vive na query string (`?aba=historico`), não em estado local:
 * assim o link de uma gleba pode apontar direto para o histórico, e o botão
 * voltar do navegador se comporta como o usuário espera.
 */
export default function Abas({ abas, ativa, aoTrocar, rotulo = 'Seções' }) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex gap-1 border-b border-slate-200">
      {abas.map((aba) => {
        const selecionada = aba.chave === ativa
        return (
          <button
            key={aba.chave}
            role="tab"
            aria-selected={selecionada}
            aria-controls={`painel-${aba.chave}`}
            id={`aba-${aba.chave}`}
            onClick={() => aoTrocar(aba.chave)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600 ${
              selecionada
                ? 'border-solo-700 text-solo-800'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            {aba.rotulo}
            {aba.contador != null && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {aba.contador}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function PainelDeAba({ chave, ativa, children }) {
  if (chave !== ativa) return null
  return (
    <div role="tabpanel" id={`painel-${chave}`} aria-labelledby={`aba-${chave}`} tabIndex={0}>
      {children}
    </div>
  )
}
