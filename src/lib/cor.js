// Conversões de cor mínimas para variar tonalidade sem trazer biblioteca.
// Só o necessário: hex -> HSL -> hex, para clarear ou escurecer mantendo o
// matiz e a saturação — o que muda é só o quão claro ou escuro o tom fica.

function hexParaRgb(hex) {
  const limpo = hex.replace('#', '')
  const bits = limpo.length === 3 ? limpo.split('').map((c) => c + c).join('') : limpo
  const num = parseInt(bits, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function rgbParaHsl({ r, g, b }) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min

  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r:
        h = ((g - b) / d) % 6
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

function hslParaRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rgb
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  }
}

function rgbParaHex({ r, g, b }) {
  const canal = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  return `#${canal(r)}${canal(g)}${canal(b)}`
}

/**
 * Clareia (`delta` > 0) ou escurece (`delta` < 0) uma cor, mantendo matiz e
 * saturação. `delta` é em pontos de luminosidade, de -1 a 1.
 *
 * O limite de 0.1 a 0.92 evita que o resultado vire preto ou branco puro —
 * nesse extremo o matiz desaparece e a cor deixa de parecer "a mesma, só
 * mais clara/escura".
 */
export function variarLuminosidade(hex, delta) {
  const hsl = rgbParaHsl(hexParaRgb(hex))
  const l = Math.min(0.92, Math.max(0.1, hsl.l + delta))
  return rgbParaHex(hslParaRgb({ ...hsl, l }))
}
