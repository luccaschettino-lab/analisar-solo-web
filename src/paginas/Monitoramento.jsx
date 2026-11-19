import { useEffect, useMemo, useState } from 'react'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import { useCenas } from './monitoramento/useCenas.js'
import { useIndices, calcularComCache, resultadoGuardado, FONTE } from './monitoramento/useIndices.js'
import GraficoDoMes from './monitoramento/GraficoDoMes.jsx'
import { listarIndicesDoTalhao } from '../dados/indicesTalhao.js'
import SeletorDeData from './monitoramento/SeletorDeData.jsx'
import MapaDoTalhao from './monitoramento/MapaDoTalhao.jsx'
import BaixarImagem from './monitoramento/BaixarImagem.jsx'
import { distribuicaoPorFaixa, faixasDoIndice } from '../lib/rasterIndice.js'

const INDICES = [
  {
    chave: 'ndvi',
    rotulo: 'NDVI',
    nome: 'Índice de vegetação por diferença normalizada',
    explicacao:
      'Vigor da vegetação: quanto mais denso e verde o dossel, mais alto o valor. É o índice mais comum pra acompanhar o desenvolvimento da lavoura ao longo da safra.',
  },
  {
    chave: 'evi',
    rotulo: 'EVI',
    nome: 'Índice de vegetação otimizado',
    explicacao:
      'Como o NDVI, mas corrige a influência do solo exposto e da atmosfera. Mais confiável quando o dossel já está fechado e o NDVI satura.',
  },
  {
    chave: 'savi',
    rotulo: 'SAVI',
    nome: 'Índice de vegetação ajustado ao solo',
    explicacao:
      'NDVI ajustado pra solo exposto. Mais confiável no início da safra ou em área de falha, onde solo claro apareceria como se fosse planta estressada.',
  },
  {
    chave: 'ndwi',
    rotulo: 'NDWI',
    nome: 'Índice de água por diferença normalizada',
    explicacao:
      'Não mede umidade do solo. Com as bandas verde e infravermelho próximo, o NDWI de McFeeters ajuda a identificar água superficial, como rios, açudes e áreas alagadas.',
  },
]

const PERIODOS = [
  [30, '1 mês'],
  [60, '2 meses'],
  [120, '4 meses'],
  [365, '1 ano'],
]

// Sem índice: só a imagem de satélite do mapa de fundo, recortada no talhão.
const SEM_INDICE = 'imagem'

const numero = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

const SELECT =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:text-slate-400 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30'

function Cartao({ titulo, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 ${className}`}>
      {titulo && <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h2>}
      {children}
    </section>
  )
}

/** Escolha do índice, sobre o mapa. */
function EscolhaDoIndice({ ativo, aoTrocar }) {
  return (
    <div role="radiogroup" aria-label="Índice" className="vidro flex gap-0.5 rounded-lg p-1 shadow">
      {[{ chave: SEM_INDICE, rotulo: 'Sem filtro', nome: 'Só a imagem de satélite, sem índice por cima' }, ...INDICES].map((item) => {
        const selecionado = item.chave === ativo
        return (
          <button
            key={item.chave}
            type="button"
            role="radio"
            aria-checked={selecionado}
            title={item.nome}
            onClick={() => aoTrocar(item.chave)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500 ${
              selecionado
                ? 'bg-solo-700 text-white shadow-sm dark:bg-solo-600'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
            }`}
          >
            {item.rotulo}
          </button>
        )
      })}
    </div>
  )
}

