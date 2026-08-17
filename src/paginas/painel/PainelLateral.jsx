import { podeEditar, ehProprietario, ROTULO_PAPEL } from '../../lib/permissoes.js'

export default function PainelLateral({
  fazendas,
  carregando,
  erro,
  fazendaSelecionada,
  aoSelecionar,
  aoNovaFazenda,
  aoEditarFazenda,
  aoExcluirFazenda,
  carregandoExclusao,
  aoMarcarCentro,
  recolhido,
  aoAlternar,
  children,
  filtros,
  detalhe,
}) {
  const papel = fazendaSelecionada?.papel
  const editor = podeEditar(papel)

  if (recolhido) {
    return (
      <button
        onClick={aoAlternar}
        title="Mostrar painel"
        className="absolute left-3 top-3 z-[1100] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow hover:bg-slate-50"
      >
        ☰ Painel
      </button>
    )
  }

  return (
    // z acima dos controles do Leaflet (1000) e abaixo dos modais (2000).
    <aside className="absolute left-0 top-0 z-[1100] flex h-full w-80 flex-col border-r border-slate-200 bg-white/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Propriedade</h2>
        <button
          onClick={aoAlternar}
          title="Recolher painel"
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
        >
          ⟨
        </button>
      </div>

      <div className="space-y-3 border-b border-slate-200 px-4 py-3">
        {erro && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-sm text-red-700">
            {erro}
          </p>
        )}

        {carregando ? (
          <p className="text-sm text-slate-400">Carregando fazendas…</p>
        ) : fazendas.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              Você ainda não tem fazendas cadastradas.
            </p>
            <button
              onClick={aoNovaFazenda}
              className="w-full rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800"
            >
              Cadastrar primeira fazenda
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <label htmlFor="seletor-fazenda" className="block text-xs font-medium text-slate-500">
                Fazenda
              </label>
              <select
                id="seletor-fazenda"
                value={fazendaSelecionada?.id ?? ''}
                onChange={(e) => aoSelecionar(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100"
              >
                {fazendas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>

            {fazendaSelecionada && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {[fazendaSelecionada.municipio, fazendaSelecionada.uf].filter(Boolean).join(' — ') ||
                    'Sem município informado'}
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                  {ROTULO_PAPEL[papel] ?? papel}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={aoNovaFazenda}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Nova
              </button>
              {editor && (
                <button
                  onClick={aoEditarFazenda}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Editar
                </button>
              )}
              {editor && (
                <button
                  onClick={aoMarcarCentro}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Marcar centro
                </button>
              )}
              {ehProprietario(papel) && (
                <button
                  onClick={aoExcluirFazenda}
                  disabled={carregandoExclusao}
                  className="rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  {carregandoExclusao ? 'Verificando…' : 'Excluir'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Árvore Talhão › Gleba, e abaixo dela os filtros de coloração. Os dois
          rolam juntos; o detalhe do item selecionado fica fixo no rodapé. */}
      <div className="min-h-0 flex-1 overflow-auto">
        {children}
        {filtros}
      </div>

      {detalhe}
    </aside>
  )
}
