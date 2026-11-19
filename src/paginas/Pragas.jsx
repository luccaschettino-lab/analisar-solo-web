import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import Abas, { PainelDeAba } from '../componentes/Abas.jsx'
import ConfirmarExclusao from '../componentes/ConfirmarExclusao.jsx'
import { CULTURAS, METODOS } from '../config/pragas.js'
import {
  STATUS,
  faseDoEstadio,
  formatarValor,
  pontosDaVistoria,
  statusDoValor,
  valoresPorPonto,
  nivelDeControle,
} from '../lib/pragas.js'
import { criarVistoria, editarVistoria, removerVistoria, removerPonto, urlDaFoto } from '../dados/pragas.js'
import { usePragas } from './pragas/usePragas.js'
import VisaoGeral from './pragas/VisaoGeral.jsx'
import MapaDePragas from './pragas/MapaDePragas.jsx'
import PainelDoPonto from './pragas/PainelDoPonto.jsx'
import FormVistoria from './pragas/FormVistoria.jsx'
import GraficoDaPraga from './pragas/GraficoDaPraga.jsx'
import NiveisDeControle from './pragas/NiveisDeControle.jsx'
import { Cartao, ChipStatus, Aviso, SELECT, BOTAO_PRINCIPAL, BOTAO_PERIGO, dataBr, rotuloTalhao } from './pragas/comum.jsx'

const ABAS = [
  { chave: 'geral', rotulo: 'Visão geral' },
  { chave: 'talhao', rotulo: 'Por talhão' },
  { chave: 'niveis', rotulo: 'Pragas e níveis' },
]

function FotoDoPonto({ caminho }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let ativo = true
    setUrl(null)
    urlDaFoto(caminho)
      .then((u) => ativo && setUrl(u))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [caminho])
  if (!url) return <div className="h-32 w-full animate-pulse rounded-md bg-slate-100 dark:bg-white/10" />
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Foto do ponto" className="max-h-56 w-full rounded-md object-cover" />
    </a>
  )
}

