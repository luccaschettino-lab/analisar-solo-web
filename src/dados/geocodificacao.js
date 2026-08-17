/**
 * Busca de lugares pelo Nominatim, o serviço de geocodificação do
 * OpenStreetMap.
 *
 * Escolhido por ser gratuito, sem chave, e da mesma fonte dos tiles de rua que
 * o mapa já usa e credita.
 *
 * A política de uso pede volume baixo, identificação da aplicação e crédito à
 * fonte. Atendemos assim: a busca só dispara quando o usuário envia o
 * formulário — nunca a cada tecla —, o navegador manda o Referer com o
 * endereço do app, e a lista de resultados exibe o crédito ao OpenStreetMap.
 *
 * Restrito ao Brasil (`countrycodes=br`). Se um dia o produto atender outro
 * país, é este parâmetro que muda.
 */

const URL_BASE = 'https://nominatim.openstreetmap.org/search'
const LIMITE = 6
const TEMPO_LIMITE_MS = 12000

export async function buscarLugares(consulta) {
  const params = new URLSearchParams({
    q: consulta,
    format: 'jsonv2',
    limit: String(LIMITE),
    countrycodes: 'br',
    'accept-language': 'pt-BR',
    addressdetails: '1',
  })

  // Sem tempo limite, uma rede ruim de campo deixaria o botão em "Buscando…"
  // para sempre, sem erro e sem resultado.
  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS)

  let resposta
  try {
    resposta = await fetch(`${URL_BASE}?${params}`, { signal: controle.signal })
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('A busca demorou demais. Tente de novo.')
    throw new Error('Não foi possível consultar a busca de lugares. Verifique a conexão.')
  } finally {
    clearTimeout(relogio)
  }

  if (resposta.status === 429) {
    throw new Error('Muitas buscas seguidas. Aguarde alguns segundos.')
  }
  if (!resposta.ok) {
    throw new Error(`A busca de lugares respondeu ${resposta.status}.`)
  }

  const bruto = await resposta.json()

  return (bruto ?? []).map((r) => ({
    id: `${r.osm_type ?? 'x'}-${r.osm_id ?? r.place_id}`,
    nome: r.display_name,
    tipo: r.type,
    lat: Number(r.lat),
    lng: Number(r.lon),
    // boundingbox vem como [sul, norte, oeste, leste], em texto.
    limites: Array.isArray(r.boundingbox)
      ? [
          [Number(r.boundingbox[0]), Number(r.boundingbox[2])],
          [Number(r.boundingbox[1]), Number(r.boundingbox[3])],
        ]
      : null,
  }))
}
