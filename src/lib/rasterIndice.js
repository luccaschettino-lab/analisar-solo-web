import { FAIXAS_VIGOR, NIVEIS_VIGOR } from './indicesVegetacao.js'

// Estados de cada pixel, os mesmos que a função sentinel-indice devolve na máscara.
export const PIXEL = { FORA: 0, VALIDO: 1, NUVEM: 2, SEM_DADO: 3 }

// NDWI mede água na superfície, não vigor: escala própria, de seco a água.
export const FAIXAS_AGUA = [
  { ate: -0.4, cor: '#d6b98c', rotulo: 'Seco' },
  { ate: -0.2, cor: '#bae6fd', rotulo: 'Pouca água' },
  { ate: 0, cor: '#7dd3fc', rotulo: 'Úmido' },
  { ate: 0.3, cor: '#38bdf8', rotulo: 'Água rasa' },
  { ate: null, cor: '#0369a1', rotulo: 'Água' },
]

/** Faixas (com cor) da legenda de cada índice. */
export function faixasDoIndice(chave) {
  if (chave === 'ndwi') return FAIXAS_AGUA
  return FAIXAS_VIGOR.map((f) => ({ ate: f.ate, cor: NIVEIS_VIGOR[f.nivel].cor, rotulo: f.rotulo }))
}

export function corDoValor(valor, faixas) {
  for (const f of faixas) if (f.ate === null || valor <= f.ate) return f.cor
  return faixas.at(-1).cor
}

const hexParaRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

function base64ParaBytes(texto) {
  const binario = atob(texto)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

/** Matriz de índices (Int16 little-endian em base64) → Int16Array. */
export function decodificarInt16(texto) {
  const bytes = base64ParaBytes(texto)
  const saida = new Int16Array(bytes.length / 2)
  const vista = new DataView(bytes.buffer)
  for (let i = 0; i < saida.length; i++) saida[i] = vista.getInt16(i * 2, true)
  return saida
}

export const decodificarMascara = base64ParaBytes

/**
 * Pixels RGBA (Uint8ClampedArray) de um índice. Fora do talhão e sem dado ficam
 * transparentes; nuvem vira cinza translúcido, para o produtor ver que ali não
 * há leitura em vez de achar que a lavoura está ruim.
 */
export function pixelsDoIndice(resposta, chave) {
  const { colunas, linhas } = resposta.janela
  const valores = decodificarInt16(resposta.indices[chave])
  const mascara = decodificarMascara(resposta.mascara)
  const faixas = faixasDoIndice(chave)
  const cores = faixas.map((f) => hexParaRgb(f.cor))
  const rgba = new Uint8ClampedArray(colunas * linhas * 4)
  for (let i = 0; i < colunas * linhas; i++) {
    const estado = mascara[i]
    if (estado === PIXEL.FORA || estado === PIXEL.SEM_DADO) continue
    let rgb
    let alfa = 235
    if (estado === PIXEL.NUVEM || valores[i] === resposta.semValor) {
      rgb = [148, 163, 184]
      alfa = 190
    } else {
      const v = valores[i] / resposta.escala
      let k = faixas.findIndex((f) => f.ate === null || v <= f.ate)
      if (k < 0) k = faixas.length - 1
      rgb = cores[k]
    }
    rgba.set([rgb[0], rgb[1], rgb[2], alfa], i * 4)
  }
  return rgba
}

/** Data URL PNG do índice, para usar como imageOverlay. */
export function imagemDoIndice(resposta, chave) {
  const { colunas, linhas } = resposta.janela
  const canvas = document.createElement('canvas')
  canvas.width = colunas
  canvas.height = linhas
  canvas.getContext('2d').putImageData(new ImageData(pixelsDoIndice(resposta, chave), colunas, linhas), 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Realce da cor real, sem canvas (testável): estica o contraste pelo próprio
 * talhão naquela data (1% e 99,5% dos pixels sem nuvem, a mesma faixa nos
 * três canais para não mudar o tom), clareia levemente os médios e dá um
 * pouco mais de saturação. Os pixels de fora recebem a cor do vizinho de
 * dentro mais próximo, para a ampliação não puxar escuro para a borda.
 * Devolve RGB (Uint8ClampedArray, 3 por pixel) e quem está dentro.
 */
export function realcarCorReal(rgb, mascara, total) {
  const dentro = new Uint8Array(total)
  const hist = new Uint32Array(256)
  let n = 0
  for (let i = 0; i < total; i++) {
    if (mascara[i] === PIXEL.VALIDO || mascara[i] === PIXEL.NUVEM) dentro[i] = 1
    if (mascara[i] !== PIXEL.VALIDO) continue
    hist[rgb[i * 3]]++
    hist[rgb[i * 3 + 1]]++
    hist[rgb[i * 3 + 2]]++
    n += 3
  }
  const percentil = (p) => {
    let acc = 0
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= p * n) return v
    }
    return 255
  }
  // Talhão todo nublado (nenhum válido): sem esticar.
  const lo = n ? percentil(0.01) : 0
  const hi = n ? Math.max(lo + 24, percentil(0.995)) : 255
  const tabela = new Float32Array(256)
  for (let v = 0; v < 256; v++) tabela[v] = 255 * Math.min(1, Math.max(0, (v - lo) / (hi - lo))) ** 0.85
  const saida = new Uint8ClampedArray(total * 3)
  for (let i = 0; i < total; i++) {
    if (!dentro[i]) continue
    const r = tabela[rgb[i * 3]]
    const g = tabela[rgb[i * 3 + 1]]
    const b = tabela[rgb[i * 3 + 2]]
    const m = (r + g + b) / 3
    saida[i * 3] = m + (r - m) * 1.15
    saida[i * 3 + 1] = m + (g - m) * 1.15
    saida[i * 3 + 2] = m + (b - m) * 1.15
  }
  return { rgb: saida, dentro }
}

function preencherBordas(rgb, dentro, w, h, passos = 4) {
  const ok = Uint8Array.from(dentro)
  for (let p = 0; p < passos; p++) {
    const novo = Uint8Array.from(ok)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (ok[i]) continue
        const viz = [x > 0 && i - 1, x < w - 1 && i + 1, y > 0 && i - w, y < h - 1 && i + w].find((j) => j !== false && ok[j])
        if (viz === undefined) continue
        rgb[i * 3] = rgb[viz * 3]
        rgb[i * 3 + 1] = rgb[viz * 3 + 1]
        rgb[i * 3 + 2] = rgb[viz * 3 + 2]
        novo[i] = 1
      }
    }
    ok.set(novo)
  }
}

