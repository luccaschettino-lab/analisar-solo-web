const SERVICO =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/identify'
const TEMPO_LIMITE_MS = 10000

/** `9/21/2024` → `21/09/2024`. O serviço responde no formato dos Estados Unidos. */
function paraDataBR(texto) {
  if (!texto || texto === 'Null') return null
  const [mes, dia, ano] = String(texto).split('/')
  if (!ano) return null
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
}

/**
 * Data, resolução e satélite da imagem de satélite sobre um ponto.
 *
 * O Esri World Imagery é um mosaico: cada pedaço do mundo vem de uma fonte e
 * de uma data diferentes. Sem essa consulta, o produtor desenha o talhão sobre
 * uma foto que pode ser de anos atrás sem ter como saber — e uma cerca movida
 * ou uma área aberta desde então passariam despercebidas.
 *
 * Devolve `null` quando não há metadado. Nunca lança por falha de rede: é
 * informação complementar, e derrubar a tela do mapa por causa dela seria
 * desproporcional.
 */
export async function metadadosDaImagem(lat, lng) {
  const margem = 0.01
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    layers: 'all',
    tolerance: '2',
    mapExtent: `${lng - margem},${lat - margem},${lng + margem},${lat + margem}`,
    imageDisplay: '600,600,96',
    returnGeometry: 'false',
    f: 'json',
  })

  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS)

  try {
    const resposta = await fetch(`${SERVICO}?${params}`, { signal: controle.signal })
    if (!resposta.ok) return null

    const bruto = await resposta.json()
    const alvo =
      bruto?.results?.find((r) => r.layerName === 'World Imagery') ?? bruto?.results?.[0]
    if (!alvo) return null

    const a = alvo.attributes ?? {}
    const data = paraDataBR(a['SRC_DATE2'])
    const resolucao = Number(a['RESOLUTION (M)'])

    // Sem data não vale mostrar nada: "resolução 15 m" sozinho não responde a
    // pergunta que o usuário faz, que é "isso aqui é de quando?".
    if (!data) return null

    return {
      data,
      resolucao: Number.isFinite(resolucao) ? resolucao : null,
      satelite: a['DESCRIPTION'] || null,
      fornecedor: a['SOURCE'] || null,
      precisaoM: Number(a['ACCURACY (M)']) || null,
    }
  } catch {
    return null
  } finally {
    clearTimeout(relogio)
  }
}
