import { useMemo, useState } from 'react'
import { useFazendaAtual } from '../../../context/FazendaContext.jsx'
import { extrairLinhasPdf } from '../../../lib/extrairLinhasPdf.js'
import { lerLaudoUfv, ehLaudoUfv, anoSafraDaData } from '../../../lib/laudoUfv.js'
import { resolverAmostraDoLaudo, payloadDaAmostra, chaveDeDuplicidade, STATUS } from '../../../lib/importacaoLaudo.js'
import { listarPontosColetaDaFazenda } from '../../../dados/pontosColeta.js'
import { criarAnalisesEmLote, listarIdentidadesDaFazenda } from '../../../dados/analises.js'

const LIMITE_BYTES = 25 * 1024 * 1024
const PROFUNDIDADES = ['0-20', '20-40', '40-60', 'outro']

const ROTULO_STATUS = {
  [STATUS.PRONTA]: { texto: 'Pronta', cor: 'text-solo-800 bg-solo-50 dark:text-solo-300 dark:bg-solo-500/10' },
  [STATUS.DUPLICADA]: { texto: 'Já importada', cor: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-white/10' },
  [STATUS.SEM_GLEBA]: { texto: 'Sem gleba', cor: 'text-amber-900 bg-amber-100 dark:text-amber-200 dark:bg-amber-500/15' },
  [STATUS.AMBIGUA]: { texto: 'Escolha a gleba', cor: 'text-amber-900 bg-amber-100 dark:text-amber-200 dark:bg-amber-500/15' },
  [STATUS.SEM_PONTO]: { texto: 'Gleba sem ponto', cor: 'text-amber-900 bg-amber-100 dark:text-amber-200 dark:bg-amber-500/15' },
  [STATUS.SEM_PROFUNDIDADE]: { texto: 'Falta profundidade', cor: 'text-amber-900 bg-amber-100 dark:text-amber-200 dark:bg-amber-500/15' },
}

const CAMPO =
  'rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100'

const formatar = (v) => (v == null ? '—' : String(v).replace('.', ','))
const safraValida = (s) => {
  const m = /^(\d{2})-(\d{2})$/.exec(s.trim())
  return Boolean(m) && (Number(m[1]) + 1) % 100 === Number(m[2])
}

/**
 * Importação de laudo em PDF (UFV).
 *
 * O PDF é lido aqui no navegador — não sai da máquina. Cada amostra vira uma
 * linha de conferência: a que gleba pertence, em que profundidade, e se já foi
 * importada. Nada é gravado até clicar em "Gravar", e só o que está pronto e
 * marcado entra. Contrato e regras: README.md ao lado.
 */
export default function ImportarPdf() {
  const { fazendaSelecionada, talhoes, glebas, editor, recarregarAnalises } = useFazendaAtual()

  const [laudos, setLaudos] = useState([]) // { nomeArquivo, laudo }
  const [contexto, setContexto] = useState(null) // { pontos, identidades }
  const [anoSafra, setAnoSafra] = useState('')
  const [escolhas, setEscolhas] = useState({}) // chave da linha -> { glebaId, profundidade }
  const [desmarcadas, setDesmarcadas] = useState(() => new Set())
  const [lendo, setLendo] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(null)
  const [resultado, setResultado] = useState('')

  const codigoDoTalhao = useMemo(() => new Map(talhoes.map((t) => [t.id, t.codigo])), [talhoes])

  async function lerArquivos(lista) {
    const arquivos = [...lista]
    if (arquivos.length === 0) return
    setErro('')
    setResultado('')
    setLendo(true)
    try {
      const lidos = []
      for (const arquivo of arquivos) {
        if (!/\.pdf$/i.test(arquivo.name)) throw new Error(`"${arquivo.name}" não é um PDF.`)
        if (arquivo.size > LIMITE_BYTES) throw new Error(`"${arquivo.name}" passa de 25 MB.`)
        const paginas = await extrairLinhasPdf(await arquivo.arrayBuffer())
        if (!ehLaudoUfv(paginas.flat())) {
          throw new Error(
            `"${arquivo.name}" não parece um laudo da UFV. Por enquanto só esse formato é lido; para outros laboratórios, use a Entrada manual.`,
          )
        }
        const laudo = lerLaudoUfv(paginas)
        if (laudo.amostras.length === 0) throw new Error(`Não encontrei nenhuma amostra em "${arquivo.name}".`)
        lidos.push({ nomeArquivo: arquivo.name, laudo })
      }

      // O que a conferência precisa saber da fazenda: pontos de coleta (posição
      // da amostra) e o que já foi gravado (para não duplicar).
      const [pontos, identidades] = await Promise.all([
        listarPontosColetaDaFazenda(fazendaSelecionada.id),
        listarIdentidadesDaFazenda(fazendaSelecionada.id),
      ])

      setLaudos(lidos)
      setContexto({ pontos, identidades })
      setAnoSafra(anoSafraDaData(lidos[0].laudo.entrada))
      setEscolhas({})
      setDesmarcadas(new Set())
    } catch (e) {
      setErro(e.message)
    } finally {
      setLendo(false)
    }
  }

  const existentes = useMemo(
    () =>
      new Set(
        (contexto?.identidades ?? []).map((a) =>
          chaveDeDuplicidade({
            talhaoId: a.talhao_id,
            anoSafra: a.ano_safra,
            profundidade: a.profundidade,
            numeroAmostraLab: a.numero_amostra_lab,
          }),
        ),
      ),
    [contexto],
  )

  const linhas = useMemo(() => {
    if (!contexto) return []
    return laudos.flatMap(({ nomeArquivo, laudo }, indiceArquivo) =>
      laudo.amostras.map((amostra) => {
        const chave = `${indiceArquivo}:${amostra.n_lab}`
        const resolvida = resolverAmostraDoLaudo(amostra, escolhas[chave], {
          glebas,
          pontos: contexto.pontos,
          anoSafra,
          existentes,
        })
        return { chave, nomeArquivo, laudo, ...resolvida }
      }),
    )
  }, [laudos, contexto, escolhas, glebas, anoSafra, existentes])

  const marcadas = linhas.filter((l) => l.status === STATUS.PRONTA && !desmarcadas.has(l.chave))
  const contagem = (s) => linhas.filter((l) => l.status === s).length
  const pendentes = linhas.filter((l) => ![STATUS.PRONTA, STATUS.DUPLICADA].includes(l.status)).length
  const safraOk = safraValida(anoSafra)

  function escolher(chave, campo, valor) {
    setEscolhas((atual) => ({ ...atual, [chave]: { ...atual[chave], [campo]: valor || undefined } }))
  }

  function alternar(chave) {
    setDesmarcadas((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  function limpar() {
    setLaudos([])
    setContexto(null)
    setEscolhas({})
    setDesmarcadas(new Set())
    setErro('')
  }

  async function gravar() {
    if (marcadas.length === 0 || !safraOk || gravando) return
    setErro('')
    setGravando({ feito: 0, total: marcadas.length })
    try {
      const payloads = marcadas.map((l) =>
        payloadDaAmostra(l, {
          anoSafra: anoSafra.trim(),
          laboratorio: l.laudo.laboratorio,
          solicitacao: l.laudo.solicitacao,
        }),
      )
      const gravadas = await criarAnalisesEmLote(payloads, (feito, total) => setGravando({ feito, total }))
      recarregarAnalises()
      setResultado(
        `${gravadas} ${gravadas === 1 ? 'análise gravada' : 'análises gravadas'} em ${anoSafra.trim()}. O mapa já usa os novos valores.`,
      )
      limpar()
    } catch (e) {
      setErro(`${e.message} Se algumas já entraram, abra o laudo de novo: as já gravadas aparecem como "Já importada".`)
    } finally {
      setGravando(null)
    }
  }

  if (!fazendaSelecionada) {
    return <Caixa>Escolha uma fazenda na barra lateral para importar um laudo.</Caixa>
  }
  if (!editor) {
    return <Caixa>Só quem pode editar a fazenda importa laudos.</Caixa>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Importar laudo em PDF</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Fazenda {fazendaSelecionada.nome}. O laudo (UFV) é lido neste computador; cada amostra vira uma análise na gleba
          que tem o mesmo número. Você confere tudo antes de gravar.
        </p>
      </div>

      {!contexto && (
        <>
          <label
            htmlFor="importar-laudo"
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastando(false)
              void lerArquivos(e.dataTransfer.files)
            }}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-10 text-center transition ${
              arrastando
                ? 'border-solo-500 bg-solo-50 dark:bg-solo-500/10'
                : 'border-slate-300 hover:border-solo-500 dark:border-white/15 dark:hover:border-solo-500'
            }`}
          >
            <span aria-hidden="true" className="text-2xl">📄</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {lendo ? 'Lendo o laudo…' : 'Arraste o laudo em PDF aqui, ou clique para escolher'}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">Pode escolher mais de um arquivo · laudos da UFV</span>
          </label>
          <input
            id="importar-laudo"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={lendo}
            onChange={(e) => {
              const escolhidos = e.target.files
              void lerArquivos(escolhidos).finally(() => {
                e.target.value = ''
              })
            }}
            className="hidden"
          />
        </>
      )}

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

      {contexto && (
        <>
          <div className="rounded-md border border-solo-100 bg-solo-50 px-3 py-2 text-sm text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300">
            {laudos.map((l) => (
              <p key={l.nomeArquivo}>
                <strong className="font-medium">{l.nomeArquivo}</strong> · laudo {l.laudo.solicitacao ?? '—'} ·{' '}
                {l.laudo.amostras.length} amostras
                {l.laudo.identificacao ? ` · ${l.laudo.identificacao}` : ''}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <label htmlFor="laudo-safra" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Ano-safra
              </label>
              <input
                id="laudo-safra"
                value={anoSafra}
                onChange={(e) => setAnoSafra(e.target.value)}
                placeholder="25-26"
                maxLength={5}
                aria-invalid={!safraOk}
                className={`${CAMPO} mt-1 w-24 ${safraOk ? '' : 'border-red-400'}`}
              />
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                {safraOk
                  ? 'Sugerida pela data de entrada do laudo. Confira.'
                  : 'Use o formato 25-26 (dois anos seguidos).'}
              </p>
            </div>
            <ul className="flex flex-wrap gap-2 text-xs">
              <Selo cor={ROTULO_STATUS[STATUS.PRONTA].cor}>{marcadas.length} para gravar</Selo>
              {contagem(STATUS.DUPLICADA) > 0 && (
                <Selo cor={ROTULO_STATUS[STATUS.DUPLICADA].cor}>{contagem(STATUS.DUPLICADA)} já importadas</Selo>
              )}
              {pendentes > 0 && (
                <Selo cor={ROTULO_STATUS[STATUS.SEM_GLEBA].cor}>{pendentes} precisam de atenção</Selo>
              )}
            </ul>
          </div>

          {pendentes > 0 && (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              As amostras que precisam de atenção não são gravadas até você escolher a gleba (ou a profundidade) delas na
              tabela. As que não têm gleba no app podem ser criadas antes, em <strong>Importar pontos de amostra</strong>.
            </p>
          )}

          <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-200 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-noite-800 dark:text-slate-400">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2 font-medium">Nº lab</th>
                  <th className="px-2 py-2 font-medium">Referência</th>
                  <th className="px-2 py-2 font-medium">Prof. (cm)</th>
                  <th className="px-2 py-2 font-medium">Gleba</th>
                  <th className="px-2 py-2 font-medium">Talhão</th>
                  <th className="px-2 py-2 font-medium">pH</th>
                  <th className="px-2 py-2 font-medium">P</th>
                  <th className="px-2 py-2 font-medium">K</th>
                  <th className="px-2 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {linhas.map((l) => {
                  const rotulo = ROTULO_STATUS[l.status]
                  const opcoesDeGleba = l.candidatas.length > 0 ? l.candidatas : glebas
                  const avisos = [...l.amostra.avisos, ...(l.motivo ? [l.motivo] : [])]
                  return (
                    <tr key={l.chave} className={l.status === STATUS.DUPLICADA ? 'opacity-60' : ''}>
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          aria-label={`Gravar a amostra ${l.amostra.n_lab}`}
                          checked={l.status === STATUS.PRONTA && !desmarcadas.has(l.chave)}
                          disabled={l.status !== STATUS.PRONTA}
                          onChange={() => alternar(l.chave)}
                          className="h-4 w-4 rounded border-slate-300 text-solo-600 focus:ring-solo-500 dark:border-white/20"
                        />
                      </td>
                      <td className="px-2 py-1.5 font-mono">{l.amostra.n_lab}</td>
                      <td className="px-2 py-1.5">{l.amostra.referencia || '—'}</td>
                      <td className="px-2 py-1.5">
                        {l.amostra.profundidade ? (
                          l.profundidade
                        ) : (
                          <select
                            aria-label={`Profundidade da amostra ${l.amostra.n_lab}`}
                            value={escolhas[l.chave]?.profundidade ?? ''}
                            onChange={(e) => escolher(l.chave, 'profundidade', e.target.value)}
                            className={CAMPO}
                          >
                            <option value="">escolher…</option>
                            {PROFUNDIDADES.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          aria-label={`Gleba da amostra ${l.amostra.n_lab}`}
                          value={l.gleba?.id ?? ''}
                          onChange={(e) => escolher(l.chave, 'glebaId', e.target.value)}
                          className={`${CAMPO} max-w-[9rem]`}
                        >
                          <option value="">escolher…</option>
                          {opcoesDeGleba.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.codigo} · talhão {codigoDoTalhao.get(g.talhao_id) ?? '?'}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">{l.talhaoId ? (codigoDoTalhao.get(l.talhaoId) ?? '—') : '—'}</td>
                      <td className="px-2 py-1.5">{formatar(l.amostra.parametros.ph_h2o)}</td>
                      <td className="px-2 py-1.5">{formatar(l.amostra.parametros.p)}</td>
                      <td className="px-2 py-1.5">{formatar(l.amostra.parametros.k)}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${rotulo.cor}`}>{rotulo.texto}</span>
                        {avisos.length > 0 && (
                          <span
                            title={avisos.join('\n')}
                            aria-label={`Avisos: ${avisos.join(' ')}`}
                            className="ml-1 cursor-help text-amber-600 dark:text-amber-300"
                          >
                            ⚠
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2">
            {gravando ? (
              <p role="status" aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
                Gravando {gravando.feito} de {gravando.total}…
              </p>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={limpar}
                disabled={Boolean(gravando)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void gravar()}
                disabled={Boolean(gravando) || marcadas.length === 0 || !safraOk}
                aria-busy={Boolean(gravando)}
                className="rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-solo-600 dark:hover:bg-solo-700 dark:disabled:bg-slate-600"
              >
                {gravando
                  ? 'Gravando…'
                  : marcadas.length === 0
                    ? 'Nada para gravar'
                    : `Gravar ${marcadas.length} ${marcadas.length === 1 ? 'análise' : 'análises'}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Selo({ cor, children }) {
  return <li className={`rounded-full px-2.5 py-1 font-medium ${cor}`}>{children}</li>
}

function Caixa({ children }) {
  return (
    <p className="m-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      {children}
    </p>
  )
}
