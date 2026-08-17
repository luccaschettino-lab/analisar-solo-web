import { useMemo, useState } from 'react'
import { GRUPOS, TRACO } from '../../config/parametros.js'
import { parametrosDoGrupo, temMedicao } from '../../lib/parametros.js'
import { anosSafra } from '../../hooks/useAnalises.js'
import { Valor, Variacao } from './celulas.jsx'

function formatarData(iso) {
  if (!iso) return TRACO
  // Construído na mão: `new Date('2026-05-10')` é meia-noite UTC e, em fuso
  // negativo como o do Brasil, `toLocaleDateString` devolveria o dia anterior.
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const SELECT =
  'mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100'

// A coluna do nome do parâmetro fica presa: é a referência da linha, e sem ela
// um número solto no meio da tabela não diz de que parâmetro é.
const PRESA = 'sticky left-0 z-10 bg-white'
const CELULA = 'whitespace-nowrap px-3 py-1.5 text-right tabular-nums'

export default function TabelaAnalises({ analises }) {
  const anos = useMemo(() => anosSafra(analises), [analises])
  const [anoAtual, setAnoAtual] = useState(anos[0] ?? '')
  const [anoComparado, setAnoComparado] = useState('')
  const [ocultarVazios, setOcultarVazios] = useState(false)

  // Em tela estreita começa com uma profundidade por vez; em tela larga mostra
  // todas lado a lado. `''` significa "todas".
  const [profFoco, setProfFoco] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      ? 'auto'
      : '',
  )

  // A safra escolhida pode sumir depois de uma exclusão; cai na mais recente.
  const safraAtual = anos.includes(anoAtual) ? anoAtual : (anos[0] ?? '')
  const safraComparada =
    anos.includes(anoComparado) && anoComparado !== safraAtual ? anoComparado : ''
  const comparando = Boolean(safraComparada)

  const daSafra = useMemo(
    () =>
      analises
        .filter((a) => a.ano_safra === safraAtual)
        .sort((a, b) =>
          String(a.profundidade).localeCompare(String(b.profundidade), 'pt-BR', { numeric: true }),
        ),
    [analises, safraAtual],
  )

  const comparadaPorProf = useMemo(() => {
    const mapa = new Map()
    for (const a of analises) if (a.ano_safra === safraComparada) mapa.set(a.profundidade, a)
    return mapa
  }, [analises, safraComparada])

  const profundidadesDaSafra = daSafra.map((a) => a.profundidade)

  /**
   * Profundidade em foco, ou `''` para mostrar todas lado a lado.
   *
   * Comparando, é sempre uma só: duas safras × várias camadas viraria de novo
   * uma tabela larga demais — e casar camada com camada é o único jeito de a
   * variação significar alguma coisa. Mas quem compara escolhe **qual** camada;
   * travar na primeira esconderia o subsolo.
   */
  const precisaDeUma = comparando || profFoco === 'auto' || profFoco !== ''
  const profEfetiva = precisaDeUma
    ? (profundidadesDaSafra.includes(profFoco) ? profFoco : (profundidadesDaSafra[0] ?? ''))
    : ''

  const visiveis = profEfetiva ? daSafra.filter((a) => a.profundidade === profEfetiva) : daSafra

  const linhasDeGrupo = GRUPOS.map((grupo) => ({
    grupo,
    parametros: parametrosDoGrupo(grupo.chave).filter((p) => {
      if (!ocultarVazios) return true
      return visiveis.some((a) => temMedicao(a[p.chave]))
    }),
  })).filter((g) => g.parametros.length > 0)

  const colunas = comparando ? 3 : visiveis.length

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-end gap-3 sm:gap-4">
        <div>
          <label htmlFor="safra-atual" className="block text-xs font-medium text-slate-500">
            Safra
          </label>
          <select
            id="safra-atual"
            value={safraAtual}
            onChange={(e) => setAnoAtual(e.target.value)}
            className={SELECT}
          >
            {anos.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="safra-comparada" className="block text-xs font-medium text-slate-500">
            Comparar com
          </label>
          <select
            id="safra-comparada"
            value={safraComparada}
            onChange={(e) => setAnoComparado(e.target.value)}
            className={SELECT}
          >
            <option value="">nenhuma</option>
            {anos
              .filter((ano) => ano !== safraAtual)
              .map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label htmlFor="prof-foco" className="block text-xs font-medium text-slate-500">
            Profundidade
          </label>
          <select
            id="prof-foco"
            value={profEfetiva}
            onChange={(e) => setProfFoco(e.target.value)}
            className={SELECT}
          >
            {/* "todas" some durante a comparação: lá é sempre uma camada. */}
            {!comparando && <option value="">todas</option>}
            {profundidadesDaSafra.map((p) => (
              <option key={p} value={p}>
                {p} cm
              </option>
            ))}
          </select>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 pb-1 text-xs text-slate-600 sm:min-h-0">
          <input
            type="checkbox"
            checked={ocultarVazios}
            onChange={(e) => setOcultarVazios(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-solo-700 focus:ring-solo-600"
          />
          Ocultar sem medição
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className={`${PRESA} border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-600`}>
                Parâmetro
              </th>
              {comparando ? (
                <>
                  <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600">
                    {safraAtual}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600">
                    {safraComparada}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600">
                    variação
                  </th>
                </>
              ) : (
                visiveis.map((a) => (
                  <th
                    key={a.id}
                    className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600"
                  >
                    <span className="block whitespace-nowrap">{a.profundidade} cm</span>
                    <span className="block whitespace-nowrap font-normal text-slate-400">
                      {formatarData(a.data_coleta)}
                    </span>
                  </th>
                ))
              )}
            </tr>
          </thead>

          {linhasDeGrupo.map(({ grupo, parametros }) => (
            <tbody key={grupo.chave}>
              <tr>
                <th
                  colSpan={colunas + 1}
                  scope="colgroup"
                  className="border-b border-t border-slate-200 bg-slate-50/70 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {grupo.rotulo}
                </th>
              </tr>

              {parametros.map((p) => {
                const atual = visiveis[0]
                const comparada = atual ? comparadaPorProf.get(atual.profundidade) : null
                return (
                  <tr key={p.chave} className="even:bg-slate-50/40">
                    <th
                      scope="row"
                      title={p.nota ?? undefined}
                      className={`${PRESA} border-b border-r border-slate-200 px-3 py-1.5 text-left font-normal even:bg-slate-50`}
                    >
                      <span className="block whitespace-nowrap text-slate-800">{p.rotulo}</span>
                      {p.unidade && (
                        <span className="block whitespace-nowrap text-xs text-slate-400">
                          {p.unidade}
                        </span>
                      )}
                    </th>

                    {comparando ? (
                      <>
                        <td className={`${CELULA} border-b border-slate-200`}>
                          <Valor chave={p.chave} valor={atual?.[p.chave]} />
                        </td>
                        <td className={`${CELULA} border-b border-slate-200`}>
                          <Valor chave={p.chave} valor={comparada?.[p.chave]} esmaecido />
                        </td>
                        <td className={`${CELULA} border-b border-slate-200`}>
                          <Variacao
                            chave={p.chave}
                            atual={atual?.[p.chave]}
                            anterior={comparada?.[p.chave]}
                            casas={p.casas}
                          />
                        </td>
                      </>
                    ) : (
                      visiveis.map((a) => (
                        <td key={a.id} className={`${CELULA} border-b border-slate-200`}>
                          <Valor chave={p.chave} valor={a[p.chave]} />
                        </td>
                      ))
                    )}
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>

      <div className="mt-2 space-y-1 text-xs text-slate-500">
        <p>
          <strong className="text-slate-400">sem medição</strong> quer dizer que o
          laboratório não analisou esse parâmetro. Um valor <strong>0</strong> é
          resultado medido, não ausência.
        </p>
        {comparando && (
          <p>
            A variação compara a mesma profundidade entre as duas safras. Com o valor
            anterior em zero, mostramos a diferença absoluta (<em>abs.</em>) — percentual
            sobre zero não existe. Subir ou descer não significa melhorar ou piorar:
            para alumínio, subir é ruim; para pH, existe um ponto ideal no meio.
          </p>
        )}
        <p className="text-slate-400">
          Amostra do laboratório em {safraAtual}:{' '}
          {visiveis.map((a) => `${a.profundidade} cm → ${a.numero_amostra_lab || TRACO}`).join(' · ')}.
          O laboratório renumera a cada coleta; a identidade da gleba é o cadastro.
        </p>
      </div>
    </div>
  )
}
