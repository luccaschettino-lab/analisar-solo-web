import { useMemo, useRef, useState } from 'react'
import { candidatosDoArquivo, EXTENSOES_ACEITAS } from '../../lib/importarArquivo.js'
import { prepararLinhasDeImportacao } from '../../lib/kml.js'
import { avaliarContencao, CONTENCAO } from '../../lib/geo.js'
import { criarTalhao } from '../../dados/talhoes.js'
import { criarGleba } from '../../dados/glebas.js'
import { CORES_TALHAO } from '../../config/mapa.js'

const CAMPO =
  'w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-solo-600 focus:ring-1 focus:ring-solo-100 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30'

function formatarArea(ha) {
  if (ha == null) return '—'
  return `${ha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
}

/**
 * Assistente de importação de talhões/glebas a partir de um arquivo
 * geoespacial (KML, KMZ, GeoJSON ou shapefile zipado) — a única forma de
 * criar um talhão agora. Desenhar um talhão do zero no mapa saiu de propósito:
 * com o volume de talhões de uma fazenda de verdade, digitar vértice por
 * vértice não compete com abrir o arquivo que o QGIS ou o app de campo já
 * exportou.
 *
 * Fica num painel largo, não num Modal pequeno — a lista de polígonos para
 * revisar não cabe num diálogo centralizado.
 *
 * Duas etapas: escolher o arquivo, e revisar/ajustar cada polígono antes de
 * gravar. Nada é salvo até o "Importar" — o volume é alto o bastante para um
 * erro em massa ser caro.
 */
export default function ImportarArquivo({ fazendaId, talhoes, aoFechar, aoImportado }) {
  const [linhas, setLinhas] = useState(null) // null = ainda na etapa de escolher o arquivo
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [erroArquivo, setErroArquivo] = useState('')
  const [lendoArquivo, setLendoArquivo] = useState(false)
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [erroImportacao, setErroImportacao] = useState('')
  const entradaArquivo = useRef(null)

  async function aoEscolherArquivo(evento) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return

    setErroArquivo('')
    setNomeArquivo(arquivo.name)
    setLendoArquivo(true)
    try {
      const candidatos = await candidatosDoArquivo(arquivo)
      setLinhas(prepararLinhasDeImportacao(candidatos))
    } catch (e) {
      setErroArquivo(e.message)
      setLinhas(null)
    } finally {
      setLendoArquivo(false)
    }
  }

  function atualizarLinha(id, patch) {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  // Quem pode ser "pai" de uma gleba: os talhões já existentes na fazenda,
  // mais as linhas deste próprio arquivo marcadas como talhão — uma gleba
  // pode nascer junto com o talhão dela, na mesma importação.
  const paisDisponiveis = useMemo(() => {
    const existentes = talhoes.map((t) => ({
      id: t.id, codigo: t.codigo, geometria: t.geometria, novo: false,
    }))
    const doArquivo = (linhas ?? [])
      .filter((l) => l.incluir && l.tipo === 'talhao')
      .map((l) => ({ id: l.id, codigo: l.codigo, geometria: l.geometria, novo: true }))
    return [...existentes, ...doArquivo]
  }, [talhoes, linhas])

  // Erros por linha — o que trava o botão de importar. Recalculado a cada
  // edição porque um código digitado numa linha pode resolver (ou criar) um
  // conflito em outra.
  const erros = useMemo(() => {
    if (!linhas) return new Map()
    const mapa = new Map()

    const contagemCodigoTalhao = new Map()
    for (const l of linhas) {
      if (l.incluir && l.tipo === 'talhao' && l.codigo.trim()) {
        const c = l.codigo.trim()
        contagemCodigoTalhao.set(c, (contagemCodigoTalhao.get(c) ?? 0) + 1)
      }
    }
    const codigosExistentes = new Set(talhoes.map((t) => t.codigo))

    for (const l of linhas) {
      if (!l.incluir) continue
      const lista = []
      const codigo = l.codigo.trim()

      if (!codigo) {
        lista.push('Código obrigatório.')
      } else if (l.tipo === 'talhao') {
        if (contagemCodigoTalhao.get(codigo) > 1) lista.push('Código repetido nesta importação.')
        if (codigosExistentes.has(codigo)) lista.push(`Já existe um talhão "${codigo}" nesta fazenda.`)
      }

      if (l.tipo === 'gleba') {
        // Busca na lista atual, não só o id: se o pai escolhido saiu da
        // lista (desmarcado, ou virou gleba ele mesmo), o id fica pra trás
        // apontando pra nada — e isso deve pedir escolha de novo, não passar
        // batido como "não dá pra verificar".
        const pai = paisDisponiveis.find((p) => p.id === l.talhaoPaiId)
        if (!pai) {
          lista.push('Escolha o talhão desta gleba.')
        } else {
          const { situacao } = avaliarContencao(l.geometria, pai.geometria)
          if (situacao === CONTENCAO.FORA) lista.push('Fica fora do talhão escolhido.')
        }
      }

      mapa.set(l.id, lista)
    }
    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, talhoes, paisDisponiveis])

  const incluidas = linhas?.filter((l) => l.incluir) ?? []
  const temErro = incluidas.some((l) => (erros.get(l.id) ?? []).length > 0)
  const podeImportar = linhas && incluidas.length > 0 && !temErro && !importando

  async function confirmar() {
    if (!podeImportar) return
    setErroImportacao('')
    setImportando(true)
    setProgresso({ feito: 0, total: incluidas.length })

    const idReal = new Map() // id da linha -> id real gravado no banco
    const talhoesCriados = []
    const glebasCriadas = []

    try {
      const linhasTalhao = incluidas.filter((l) => l.tipo === 'talhao')
      for (const [i, l] of linhasTalhao.entries()) {
        const salvo = await criarTalhao({
          fazendaId,
          codigo: l.codigo,
          nome: l.nome,
          geometria: l.geometria,
          areaHa: l.areaHa,
          cor: CORES_TALHAO[i % CORES_TALHAO.length],
        })
        idReal.set(l.id, salvo.id)
        talhoesCriados.push(salvo)
        setProgresso((p) => ({ ...p, feito: p.feito + 1 }))
      }

      const linhasGleba = incluidas.filter((l) => l.tipo === 'gleba')
      for (const l of linhasGleba) {
        const talhaoId = idReal.get(l.talhaoPaiId) ?? l.talhaoPaiId
        const salvo = await criarGleba({
          talhaoId,
          codigo: l.codigo,
          nome: l.nome,
          geometria: l.geometria,
          areaHa: l.areaHa,
        })
        glebasCriadas.push(salvo)
        setProgresso((p) => ({ ...p, feito: p.feito + 1 }))
      }

      // Só fecha no sucesso completo — no erro, quem revisa precisa ver a
      // mensagem e o que sobrou pendente continua na tela.
      aoImportado({ talhoes: talhoesCriados, glebas: glebasCriadas })
      aoFechar()
    } catch (e) {
      // O que já foi gravado no banco não pode ser desfeito daqui — e não
      // devia sumir da tela só porque o resto falhou.
      if (talhoesCriados.length || glebasCriadas.length) aoImportado({ talhoes: talhoesCriados, glebas: glebasCriadas })
      setErroImportacao(
        `${e.message} Antes do erro, ${talhoesCriados.length} talhão(ões) e ${glebasCriadas.length} gleba(s) já tinham sido gravados — eles continuam salvos.`,
      )
      setImportando(false)
    }
  }

  return (
    <aside className="fixed inset-0 z-[2000] flex flex-col bg-white shadow-xl dark:bg-noite-900 sm:inset-y-0 sm:left-0 sm:right-auto sm:w-[40rem] sm:border-r sm:border-slate-200 dark:sm:border-white/10">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Importar arquivo</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Talhões e glebas a partir de um arquivo do QGIS, Google Earth ou app de campo —
            .kml, .kmz, .geojson ou shapefile (.zip).
          </p>
        </div>
        <button
          onClick={aoFechar}
          disabled={importando}
          aria-label="Fechar"
          className="shrink-0 rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {!linhas ? (
          <div>
            <label
              htmlFor="importar-arquivo"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-10 text-center hover:border-solo-500 dark:border-white/15 dark:hover:border-solo-500"
            >
              <span aria-hidden="true" className="text-2xl">🗺</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {lendoArquivo ? 'Lendo arquivo…' : 'Clique para escolher um arquivo'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                .kml, .kmz, .geojson ou shapefile (.zip). Cada polígono vira uma linha para revisar antes de gravar.
              </span>
            </label>
            <input
              ref={entradaArquivo}
              id="importar-arquivo"
              type="file"
              accept={EXTENSOES_ACEITAS}
              onChange={aoEscolherArquivo}
              disabled={lendoArquivo}
              className="hidden"
            />
            {erroArquivo && (
              <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
                {nomeArquivo && <span className="block font-medium">{nomeArquivo}</span>}
                {erroArquivo}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-solo-100 bg-solo-50 px-3 py-2 text-xs text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300">
              <strong className="font-medium">{nomeArquivo}</strong> · {linhas.length}{' '}
              {linhas.length === 1 ? 'polígono encontrado' : 'polígonos encontrados'}, {incluidas.length}{' '}
              {incluidas.length === 1 ? 'selecionado' : 'selecionados'}.
              {' '}Confira código, tipo e talhão de cada um antes de importar.
            </div>

            <ul className="space-y-2">
              {linhas.map((l) => {
                const errosLinha = erros.get(l.id) ?? []
                return (
                  <li
                    key={l.id}
                    className={`rounded-md border px-3 py-2 ${
                      !l.incluir
                        ? 'border-slate-200 opacity-50 dark:border-white/10'
                        : errosLinha.length > 0
                          ? 'border-red-300 dark:border-red-400/40'
                          : 'border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={l.incluir}
                        onChange={(e) => atualizarLinha(l.id, { incluir: e.target.checked })}
                        className="mt-1.5 h-4 w-4 shrink-0 rounded border-slate-300 text-solo-700 focus:ring-solo-600 dark:border-white/20 dark:bg-noite-800"
                        aria-label={`Incluir ${l.nomeOriginal}`}
                      />

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="truncate text-xs text-slate-400 dark:text-slate-500" title={l.nomeOriginal}>
                          {l.nomeOriginal || '(sem nome no arquivo)'} · {formatarArea(l.areaHa)}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          <input
                            value={l.codigo}
                            onChange={(e) => atualizarLinha(l.id, { codigo: e.target.value })}
                            disabled={!l.incluir}
                            placeholder="Código"
                            className={`${CAMPO} w-20`}
                            aria-label="Código"
                          />
                          <input
                            value={l.nome}
                            onChange={(e) => atualizarLinha(l.id, { nome: e.target.value })}
                            disabled={!l.incluir}
                            placeholder="Nome (opcional)"
                            className={`${CAMPO} min-w-0 flex-1`}
                            aria-label="Nome"
                          />
                          <select
                            value={l.tipo}
                            onChange={(e) =>
                              atualizarLinha(l.id, {
                                tipo: e.target.value,
                                talhaoPaiId: e.target.value === 'talhao' ? null : l.talhaoPaiId,
                              })
                            }
                            disabled={!l.incluir}
                            className={`${CAMPO} w-24`}
                            aria-label="Tipo"
                          >
                            <option value="talhao">Talhão</option>
                            <option value="gleba">Gleba</option>
                          </select>
                        </div>

                        {l.tipo === 'gleba' && (
                          <select
                            value={l.talhaoPaiId ?? ''}
                            onChange={(e) => atualizarLinha(l.id, { talhaoPaiId: e.target.value || null })}
                            disabled={!l.incluir}
                            className={CAMPO}
                            aria-label="Talhão desta gleba"
                          >
                            <option value="">Escolha o talhão…</option>
                            {paisDisponiveis.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.codigo} {p.novo ? '(deste arquivo)' : ''}
                              </option>
                            ))}
                          </select>
                        )}

                        {errosLinha.length > 0 && (
                          <p className="text-[11px] text-red-700 dark:text-red-300">{errosLinha.join(' ')}</p>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            {erroImportacao && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
                {erroImportacao}
              </p>
            )}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-white/10">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {importando && progresso && `Importando ${progresso.feito} de ${progresso.total}…`}
        </span>
        <div className="flex gap-2">
          <button
            onClick={aoFechar}
            disabled={importando}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10"
          >
            {linhas ? 'Cancelar' : 'Fechar'}
          </button>
          {linhas && (
            <button
              onClick={confirmar}
              disabled={!podeImportar}
              className="rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-solo-600 dark:hover:bg-solo-700 dark:disabled:bg-slate-600"
            >
              {importando
                ? 'Importando…'
                : incluidas.length === 0
                  ? 'Nada selecionado'
                  : `Importar ${incluidas.length}`}
            </button>
          )}
        </div>
      </footer>
    </aside>
  )
}
