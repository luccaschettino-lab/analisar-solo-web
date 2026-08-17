import { useMemo, useState } from 'react'
import { GRUPOS, TRACO } from '../../config/parametros.js'
import { parametrosDoGrupo } from '../../lib/parametros.js'
import { anosSafra } from '../../hooks/useAnalises.js'
import CelulaParametro from './CelulaParametro.jsx'

function formatarData(iso) {
  if (!iso) return TRACO
  // Constrói na mão: `new Date('2026-05-10')` é meia-noite UTC e, em fuso
  // negativo como o do Brasil, `toLocaleDateString` devolveria o dia anterior.
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

// A primeira coluna fica presa à esquerda: sem isso, rolar até o zinco faz
// perder de vista de qual profundidade é a linha.
const PRESA = 'sticky left-0 z-20 bg-white'
const PRESA_CABECALHO = 'sticky left-0 z-30 bg-slate-50'
const SELECT =
  'rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100'

export default function TabelaAnalises({ analises }) {
  const anos = useMemo(() => anosSafra(analises), [analises])
  const [anoAtual, setAnoAtual] = useState(anos[0] ?? '')
  const [anoComparado, setAnoComparado] = useState('')

  // A safra selecionada pode sumir depois de uma exclusão; cai na mais recente.
  const safraAtual = anos.includes(anoAtual) ? anoAtual : (anos[0] ?? '')
  const safraComparada = anos.includes(anoComparado) && anoComparado !== safraAtual ? anoComparado : ''
  const comparando = Boolean(safraComparada)

  const linhas = useMemo(
    () =>
      analises
        .filter((a) => a.ano_safra === safraAtual)
        .sort((a, b) =>
          String(a.profundidade).localeCompare(String(b.profundidade), 'pt-BR', { numeric: true }),
        ),
    [analises, safraAtual],
  )

  // Casa por profundidade: comparar 0-20 com 20-40 não diria nada sobre a
  // evolução do solo, só sobre a diferença entre camadas.
  const comparadasPorProfundidade = useMemo(() => {
    const mapa = new Map()
    for (const a of analises) {
      if (a.ano_safra === safraComparada) mapa.set(a.profundidade, a)
    }
    return mapa
  }, [analises, safraComparada])

  const colunas = GRUPOS.map((g) => ({ grupo: g, parametros: parametrosDoGrupo(g.chave) }))

  return (
    <div className="p-6">
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="safra-atual" className="block text-xs font-medium text-slate-500">
            Safra
          </label>
          <select
            id="safra-atual"
            value={safraAtual}
            onChange={(e) => setAnoAtual(e.target.value)}
            className={`mt-1 ${SELECT}`}
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
            className={`mt-1 ${SELECT}`}
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

        {comparando && (
          <p className="pb-1.5 text-xs text-slate-500">
            Cada célula mostra o valor de <strong>{safraAtual}</strong>, e abaixo o de{' '}
            <strong>{safraComparada}</strong> com a variação.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className={`${PRESA_CABECALHO} border-b border-r border-slate-200 px-3 py-2`} />
              <th
                className="border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-500"
                colSpan={2}
              >
                Laudo
              </th>
              {colunas.map(({ grupo, parametros }) => (
                <th
                  key={grupo.chave}
                  colSpan={parametros.length}
                  className="border-b border-r border-slate-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {grupo.rotulo}
                </th>
              ))}
            </tr>

            <tr className="bg-slate-50">
              <th
                className={`${PRESA_CABECALHO} border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600`}
              >
                Profundidade
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600">
                Amostra lab.
              </th>
              <th className="border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600">
                Coleta
              </th>
              {colunas.flatMap(({ parametros }) =>
                parametros.map((p, indice) => (
                  <th
                    key={p.chave}
                    title={p.nota ?? undefined}
                    className={`border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600 ${
                      indice === parametros.length - 1 ? 'border-r' : ''
                    }`}
                  >
                    <span className="block whitespace-nowrap">{p.rotulo}</span>
                    {p.unidade && (
                      <span className="block whitespace-nowrap font-normal text-slate-400">
                        {p.unidade}
                      </span>
                    )}
                  </th>
                )),
              )}
            </tr>
          </thead>

          <tbody>
            {linhas.map((a) => {
              const comparada = comparadasPorProfundidade.get(a.profundidade) ?? null
              return (
                <tr key={a.id} className="align-top even:bg-slate-50/50">
                  <th
                    scope="row"
                    className={`${PRESA} border-b border-r border-slate-200 px-3 py-2 text-left font-medium text-slate-800`}
                  >
                    <span className="block whitespace-nowrap">{a.profundidade} cm</span>
                    {comparando && !comparada && (
                      <span className="block whitespace-nowrap text-xs font-normal text-amber-700">
                        sem {safraComparada}
                      </span>
                    )}
                  </th>
                  <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-slate-500">
                    {a.numero_amostra_lab || TRACO}
                  </td>
                  <td className="whitespace-nowrap border-b border-r border-slate-200 px-3 py-2 text-left text-slate-500">
                    {formatarData(a.data_coleta)}
                  </td>

                  {colunas.flatMap(({ parametros }) =>
                    parametros.map((p, indice) => (
                      <td
                        key={p.chave}
                        className={`whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right tabular-nums ${
                          indice === parametros.length - 1 ? 'border-r' : ''
                        }`}
                      >
                        <CelulaParametro
                          chave={p.chave}
                          valor={a[p.chave]}
                          valorComparado={comparada ? comparada[p.chave] : null}
                          comparando={comparando}
                        />
                      </td>
                    )),
                  )}
                </tr>
              )
            })}
          </tbody>
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
            A variação é relativa à safra comparada. Quando o valor anterior é zero,
            mostramos a diferença absoluta (marcada <em>abs.</em>) — percentual sobre
            zero não existe. Subir ou descer não significa melhorar ou piorar: para
            alumínio, subir é ruim; para pH, existe um ponto ideal no meio.
          </p>
        )}
        <p className="text-slate-400">
          O número da amostra é a referência do laudo daquele ano — o laboratório
          renumera a cada coleta. A identidade da gleba é o cadastro, não ele.
        </p>
      </div>
    </div>
  )
}
