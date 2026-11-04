// Latitude/longitude (WGS84) -> UTM. Série de Krüger (Karney, 2011): erro abaixo
// de 1 mm dentro da zona. Escrito aqui porque a função roda no servidor e as
// cenas do CBERS vêm em UTM; não vale puxar uma biblioteca de projeção só para
// uma conta de ida.

const A = 6378137.0
const F = 1 / 298.257223563
const K0 = 0.9996

/** Meridiano central da zona UTM, em graus. */
export const meridianoCentral = (zona) => (zona - 1) * 6 - 180 + 3

/** Zona UTM de um EPSG de UTM WGS84 (326xx norte, 327xx sul), ou null. */
export function zonaDoEpsg(epsg) {
  if (epsg >= 32601 && epsg <= 32660) return { zona: epsg - 32600, sul: false }
  if (epsg >= 32701 && epsg <= 32760) return { zona: epsg - 32700, sul: true }
  return null
}

const n = F / (2 - F)
const n2 = n * n
const n3 = n2 * n
const n4 = n3 * n
const RAIO = (A / (1 + n)) * (1 + n2 / 4 + n4 / 64)
const ALFA = [
  n / 2 - (2 * n2) / 3 + (5 * n3) / 16 + (41 * n4) / 180,
  (13 * n2) / 48 - (3 * n3) / 5 + (557 * n4) / 1440,
  (61 * n3) / 240 - (103 * n4) / 140,
  (49561 * n4) / 161280,
]
const C = (2 * Math.sqrt(n)) / (1 + n)

/** [leste, norte] em metros. */
export function latLngParaUtm(lat, lng, zona, sul) {
  const phi = (lat * Math.PI) / 180
  const lam = ((lng - meridianoCentral(zona)) * Math.PI) / 180
  const senoPhi = Math.sin(phi)
  const t = Math.sinh(Math.atanh(senoPhi) - C * Math.atanh(C * senoPhi))
  const xi1 = Math.atan2(t, Math.cos(lam))
  const eta1 = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t))

  let xi = xi1
  let eta = eta1
  ALFA.forEach((a, j) => {
    const k = 2 * (j + 1)
    xi += a * Math.sin(k * xi1) * Math.cosh(k * eta1)
    eta += a * Math.cos(k * xi1) * Math.sinh(k * eta1)
  })

  return [500000 + K0 * RAIO * eta, (sul ? 10000000 : 0) + K0 * RAIO * xi]
}

const BETA = [
  n / 2 - (2 * n2) / 3 + (37 * n3) / 96 - n4 / 360,
  n2 / 48 + n3 / 15 - (437 * n4) / 1440,
  (17 * n3) / 480 - (37 * n4) / 840,
  (4397 * n4) / 161280,
]
const DELTA = [
  2 * n - (2 * n2) / 3 - 2 * n3 + (116 * n4) / 45,
  (7 * n2) / 3 - (8 * n3) / 5 - (227 * n4) / 45,
  (56 * n3) / 15 - (136 * n4) / 35,
  (4279 * n4) / 630,
]

/** [latitude, longitude] em graus a partir de leste/norte em metros. */
export function utmParaLatLng(leste, norte, zona, sul) {
  const xi = (norte - (sul ? 10000000 : 0)) / (K0 * RAIO)
  const eta = (leste - 500000) / (K0 * RAIO)

  let xi1 = xi
  let eta1 = eta
  BETA.forEach((b, j) => {
    const k = 2 * (j + 1)
    xi1 -= b * Math.sin(k * xi) * Math.cosh(k * eta)
    eta1 -= b * Math.cos(k * xi) * Math.sinh(k * eta)
  })

  const chi = Math.asin(Math.sin(xi1) / Math.cosh(eta1))
  let phi = chi
  DELTA.forEach((d, j) => {
    phi += d * Math.sin(2 * (j + 1) * chi)
  })
  const lam = Math.atan2(Math.sinh(eta1), Math.cos(xi1))
  return [(phi * 180) / Math.PI, meridianoCentral(zona) + (lam * 180) / Math.PI]
}