/** Legenda das cores, sobre o mapa. */
function LegendaNoMapa({ indice }) {
  const faixas = faixasDoIndice(indice)
  return (
    <div className="vidro rounded-lg px-3 py-2 text-xs text-slate-700 shadow dark:text-slate-200">
      <ul className="space-y-1">
        {[...faixas].reverse().map((f) => (
          <li key={f.rotulo} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm border border-black/10" style={{ background: f.cor }} />
            {f.rotulo}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm border border-black/10 bg-slate-400/80" />
          Nuvem (sem leitura)
        </li>
      </ul>
    </div>
  )
}

function Numeros({ dados, indice, rotulo }) {
  const est = dados.estatisticas[indice]
  const q = dados.qualidade
  if (!est) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
        Não há pixel limpo dentro do talhão nesta data
        {q.possivelNuvemPct > 0 ? ` (${q.possivelNuvemPct}% parece nuvem)` : ''}. Escolha outra data.
      </p>
    )
  }
  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400">{rotulo} médio</span>
        <span className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{numero(est.media)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Mínimo', est.minimo],
          ['Máximo', est.maximo],
          ['Desvio', est.desvio],
        ].map(([nome, valor]) => (
          <div key={nome} className="rounded-md bg-slate-100 px-2 py-1.5 dark:bg-white/10">
            <dt className="text-xs text-slate-500 dark:text-slate-400">{nome}</dt>
            <dd className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{numero(valor)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {q.validos.toLocaleString('pt-BR')} de {q.pixelsNoTalhao.toLocaleString('pt-BR')} pixels de {dados.janela?.tamanhoPixelM ?? ''} m entram na conta
        {q.possivelNuvemPct > 0 ? `; ${q.possivelNuvemPct}% parece nuvem e fica de fora` : ''}.
      </p>
    </>
  )
}

/** Quanto do talhão está em cada faixa, em barras. */
function Distribuicao({ dados, indice }) {
  const faixas = useMemo(() => distribuicaoPorFaixa(dados, indice), [dados, indice])
  return (
    <ul className="space-y-2">
      {[...faixas].reverse().map((f) => (
        <li key={f.rotulo} className="text-xs">
          <div className="mb-0.5 flex justify-between text-slate-600 dark:text-slate-300">
            <span>{f.rotulo}</span>
            <span className="tabular-nums">{Math.round(f.pct)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${f.pct}%`, background: f.cor }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function Monitoramento() {
  const { fazendaSelecionada, talhoes, carregando: carregandoTalhoes, selecionado } = useFazendaAtual()
  const [talhaoId, setTalhaoId] = useState('')
  const [indiceAtivo, setIndiceAtivo] = useState('ndvi')
  const [cenaAtivaId, setCenaAtivaId] = useState('')
  // Só o Sentinel-2: o CBERS-4A saiu em 18/11/2026.
  const fonte = FONTE

  // Período da barra do tempo, do gráfico e do "carregar com um clique".
  // 12 meses de Sentinel-2 são ~100 imagens: numa barra estreita as bolinhas
  // grudavam. Começa em 2 meses (~20 imagens).
  const [periodo, setPeriodo] = useState(60)
  const rotuloDoPeriodo = { 30: 'o último mês', 60: 'os últimos 2 meses', 120: 'os últimos 4 meses', 365: 'o último ano' }[periodo]
  const [lote, setLote] = useState(null) // { feitos, total, falhas }
  const [, setVersaoSerie] = useState(0)
  const [guardados, setGuardados] = useState([]) // resumos já no banco
  useEffect(() => {
    setLote(null)
  }, [talhaoId, fonte])

  // Começa no talhão selecionado no mapa, se houver; senão no primeiro.
  useEffect(() => {
    if (talhoes.some((t) => t.id === talhaoId)) return
    const doMapa = selecionado?.tipo === 'talhao' ? selecionado.id : null
    setTalhaoId(talhoes.find((t) => t.id === doMapa)?.id ?? talhoes[0]?.id ?? '')
  }, [talhoes, talhaoId, selecionado])

  const talhao = talhoes.find((t) => t.id === talhaoId) ?? null
  const geometria = talhao?.geometria ?? null
  const { cenas, carregando, erro } = useCenas(talhaoId, geometria)
  // A data escolhida fica dentro do período; fora dele, vale a mais recente.
  const limitePeriodo = Date.now() - periodo * 86400000
  const visiveis = cenas.filter((c) => Date.parse(c.data) >= limitePeriodo)
  const cenaSelecionada = visiveis.find((cena) => cena.id === cenaAtivaId) ?? visiveis.at(-1) ?? null
  const { dados, carregando: calculando, erro: erroCalculo } = useIndices(talhaoId, cenaSelecionada?.id, geometria)

  // Resumos já guardados no banco (qualquer pessoa da fazenda que calculou):
  // o gráfico abre com eles, sem recalcular.
  useEffect(() => {
    let ativo = true
    setGuardados([])
    if (!talhaoId) return
    listarIndicesDoTalhao(talhaoId, fonte)
      .then((lista) => ativo && setGuardados(lista))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [talhaoId, fonte])

  const fimPeriodo = new Date()
  const inicioPeriodo = new Date(fimPeriodo.getTime() - periodo * 86400000)
  const noPeriodo = (iso) => Date.parse(iso) >= inicioPeriodo.getTime()
  const cenasDoPeriodo = cenas.filter((c) => noPeriodo(c.data))
  const guardadoPorCena = new Map(guardados.map((g) => [g.cena_id, g]))
  const resumoDe = (cenaId) => {
    const d = geometria ? resultadoGuardado(talhaoId, cenaId, geometria) : null
    if (d) return { estatisticas: d.estatisticas, qualidade: d.qualidade }
    return guardadoPorCena.get(cenaId) ?? null
  }
  const faltando = cenasDoPeriodo.filter((c) => !resumoDe(c.id))

  async function carregarPeriodo() {
    if (!geometria || faltando.length === 0 || (lote && lote.feitos < lote.total)) return
    const fila = [...faltando]
    const total = fila.length
    let feitos = 0
    let falhas = 0
    setLote({ feitos, total, falhas })
    const trabalhar = async () => {
      while (fila.length) {
        const cena = fila.shift()
        try {
          await calcularComCache(talhaoId, cena.id, geometria)
        } catch {
          falhas++
        }
        feitos++
        setLote({ feitos, total, falhas })
        setVersaoSerie((v) => v + 1)
      }
    }
    await Promise.all([trabalhar(), trabalhar(), trabalhar()])
  }

  // Pontos do gráfico: tudo o que já foi calculado no período (banco ou agora).
  const datasDasCenas = new Map(cenas.map((c) => [c.id, c.data]))
  const idsNoPeriodo = new Set([...cenasDoPeriodo.map((c) => c.id), ...guardados.filter((g) => noPeriodo(g.data)).map((g) => g.cena_id)])
  const pontosDoPeriodo = [...idsNoPeriodo]
    .map((id) => {
      const r = resumoDe(id)
      if (!r) return null
      const q = r.qualidade
      return {
        id,
        data: datasDasCenas.get(id) ?? guardadoPorCena.get(id)?.data,
        media: r.estatisticas?.[indiceAtivo]?.media ?? null,
        limpoPct: q?.pixelsNoTalhao ? (q.validos / q.pixelsNoTalhao) * 100 : 0,
      }
    })
    .filter((p) => p?.data)
    .sort((a, b) => Date.parse(a.data) - Date.parse(b.data))

  useEffect(() => {
    if (cenas.length > 0 && !cenas.some((cena) => cena.id === cenaAtivaId)) {
      setCenaAtivaId(cenas[cenas.length - 1].id)
    }
  }, [cenas, cenaAtivaId])

  const semIndice = indiceAtivo === SEM_INDICE
  const info = INDICES.find((i) => i.chave === indiceAtivo) ?? INDICES[0]

  if (!fazendaSelecionada) {
    return (
      <p className="m-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        Escolha uma fazenda na barra lateral para ver o monitoramento por satélite.
      </p>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-noite-900 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-solo-50 text-lg dark:bg-solo-500/15">
            🛰
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Monitoramento por satélite</h1>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {fazendaSelecionada.nome} · imagens Sentinel-2, calculadas só dentro do talhão
            </p>
          </div>
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          Talhão
          <select
            value={talhaoId}
            onChange={(e) => setTalhaoId(e.target.value)}
            disabled={talhoes.length === 0}
            className={`${SELECT} w-44`}
          >
            {talhoes.length === 0 && <option value="">{carregandoTalhoes ? 'carregando…' : 'nenhum talhão'}</option>}
            {talhoes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome ? `${t.codigo} · ${t.nome}` : t.codigo}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="min-h-0 flex-1 overflow-auto lg:overflow-hidden">
        <div className="flex flex-col gap-4 p-4 lg:grid lg:h-full lg:grid-cols-[minmax(0,1fr)_22rem] sm:p-6 lg:p-4">
          {/* Mapa */}
          <div className="h-[60vh] min-h-[22rem] lg:h-full">
            {geometria ? (
              <MapaDoTalhao geometria={geometria} dados={semIndice ? null : dados} indice={indiceAtivo}>
                <div className="absolute left-3 top-3 z-[1000] flex flex-col items-start gap-2">
                  <EscolhaDoIndice ativo={indiceAtivo} aoTrocar={setIndiceAtivo} />
                  {calculando && (
                    <p role="status" className="vidro rounded-md px-3 py-1.5 text-sm text-slate-700 shadow dark:text-slate-200">
                      Calculando os índices desta data…
                    </p>
                  )}
                </div>
                <div className="absolute right-3 top-3 z-[1000]">
                  <BaixarImagem
                    fazenda={fazendaSelecionada}
                    talhao={talhao}
                    dados={dados}
                    indice={semIndice ? null : indiceAtivo}
                    data={cenaSelecionada?.data ?? null}
                    desativado={!semIndice && (!dados || calculando)}
                  />
                </div>
                {dados && !semIndice && (
                  <div className="absolute bottom-8 left-3 z-[1000]">
                    <LegendaNoMapa indice={indiceAtivo} />
                  </div>
                )}
              </MapaDoTalhao>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
                {talhoes.length === 0 ? 'Esta fazenda ainda não tem talhões.' : 'Este talhão não tem área desenhada.'}
              </div>
            )}
          </div>

          {/* Painel */}
          <aside className="space-y-4 lg:min-h-0 lg:overflow-auto lg:pr-1">
            <Cartao titulo="Data da imagem">
              {geometria && carregando && (
                <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
                  Consultando as datas no catálogo do Sentinel-2…
                </p>
              )}
              {erro && (
                <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                  {erro}
                </p>
              )}
              {geometria && !carregando && !erro && cenas.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma imagem do Sentinel-2 para este talhão.</p>
              )}
              {cenas.length > 0 && (
                <div role="radiogroup" aria-label="Período" className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/5">
                  {PERIODOS.map(([dias, rotuloPeriodo]) => (
                    <button
                      key={dias}
                      type="button"
                      role="radio"
                      aria-checked={periodo === dias}
                      onClick={() => setPeriodo(dias)}
                      className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition ${
                        periodo === dias
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-noite-800 dark:text-slate-100'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {rotuloPeriodo}
                    </button>
                  ))}
                </div>
              )}
              {cenas.length > 0 && cenasDoPeriodo.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma imagem neste período. Escolha um período maior.</p>
              )}
              <SeletorDeData
                cenas={cenasDoPeriodo}
                selecionadaId={cenaSelecionada?.id}
                aoSelecionar={(cena) => setCenaAtivaId(cena.id)}
              />
              {geometria && !carregando && cenas.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => void carregarPeriodo()}
                    disabled={faltando.length === 0 || Boolean(lote && lote.feitos < lote.total)}
                    className="w-full rounded-md bg-solo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-solo-600 dark:hover:bg-solo-700"
                  >
                    {lote && lote.feitos < lote.total
                      ? `Carregando ${lote.feitos} de ${lote.total} imagens…`
                      : cenasDoPeriodo.length === 0
                        ? 'Nenhuma imagem neste período'
                        : faltando.length === 0
                          ? '✓ Período todo carregado'
                          : `⚡ Carregar ${rotuloDoPeriodo} (${faltando.length} ${faltando.length === 1 ? 'imagem' : 'imagens'})`}
                  </button>
                  {lote && lote.feitos === lote.total && (
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      Pronto: trocar de data agora é imediato.{lote.falhas > 0 && ` ${lote.falhas} não puderam ser calculadas.`}
                    </p>
                  )}
                </div>
              )}
            </Cartao>

            {pontosDoPeriodo.length > 0 && !semIndice && (
              <Cartao titulo={`${info.rotulo} médio em ${rotuloDoPeriodo}`}>
                <GraficoDoMes
                  pontos={pontosDoPeriodo}
                  rotulo={info.rotulo}
                  selecionadaId={cenaSelecionada?.id}
                  inicio={inicioPeriodo}
                  fim={fimPeriodo}
                  aoEscolher={(id) => setCenaAtivaId(id)}
                />
              </Cartao>
            )}

            {erroCalculo && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
                {erroCalculo}
              </p>
            )}

            {semIndice && (
              <Cartao titulo="Sem filtro">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  O talhão aparece só com a imagem de satélite do mapa de fundo, sem índice por cima. Essa imagem não é a da data
                  escolhida acima: é o mosaico do provedor do mapa, e a data dela varia de lugar para lugar. Para trocar de imagem, use o botão de camadas no canto
                  do mapa.
                </p>
              </Cartao>
            )}

            {dados && !semIndice && (
              <>
                <Cartao titulo={`${info.rotulo} no talhão ${talhao?.codigo ?? ''}`}>
                  <Numeros dados={dados} indice={indiceAtivo} rotulo={info.rotulo} />
                </Cartao>
                <Cartao titulo="Quanto do talhão em cada faixa">
                  <Distribuicao dados={dados} indice={indiceAtivo} />
                </Cartao>
              </>
            )}

            {!semIndice && <Cartao>
              {/* Aberto de saída só no NDWI, cujo nome engana (não é umidade do solo). */}
              <details key={indiceAtivo} open={indiceAtivo === 'ndwi'}>
                <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
                  ⓘ O que é o {info.rotulo}?
                </summary>
                <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">{info.nome}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{info.explicacao}</p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Reflectância de superfície, já corrigida da atmosfera pela ESA. Nuvem e sombra de nuvem são marcadas pixel a pixel
                  pela classificação da própria cena e ficam fora das contas. Cada quadrado do mapa tem 10 m. Imagens: Sentinel-2
                  L2A, Copernicus/ESA, pelo repositório público da AWS (Earth Search).
                </p>
              </details>
            </Cartao>}
          </aside>
        </div>
      </div>
    </div>
  )
}
