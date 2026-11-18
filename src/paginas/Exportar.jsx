import { useEffect, useMemo, useState } from 'react'
import { useFazendaAtual } from '../context/FazendaContext.jsx'

/**
 * Exportar: o produtor escolhe o recorte (talhões, safras, profundidades) e o
 * que quer levar — planilha Excel com a cara do Moinho, mapas (KML,
 * Shapefile, GeoJSON), imagens de satélite (NDVI/EVI/SAVI/NDWI em KMZ) e as
 * fotos do perfil do solo. Sai um arquivo só: o .xlsx, ou um ZIP com tudo.
 * Qualquer pessoa com acesso à fazenda pode exportar.
 */

const ABAS = [
  ['glebas', 'Glebas', 'Uma linha por gleba × safra × profundidade, com todos os parâmetros coloridos pelo critério.'],
  ['interpretacao', 'Interpretação', 'A mesma tabela, com o nível escrito (baixo, ideal, alto…).'],
  ['talhoes', 'Talhões', 'Área, número de glebas, análises e safras de cada talhão.'],
  ['analises', 'Análises', 'Cada análise como foi lançada: laboratório, nº da amostra, origem, coordenadas.'],
  ['pontos', 'Pontos de amostra', 'Cada ponto de coleta, com latitude e longitude.'],
  ['satelite', 'Satélite (resumo)', 'NDVI, EVI, SAVI e NDWI médios por talhão e data, dos cálculos já feitos.'],
  ['comparacao', 'Comparação de safras', 'Variação de cada parâmetro entre duas safras, por gleba.'],
  ['criterios', 'Critérios', 'As faixas de interpretação usadas para colorir.'],
]

const FORMATOS_MAPA = [
  ['kml', 'KML', 'Google Earth'],
  ['shp', 'Shapefile', 'QGIS, ArcGIS, agricultura de precisão'],
  ['geojson', 'GeoJSON', 'sistemas web'],
]
const CAMADAS = [
  ['talhoes', 'Talhões'],
  ['glebas', 'Glebas (com a última análise)'],
  ['pontos', 'Pontos de amostra'],
]
const INDICES = [
  ['ndvi', 'NDVI', 'vigor'],
  ['evi', 'EVI', 'vigor, dossel fechado'],
  ['savi', 'SAVI', 'vigor, solo exposto'],
  ['ndwi', 'NDWI', 'água'],
]

const SELECT =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:text-slate-400 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30'

const ordem = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })

