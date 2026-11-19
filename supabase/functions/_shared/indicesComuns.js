import { Buffer } from 'node:buffer'

/**
 * A base do cálculo de índices (hoje só do Sentinel-2; o CBERS-4A saiu em
 * 18/11/2026): as fórmulas, o formato da resposta (inteiros × 10000, máscara por pixel) e as
 * contas de geometria e estatística. As mesmas fórmulas de
 * src/lib/indicesVegetacao.js (o teste confere as duas).
 */

export const ESCALA = 10000 // índice = inteiro / 10000
export const SEM_VALOR = -32768

// Estados de cada pixel da janela.
export const PIXEL = { FORA: 0, VALIDO: 1, NUVEM: 2, SEM_DADO: 3 }

export const ndvi = (nir, vermelho) => (nir + vermelho === 0 ? null : (nir - vermelho) / (nir + vermelho))
export const evi = (nir, vermelho, azul) => {
  const den = nir + 6 * vermelho - 7.5 * azul + 1
  return den === 0 ? null : 2.5 * ((nir - vermelho) / den)
}
export const savi = (nir, vermelho, l = 0.5) => (nir + vermelho + l === 0 ? null : ((nir - vermelho) / (nir + vermelho + l)) * (1 + l))
export const ndwi = (verde, nir) => (verde + nir === 0 ? null : (verde - nir) / (verde + nir))

const falha = (status, mensagem) => Object.assign(new Error(mensagem), { status })

export function aneisDe(geometria) {
  const g = geometria?.type === 'Feature' ? geometria.geometry : geometria
  if (g?.type === 'Polygon') return [g.coordinates]
  if (g?.type === 'MultiPolygon') return g.coordinates
  throw falha(400, 'A geometria do talhão precisa ser um polígono.')
}

/** Ponto dentro de um polígono (anel externo e furos, regra par-ímpar). */
export function dentroDoPoligono(x, y, aneis) {
  let dentro = false
  for (const anel of aneis) {
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [xi, yi] = anel[i]
      const [xj, yj] = anel[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro
    }
  }
  return dentro
}

export function estatisticas(valores) {
  const n = valores.length
  if (n === 0) return null
  let soma = 0
  let minimo = Infinity
  let maximo = -Infinity
  for (const v of valores) {
    soma += v
    if (v < minimo) minimo = v
    if (v > maximo) maximo = v
  }
  const media = soma / n
  let variancia = 0
  for (const v of valores) variancia += (v - media) ** 2
  const ordenados = Float64Array.from(valores).sort()
  const percentil = (p) => ordenados[Math.min(n - 1, Math.floor(p * n))]
  const r = (x) => Math.round(x * 10000) / 10000
  return { media: r(media), minimo: r(minimo), maximo: r(maximo), desvio: r(Math.sqrt(variancia / n)), p10: r(percentil(0.1)), p90: r(percentil(0.9)), validos: n }
}

export const base64 = (tipado) => Buffer.from(tipado.buffer, tipado.byteOffset, tipado.byteLength).toString('base64')
