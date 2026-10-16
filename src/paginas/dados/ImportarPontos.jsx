import { useMemo, useState } from 'react'
import { useFazendaAtual } from '../../context/FazendaContext.jsx'
import { pontosDoArquivo, distribuirPontos } from '../../lib/pontosDeColeta.js'
import { pontoFeature } from '../../lib/geo.js'
import { criarPontosColetaEmLote } from '../../dados/pontosColeta.js'

/**
 * Importa pontos de coleta sem transformá-los em glebas ou análises.
 *
 * Duas etapas, como a importação de talhões: ler o arquivo e mostrar a revisão,
 * e só gravar ao confirmar a importação. Ponto fora de qualquer talhão é avisado em
 * destaque, mas também é importado: vai para o talhão mais próximo.
 */
export default function ImportarPontos() {
  const { fazendaSelecionada, talhoes, editor } = useFazendaAtual()

  const [nomeArquivo, setNomeArquivo] = useState('')
  const [pontos, setPontos] = useState(null)
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [resultado, setResultado] = useState('')

  async function aoEscolher(evento) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    setErro('')
    setResultado('')
    setPontos(null)
    setNomeArquivo(arquivo.name)
    setLendo(true)
    try {
      setPontos(await pontosDoArquivo(arquivo))
    } catch (e) {
      setErro(e.message)
    } finally {
      setLendo(false)
    }
  }

  const distribuicao = useMemo(
    () => (pontos ? distribuirPontos(pontos, talhoes) : null),
    [pontos, talhoes],
  )

  const totalAImportar = distribuicao ? [...distribuicao.porTalhao.values()].reduce((s, l) => s + l.length, 0) : 0
  const linhasPorTalhao = distribuicao
    ? talhoes.filter((t) => distribuicao.porTalhao.has(t.id)).map((t) => ({ talhao: t, itens: distribuicao.porTalhao.get(t.id) }))
    : []

  async function gravar() {
    if (!distribuicao || totalAImportar === 0 || gravando) return
    setErro('')
    setGravando(true)
    setProgresso({ feito: 0, total: totalAImportar })
    let importados = 0
    try {
      for (const { talhao, itens } of linhasPorTalhao) {
        const novos = await criarPontosColetaEmLote(
          talhao.id,
          itens.map(({ ponto }) => ({
            geometria: pontoFeature(ponto.lat, ponto.lng),
            propriedades: ponto.propriedades,
          })),
        )
        importados += novos.length
        setProgresso({ feito: importados, total: totalAImportar })
      }
      setResultado(`${importados} ${importados === 1 ? 'ponto de coleta importado' : 'pontos de coleta importados'}.`)
      setPontos(null)
    } catch (e) {
      setErro(`${e.message} Antes do erro, ${importados} ponto(s) já tinham sido importados — eles continuam salvos.`)
    } finally {
      setGravando(false)
      setProgresso(null)
    }
  }

  if (!fazendaSelecionada) {
    return <Caixa>Escolha uma fazenda na barra lateral para importar os pontos de coleta.</Caixa>
  }
  if (!editor) {
    return <Caixa>Só quem pode editar a fazenda importa pontos de coleta.</Caixa>
  }
  if (talhoes.length === 0) {
    return <Caixa>Esta fazenda ainda não tem talhões. Cadastre os talhões antes de importar os pontos de coleta.</Caixa>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Importar pontos de coleta</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Fazenda {fazendaSelecionada.nome}. Os pontos são salvos como pontos de coleta independentes, associados ao talhão
          onde caem. Eles não criam glebas nem análises.
        </p>
      </div>

      <label
        htmlFor="importar-pontos"
        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-300 px-4 py-8 text-center hover:border-solo-500 dark:border-white/15 dark:hover:border-solo-500"
      >
        <span aria-hidden="true" className="text-2xl">📍</span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {lendo ? 'Lendo arquivo…' : 'Clique para escolher o arquivo de pontos'}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">Shapefile (.zip) ou .geojson</span>
      </label>
      <input id="importar-pontos" type="file" accept=".zip,.geojson,.json" onChange={aoEscolher} disabled={lendo || gravando} className="hidden" />

      {erro && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
          {erro}
        </p>
      )}
      {resultado && (
        <p role="status" className="rounded-md border border-solo-100 bg-solo-50 px-3 py-2 text-sm font-medium text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300">
          {resultado}
        </p>
      )}

      {distribuicao && (
        <>
          <div className="rounded-md border border-solo-100 bg-solo-50 px-3 py-2 text-sm text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300">
            <strong className="font-medium">{nomeArquivo}</strong> · {pontos.length} pontos lidos: {totalAImportar - distribuicao.fora.length} dentro
            de talhões e {distribuicao.fora.length} fora.
          </div>

          {distribuicao.fora.length > 0 && (
            <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="text-sm font-medium">
                ⚠ {distribuicao.fora.length} {distribuicao.fora.length === 1 ? 'ponto não cai' : 'pontos não caem'} dentro de nenhum talhão
              </p>
              <p className="mt-1">
                Esses pontos <strong>serão importados mesmo assim</strong>, associados ao talhão mais próximo. Confira se a distância
                faz sentido — uma distância grande pode ser coordenada errada ou talhão que falta cadastrar.
              </p>
              <ul className="mt-2 max-h-48 overflow-auto font-mono">
                {distribuicao.fora.map(({ ponto, talhao, distanciaM }) => (
                  <li key={ponto.indice}>
                    ponto {ponto.indice}
                    {ponto.propriedades?.id != null && ` (id ${ponto.propriedades.id})`} · {ponto.lat.toFixed(6)},{' '}
                    {ponto.lng.toFixed(6)} → talhão {talhao.codigo}, a {Math.round(distanciaM)} m
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-hidden rounded-md border border-slate-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Talhão</th>
                  <th className="px-3 py-2 font-medium">Pontos a importar</th>
                  <th className="px-3 py-2 font-medium">Localizações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {linhasPorTalhao.map(({ talhao, itens }) => (
                  <tr key={talhao.id} className="align-top">
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                      {talhao.codigo}
                      {talhao.nome && <span className="font-normal text-slate-400"> · {talhao.nome}</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {itens.length}
                      {itens.some((i) => i.fora) && (
                        <span className="text-xs text-amber-700 dark:text-amber-300">
                          {' '}({itens.filter((i) => i.fora).length} fora)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {itens.length === 1 ? `ponto ${itens[0].ponto.indice}` : `${itens.length} pontos`}
                    </td>
                  </tr>
                ))}
                {linhasPorTalhao.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-xs text-slate-400">
                      Nenhum ponto para importar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2">
            {gravando && progresso ? (
              <p role="status" aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
                Importando {progresso.feito} de {progresso.total} pontos…
              </p>
            ) : <span />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPontos(null)}
                disabled={gravando}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void gravar()}
                disabled={gravando || totalAImportar === 0}
                aria-busy={gravando}
                className="rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-solo-600 dark:hover:bg-solo-700 dark:disabled:bg-slate-600"
              >
                {gravando ? 'Importando…' : totalAImportar === 0 ? 'Nada para importar' : `Importar ${totalAImportar} pontos`}
              </button>
            </div>
          </div>
          {erro && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300"
            >
              {erro}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Caixa({ children }) {
  return (
    <p className="m-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      {children}
    </p>
  )
}
