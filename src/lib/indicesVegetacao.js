// Índices espectrais a partir de reflectância de banda (0 a 1, não número
// digital bruto do sensor). Fórmulas padrão de sensoriamento remoto — não são
// específicas do Planet, servem pra qualquer fonte multiespectral com essas
// bandas (NIR, vermelho, azul).
//
// Cada função devolve `null` quando o denominador zera (region sem sinal,
// tipicamente água profunda ou nuvem) em vez de Infinity/NaN — ausência de
// índice é diferente de índice zero, mesma regra que `coloracao.js` já segue
// pra análise de solo.

/** NDVI — vigor da vegetação. -1 a 1; acima de ~0,2 já é cobertura vegetal. */
export function ndvi(nir, red) {
  const soma = nir + red
  return soma === 0 ? null : (nir - red) / soma
}

/**
 * EVI — como o NDVI, mas corrige influência do solo exposto e da atmosfera
 * usando a banda azul. Mais estável em lavoura com dossel denso, onde o NDVI
 * satura (para de crescer mesmo com mais biomassa).
 */
export function evi(nir, red, blue) {
  const denominador = nir + 6 * red - 7.5 * blue + 1
  return denominador === 0 ? null : 2.5 * ((nir - red) / denominador)
}

/**
 * SAVI — NDVI ajustado pra solo exposto, com um fator `l` (0 a 1) pro quanto
 * de vegetação cobre o pixel. 0,5 é o padrão de Huete (1988) pra cobertura
 * intermediária — cedo de safra ou lavoura em falha, onde o NDVI puro
 * confundiria solo claro com estresse da planta.
 */
export function savi(nir, red, l = 0.5) {
  const denominador = nir + red + l
  return denominador === 0 ? null : ((nir - red) / denominador) * (1 + l)
}

/**
 * NDWI (McFeeters, 1996) — feito pra achar água superficial (rio, açude,
 * área alagada), não umidade do solo. Sem banda SWIR ou radar, nenhum índice
 * do Planet mede umidade de terra de verdade; isto aqui é o que dá pra fazer
 * só com bandas óticas, e o rótulo na tela precisa deixar isso claro.
 */
export function ndwi(green, nir) {
  const soma = green + nir
  return soma === 0 ? null : (green - nir) / soma
}

/**
 * Faixas de leitura do NDVI/EVI/SAVI, pensadas pra vigor de lavoura.
 * As mesmas cinco cores de `NIVEIS` (config/parametros.js) — um produtor que
 * já lê o mapa de solo por essa escala não aprende uma segunda.
 */
export const FAIXAS_VIGOR = [
  { ate: 0.2, nivel: 'muito_baixo', rotulo: 'Muito baixo' },
  { ate: 0.4, nivel: 'baixo', rotulo: 'Baixo' },
  { ate: 0.6, nivel: 'medio', rotulo: 'Médio' },
  { ate: 0.8, nivel: 'bom', rotulo: 'Bom' },
  { ate: null, nivel: 'muito_bom', rotulo: 'Muito bom' },
]

/** Nível da faixa de vigor pra um valor de índice, ou `null` se o valor for ausente. */
export function nivelDoIndice(valor, faixas = FAIXAS_VIGOR) {
  if (valor == null || !Number.isFinite(valor)) return null
  for (const faixa of faixas) {
    if (faixa.ate === null || valor <= faixa.ate) return faixa.nivel
  }
  return null
}
