const NS = 'http://www.w3.org/2000/svg'

export const ID_HACHURA = 'hachura-sem-dado'

/** Valor de `fillColor` que faz o Leaflet pintar a geometria com a hachura. */
export const PREENCHIMENTO_HACHURA = `url(#${ID_HACHURA})`

const COR_FUNDO = '#f1f5f9'
const COR_TRACO = '#94a3b8'

/**
 * Injeta o `<pattern>` da hachura no SVG do mapa, uma vez.
 *
 * Gleba sem dado precisa continuar visível e distinguível de gleba cinza sem
 * classificação — ausência de dado é informação, não invisibilidade. Hachura
 * resolve isso sem inventar uma cor que pareça um valor.
 *
 * Como funciona: o Leaflet escreve `options.fillColor` direto no atributo
 * `fill` do path (`SVG.prototype._updateStyle`), então passar
 * `url(#hachura-sem-dado)` como fillColor faz o navegador resolver o pattern.
 * Não é API documentada, mas também não depende de nada privado do Leaflet —
 * só do fato de o valor chegar intacto ao atributo.
 *
 * **Só funciona no renderizador SVG.** Se algum dia o mapa passar a usar
 * `preferCanvas: true`, o Canvas ignora o pattern e a gleba sairia com o
 * fill padrão. Nesse caso, trocar por cinza claro com borda tracejada.
 *
 * Devolve `false` quando o SVG ainda não existe — ele só é criado quando a
 * primeira camada vetorial entra no mapa. Quem chama deve tentar de novo
 * depois de desenhar as geometrias.
 */
export function garantirHachura(mapa) {
  const svg = mapa?.getPanes?.()?.overlayPane?.querySelector('svg')
  if (!svg) return false

  // Idempotente: chamado a cada redesenho das camadas.
  if (svg.querySelector(`#${ID_HACHURA}`)) return true

  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS(NS, 'defs')
    svg.insertBefore(defs, svg.firstChild)
  }

  const pattern = document.createElementNS(NS, 'pattern')
  pattern.setAttribute('id', ID_HACHURA)
  // userSpaceOnUse mantém o traço com espessura constante; com
  // objectBoundingBox a hachura esticaria conforme o tamanho da gleba, e
  // glebas pequenas ficariam quase sólidas.
  pattern.setAttribute('patternUnits', 'userSpaceOnUse')
  pattern.setAttribute('width', '8')
  pattern.setAttribute('height', '8')
  pattern.setAttribute('patternTransform', 'rotate(45)')

  const fundo = document.createElementNS(NS, 'rect')
  fundo.setAttribute('width', '8')
  fundo.setAttribute('height', '8')
  fundo.setAttribute('fill', COR_FUNDO)

  const traco = document.createElementNS(NS, 'line')
  traco.setAttribute('x1', '0')
  traco.setAttribute('y1', '0')
  traco.setAttribute('x2', '0')
  traco.setAttribute('y2', '8')
  traco.setAttribute('stroke', COR_TRACO)
  traco.setAttribute('stroke-width', '2')

  pattern.appendChild(fundo)
  pattern.appendChild(traco)
  defs.appendChild(pattern)

  return true
}