// Desfoque de caixa separável (raio r), duas passadas ≈ gaussiano.
function desfocar(px, w, h, r) {
  const tmp = new Float32Array(px.length)
  const passada = (de, para, horizontal) => {
    const [n1, n2] = horizontal ? [h, w] : [w, h]
    for (let a = 0; a < n1; a++) {
      for (let c = 0; c < 3; c++) {
        let soma = 0
        const idx = (b) => (horizontal ? (a * w + b) * 4 + c : (b * w + a) * 4 + c)
        for (let b = -r; b <= r; b++) soma += de[idx(Math.min(n2 - 1, Math.max(0, b)))]
        for (let b = 0; b < n2; b++) {
          para[idx(b)] = soma / (2 * r + 1)
          soma += de[idx(Math.min(n2 - 1, b + r + 1))] - de[idx(Math.max(0, b - r))]
        }
      }
    }
  }
  const out = new Float32Array(px.length)
  passada(px, tmp, true)
  passada(tmp, out, false)
  passada(out, tmp, true)
  passada(tmp, out, false)
  return out
}

/**
 * Data URL PNG da COR REAL da cena (o "Sem filtro"). O pixel do Sentinel tem
 * 10 m: não há mais detalhe que isso. O que dá para fazer é mostrar bem o que
 * existe — contraste do próprio talhão, ampliação suave (em vez dos blocos
 * esticados pelo navegador) e um realce leve de nitidez. Fora do talhão fica
 * transparente, com borda suave. A nuvem aparece como nuvem. Null se a
 * resposta não trouxer cor (cálculo antigo).
 */
export function imagemCorReal(resposta) {
  if (!resposta?.cor) return null
  const { colunas: w, linhas: h } = resposta.janela
  const total = w * h
  const { rgb, dentro } = realcarCorReal(base64ParaBytes(resposta.cor), decodificarMascara(resposta.mascara), total)
  preencherBordas(rgb, dentro, w, h)

  const pequeno = new Uint8ClampedArray(total * 4)
  const alfa = new Uint8ClampedArray(total * 4)
  for (let i = 0; i < total; i++) {
    pequeno.set([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255], i * 4)
    alfa[i * 4 + 3] = dentro[i] ? 255 : 0
  }
  const E = Math.max(1, Math.min(5, Math.floor(2400 / Math.max(w, h))))
  const W = w * E
  const H = h * E
  const ampliar = (dados) => {
    const origem = document.createElement('canvas')
    origem.width = w
    origem.height = h
    origem.getContext('2d').putImageData(new ImageData(dados, w, h), 0, 0)
    const destino = document.createElement('canvas')
    destino.width = W
    destino.height = H
    const ctx = destino.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(origem, 0, 0, W, H)
    return { canvas: destino, dados: ctx.getImageData(0, 0, W, H) }
  }
  const grande = ampliar(pequeno)
  const borda = ampliar(alfa).dados.data

  // Máscara de nitidez: original + 0,7 × (original − desfocado).
  const px = grande.dados.data
  const desfocado = desfocar(px, W, H, Math.max(1, Math.round(E * 0.6)))
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) {
      const k = i * 4 + c
      const dif = px[k] - desfocado[k]
      if (Math.abs(dif) > 2) px[k] = px[k] + 0.7 * dif
    }
    px[i * 4 + 3] = borda[i * 4 + 3]
  }
  grande.canvas.getContext('2d').putImageData(grande.dados, 0, 0)
  return grande.canvas.toDataURL('image/png')
}

/** Percentual de cada faixa entre os pixels válidos, na ordem da legenda. */
export function distribuicaoPorFaixa(resposta, chave) {
  const faixas = faixasDoIndice(chave)
  const valores = decodificarInt16(resposta.indices[chave])
  const mascara = decodificarMascara(resposta.mascara)
  const contagem = faixas.map(() => 0)
  let total = 0
  for (let i = 0; i < valores.length; i++) {
    if (mascara[i] !== PIXEL.VALIDO || valores[i] === resposta.semValor) continue
    const v = valores[i] / resposta.escala
    let k = faixas.findIndex((f) => f.ate === null || v <= f.ate)
    if (k < 0) k = faixas.length - 1
    contagem[k]++
    total++
  }
  return faixas.map((f, k) => ({ ...f, pct: total ? (contagem[k] / total) * 100 : 0 }))
}