export default function Pragas() {
  const { fazendaSelecionada, talhoes, carregando: carregandoTalhoes, selecionado, lancador, podeCriterio } = useFazendaAtual()
  const [params, setParams] = useSearchParams()
  const aba = ABAS.some((a) => a.chave === params.get('aba')) ? params.get('aba') : 'geral'
  const trocarAba = (chave) => setParams(chave === 'geral' ? {} : { aba: chave }, { replace: true })

  const dados = usePragas(fazendaSelecionada?.id ?? null, talhoes)
  const { pragas, vistorias, registrosPorVistoria, resumos, aplicar, recarregar } = dados

  const [talhaoId, setTalhaoId] = useState('')
  const [vistoriaId, setVistoriaId] = useState('')
  const [pragaSel, setPragaSel] = useState('') // 'chave|metodo'
  const [form, setForm] = useState(null) // 'nova' | 'editar'
  const [lancando, setLancando] = useState(false)
  const [local, setLocal] = useState(null)
  const [minhaPosicao, setMinhaPosicao] = useState(null)
  const [pontoEmFoco, setPontoEmFoco] = useState(null)
  const [excluir, setExcluir] = useState(null) // { tipo: 'vistoria' } | { tipo: 'ponto', ponto }
  const [erro, setErro] = useState(null)

  // Começa no talhão selecionado no mapa, se houver; senão no primeiro.
  useEffect(() => {
    if (talhoes.some((t) => t.id === talhaoId)) return
    const doMapa = selecionado?.tipo === 'talhao' ? selecionado.id : null
    setTalhaoId(talhoes.find((t) => t.id === doMapa)?.id ?? talhoes[0]?.id ?? '')
  }, [talhoes, talhaoId, selecionado])

  const talhao = talhoes.find((t) => t.id === talhaoId) ?? null
  const vistoriasDoTalhao = useMemo(() => vistorias.filter((v) => v.talhao_id === talhaoId), [vistorias, talhaoId])
  const vistoria = vistoriasDoTalhao.find((v) => v.id === vistoriaId) ?? vistoriasDoTalhao[0] ?? null
  const registros = useMemo(() => (vistoria ? (registrosPorVistoria.get(vistoria.id) ?? []) : []), [vistoria, registrosPorVistoria])
  const resumo = vistoria ? resumos.get(vistoria.id) : null
  const fase = vistoria ? faseDoEstadio(vistoria.cultura, vistoria.estadio) : 'vegetativo'

  // Trocar de talhão ou vistoria: fecha o lançamento e o foco — menos na
  // vistoria que acabou de ser criada, que já abre lançando o ponto 1.
  const abrirLancandoEm = useRef(null)
  useEffect(() => {
    setLancando(Boolean(vistoria?.id) && abrirLancandoEm.current === vistoria?.id)
    abrirLancandoEm.current = null
    setLocal(null)
    setPontoEmFoco(null)
  }, [talhaoId, vistoria?.id])

  // A praga escolhida some se não existir nesta vistoria.
  const linhaSel = resumo?.linhas.find((l) => `${l.praga}|${l.metodo}` === pragaSel) ?? null

  const pontosNoMapa = useMemo(() => {
    if (!linhaSel) return pontosDaVistoria(registros)
    return valoresPorPonto(registros, linhaSel.praga, linhaSel.metodo)
  }, [registros, linhaSel])

  const pragaInfo = linhaSel ? (pragas.find((p) => p.chave === linhaSel.praga) ?? null) : null
  const calor = useMemo(() => {
    if (!linhaSel) return null
    return {
      praga: linhaSel.praga,
      metodo: linhaSel.metodo,
      nivel: linhaSel.nivel,
      maximo: Math.max(0, ...pontosNoMapa.map((p) => p.valor ?? 0)),
      fase,
      pragaInfo,
    }
  }, [linhaSel, pontosNoMapa, fase, pragaInfo])

  // Histórico da praga escolhida no talhão: uma entrada por vistoria (zero
  // quando foi vistoriado e não achou).
  const historico = useMemo(() => {
    if (!linhaSel || !vistoria) return []
    return [...vistoriasDoTalhao]
      .filter((v) => v.cultura === vistoria.cultura && (registrosPorVistoria.get(v.id)?.length ?? 0) > 0)
      .reverse()
      .map((v) => {
        const f = faseDoEstadio(v.cultura, v.estadio)
        const l = resumos.get(v.id)?.linhas.find((x) => x.praga === linhaSel.praga && x.metodo === linhaSel.metodo)
        const valor = l ? l.valor : 0
        const nivel = pragaInfo && pragaInfo.metodo === linhaSel.metodo ? nivelDeControle(pragaInfo, f) : null
        return { vistoriaId: v.id, data: v.data, valor, nivel, status: l ? l.status : statusDoValor(0, linhaSel.metodo, pragaInfo, f) }
      })
  }, [linhaSel, vistoria, vistoriasDoTalhao, registrosPorVistoria, resumos, pragaInfo])

  const numeroDoProximo = Math.max(0, ...registros.map((r) => r.ponto)) + 1
  const registrosDoFoco = pontoEmFoco ? registros.filter((r) => r.ponto === pontoEmFoco) : []

  function abrirTalhao(id) {
    setTalhaoId(id)
    setVistoriaId('')
    setPragaSel('')
    trocarAba('talhao')
  }

  async function salvarVistoria(campos) {
    if (form === 'editar' && vistoria) {
      const v = await editarVistoria(vistoria.id, campos)
      aplicar((e) => ({ vistorias: e.vistorias.map((x) => (x.id === v.id ? v : x)).sort(maisRecente) }))
    } else {
      const v = await criarVistoria({ talhaoId, ...campos })
      abrirLancandoEm.current = v.id
      aplicar((e) => ({ vistorias: [v, ...e.vistorias].sort(maisRecente) }))
      setVistoriaId(v.id)
      setPragaSel('')
    }
    setForm(null)
  }

  async function confirmarExclusao() {
    setErro(null)
    if (excluir.tipo === 'vistoria') {
      const fotos = registros.map((r) => r.foto).filter(Boolean)
      await removerVistoria(vistoria.id, [...new Set(fotos)])
      aplicar((e) => ({
        vistorias: e.vistorias.filter((v) => v.id !== vistoria.id),
        registros: e.registros.filter((r) => r.vistoria_id !== vistoria.id),
      }))
      setVistoriaId('')
    } else {
      const doPonto = registros.filter((r) => r.ponto === excluir.ponto)
      await removerPonto(vistoria.id, excluir.ponto, [...new Set(doPonto.map((r) => r.foto).filter(Boolean))])
      aplicar((e) => ({ registros: e.registros.filter((r) => !(r.vistoria_id === vistoria.id && r.ponto === excluir.ponto)) }))
      setPontoEmFoco(null)
    }
    setExcluir(null)
  }

  if (!fazendaSelecionada) {
    return (
      <p className="m-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        Escolha uma fazenda na barra lateral para ver o monitoramento de pragas.
      </p>
    )
  }

  const nomeDe = (chave) => pragas.find((p) => p.chave === chave)?.nome ?? chave

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-4 pt-3 dark:border-white/10 dark:bg-noite-900 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-2">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-solo-50 text-lg dark:bg-solo-500/15">
              🐛
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Pragas e doenças</h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {fazendaSelecionada.nome} · vistorias de campo, nível de controle e mapa de infestação
              </p>
            </div>
          </div>
          {aba === 'talhao' && (
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              Talhão
              <select value={talhaoId} onChange={(e) => abrirTalhao(e.target.value)} disabled={talhoes.length === 0} className={`${SELECT} w-44`}>
                {talhoes.length === 0 && <option value="">{carregandoTalhoes ? 'carregando…' : 'nenhum talhão'}</option>}
                {talhoes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {rotuloTalhao(t)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <Abas abas={ABAS} ativa={aba} aoTrocar={trocarAba} rotulo="Pragas" />
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {dados.erro && (
          <div className="p-4 sm:px-6">
            <Aviso>
              {dados.erro}{' '}
              <button type="button" onClick={recarregar} className="font-semibold underline">
                Tentar de novo
              </button>
            </Aviso>
          </div>
        )}

        <PainelDeAba chave="geral" ativa={aba}>
          <div className="p-4 sm:p-6">
            {dados.carregando && vistorias.length === 0 ? (
              <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
                Carregando as vistorias…
              </p>
            ) : (
              <VisaoGeral talhoes={talhoes} vistorias={vistorias} resumos={resumos} aoAbrir={abrirTalhao} />
            )}
          </div>
        </PainelDeAba>

        <PainelDeAba chave="niveis" ativa={aba}>
          <div className="mx-auto max-w-4xl p-4 sm:p-6">
            <NiveisDeControle fazendaId={fazendaSelecionada.id} pragas={pragas} podeAjustar={podeCriterio} aoMudar={recarregar} />
          </div>
        </PainelDeAba>

        <PainelDeAba chave="talhao" ativa={aba}>
          <div className="flex flex-col gap-4 p-4 lg:grid lg:h-[calc(100vh-9.5rem)] lg:grid-cols-[minmax(0,1fr)_24rem] sm:p-6 lg:p-4">
            <div className="relative h-[55vh] min-h-[20rem] lg:h-full">
              {talhao?.geometria ? (
                <>
                  <MapaDePragas
                    geometria={talhao.geometria}
                    pontos={pontosNoMapa}
                    calor={calor}
                    marcando={lancando}
                    novoPonto={local}
                    minhaPosicao={minhaPosicao}
                    pontoEmFoco={pontoEmFoco}
                    aoMarcar={setLocal}
                    aoEscolherPonto={(n) => setPontoEmFoco((f) => (f === n ? null : n))}
                  />
                  {lancando && (
                    <p className="vidro pointer-events-none absolute left-3 top-3 z-[1000] rounded-md px-3 py-1.5 text-sm text-slate-700 shadow dark:text-slate-200">
                      Toque no mapa para marcar o ponto {numeroDoProximo}, ou use o GPS.
                    </p>
                  )}
                  {calor && (
                    <div className="vidro absolute bottom-8 left-3 z-[1000] rounded-lg px-3 py-2 text-xs text-slate-700 shadow dark:text-slate-200">
                      <p className="mb-1 font-semibold">{linhaSel.nome}</p>
                      {calor.nivel != null || ['nota', 'presenca'].includes(calor.metodo) ? (
                        <ul className="space-y-0.5">
                          {['controle', 'alerta', 'ok'].map((s) => (
                            <li key={s} className="flex items-center gap-2">
                              <span aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ background: STATUS[s].cor }} />
                              {STATUS[s].rotulo}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="flex items-center gap-2">
                          <span aria-hidden="true" className="h-3 w-16 rounded-sm" style={{ background: 'linear-gradient(90deg,#e0e7ff,#4338ca)' }} />
                          0 → {formatarValor(calor.maximo, calor.metodo)}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
                  {talhoes.length === 0 ? 'Esta fazenda ainda não tem talhões.' : 'Este talhão não tem área desenhada.'}
                </div>
              )}
            </div>

            <aside className="space-y-4 lg:min-h-0 lg:overflow-auto lg:pr-1">
              {erro && <Aviso>{erro}</Aviso>}

              <Cartao
                titulo="Vistoria"
                acao={
                  lancador &&
                  talhao && (
                    <button type="button" onClick={() => setForm('nova')} className="text-sm font-semibold text-solo-700 hover:underline dark:text-solo-300">
                      + Nova vistoria
                    </button>
                  )
                }
              >
                {vistoriasDoTalhao.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {dados.carregando ? 'Carregando…' : 'Nenhuma vistoria neste talhão ainda.'}
                    {!dados.carregando && lancador && ' Comece com "Nova vistoria".'}
                  </p>
                ) : (
                  <>
                    <select
                      value={vistoria?.id ?? ''}
                      onChange={(e) => {
                        setVistoriaId(e.target.value)
                      }}
                      aria-label="Vistoria"
                      className={SELECT}
                    >
                      {vistoriasDoTalhao.map((v) => (
                        <option key={v.id} value={v.id}>
                          {dataBr(v.data)} · {CULTURAS.find((c) => c.chave === v.cultura)?.rotulo}
                          {v.estadio ? ` · ${v.estadio}` : ''}
                        </option>
                      ))}
                    </select>
                    {vistoria && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {pontosDaVistoria(registros).length} {pontosDaVistoria(registros).length === 1 ? 'ponto' : 'pontos'}
                        </span>
                        {resumo && registros.length > 0 && <ChipStatus status={resumo.pior} />}
                        {lancador && (
                          <span className="ml-auto flex gap-1">
                            <button type="button" onClick={() => setForm('editar')} className="rounded px-2 py-1 font-medium text-solo-700 hover:bg-solo-50 dark:text-solo-300 dark:hover:bg-white/5">
                              Editar
                            </button>
                            <button type="button" onClick={() => setExcluir({ tipo: 'vistoria' })} className="rounded px-2 py-1 font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10">
                              Excluir
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                    {vistoria?.observacao && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{vistoria.observacao}</p>}
                  </>
                )}
                {vistoria && lancador && !lancando && (
                  <button type="button" onClick={() => setLancando(true)} className={`${BOTAO_PRINCIPAL} mt-3 w-full`}>
                    + Lançar ponto {numeroDoProximo}
                  </button>
                )}
              </Cartao>

              {vistoria && lancando && (
                <Cartao>
                  <PainelDoPonto
                    key={vistoria.id}
                    fazendaId={fazendaSelecionada.id}
                    vistoria={vistoria}
                    geometria={talhao?.geometria}
                    pragas={pragas}
                    numeroDoPonto={numeroDoProximo}
                    local={local}
                    aoLocal={setLocal}
                    aoPosicao={setMinhaPosicao}
                    aoGravar={(novos) => aplicar((e) => ({ registros: [...e.registros, ...novos] }))}
                    aoFechar={() => {
                      setLancando(false)
                      setLocal(null)
                    }}
                  />
                </Cartao>
              )}

              {pontoEmFoco && registrosDoFoco.length > 0 && (
                <Cartao
                  titulo={`Ponto ${pontoEmFoco}`}
                  acao={
                    <button type="button" onClick={() => setPontoEmFoco(null)} aria-label="Fechar" className="text-slate-400 hover:text-slate-700">
                      ✕
                    </button>
                  }
                >
                  {registrosDoFoco.every((r) => !r.praga) ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">Nada encontrado.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {registrosDoFoco
                        .filter((r) => r.praga)
                        .map((r) => (
                          <li key={r.id} className="flex justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-200">{nomeDe(r.praga)}</span>
                            <span className="tabular-nums text-slate-600 dark:text-slate-300">
                              {r.metodo === 'pano'
                                ? `${Number(r.valor)} em ${Number(r.amostra)} m`
                                : r.metodo === 'contagem'
                                  ? `${Number(r.valor)} de ${Number(r.amostra)}`
                                  : formatarValor(Number(r.valor), r.metodo)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                  {registrosDoFoco[0].observacao && <p className="mt-2 text-sm italic text-slate-600 dark:text-slate-300">{registrosDoFoco[0].observacao}</p>}
                  {registrosDoFoco[0].foto && (
                    <div className="mt-3">
                      <FotoDoPonto caminho={registrosDoFoco[0].foto} />
                    </div>
                  )}
                  {lancador && (
                    <button type="button" onClick={() => setExcluir({ tipo: 'ponto', ponto: pontoEmFoco })} className={`${BOTAO_PERIGO} mt-3`}>
                      Excluir ponto
                    </button>
                  )}
                </Cartao>
              )}

              {resumo && registros.length > 0 && (
                <Cartao titulo="O que foi encontrado">
                  {resumo.linhas.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">Nada encontrado em nenhum ponto.</p>
                  ) : (
                    <>
                      <ul className="-mx-2 space-y-0.5">
                        {resumo.linhas.map((l) => {
                          const chave = `${l.praga}|${l.metodo}`
                          const ativa = chave === pragaSel
                          return (
                            <li key={chave}>
                              <button
                                type="button"
                                onClick={() => setPragaSel(ativa ? '' : chave)}
                                aria-pressed={ativa}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                                  ativa ? 'bg-solo-50 ring-1 ring-solo-300 dark:bg-solo-500/10 dark:ring-solo-500/40' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                                }`}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-slate-800 dark:text-slate-100">{l.nome}</span>
                                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                                    {METODOS[l.metodo]?.rotulo} · em {l.pontosCom} de {l.pontos} pontos
                                    {l.nivel != null ? ` · nível ${formatarValor(l.nivel, l.metodo)}` : ''}
                                  </span>
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="block text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatarValor(l.valor, l.metodo)}</span>
                                  <ChipStatus status={l.status} pequeno />
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Valor do talhão = média de todos os pontos (onde não achou conta zero). Toque numa linha para ver o mapa de calor e o histórico.
                      </p>
                    </>
                  )}
                </Cartao>
              )}

              {linhaSel && historico.length > 0 && (
                <Cartao titulo={`${linhaSel.nome} ao longo das vistorias`}>
                  <GraficoDaPraga
                    pontos={historico}
                    metodo={linhaSel.metodo}
                    nome={linhaSel.nome}
                    selecionadaId={vistoria?.id}
                    aoEscolher={(id) => setVistoriaId(id)}
                  />
                </Cartao>
              )}

              {!lancador && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Seu cargo nesta fazenda só consulta as vistorias.</p>
              )}
            </aside>
          </div>
        </PainelDeAba>
      </div>

      {form && (
        <FormVistoria
          inicial={form === 'editar' ? vistoria : { cultura: vistoriasDoTalhao[0]?.cultura ?? 'soja', estadio: vistoriasDoTalhao[0]?.estadio ?? '' }}
          talhaoRotulo={rotuloTalhao(talhao)}
          aoSalvar={salvarVistoria}
          aoFechar={() => setForm(null)}
        />
      )}

      {excluir && (
        <ConfirmarExclusao
          titulo={excluir.tipo === 'vistoria' ? `Excluir a vistoria de ${dataBr(vistoria?.data)}?` : `Excluir o ponto ${excluir.ponto}?`}
          descricao={
            excluir.tipo === 'vistoria'
              ? 'Todos os pontos, valores e fotos desta vistoria serão apagados. Não dá para desfazer.'
              : 'O que foi lançado neste ponto (e a foto) será apagado. Não dá para desfazer.'
          }
          consequencias={excluir.tipo === 'vistoria' ? [{ rotulo: 'pontos', quantidade: pontosDaVistoria(registros).length }] : []}
          aoConfirmar={confirmarExclusao}
          aoFechar={() => setExcluir(null)}
        />
      )}
    </div>
  )
}

function maisRecente(a, b) {
  return b.data.localeCompare(a.data) || String(b.criado_em).localeCompare(String(a.criado_em))
}
