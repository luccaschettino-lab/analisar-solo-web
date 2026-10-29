import { useMemo, useState } from 'react'
import { useFazendaAtual } from '../../context/FazendaContext.jsx'
import { pontosDoArquivo, distribuirPontos, agruparPontosEmGlebas } from '../../lib/pontosDeColeta.js'
import { pontoFeature } from '../../lib/geo.js'
import { criarPontosColetaEmLote, criarGlebaComPontosColeta } from '../../dados/pontosColeta.js'

/**
 * Importa pontos de coleta sem transformá-los em glebas ou análises.
 *
 * Duas etapas, como a importação de talhões: ler o arquivo e mostrar a revisão,
 * e só gravar ao confirmar a importação. Ponto fora de qualquer talhão é avisado em
 * destaque, mas também é importado: vai para o talhão mais próximo.
 *
 * Depois de importar, o site pergunta se deve criar as glebas sozinho: uma por
 * código de ponto (as várias coletas de uma mesma amostra compartilham o código).
 */
export default function ImportarPontos() {
  const { fazendaSelecionada, talhoes, glebas, aplicarGlebas, editor } = useFazendaAtual()

  const [nomeArquivo, setNomeArquivo] = useState('')
  const [pontos, setPontos] = useState(null)
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [resultado, setResultado] = useState('')
  // Pontos gravados nesta importação: base da oferta de criar glebas.
  const [importados, setImportados] = useState(null)
  const [criandoGlebas, setCriandoGlebas] = useState(null)
  const [resultadoGlebas, setResultadoGlebas] = useState('')

  async function aoEscolher(evento) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    setErro('')
    setResultado('')
    setResultadoGlebas('')
    setImportados(null)
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

  // O que a criação automática faria: grupos novos, e quantos já têm gleba com
  // o mesmo código no talhão (esses são pulados, nunca sobrescritos).
  const plano = useMemo(() => {
    if (!importados) return null
    const { glebas: grupos, semCodigo } = agruparPontosEmGlebas(importados, talhoes)
    const existentes = new Set(glebas.map((g) => JSON.stringify([g.talhao_id, g.codigo])))
    const novas = grupos.filter((g) => !existentes.has(JSON.stringify([g.talhaoId, g.codigo])))
    return { novas, jaExistem: grupos.length - novas.length, semCodigo, totalPontos: importados.length }
  }, [importados, talhoes, glebas])

  async function criarGlebasAutomaticas() {
    if (!plano || plano.novas.length === 0 || criandoGlebas) return
    setErro('')
    const total = plano.novas.length
    const criadas = []
    setCriandoGlebas({ feito: 0, total })
    try {
      // Uma por vez: cada gleba é gravada junto com o vínculo dos seus pontos,
      // de forma atômica. Se uma falhar, as anteriores ficam e o botão volta
      // oferecendo só o que falta.
      for (const g of plano.novas) {
        criadas.push(
          await criarGlebaComPontosColeta({
            talhaoId: g.talhaoId,
            codigo: g.codigo,
            nome: null,
            geometria: g.geometria,
            areaHa: g.areaHa,
            pontosColetaIds: g.pontoIds,
          }),
        )
        setCriandoGlebas({ feito: criadas.length, total })
      }
      setResultadoGlebas(`${criadas.length} ${criadas.length === 1 ? 'gleba criada' : 'glebas criadas'} a partir dos pontos de amostra.`)
      setImportados(null)
    } catch (e) {
      setErro(`${e.message} ${criadas.length} de ${total} glebas foram criadas; as demais ficaram pendentes.`)
    } finally {
      if (criadas.length > 0) aplicarGlebas(criadas)
      setCriandoGlebas(null)
    }
  }

  async function gravar() {
    if (!distribuicao || totalAImportar === 0 || gravando) return
    setErro('')
    setGravando(true)
    setProgresso({ feito: 0, total: totalAImportar })
    let contagem = 0
    const gravados = []
    try {
      for (const { talhao, itens } of linhasPorTalhao) {
        const novos = await criarPontosColetaEmLote(
          talhao.id,
          itens.map(({ ponto }) => ({
            geometria: pontoFeature(ponto.lat, ponto.lng),
            propriedades: ponto.propriedades,
          })),
        )
        contagem += novos.length
        gravados.push(...novos)
        setProgresso({ feito: contagem, total: totalAImportar })
      }
      setResultado(`${contagem} ${contagem === 1 ? 'ponto de amostra importado' : 'pontos de amostra importados'}.`)
      setResultadoGlebas('')
      setImportados(gravados)
      setPontos(null)
    } catch (e) {
      setErro(`${e.message} Antes do erro, ${contagem} ponto(s) já tinham sido importados — eles continuam salvos.`)
    } finally {
      setGravando(false)
      setProgresso(null)
    }
  }

  if (!fazendaSelecionada) {
    return <Caixa>Escolha uma fazenda na barra lateral para importar os pontos de amostra.</Caixa>
  }
  if (!editor) {
    return <Caixa>Só quem pode editar a fazenda importa pontos de amostra.</Caixa>
  }
  if (talhoes.length === 0) {
    return <Caixa>Esta fazenda ainda não tem talhões. Cadastre os talhões antes de importar os pontos de amostra.</Caixa>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Importar pontos de amostra</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Fazenda {fazendaSelecionada.nome}. Os pontos são salvos como pontos de amostra independentes, associados ao talhão
          onde caem. Eles não criam glebas nem análises.
        </p>
      </div>

      <label
        htmlFor="importar-pontos"
        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-300 px-4 py-8 text-center hover:border-solo-500 dark:border-white/15 dark:hover:border-solo-500"
      >
        <span aria-hidden="true" className="text-2xl">📍</span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {lendo ? 'Lendo arquivo…' : '          Clique para escolher o arquivo de pontos de amostra'}
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

      {resultadoGlebas && (
        <p role="status" className="rounded-md border border-solo-100 bg-solo-50 px-3 py-2 text-sm font-medium text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300">
          {resultadoGlebas}
        </p>
      )}

      {plano && (
        <div className="space-y-3 rounded-lg border border-solo-200 bg-white px-4 py-4 shadow-sm dark:border-solo-500/30 dark:bg-white/5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Criar as glebas automaticamente?</h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Os pontos que têm o mesmo código no arquivo são coletas da mesma amostra. Posso ler os {plano.totalPontos} pontos
              importados e criar uma gleba para cada código, no talhão onde eles estão (talhão 7, código 12 → gleba{' '}
              <span className="font-mono">7-12</span>). A gleba é o contorno dos pontos; com menos de 3 pontos, ou todos em linha,
              ela fica como um ponto.
            </p>
          </div>

          <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
            <li>
              <strong className="font-medium text-slate-800 dark:text-slate-200">{plano.novas.length}</strong>{' '}
              {plano.novas.length === 1 ? 'gleba será criada' : 'glebas serão criadas'}
            </li>
            {plano.jaExistem > 0 && (
              <li>
                {plano.jaExistem} {plano.jaExistem === 1 ? 'código já tem gleba' : 'códigos já têm gleba'} no talhão e{' '}
                {plano.jaExistem === 1 ? 'será pulado' : 'serão pulados'}
              </li>
            )}
            {plano.semCodigo > 0 && (
              <li className="text-amber-700 dark:text-amber-300">
                {plano.semCodigo} {plano.semCodigo === 1 ? 'ponto não tem' : 'pontos não têm'} código no arquivo e ficam de fora
              </li>
            )}
          </ul>

          <div className="flex items-center justify-between gap-2">
            {criandoGlebas ? (
              <p role="status" aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
                Criando glebas: {criandoGlebas.feito} de {criandoGlebas.total}…
              </p>
            ) : <span />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setImportados(null)}
                disabled={Boolean(criandoGlebas)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={() => void criarGlebasAutomaticas()}
                disabled={Boolean(criandoGlebas) || plano.novas.length === 0}
                aria-busy={Boolean(criandoGlebas)}
                className="rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-solo-600 dark:hover:bg-solo-700 dark:disabled:bg-slate-600"
              >
                {criandoGlebas
                  ? 'Criando…'
                  : plano.novas.length === 0
                    ? 'Nada a criar'
                    : `Criar ${plano.novas.length} ${plano.novas.length === 1 ? 'gleba' : 'glebas'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {distribuicao && (
        <>
          <div className="rounded-md border border-solo-100 bg-solo-50 px-3 py-2 text-sm text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300">
            <strong className="font-medium">{nomeArquivo}</strong> · {pontos.length} pontos de amostra lidos: {totalAImportar - distribuicao.fora.length} dentro
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
                  <th className="px-3 py-2 font-medium">Pontos de amostra a importar</th>
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