function Cartao({ titulo, subtitulo, icone, ativo = true, acao, children }) {
  return (
    <section
      className={`rounded-xl border bg-white p-4 transition dark:bg-white/5 ${
        ativo ? 'border-slate-200 dark:border-white/10' : 'border-dashed border-slate-200 opacity-70 dark:border-white/10'
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-solo-50 text-lg dark:bg-solo-500/15">
          {icone}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
          {subtitulo && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  )
}

function Interruptor({ ligado, aoTrocar, rotulo }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => aoTrocar(!ligado)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500 ${
        ligado ? 'bg-solo-600' : 'bg-slate-300 dark:bg-white/20'
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${ligado ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/** Fichas de escolha múltipla; `null` no conjunto = todas. */
function Fichas({ opcoes, selecionadas, aoTrocar, rotulo }) {
  const todas = selecionadas === null
  const alternar = (v) => {
    const base = todas ? new Set(opcoes.map((o) => o.valor)) : new Set(selecionadas)
    if (base.has(v)) base.delete(v)
    else base.add(v)
    aoTrocar(base.size === opcoes.length ? null : base)
  }
  const ficha = (ativa) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500 ${
      ativa
        ? 'border-solo-600 bg-solo-600 text-white dark:border-solo-500 dark:bg-solo-500'
        : 'border-slate-300 text-slate-600 hover:border-solo-400 hover:text-solo-700 dark:border-white/15 dark:text-slate-300 dark:hover:text-white'
    }`
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => aoTrocar(null)} className={ficha(todas)} aria-pressed={todas}>
        Todos
      </button>
      {opcoes.map((o) => {
        const ativa = !todas && selecionadas.has(o.valor)
        return (
          <button key={o.valor} type="button" onClick={() => alternar(o.valor)} className={ficha(ativa)} aria-pressed={ativa}>
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}

function Marca({ marcado, aoTrocar, titulo, descricao }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5">
      <input type="checkbox" checked={marcado} onChange={(e) => aoTrocar(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-solo-600" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{titulo}</span>
        {descricao && <span className="block text-xs text-slate-500 dark:text-slate-400">{descricao}</span>}
      </span>
    </label>
  )
}

const comAlternancia = (conjunto, valor, ligado) => {
  const novo = new Set(conjunto)
  if (ligado) novo.add(valor)
  else novo.delete(valor)
  return novo
}

export default function Exportar() {
  const { fazendaSelecionada, talhoes, glebas, analisesDaFazenda, anos, criterio, parametrosDoCriterio, semCriterio } = useFazendaAtual()

  // Recorte
  const [selTalhoes, setSelTalhoes] = useState(null)
  const [selSafras, setSelSafras] = useState(null)
  const [selProfs, setSelProfs] = useState(null)

  // O que levar
  const [planilha, setPlanilha] = useState(true)
  const [partes, setPartes] = useState(() => new Set(ABAS.map(([c]) => c)))
  const [comparar, setComparar] = useState({ safraA: '', safraB: '' })
  const [mapas, setMapas] = useState(true)
  const [formatos, setFormatos] = useState(() => new Set(['kml', 'shp']))
  const [camadas, setCamadas] = useState(() => new Set(CAMADAS.map(([c]) => c)))
  const [imagens, setImagens] = useState(true)
  const [indices, setIndices] = useState(() => new Set(['ndvi', 'ndwi']))
  const [quando, setQuando] = useState('recente') // 'recente' | 'data'
  const [dataAlvo, setDataAlvo] = useState(() => new Date().toISOString().slice(0, 10))
  const [fotos, setFotos] = useState(true)

  const [progresso, setProgresso] = useState(null) // { texto, fracao }
  const [resultado, setResultado] = useState(null) // { nome, tamanho, faltas, totais }
  const [erro, setErro] = useState(null)

  // Trocar de fazenda zera o recorte (os ids são de outra fazenda).
  useEffect(() => {
    setSelTalhoes(null)
    setSelSafras(null)
    setSelProfs(null)
    setResultado(null)
    setErro(null)
  }, [fazendaSelecionada?.id])

  const safras = useMemo(() => [...(anos ?? [])].sort().reverse(), [anos])
  const profundidades = useMemo(() => [...new Set((analisesDaFazenda ?? []).map((a) => a.profundidade))].sort(ordem), [analisesDaFazenda])

  // Comparação: por padrão as duas safras mais recentes.
  useEffect(() => {
    setComparar((c) => (c.safraA && safras.includes(c.safraA) && safras.includes(c.safraB) ? c : { safraA: safras[1] ?? '', safraB: safras[0] ?? '' }))
  }, [safras])

  const talhoesOrdenados = useMemo(() => [...talhoes].sort((a, b) => ordem(a.codigo, b.codigo)), [talhoes])

  const partesEfetivas = planilha ? partes : new Set()
  const temAlgo = partesEfetivas.size > 0 || (mapas && formatos.size > 0 && camadas.size > 0) || (imagens && indices.size > 0) || fotos
  const ocupado = progresso !== null

  function marcarTudo() {
    setPlanilha(true)
    setPartes(new Set(ABAS.map(([c]) => c)))
    setMapas(true)
    setFormatos(new Set(FORMATOS_MAPA.map(([c]) => c)))
    setCamadas(new Set(CAMADAS.map(([c]) => c)))
    setImagens(true)
    setIndices(new Set(INDICES.map(([c]) => c)))
    setFotos(true)
  }
  function soPlanilha() {
    setPlanilha(true)
    setMapas(false)
    setImagens(false)
    setFotos(false)
  }

  async function exportar() {
    setErro(null)
    setResultado(null)
    setProgresso({ texto: 'Preparando…', fracao: 0 })
    try {
      const { gerarExportacao } = await import('../lib/exportar/gerar.js')
      const compararValido = partesEfetivas.has('comparacao') && comparar.safraA && comparar.safraB && comparar.safraA !== comparar.safraB ? comparar : null
      const r = await gerarExportacao(
        {
          fazenda: fazendaSelecionada,
          talhoes,
          glebas,
          criterio: semCriterio ? null : criterio,
          parametrosDoCriterio,
          filtro: { talhoes: selTalhoes, safras: selSafras, profundidades: selProfs },
          partes: compararValido ? partesEfetivas : new Set([...partesEfetivas].filter((p) => p !== 'comparacao')),
          comparar: compararValido,
          mapas: mapas ? { formatos, camadas: CAMADAS.map(([c]) => c).filter((c) => camadas.has(c)) } : null,
          fotos,
          imagens: imagens ? { indices: INDICES.map(([c]) => c).filter((c) => indices.has(c)), data: quando === 'data' ? dataAlvo : null } : null,
        },
        (texto, fracao) => setProgresso({ texto, fracao }),
      )
      const url = URL.createObjectURL(r.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = r.nome
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setResultado({ nome: r.nome, tamanho: r.blob.size, faltas: r.faltas, totais: r.totais })
    } catch (e) {
      setErro(e.message || 'Não foi possível gerar a exportação.')
    } finally {
      setProgresso(null)
    }
  }

  if (!fazendaSelecionada) {
    return (
      <p className="m-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        Escolha uma fazenda na barra lateral para exportar os dados.
      </p>
    )
  }

  const resumo = []
  if (partesEfetivas.size) resumo.push(`Planilha Excel com ${partesEfetivas.size + 1} abas`)
  if (mapas && formatos.size && camadas.size) resumo.push(`Mapas em ${FORMATOS_MAPA.filter(([c]) => formatos.has(c)).map(([, n]) => n).join(', ')}`)
  if (imagens && indices.size) resumo.push(`Imagens de ${INDICES.filter(([c]) => indices.has(c)).map(([, n]) => n).join(', ')} de cada talhão`)
  if (fotos) resumo.push('Fotos do perfil do solo')
  const vaiSerZip = resumo.length > 1 || !partesEfetivas.size
  const nTalhoes = selTalhoes === null ? talhoes.length : selTalhoes.size

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-noite-900 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-solo-50 text-lg dark:bg-solo-500/15">
            📦
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Exportar</h1>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{fazendaSelecionada.nome} · escolha o que levar e baixe num arquivo só</p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={soPlanilha} disabled={ocupado} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
            Só a planilha
          </button>
          <button type="button" onClick={marcarTudo} disabled={ocupado} className="rounded-md border border-solo-600 px-3 py-1.5 text-sm font-semibold text-solo-700 hover:bg-solo-50 disabled:opacity-50 dark:border-solo-500 dark:text-solo-300 dark:hover:bg-solo-500/10">
            Marcar tudo
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <fieldset disabled={ocupado} className="min-w-0 space-y-4">
            <Cartao icone="🎯" titulo="Recorte" subtitulo="Vale para tudo o que for exportado.">
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Talhões</p>
                  <Fichas rotulo="Talhões" opcoes={talhoesOrdenados.map((t) => ({ valor: t.id, rotulo: t.codigo }))} selecionadas={selTalhoes} aoTrocar={setSelTalhoes} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Safras</p>
                    {safras.length ? (
                      <Fichas rotulo="Safras" opcoes={safras.map((s) => ({ valor: s, rotulo: s }))} selecionadas={selSafras} aoTrocar={setSelSafras} />
                    ) : (
                      <p className="text-xs text-slate-400">Nenhuma análise lançada ainda.</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Profundidades (cm)</p>
                    {profundidades.length ? (
                      <Fichas rotulo="Profundidades" opcoes={profundidades.map((p) => ({ valor: p, rotulo: p }))} selecionadas={selProfs} aoTrocar={setSelProfs} />
                    ) : (
                      <p className="text-xs text-slate-400">—</p>
                    )}
                  </div>
                </div>
              </div>
            </Cartao>

            <Cartao
              icone="📊"
              titulo="Planilha Excel"
              subtitulo="Com a logo do Moinho na capa, valores coloridos pelo critério e filtros em cada coluna."
              ativo={planilha}
              acao={<Interruptor ligado={planilha} aoTrocar={setPlanilha} rotulo="Incluir planilha" />}
            >
              {planilha && (
                <>
                  {semCriterio && (
                    <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                      Esta fazenda está sem critério de interpretação: os valores saem sem cor e sem nível.
                    </p>
                  )}
                  <div className="grid gap-x-2 sm:grid-cols-2">
                    {ABAS.map(([chave, titulo, descricao]) => (
                      <Marca key={chave} titulo={titulo} descricao={descricao} marcado={partes.has(chave)} aoTrocar={(v) => setPartes((p) => comAlternancia(p, chave, v))} />
                    ))}
                  </div>
                  {partes.has('comparacao') && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      Comparar a safra
                      <select value={comparar.safraA} onChange={(e) => setComparar((c) => ({ ...c, safraA: e.target.value }))} className={SELECT}>
                        <option value="">—</option>
                        {safras.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      com
                      <select value={comparar.safraB} onChange={(e) => setComparar((c) => ({ ...c, safraB: e.target.value }))} className={SELECT}>
                        <option value="">—</option>
                        {safras.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      {(!comparar.safraA || comparar.safraA === comparar.safraB) && <span className="text-xs text-amber-600 dark:text-amber-300">escolha duas safras diferentes</span>}
                    </div>
                  )}
                </>
              )}
            </Cartao>

            <Cartao
              icone="🗺️"
              titulo="Mapas"
              subtitulo="Os desenhos de talhões, glebas e pontos, para abrir em outros programas."
              ativo={mapas}
              acao={<Interruptor ligado={mapas} aoTrocar={setMapas} rotulo="Incluir mapas" />}
            >
              {mapas && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Formatos</p>
                    {FORMATOS_MAPA.map(([chave, nome, uso]) => (
                      <Marca key={chave} titulo={nome} descricao={uso} marcado={formatos.has(chave)} aoTrocar={(v) => setFormatos((f) => comAlternancia(f, chave, v))} />
                    ))}
                  </div>
                  <div>
                    <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Camadas</p>
                    {CAMADAS.map(([chave, nome]) => (
                      <Marca key={chave} titulo={nome} marcado={camadas.has(chave)} aoTrocar={(v) => setCamadas((c) => comAlternancia(c, chave, v))} />
                    ))}
                  </div>
                </div>
              )}
            </Cartao>

            <Cartao
              icone="🛰"
              titulo="Imagens de satélite"
              subtitulo="O mapa de cada índice sobre cada talhão (Sentinel-2), em KMZ para o Google Earth e em PNG."
              ativo={imagens}
              acao={<Interruptor ligado={imagens} aoTrocar={setImagens} rotulo="Incluir imagens de satélite" />}
            >
              {imagens && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {INDICES.map(([chave, nome, uso]) => {
                      const ativo = indices.has(chave)
                      return (
                        <button
                          key={chave}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setIndices((s) => comAlternancia(s, chave, !ativo))}
                          className={`rounded-lg border px-3 py-1.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500 ${
                            ativo ? 'border-solo-600 bg-solo-50 dark:border-solo-500 dark:bg-solo-500/15' : 'border-slate-300 dark:border-white/15'
                          }`}
                        >
                          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{nome}</span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">{uso}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700 dark:text-slate-200">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="quando" checked={quando === 'recente'} onChange={() => setQuando('recente')} className="accent-solo-600" />
                      A imagem mais recente sem nuvem
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="quando" checked={quando === 'data'} onChange={() => setQuando('data')} className="accent-solo-600" />
                      A mais perto de
                      <input type="date" value={dataAlvo} max={new Date().toISOString().slice(0, 10)} onChange={(e) => { setDataAlvo(e.target.value); setQuando('data') }} className={SELECT} />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cada talhão leva uns segundos para calcular{nTalhoes > 6 ? `: com ${nTalhoes} talhões, conte com cerca de ${Math.ceil(nTalhoes / 6)} minuto(s)` : ''}.
                  </p>
                </div>
              )}
            </Cartao>

            <Cartao
              icone="📷"
              titulo="Fotos do perfil do solo"
              subtitulo="Uma pasta por talhão e gleba; a safra e a profundidade vão no nome de cada foto."
              ativo={fotos}
              acao={<Interruptor ligado={fotos} aoTrocar={setFotos} rotulo="Incluir fotos" />}
            />
          </fieldset>

          <aside className="lg:sticky lg:top-0 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
              <div className="bg-gradient-to-br from-solo-700 to-solo-900 px-4 py-4 text-white">
                <p className="text-xs uppercase tracking-wide text-solo-100/80">Vai sair</p>
                <p className="mt-0.5 text-lg font-semibold">{vaiSerZip ? 'Um arquivo .zip' : 'Uma planilha .xlsx'}</p>
                <p className="text-xs text-solo-100/80">
                  {nTalhoes} {nTalhoes === 1 ? 'talhão' : 'talhões'} · {selSafras === null ? 'todas as safras' : `safra ${[...selSafras].sort().join(', ')}`} ·{' '}
                  {selProfs === null ? 'todas as profundidades' : `${[...selProfs].sort(ordem).join(', ')} cm`}
                </p>
              </div>
              <div className="space-y-3 p-4">
                {resumo.length ? (
                  <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                    {resumo.map((r) => (
                      <li key={r} className="flex gap-2">
                        <span aria-hidden="true" className="text-solo-600 dark:text-solo-400">✓</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Nada marcado ainda.</p>
                )}

                {progresso ? (
                  <div aria-live="polite">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-solo-600 transition-all" style={{ width: `${Math.max(4, Math.round(progresso.fracao * 100))}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{progresso.texto}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={exportar}
                    disabled={!temAlgo || nTalhoes === 0}
                    className="w-full rounded-lg bg-solo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-solo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-solo-600 dark:hover:bg-solo-500"
                  >
                    Exportar e baixar
                  </button>
                )}

                {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}

                {resultado && (
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <p className="font-semibold">Baixado: {resultado.nome}</p>
                    <p>
                      {(resultado.tamanho / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB · {resultado.totais.glebas} glebas · {resultado.totais.analises} análises
                    </p>
                    {resultado.faltas.length > 0 && (
                      <details className="mt-1 text-amber-800 dark:text-amber-200">
                        <summary className="cursor-pointer">{resultado.faltas.length} item(ns) ficaram de fora</summary>
                        <ul className="mt-1 list-disc pl-4">
                          {resultado.faltas.map((f) => <li key={f}>{f}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
                <p className="text-[11px] leading-snug text-slate-400">O arquivo é montado aqui no seu navegador. Dentro do ZIP vai um LEIA-ME explicando cada pasta.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
