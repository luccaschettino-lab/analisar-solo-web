const SELECT =
  'mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50 disabled:text-slate-400'

function Nivel({ id, rotulo, valor, aoMudar, opcoes, desabilitado, vazio, rotularOpcao }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        disabled={desabilitado || opcoes.length === 0}
        className={SELECT}
      >
        <option value="">{opcoes.length === 0 ? vazio : 'selecione…'}</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {rotularOpcao(o)}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function SeletorGleba({ selecao, desabilitado }) {
  const {
    fazendas,
    talhoes,
    glebas,
    fazendaId,
    talhaoId,
    glebaId,
    selecionarFazenda,
    selecionarTalhao,
    selecionarGleba,
    carregandoFazendas,
    carregandoHierarquia,
    erro,
    recarregar,
  } = selecao

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {/* Sem isto, uma falha de rede vira "nenhuma fazenda" — e o usuário
          conclui que perdeu os dados em vez de tentar de novo. */}
      {erro && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-3"
        >
          <span>{erro}</span>
          <button
            type="button"
            onClick={recarregar}
            className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Tentar de novo
          </button>
        </div>
      )}

      <Nivel
        id="sel-fazenda"
        rotulo="Fazenda"
        valor={fazendaId}
        aoMudar={selecionarFazenda}
        opcoes={fazendas}
        desabilitado={desabilitado || carregandoFazendas}
        vazio={
          carregandoFazendas
            ? 'carregando…'
            : erro
              ? 'não foi possível carregar'
              : 'nenhuma fazenda'
        }
        rotularOpcao={(f) => f.nome}
      />

      <Nivel
        id="sel-talhao"
        rotulo="Talhão"
        valor={talhaoId}
        aoMudar={selecionarTalhao}
        opcoes={talhoes}
        desabilitado={desabilitado || !fazendaId || carregandoHierarquia}
        vazio={
          !fazendaId
            ? 'escolha a fazenda'
            : carregandoHierarquia
              ? 'carregando…'
              : erro
                ? 'não foi possível carregar'
                : 'nenhum talhão'
        }
        rotularOpcao={(t) => (t.nome ? `${t.codigo} · ${t.nome}` : t.codigo)}
      />

      <Nivel
        id="sel-gleba"
        rotulo="Gleba"
        valor={glebaId}
        aoMudar={selecionarGleba}
        opcoes={glebas}
        desabilitado={desabilitado || !talhaoId || carregandoHierarquia}
        vazio={!talhaoId ? 'escolha o talhão' : 'nenhuma gleba neste talhão'}
        rotularOpcao={(g) => (g.nome ? `${g.codigo} · ${g.nome}` : g.codigo)}
      />
    </div>
  )
}
