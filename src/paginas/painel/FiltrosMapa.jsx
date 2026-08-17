import { GRUPOS, PROFUNDIDADES } from '../../config/parametros.js'
import { parametrosDoGrupo } from '../../lib/parametros.js'
import { filtroCompleto } from '../../lib/coloracao.js'

const SEM_FILTRO = ''
const SELECT =
  'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50 disabled:text-slate-400'

function Campo({ id, rotulo, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {rotulo}
      </label>
      {children}
    </div>
  )
}

/**
 * Filtros que colorem o mapa: ano-safra, profundidade e parâmetro.
 *
 * Os três são independentes e a coloração só liga com os três preenchidos —
 * a regra mora em `filtroCompleto`, não aqui.
 */
export default function FiltrosMapa({ filtro, aoMudar, anos, carregando, erro }) {
  const completo = filtroCompleto(filtro)

  function mudar(campo, valor) {
    aoMudar({ ...filtro, [campo]: valor })
  }

  return (
    <section className="border-t border-slate-200 px-4 py-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Colorir o mapa
      </h3>

      {erro && (
        <p role="alert" className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {erro}
        </p>
      )}

      <div className="space-y-2">
        <Campo id="filtro-ano" rotulo="Ano-safra">
          <select
            id="filtro-ano"
            value={filtro.anoSafra}
            onChange={(e) => mudar('anoSafra', e.target.value)}
            disabled={carregando || anos.length === 0}
            className={SELECT}
          >
            <option value={SEM_FILTRO}>
              {carregando
                ? 'carregando…'
                : anos.length === 0
                  ? 'nenhuma análise nesta fazenda'
                  : 'Sem filtro'}
            </option>
            {anos.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="filtro-profundidade" rotulo="Profundidade (cm)">
          <select
            id="filtro-profundidade"
            value={filtro.profundidade}
            onChange={(e) => mudar('profundidade', e.target.value)}
            className={SELECT}
          >
            <option value={SEM_FILTRO}>Sem filtro</option>
            {PROFUNDIDADES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="filtro-parametro" rotulo="Parâmetro">
          <select
            id="filtro-parametro"
            value={filtro.chaveParametro}
            onChange={(e) => mudar('chaveParametro', e.target.value)}
            className={SELECT}
          >
            <option value={SEM_FILTRO}>Sem filtro</option>
            {GRUPOS.map((grupo) => (
              <optgroup key={grupo.chave} label={grupo.rotulo}>
                {parametrosDoGrupo(grupo.chave).map((p) => (
                  <option key={p.chave} value={p.chave}>
                    {p.rotulo}
                    {p.unidade ? ` (${p.unidade})` : ''}
                    {/* Avisa antes de escolher: sem faixa no config, este
                        parâmetro mostra valor no tooltip mas não colore. */}
                    {p.faixas ? '' : ' — sem classificação'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Campo>
      </div>

      {!completo && (
        <p className="mt-2 text-xs text-slate-500">
          Escolha os três para colorir as glebas. Com qualquer um em "Sem filtro",
          o mapa fica em cinza neutro.
        </p>
      )}
    </section>
  )
}
