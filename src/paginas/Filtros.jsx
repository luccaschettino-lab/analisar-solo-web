import { useCallback, useEffect, useMemo, useState } from 'react'
import Mapa from '../mapa/Mapa.jsx'
import { useGeometrias } from '../mapa/useGeometrias.js'
import { focarGeometria } from '../mapa/enquadrar.js'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import FiltrosMapa from './painel/FiltrosMapa.jsx'
import LegendaMapa from './painel/LegendaMapa.jsx'

const SELECT =
  'mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50 disabled:text-slate-400 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30 dark:disabled:bg-white/5 dark:disabled:text-slate-600'

/**
 * Um talhão por vez, em close — a tela existe para isso. O mapa geral mostra
 * a fazenda inteira, e é ótimo pra ver o conjunto; aqui é o oposto: escolhe
 * um talhão, ajusta o filtro, e o mapa mostra só ele, enquadrado, com o mapa
 * de calor por cima. É o que sobrou do antigo botão "Filtro" que flutuava em
 * cima do mapa geral — o filtro merecia uma tela própria, não um painel que
 * cobria o que se estava tentando ver.
 *
 * Fazenda e talhão vêm da mesma seleção da barra lateral (`useFazendaAtual`),
 * não de um seletor próprio: o filtro e a coloração já são calculados para a
 * fazenda aberta, e um segundo seletor de fazenda aqui poderia escolher uma
 * diferente da que os dados pertencem.
 */
export default function Filtros() {
  const {
    fazendaSelecionada,
    talhoes,
    carregando: carregandoHierarquia,
    anos,
    filtro,
    definirFiltro,
    coloracao,
    carregandoAnalises,
    erroAnalises,
    criterio,
  } = useFazendaAtual()

  const [talhaoId, setTalhaoId] = useState('')
  const [mostrarAmostras, setMostrarAmostras] = useState(true)
  const talhao = talhoes.find((t) => t.id === talhaoId) ?? null

  // Fazenda com um talhão só: escolhe ele sozinho, sem exigir clique.
  useEffect(() => {
    if (!talhaoId && talhoes.length === 1) setTalhaoId(talhoes[0].id)
  }, [talhoes, talhaoId])

  // Trocar de fazenda invalida a escolha anterior — o id antigo não existe
  // na lista nova, e deixar como está produziria uma seleção fantasma.
  useEffect(() => {
    setTalhaoId('')
  }, [fazendaSelecionada?.id])

  const [mapa, setMapa] = useState(null)
  const aoCriarMapa = useCallback((instancia) => setMapa(instancia), [])
  const aoSelecionar = useCallback(() => {}, [])

  // `useGeometrias` desenha o que estiver em `talhoes` — passar só o talhão
  // escolhido é o que faz "ver um de cada vez" funcionar sem precisar de uma
  // variante própria do hook.
  const talhoesParaDesenhar = useMemo(() => (talhao ? [talhao] : []), [talhao])

  useGeometrias(mapa, {
    talhoes: talhoesParaDesenhar,
    selecionado: null,
    aoSelecionar,
    coloracao,
    filtro,
    mostrarCor: true,
    mostrarAmostras,
  })

  useEffect(() => {
    if (!mapa || !talhao?.geometria) return
    focarGeometria(mapa, talhao.geometria)
  }, [mapa, talhao])

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-noite-900">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-solo-50 text-lg dark:bg-solo-500/15"
          >
            🔽
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Filtros</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Escolha o talhão e o filtro — o mapa mostra só ele, de perto.
            </p>
          </div>
        </div>

        <div className="mt-3 max-w-xs">
          <label htmlFor="filtros-talhao" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Talhão
          </label>
          <select
            id="filtros-talhao"
            value={talhaoId}
            onChange={(e) => setTalhaoId(e.target.value)}
            disabled={!fazendaSelecionada || carregandoHierarquia}
            className={SELECT}
          >
            <option value="">
              {!fazendaSelecionada
                ? 'selecione uma fazenda na barra lateral'
                : carregandoHierarquia
                  ? 'carregando…'
                  : talhoes.length === 0
                    ? 'nenhum talhão'
                    : 'selecione…'}
            </option>
            {talhoes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome ? `${t.codigo} · ${t.nome}` : t.codigo}
              </option>
            ))}
          </select>
        </div>
      </header>

      {!fazendaSelecionada ? (
        <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-400 dark:text-slate-500">
          Selecione uma fazenda na barra lateral para começar.
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_1fr]">
          <div className="overflow-y-auto border-b border-slate-200 lg:border-b-0 lg:border-r dark:border-white/10">
            <FiltrosMapa
              filtro={filtro}
              aoMudar={definirFiltro}
              anos={anos}
              carregando={carregandoAnalises}
              erro={erroAnalises}
            />

            <label className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={mostrarAmostras}
                onChange={(e) => setMostrarAmostras(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-solo-600 focus:ring-solo-500 dark:border-white/20"
              />
              Pontos de amostra
            </label>
          </div>

          <div className="relative min-h-0">
            <Mapa aoCriarMapa={aoCriarMapa} />

            {coloracao && talhao && (
              <LegendaMapa
                chaveParametro={filtro.chaveParametro}
                anoSafra={filtro.anoSafra}
                profundidade={filtro.profundidade}
                elevada={false}
                criterio={criterio}
              />
            )}

            {!talhao && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                <p className="vidro-forte pointer-events-auto rounded-lg border border-slate-200 px-4 py-3 text-center text-sm text-slate-600 shadow-painel dark:border-white/15 dark:text-slate-300">
                  Escolha um talhão acima para ver o mapa de calor dele.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
