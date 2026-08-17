import { useEffect, useState } from 'react'
import { glebasDoTalhao } from '../../hooks/useHierarquia.js'

function formatarArea(ha) {
  if (ha == null) return null
  return `${ha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
}

// Foco visível em tudo que é navegável por teclado — o painel inteiro é uma
// lista de alvos de clique, e sem isso a navegação por Tab fica cega.
const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600'

export default function ArvoreHierarquia({
  talhoes,
  glebas,
  selecionado,
  aoSelecionar,
  aoNovoTalhao,
  aoNovaGleba,
  editor,
  carregando,
  erro,
}) {
  const [abertos, setAbertos] = useState(() => new Set())

  // Abre o talhão do item selecionado: clicar numa gleba no mapa deveria
  // revelá-la na árvore, não deixá-la escondida sob um nó fechado.
  useEffect(() => {
    if (!selecionado) return
    const idTalhao =
      selecionado.tipo === 'talhao'
        ? selecionado.id
        : glebas.find((g) => g.id === selecionado.id)?.talhao_id
    if (idTalhao) setAbertos((atual) => new Set(atual).add(idTalhao))
  }, [selecionado, glebas])

  function alternar(id) {
    setAbertos((atual) => {
      const proximo = new Set(atual)
      proximo.has(id) ? proximo.delete(id) : proximo.add(id)
      return proximo
    })
  }

  if (carregando) {
    return <p className="px-4 py-3 text-sm text-slate-400">Carregando talhões…</p>
  }

  if (erro) {
    return (
      <p role="alert" className="mx-4 my-3 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-sm text-red-700">
        {erro}
      </p>
    )
  }

  if (talhoes.length === 0) {
    return (
      <div className="space-y-3 px-4 py-4">
        <p className="text-sm text-slate-500">
          Nenhum talhão nesta fazenda. Desenhe o primeiro no mapa para começar a
          organizar as coletas.
        </p>
        {editor && (
          <button
            onClick={aoNovoTalhao}
            className={`w-full rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800 ${FOCO}`}
          >
            Desenhar talhão
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-4 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Talhões
        </h3>
        {editor && (
          <button
            onClick={aoNovoTalhao}
            className={`rounded px-2 py-1 text-xs font-medium text-solo-700 hover:bg-solo-50 ${FOCO}`}
          >
            + Talhão
          </button>
        )}
      </div>

      <ul>
        {talhoes.map((talhao) => {
          const filhas = glebasDoTalhao(glebas, talhao.id)
          const aberto = abertos.has(talhao.id)
          const ativo = selecionado?.tipo === 'talhao' && selecionado.id === talhao.id

          return (
            <li key={talhao.id}>
              <div
                className={`flex items-stretch gap-1 border-l-4 pr-2 transition-colors ${
                  ativo ? 'bg-solo-50' : 'hover:bg-slate-50'
                }`}
                style={{ borderLeftColor: talhao.cor }}
              >
                <button
                  onClick={() => alternar(talhao.id)}
                  aria-expanded={aberto}
                  aria-label={aberto ? `Recolher talhão ${talhao.codigo}` : `Expandir talhão ${talhao.codigo}`}
                  className={`w-6 shrink-0 text-xs text-slate-400 hover:text-slate-700 ${FOCO}`}
                >
                  {aberto ? '▾' : '▸'}
                </button>

                <button
                  onClick={() => aoSelecionar({ tipo: 'talhao', id: talhao.id })}
                  className={`flex-1 py-2 text-left ${FOCO}`}
                >
                  <span className="block text-sm font-medium text-slate-800">
                    {talhao.codigo}
                    {talhao.nome && <span className="font-normal text-slate-500"> · {talhao.nome}</span>}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {filhas.length === 0
                      ? 'sem glebas'
                      : `${filhas.length} ${filhas.length === 1 ? 'gleba' : 'glebas'}`}
                    {formatarArea(talhao.area_ha) && ` · ${formatarArea(talhao.area_ha)}`}
                  </span>
                </button>
              </div>

              {aberto && (
                <ul className="bg-slate-50/60">
                  {filhas.map((gleba) => {
                    const glebaAtiva = selecionado?.tipo === 'gleba' && selecionado.id === gleba.id
                    return (
                      <li key={gleba.id}>
                        <button
                          onClick={() => aoSelecionar({ tipo: 'gleba', id: gleba.id })}
                          className={`w-full py-1.5 pl-12 pr-3 text-left ${FOCO} ${
                            glebaAtiva ? 'bg-amber-100' : 'hover:bg-slate-100'
                          }`}
                        >
                          <span className="block text-sm text-slate-700">
                            {gleba.codigo}
                            {gleba.nome && <span className="text-slate-500"> · {gleba.nome}</span>}
                          </span>
                          <span className="block text-xs text-slate-400">
                            {gleba.area_ha != null ? formatarArea(gleba.area_ha) : 'ponto de coleta'}
                          </span>
                        </button>
                      </li>
                    )
                  })}

                  {editor && (
                    <li>
                      <button
                        onClick={() => aoNovaGleba(talhao.id)}
                        className={`w-full py-1.5 pl-12 pr-3 text-left text-xs font-medium text-solo-700 hover:bg-solo-50 ${FOCO}`}
                      >
                        + Gleba neste talhão
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
