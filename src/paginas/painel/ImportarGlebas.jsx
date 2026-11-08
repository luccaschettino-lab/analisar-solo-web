import { useMemo, useRef, useState } from 'react'
import { candidatosDoArquivo, EXTENSOES_ACEITAS } from '../../lib/importarArquivo.js'
import { prepararLinhasDeGlebas, errosDasLinhasDeGlebas } from '../../lib/importarGlebas.js'
import { avaliarContencao, CONTENCAO, ehPonto } from '../../lib/geo.js'
import { pontosNaGleba } from '../../lib/pontosDeColeta.js'
import { criarGlebasEmLote } from '../../dados/glebas.js'
import { listarPontosColetaDaFazenda, vincularPontosColetaAGleba } from '../../dados/pontosColeta.js'

const CAMPO =
  'w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-solo-600 focus:ring-1 focus:ring-solo-100 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30'

function descricaoDaGeometria(linha) {
  if (ehPonto(linha.geometria)) return 'ponto'
  if (linha.areaHa == null) return '—'
  return `${linha.areaHa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
}

/**
 * Assistente de importação de glebas a partir de um arquivo geoespacial (KML,
 * KMZ, GeoJSON ou shapefile zipado) — o irmão do "Importar talhões", com o
 * mesmo painel lateral e a mesma revisão antes de gravar.
 *
 * O que muda: a gleba vive dentro de um talhão. Cada linha traz o talhão que
 * o arquivo "cai" (descoberto pela posição) e deixa trocá-lo; quando nenhum
 * talhão contém a gleba, a escolha é da pessoa. Polígonos e pontos entram: a
 * gleba pode ser uma sub-área ou um ponto de coleta.
 *
 * Opcionalmente liga, a cada gleba de área criada, os pontos de amostra que
 * caem dentro dela e ainda não têm gleba — o que faz o mapa de calor e a
 * importação de laudos acharem a posição da amostra.
 */
export default function ImportarGlebas({ fazendaId, talhoes, glebas, aoFechar, aoImportado }) {
  const [linhas, setLinhas] = useState(null) // null = ainda na etapa de escolher o arquivo
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [erroArquivo, setErroArquivo] = useState('')
  const [lendoArquivo, setLendoArquivo] = useState(false)
  const [ligarPontos, setLigarPontos] = useState(true)
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [erroImportacao, setErroImportacao] = useState('')

  // O recorte geométrico é caro demais para refazer a cada tecla digitada.
  const cacheContencao = useRef(new Map())

  async function aoEscolherArquivos(evento) {
    const arquivos = Array.from(evento.target.files ?? [])
    evento.target.value = ''
    if (arquivos.length === 0) return

    setErroArquivo('')
    setNomeArquivo(arquivos.length === 1 ? arquivos[0].name : `${arquivos.length} arquivos`)
    setLendoArquivo(true)
    try {
      const candidatos = []
      const falhas = []
      for (const arquivo of arquivos) {
        try {
          for (const c of await candidatosDoArquivo(arquivo, { pontos: true })) {
            candidatos.push({ ...c, arquivo: arquivo.name })
          }
        } catch (e) {
          falhas.push(`${arquivo.name}: ${e.message}`)
        }
      }
      if (candidatos.length === 0) {
        setErroArquivo(falhas.join(' | '))
        setLinhas(null)
        return
      }
      cacheContencao.current = new Map()
      setLinhas(prepararLinhasDeGlebas(candidatos, talhoes))
      // Arquivos que falharam não derrubam os demais — ficam como aviso.
      setErroArquivo(falhas.join(' | '))
    } finally {
      setLendoArquivo(false)
    }
  }

  function atualizarLinha(id, patch) {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const erros = useMemo(() => {
    if (!linhas) return new Map()
    return errosDasLinhasDeGlebas(linhas, {
      talhoes,
      glebasExistentes: glebas,
      contencaoDe: (linha, talhao) => {
        // O talhão achado pela posição já foi conferido ao ser achado.
        if (linha.talhaoAutomatico) return CONTENCAO.DENTRO
        const chave = `${linha.id}|${talhao.id}`
        if (!cacheContencao.current.has(chave)) {
          cacheContencao.current.set(chave, avaliarContencao(linha.geometria, talhao.geometria).situacao)
        }
        return cacheContencao.current.get(chave)
      },
    })
  }, [linhas, talhoes, glebas])

  const incluidas = linhas?.filter((l) => l.incluir) ?? []
  const semTalhao = incluidas.filter((l) => !l.talhaoId).length
  const temErro = incluidas.some((l) => (erros.get(l.id) ?? []).length > 0)
  const podeImportar = linhas && incluidas.length > 0 && !temErro && !importando

  async function confirmar() {
    if (!podeImportar) return
    setErroImportacao('')
    setImportando(true)

    const criadas = []
    let pontosLigados = 0

    try {
      // Uma gravação por talhão (cada lote é atômico: ou entra inteiro ou nada).
      const porTalhao = new Map()
      for (const l of incluidas) {
        if (!porTalhao.has(l.talhaoId)) porTalhao.set(l.talhaoId, [])
        porTalhao.get(l.talhaoId).push(l)
      }

      setProgresso({ etapa: 'Gravando glebas', feito: 0, total: incluidas.length })
      for (const [talhaoId, itens] of porTalhao) {
        const novas = await criarGlebasEmLote(
          talhaoId,
          itens.map((l) => ({ codigo: l.codigo, nome: l.nome, geometria: l.geometria, areaHa: l.areaHa })),
        )
        criadas.push(...novas)
        setProgresso((p) => ({ ...p, feito: criadas.length }))
      }

      if (ligarPontos) {
        const comArea = criadas.filter((g) => !ehPonto(g.geometria))
        if (comArea.length > 0) {
          setProgresso({ etapa: 'Ligando pontos de amostra', feito: 0, total: comArea.length })
          const livres = (await listarPontosColetaDaFazenda(fazendaId)).filter((p) => !p.gleba_id)
          const usados = new Set()
          for (const [i, gleba] of comArea.entries()) {
            // Só pontos do mesmo talhão da gleba: o banco recusa ligar de outro.
            const candidatos = livres.filter((p) => p.talhao_id === gleba.talhao_id && !usados.has(p.id))
            const ids = pontosNaGleba(candidatos, gleba.geometria).map((p) => p.id)
            pontosLigados += await vincularPontosColetaAGleba(gleba.id, ids)
            ids.forEach((id) => usados.add(id))
            setProgresso((p) => ({ ...p, feito: i + 1 }))
          }
        }
      }

      // Só fecha no sucesso completo — no erro, quem revisa precisa ver a
      // mensagem e o que sobrou pendente continua na tela.
      aoImportado({ glebas: criadas, pontosLigados })
      aoFechar()
    } catch (e) {
      // O que já foi gravado não pode ser desfeito daqui — e não devia sumir
      // da tela só porque o resto falhou.
      if (criadas.length) aoImportado({ glebas: criadas, pontosLigados })
      setErroImportacao(
        `${e.message} Antes do erro, ${criadas.length} gleba(s) já tinham sido gravadas — elas continuam salvas` +
          `${pontosLigados ? ` (com ${pontosLigados} ponto(s) ligados)` : ''}. Não importe o mesmo arquivo de novo sem tirar as já criadas.`,
      )
      setImportando(false)
    }
  }

  return (
    <aside className="fixed inset-0 z-[2000] flex flex-col bg-white shadow-xl dark:bg-noite-900 sm:inset-y-0 sm:left-0 sm:right-auto sm:w-[40rem] sm:border-r sm:border-slate-200 dark:sm:border-white/10">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Importar glebas</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Glebas a partir de um ou mais arquivos do QGIS, Google Earth ou app de campo — .kml, .kmz,
            .geojson ou shapefile (.zip). Podem ser polígonos ou pontos.
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
        {talhoes.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Esta fazenda ainda não tem talhões. Cada gleba pertence a um talhão, então importe ou cadastre os talhões antes.
          </p>
        ) : !linhas ? (
          <div>
            <label
              htmlFor="importar-glebas"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-10 text-center hover:border-solo-500 dark:border-white/15 dark:hover:border-solo-500"
            >
              <span aria-hidden="true" className="text-2xl">🗺</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {lendoArquivo ? 'Lendo arquivo…' : 'Clique para escolher um ou vários arquivos'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                .kml, .kmz, .geojson ou shapefile (.zip). Cada polígono ou ponto vira uma linha para revisar
                antes de gravar; o talhão de cada gleba é sugerido pela posição.
              </span>
            </label>
            <input
              id="importar-glebas"
              type="file"
              multiple
              accept={EXTENSOES_ACEITAS}
              onChange={aoEscolherArquivos}
              disabled={lendoArquivo}
              className="hidden"
            />
            {erroArquivo && (
              <p role="alert" className="mt-3 whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
                {nomeArquivo && <span className="block font-medium">{nomeArquivo}</span>}
                {erroArquivo}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-solo-100 bg-solo-50 px-3 py-2 text-xs text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300">
              <strong className="font-medium">{nomeArquivo}</strong> · {linhas.length}{' '}
              {linhas.length === 1 ? 'gleba encontrada' : 'glebas encontradas'}, {incluidas.length}{' '}
              {incluidas.length === 1 ? 'selecionada' : 'selecionadas'}.
              {semTalhao > 0 && (
                <strong className="font-medium"> {semTalhao} sem talhão: escolha o talhão de cada uma.</strong>
              )}
            </div>

            {erroArquivo && (
              <p role="alert" className="whitespace-pre-line rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
                Alguns arquivos foram ignorados: {erroArquivo}
              </p>
            )}

            <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={ligarPontos}
                onChange={(e) => setLigarPontos(e.target.checked)}
                disabled={importando}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-solo-700 focus:ring-solo-600 dark:border-white/20 dark:bg-noite-800"
              />
              <span>
                Ligar a cada gleba os pontos de amostra que caem dentro dela
                <span className="block text-slate-400 dark:text-slate-500">
                  Só pontos do mesmo talhão e que ainda não pertencem a outra gleba. Vale para glebas de área; ponto não liga nada.
                </span>
              </span>
            </label>

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
                          {linhas.some((x) => x.arquivo !== l.arquivo) && `${l.arquivo} · `}
                          {l.nomeOriginal || '(sem nome no arquivo)'} · {descricaoDaGeometria(l)}
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
                            value={l.talhaoId}
                            onChange={(e) => atualizarLinha(l.id, { talhaoId: e.target.value, talhaoAutomatico: false })}
                            disabled={!l.incluir}
                            className={`${CAMPO} w-40`}
                            aria-label="Talhão"
                          >
                            <option value="">Talhão…</option>
                            {talhoes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.nome ? `${t.codigo} · ${t.nome}` : t.codigo}
                              </option>
                            ))}
                          </select>
                        </div>

                        {l.incluir && l.talhaoAutomatico && (
                          <p className="text-xs text-slate-400 dark:text-slate-500">Talhão encontrado pela posição.</p>
                        )}
                        {errosLinha.length > 0 && (
                          <p className="text-xs text-red-700 dark:text-red-300">{errosLinha.join(' ')}</p>
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
        <span role="status" aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
          {importando && progresso && `${progresso.etapa}: ${progresso.feito} de ${progresso.total}…`}
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
