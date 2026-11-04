import { FAIXAS_VIGOR, NIVEIS_VIGOR } from './indicesVegetacao.js'

// Estados de cada pixel, os mesmos que a função cbers-indice devolve na máscara.
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
