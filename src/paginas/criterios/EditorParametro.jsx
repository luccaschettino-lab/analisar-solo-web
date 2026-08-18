import { NIVEIS } from '../../config/parametros.js'
import { rotuloComUnidade, parametro } from '../../lib/parametros.js'
import { ORIGEM, origemDasFaixas, faixasEfetivas, faixasIniciais } from '../../lib/criterios.js'

const CAMPO =
  'rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50 disabled:text-slate-500'
const BOTAO =
  'rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300'

/**
 * Editor das faixas de um parâmetro.
 *
 * Os três estados do modelo aparecem como três situações na tela, e a troca
 * entre elas é explícita:
 *
 *   - **Padrão do sistema** — o conjunto não fala deste parâmetro. É como todo
 *     parâmetro começa, e o botão "Voltar ao padrão" devolve a ele.
 *   - **Personalizado** — as faixas foram escritas aqui.
 *   - **Sem classificação** — declara que este parâmetro não se classifica,
 *     mesmo que o config traga uma faixa.
 *
 * Personalizar começa com uma cópia das faixas do config em vez de uma lista
 * vazia. Digitar cinco faixas do zero para mudar um limite seria o caminho
 * mais curto para ninguém usar a tela.
 */
export default function EditorParametro({ chave, criterio, aoMudar, problemas, somenteLeitura }) {
  const p = parametro(chave)
  const origem = origemDasFaixas(chave, criterio)
  const faixas = faixasEfetivas(chave, criterio)
  const entrada = criterio?.[chave]

  const erros = problemas?.erros ?? []
  const avisos = problemas?.avisos ?? []

  function definirFaixas(novas) {
    aoMudar(chave, { ...entrada, faixas: novas })
  }

  function voltarAoPadrao() {
    // Remove a chave inteira: "não falar do parâmetro" é diferente de "falar
    // que não tem faixa", e é isso que devolve o controle ao config.
    aoMudar(chave, undefined)
  }

  function personalizar() {
    definirFaixas(faixasIniciais(chave) ?? [{ ate: null, nivel: 'medio' }])
  }

  function mudarFaixa(i, campo, valor) {
    definirFaixas(faixas.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)))
  }

  function adicionar() {
    // Entra antes da última, que é a aberta: a nova precisa de um teto, e a
    // aberta tem que continuar sendo a última.
    const nova = { ate: null, nivel: 'medio' }
    const copia = [...faixas]
    copia.splice(Math.max(0, copia.length - 1), 0, { ...nova, ate: 0 })
    definirFaixas(copia)
  }

  function remover(i) {
    const restante = faixas.filter((_, j) => j !== i)
    // A última tem que continuar aberta, senão valores acima dela ficariam
    // sem classificação — a validação reprovaria, mas é melhor não deixar
    // chegar lá.
    //
    // Reescrito com objeto novo, e não mutando o último: quando a origem é o
    // config, `faixas` é o array do próprio `config/parametros.js`. Mutar ali
    // corromperia a semente para todas as outras telas da sessão. Hoje este
    // caminho só roda com faixas personalizadas, mas a garantia não deve
    // depender disso.
    definirFaixas(
      restante.map((f, j) => (j === restante.length - 1 ? { ...f, ate: null } : { ...f })),
    )
  }

  return (
    <div
      className={`rounded-lg border p-3 ${erros.length ? 'border-red-300 bg-red-50/40' : 'border-slate-200'}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-800">{rotuloComUnidade(chave)}</h4>
        <span className="text-[11px] text-slate-500">
          {origem === ORIGEM.CRITERIO && 'personalizado'}
          {origem === ORIGEM.CONFIG && 'padrão do sistema'}
          {origem === ORIGEM.SEM_CLASSIFICACAO && 'sem classificação'}
        </span>
      </div>

      {p?.nota && origem !== ORIGEM.CRITERIO && (
        <p className="mt-1 text-[11px] leading-tight text-slate-500">{p.nota}</p>
      )}

      {!somenteLeitura && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={personalizar} className={BOTAO} disabled={origem === ORIGEM.CRITERIO}>
            Personalizar
          </button>
          <button
            type="button"
            onClick={() => aoMudar(chave, { ...entrada, faixas: null })}
            className={BOTAO}
            disabled={origem === ORIGEM.SEM_CLASSIFICACAO}
          >
            Sem classificação
          </button>
          <button type="button" onClick={voltarAoPadrao} className={BOTAO} disabled={origem === ORIGEM.CONFIG}>
            Voltar ao padrão
          </button>
        </div>
      )}

      {faixas && (
        <ul className="mt-2 space-y-1.5">
          {faixas.map((faixa, i) => {
            const ultima = i === faixas.length - 1
            const editavel = origem === ORIGEM.CRITERIO && !somenteLeitura
            return (
              <li key={i} className="flex flex-wrap items-center gap-1.5">
                <span className="w-14 shrink-0 text-[11px] text-slate-500">
                  {ultima ? 'acima de' : 'até'}
                </span>

                <input
                  inputMode="decimal"
                  aria-label={`Limite da faixa ${i + 1} de ${rotuloComUnidade(chave)}`}
                  value={ultima ? '' : (faixa.ate ?? '')}
                  disabled={!editavel || ultima}
                  placeholder={ultima ? '—' : ''}
                  onChange={(e) => {
                    const texto = e.target.value.replace(',', '.')
                    mudarFaixa(i, 'ate', texto === '' ? null : Number(texto))
                  }}
                  className={`${CAMPO} w-20`}
                />

                <select
                  aria-label={`Nível da faixa ${i + 1} de ${rotuloComUnidade(chave)}`}
                  value={faixa.nivel}
                  disabled={!editavel}
                  onChange={(e) => mudarFaixa(i, 'nivel', e.target.value)}
                  className={`${CAMPO} w-32`}
                >
                  {Object.entries(NIVEIS).map(([chaveNivel, nivel]) => (
                    <option key={chaveNivel} value={chaveNivel}>
                      {nivel.rotulo}
                    </option>
                  ))}
                </select>

                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 rounded-sm border border-slate-300"
                  style={{ backgroundColor: NIVEIS[faixa.nivel]?.cor ?? '#fff' }}
                />

                <input
                  aria-label={`Rótulo próprio da faixa ${i + 1} de ${rotuloComUnidade(chave)}`}
                  value={faixa.rotulo ?? ''}
                  disabled={!editavel}
                  placeholder="rótulo próprio (opcional)"
                  onChange={(e) => mudarFaixa(i, 'rotulo', e.target.value || undefined)}
                  className={`${CAMPO} min-w-0 flex-1`}
                />

                {editavel && faixas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remover(i)}
                    aria-label={`Remover faixa ${i + 1}`}
                    className="px-1 text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {origem === ORIGEM.CRITERIO && !somenteLeitura && (
        <button type="button" onClick={adicionar} className={`${BOTAO} mt-2`}>
          + Faixa
        </button>
      )}

      {origem === ORIGEM.CRITERIO && !somenteLeitura && (
        <label className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          Variação mínima para contar como mudança
          <input
            inputMode="decimal"
            value={entrada?.delta_minimo ?? ''}
            placeholder="automático"
            onChange={(e) => {
              const texto = e.target.value.replace(',', '.')
              aoMudar(chave, { ...entrada, delta_minimo: texto === '' ? undefined : Number(texto) })
            }}
            className={`${CAMPO} w-24`}
          />
          <span className="text-slate-400">
            vazio = 5% da amplitude das faixas
          </span>
        </label>
      )}

      {erros.map((e) => (
        <p key={e} role="alert" className="mt-1.5 text-[11px] font-medium text-red-700">
          {e}
        </p>
      ))}
      {avisos.map((a) => (
        <p key={a} className="mt-1.5 text-[11px] text-amber-800">
          {a}
        </p>
      ))}
    </div>
  )
}
