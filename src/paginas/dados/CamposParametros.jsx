import { GRUPOS } from '../../config/parametros.js'
import { parametrosDoGrupo, foraDaFaixaPlausivel, textoDaFaixaPlausivel } from '../../lib/parametros.js'
import { ehNumeroInvalido } from '../../lib/numeros.js'

/**
 * Os 24 parâmetros, agrupados como no laudo.
 *
 * Todos opcionais: laudo incompleto é o normal, não a exceção — a camada
 * 20-40 quase nunca traz micronutrientes.
 *
 * O aviso de faixa implausível é amarelo e não impede nada. Laboratório erra,
 * e o dado tem que entrar mesmo assim; o aviso serve para o usuário reparar
 * antes de gravar, não para discutir com ele.
 */
function Campo({ p, valor, aoMudar, desabilitado }) {
  const invalido = ehNumeroInvalido(valor)
  const implausivel = !invalido && foraDaFaixaPlausivel(p.chave, valor)
  const idAviso = `${p.chave}-aviso`

  return (
    <div>
      <label htmlFor={p.chave} className="block text-xs font-medium text-slate-600">
        {p.rotulo}
        {p.unidade && <span className="ml-1 font-normal text-slate-400">({p.unidade})</span>}
      </label>
      <input
        id={p.chave}
        type="text"
        // inputMode decimal abre o teclado numérico no celular sem impedir a
        // vírgula, que `type="number"` recusaria em pt-BR.
        inputMode="decimal"
        autoComplete="off"
        value={valor ?? ''}
        onChange={(e) => aoMudar(p.chave, e.target.value)}
        disabled={desabilitado}
        aria-invalid={invalido || undefined}
        aria-describedby={invalido || implausivel ? idAviso : undefined}
        title={p.nota ?? undefined}
        className={`mt-1 w-full rounded-md border px-2 py-1.5 text-sm tabular-nums outline-none transition disabled:bg-slate-50 ${
          invalido
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : implausivel
              ? 'border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
              : 'border-slate-300 focus:border-solo-600 focus:ring-2 focus:ring-solo-100'
        }`}
      />
      {invalido && (
        <p id={idAviso} className="mt-0.5 text-xs text-red-700">
          Não é um número.
        </p>
      )}
      {implausivel && (
        <p id={idAviso} className="mt-0.5 text-xs text-amber-700">
          Fora do usual ({textoDaFaixaPlausivel(p.chave)}). Confira — dá para salvar assim.
        </p>
      )}
    </div>
  )
}

export default function CamposParametros({ valores, aoMudar, desabilitado }) {
  return (
    <div className="space-y-5">
      {GRUPOS.map((grupo) => (
        <fieldset key={grupo.chave} disabled={desabilitado}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {grupo.rotulo}
          </legend>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {parametrosDoGrupo(grupo.chave).map((p) => (
              <Campo
                key={p.chave}
                p={p}
                valor={valores[p.chave]}
                aoMudar={aoMudar}
                desabilitado={desabilitado}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
