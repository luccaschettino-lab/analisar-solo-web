import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { latLngDoPonto } from '../../lib/geo.js'

function rotuloDoPonto(ponto, indice) {
  const propriedades = ponto.propriedades ?? {}
  const valor = propriedades.amostra ?? propriedades.Amostra ?? propriedades.id ?? propriedades.ID
  return valor == null || typeof valor === 'object' ? `Ponto ${indice + 1}` : String(valor)
}

export default function PontosColetaNoMapa({
  mapa,
  pontos,
  pontosAgrupados,
  carregando,
  erro,
  desenhando,
  aoCancelar,
}) {
  const agrupados = useMemo(() => new Set(pontosAgrupados.map((ponto) => ponto.id)), [pontosAgrupados])

  useEffect(() => {
    if (!mapa) return
    const camada = L.layerGroup().addTo(mapa)

    pontos.forEach((ponto, indice) => {
      const latLng = latLngDoPonto(ponto.geometria)
      if (!latLng) return

      const usado = Boolean(ponto.gleba_id)
      L.circleMarker(latLng, {
        radius: agrupados.has(ponto.id) ? 9 : 7,
        color: '#ffffff',
        weight: 2,
        fillColor: usado ? '#64748b' : agrupados.has(ponto.id) ? '#ca8a04' : '#16a34a',
        fillOpacity: 0.95,
        interactive: false,
      })
        .bindTooltip(usado ? 'Ponto já associado a uma gleba' : 'Ponto de coleta importado')
        .addTo(camada)
    })

    return () => camada.remove()
  }, [mapa, pontos, agrupados])

  return (
    <aside className="vidro-forte absolute right-3 top-20 z-[1100] max-h-[calc(100%-6rem)] w-72 overflow-auto rounded-lg border border-slate-200 p-3 shadow-painel dark:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Gleba a partir dos pontos
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {desenhando
              ? 'Desenhe no mapa o contorno que reúne os pontos desta gleba.'
              : 'Pontos dentro do contorno serão vinculados a esta gleba.'}
          </p>
        </div>
        <button
          type="button"
          onClick={aoCancelar}
          aria-label="Cancelar agrupamento"
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      {carregando && (
        <p role="status" className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Carregando pontos de coleta…
        </p>
      )}
      {erro && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {erro}
        </p>
      )}
      {!carregando && !erro && (
        <>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-green-600" />Disponível</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Neste grupo</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-500" />Já usado</span>
          </div>
          <p className="mt-3 text-xs font-medium text-slate-700 dark:text-slate-300">
            {pontosAgrupados.length} ponto(s) disponíveis dentro do contorno
          </p>
          {pontosAgrupados.length > 0 && (
            <ul className="mt-1 max-h-36 overflow-auto text-xs text-slate-600 dark:text-slate-400">
              {pontosAgrupados.map((ponto) => (
                <li key={ponto.id}>{rotuloDoPonto(ponto, pontos.indexOf(ponto))}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <button
        type="button"
        onClick={aoCancelar}
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
      >
        Cancelar
      </button>
    </aside>
  )
}
