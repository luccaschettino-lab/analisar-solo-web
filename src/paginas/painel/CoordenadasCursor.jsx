/**
 * Etiqueta com a coordenada geográfica do cursor, seguindo o mouse durante o
 * desenho de uma gleba. Latitude e longitude em graus decimais — é o mesmo
 * formato que o cadastro em lote aceita colado, então dá pra conferir um
 * ponto aqui e digitar em outro lugar sem converter nada.
 */
export default function CoordenadasCursor({ posicao }) {
  if (!posicao) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-[1200] whitespace-nowrap rounded bg-slate-900/85 px-2 py-1 font-mono text-[11px] text-white shadow"
      style={{ left: posicao.x + 14, top: posicao.y + 14 }}
    >
      {posicao.lat.toFixed(6)}, {posicao.lng.toFixed(6)}
    </div>
  )
}
