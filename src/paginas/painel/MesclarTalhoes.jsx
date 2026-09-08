import { useMemo, useState } from 'react'
import { combinarGeometrias, areaEmHectares } from '../../lib/geo.js'
import { atualizarTalhao, excluirTalhao } from '../../dados/talhoes.js'
import { CORES_TALHAO } from '../../config/mapa.js'

function formatarArea(ha) {
  if (ha == null) return '—'
  return `${ha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
}

/**
 * Mesclar vários talhões num só.
 *
 * Nasceu do próprio KML: um Lote do produtor às vezes vira 2-3 talhões
 * separados na importação ("10", "10-2", "10-3") porque os polígonos não se
 * encostam o bastante pra virar um só sozinhos. Isso corrige depois, à mão.
 *
 * Um dos selecionados é a "base": mantém o id (e portanto o histórico), e
 * ganha a geometria combinada, a área recalculada, e o código/nome/cor que
 * a pessoa confirmar. Os outros são apagados em seguida.
 */
export default function MesclarTalhoes({ talhoes, aoFechar, aoMesclado }) {
  const [selecionados, setSelecionados] = useState(() => new Set())
  const [baseId, setBaseId] = useState(null)
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES_TALHAO[0])
  const [mesclando, setMesclando] = useState(false)
  const [erro, setErro] = useState('')

  const talhoesSelecionados = useMemo(
    () => talhoes.filter((t) => selecionados.has(t.id)),
    [talhoes, selecionados],
  )

  function usarComoBase(talhao) {
    setBaseId(talhao.id)
    setCodigo(talhao.codigo)
    setNome(talhao.nome ?? '')
    setCor(talhao.cor ?? CORES_TALHAO[0])
  }

  function alternar(talhao) {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(talhao.id)) {
        proximo.delete(talhao.id)
        if (baseId === talhao.id) setBaseId(null)
      } else {
        proximo.add(talhao.id)
        // A primeira marcação já sugere uma base, pra não obrigar mais um clique.
        if (!baseId) usarComoBase(talhao)
      }
      return proximo
    })
  }

  const areaCombinada = useMemo(() => {
    if (talhoesSelecionados.length < 2) return null
    const combinada = combinarGeometrias(talhoesSelecionados.map((t) => t.geometria))
    return combinada ? areaEmHectares(combinada) : null
  }, [talhoesSelecionados])

  const codigoConflita = talhoes.some(
    (t) => !selecionados.has(t.id) && t.codigo === codigo.trim(),
  )

  const podeMesclar =
    talhoesSelecionados.length >= 2 &&
    Boolean(baseId) &&
    codigo.trim() !== '' &&
    !codigoConflita &&
    !mesclando

  async function confirmar() {
    if (!podeMesclar) return
    setErro('')
    setMesclando(true)

    const base = talhoesSelecionados.find((t) => t.id === baseId)
    const outros = talhoesSelecionados.filter((t) => t.id !== baseId)

    try {
      const geometriaCombinada = combinarGeometrias(talhoesSelecionados.map((t) => t.geometria))
      const talhaoMesclado = await atualizarTalhao(base.id, {
        codigo,
        nome,
        cor,
        geometria: geometriaCombinada,
        areaHa: areaEmHectares(geometriaCombinada),
      })

      for (const talhao of outros) {
        await excluirTalhao(talhao.id)
      }

      aoMesclado({ talhao: talhaoMesclado, removidos: outros.map((t) => t.id) })
      aoFechar()
    } catch (e) {
      setErro(
        `${e.message} Confira a lista de talhões antes de tentar de novo — parte da mesclagem pode já ter sido feita.`,
      )
      setMesclando(false)
    }
  }

  return (
    <aside className="fixed inset-0 z-[2000] flex flex-col bg-white shadow-xl dark:bg-noite-900 sm:inset-y-0 sm:left-0 sm:right-auto sm:w-[32rem] sm:border-r sm:border-slate-200 dark:sm:border-white/10">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mesclar talhões</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Escolha dois ou mais talhões e uma "base" — o que vira o talhão final.
          </p>
        </div>
        <button
          onClick={aoFechar}
          disabled={mesclando}
          aria-label="Fechar"
          className="shrink-0 rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <ul className="space-y-1.5">
          {talhoes.map((t) => {
            const marcado = selecionados.has(t.id)
            return (
              <li
                key={t.id}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
                  marcado ? 'border-solo-300 bg-solo-50 dark:border-solo-500/40 dark:bg-solo-500/10' : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternar(t)}
                  disabled={mesclando}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-solo-700 focus:ring-solo-600 dark:border-white/20 dark:bg-noite-800"
                />
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: t.cor }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">
                  Talhão {t.codigo}
                  {t.nome && <span className="text-slate-400 dark:text-slate-500"> · {t.nome}</span>}
                </span>
                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatarArea(t.area_ha)}</span>
                {marcado && (
                  <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <input
                      type="radio"
                      name="base"
                      checked={baseId === t.id}
                      onChange={() => usarComoBase(t)}
                      disabled={mesclando}
                      className="h-3.5 w-3.5 border-slate-300 text-solo-700 focus:ring-solo-600 dark:border-white/20"
                    />
                    base
                  </label>
                )}
              </li>
            )
          })}
        </ul>

        {talhoesSelecionados.length >= 2 && (
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-3 dark:border-white/10">
            <div className="rounded-md border border-solo-100 bg-solo-50 px-3 py-2 text-xs text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300">
              {talhoesSelecionados.length} talhões selecionados · {formatarArea(areaCombinada)} combinados
            </div>

            <div className="flex gap-3">
              <div className="w-28">
                <label htmlFor="mesclar-codigo" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Código final
                </label>
                <input
                  id="mesclar-codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  disabled={mesclando}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="mesclar-nome" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Nome (opcional)
                </label>
                <input
                  id="mesclar-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  disabled={mesclando}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30"
                />
              </div>
            </div>

            {codigoConflita && (
              <p className="text-xs text-red-700 dark:text-red-300">
                Já existe outro talhão "{codigo.trim()}" nesta fazenda — escolha outro código.
              </p>
            )}

            <div>
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Cor no mapa</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {CORES_TALHAO.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    disabled={mesclando}
                    aria-label={`Cor ${c}`}
                    aria-pressed={cor === c}
                    style={{ backgroundColor: c }}
                    className={`h-6 w-6 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 ${
                      cor === c ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white' : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">
              Os outros {talhoesSelecionados.length - 1} talhões selecionados serão apagados — a área
              desenhada de cada um continua, só passa a ser uma peça do talhão {codigo || '—'}.
            </p>
          </div>
        )}

        {erro && (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
            {erro}
          </p>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-white/10">
        <button
          onClick={aoFechar}
          disabled={mesclando}
          className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10"
        >
          Cancelar
        </button>
        <button
          onClick={confirmar}
          disabled={!podeMesclar}
          className="rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-solo-600 dark:hover:bg-solo-700 dark:disabled:bg-slate-600"
        >
          {mesclando
            ? 'Mesclando…'
            : talhoesSelecionados.length >= 2
              ? `Mesclar ${talhoesSelecionados.length} talhões`
              : 'Selecione 2 ou mais'}
        </button>
      </footer>
    </aside>
  )
}
