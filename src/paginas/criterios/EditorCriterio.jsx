import { useState } from 'react'
import { GRUPOS } from '../../config/parametros.js'
import { parametrosDoGrupo } from '../../lib/parametros.js'
import { origemDasFaixas, ORIGEM } from '../../lib/criterios.js'
import EditorParametro from './EditorParametro.jsx'

/**
 * Os 24 parâmetros agrupados, um editor por parâmetro.
 *
 * Os grupos abrem fechados. Vinte e quatro editores abertos de uma vez dariam
 * uma página de rolagem infinita em que não se acha nada — e o uso real é
 * ajustar dois ou três parâmetros, não os vinte e quatro.
 *
 * Cada grupo mostra quantos parâmetros dele o conjunto já toca, para o que foi
 * personalizado ser encontrável sem abrir tudo.
 */
export default function EditorCriterio({ parametros, aoMudar, problemas, somenteLeitura }) {
  const [abertos, setAbertos] = useState(() => new Set())

  function alternar(chave) {
    setAbertos((atual) => {
      const proximo = new Set(atual)
      proximo.has(chave) ? proximo.delete(chave) : proximo.add(chave)
      return proximo
    })
  }

  return (
    <div className="space-y-2">
      {GRUPOS.map((grupo) => {
        const doGrupo = parametrosDoGrupo(grupo.chave)
        const aberto = abertos.has(grupo.chave)

        const tocados = doGrupo.filter(
          (p) => origemDasFaixas(p.chave, parametros) !== ORIGEM.CONFIG,
        ).length
        const comErro = doGrupo.filter((p) => problemas?.[p.chave]?.erros?.length).length

        return (
          <section key={grupo.chave} className="rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => alternar(grupo.chave)}
              aria-expanded={aberto}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <span aria-hidden="true" className="w-3 text-xs text-slate-400">
                {aberto ? '▾' : '▸'}
              </span>
              {grupo.rotulo}
              <span className="ml-auto flex items-center gap-2 text-xs font-normal">
                {comErro > 0 && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">
                    {comErro} com erro
                  </span>
                )}
                {tocados > 0 && (
                  <span className="rounded bg-solo-50 px-1.5 py-0.5 text-solo-800">
                    {tocados} personalizado{tocados > 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-slate-400">{doGrupo.length}</span>
              </span>
            </button>

            {aberto && (
              <div className="space-y-2 border-t border-slate-100 p-3">
                {doGrupo.map((p) => (
                  <EditorParametro
                    key={p.chave}
                    chave={p.chave}
                    criterio={parametros}
                    aoMudar={aoMudar}
                    problemas={problemas?.[p.chave]}
                    somenteLeitura={somenteLeitura}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
