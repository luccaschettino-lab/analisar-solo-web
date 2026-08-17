/**
 * Interpretação do que o usuário digita no campo de busca do mapa.
 *
 * Um campo só, dois comportamentos: se o texto é um par de coordenadas, o mapa
 * vai direto; se não, vira consulta de nome de lugar. A escolha é do texto, não
 * do usuário — obrigar a escolher o tipo antes de digitar seria pedir que ele
 * soubesse o que o sistema aceita.
 */

// Faixa aproximada do Brasil. Serve só para desconfiar de coordenada trocada,
// nunca para recusar — quem trabalha fora daqui tem o direito de digitar.
const BRASIL = { lat: [-34, 6], lng: [-74, -34] }

const DMS = /[°º'"′″]|\b[NSEWLO]\b/i

function dentroDoBrasil(lat, lng) {
  return (
    lat >= BRASIL.lat[0] && lat <= BRASIL.lat[1] &&
    lng >= BRASIL.lng[0] && lng <= BRASIL.lng[1]
  )
}

/**
 * Separa os dois números respeitando a vírgula decimal.
 *
 * A ambiguidade é real: em `-20.7546, -42.8825` a vírgula separa os campos, e
 * em `-20,7546 -42,8825` ela é o decimal. **Quem desfaz o empate é a
 * contagem** — uma vírgula só separa; duas são decimais e o separador é o
 * espaço. Tentar decidir pelo espaço primeiro quebra o formato mais comum,
 * porque `-20.7546,` fica com a vírgula colada no número.
 */
function separar(texto) {
  const t = texto.trim()
  if (t.includes(';')) return { partes: t.split(';'), virgulaEhDecimal: true }

  const virgulas = (t.match(/,/g) || []).length
  if (virgulas === 2) return { partes: t.split(/\s+/), virgulaEhDecimal: true }
  if (virgulas === 1) return { partes: t.split(','), virgulaEhDecimal: false }
  return { partes: t.split(/\s+/), virgulaEhDecimal: false }
}

function paraNumero(bruto, virgulaEhDecimal) {
  let t = String(bruto).trim()
  if (virgulaEhDecimal) t = t.replace(',', '.')
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return NaN
  return Number(t)
}

/**
 * Resultado possível:
 *   { tipo: 'coordenada', lat, lng, invertidaProvavel }
 *   { tipo: 'lugar', consulta }
 *   { tipo: 'erro', motivo }
 */
export function interpretarBusca(texto) {
  const limpo = String(texto ?? '').trim()
  if (!limpo) return { tipo: 'erro', motivo: 'Digite um lugar ou um par de coordenadas.' }

  // Grau, minuto e segundo é comum em documento do CAR e em GPS antigo, mas
  // converter aqui abriria uma caixa de formatos. Melhor dizer o que fazer.
  if (DMS.test(limpo) && /\d/.test(limpo)) {
    return {
      tipo: 'erro',
      motivo: 'Coordenada em grau/minuto/segundo ainda não é aceita. Converta para graus decimais, como -20.7546, -42.8825.',
    }
  }

  const { partes, virgulaEhDecimal } = separar(limpo)
  const numericos = partes.length === 2 && partes.every((p) => /\d/.test(p))

  if (numericos) {
    const lat = paraNumero(partes[0], virgulaEhDecimal)
    const lng = paraNumero(partes[1], virgulaEhDecimal)

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      if (lat < -90 || lat > 90) {
        return { tipo: 'erro', motivo: `Latitude ${lat} fora de −90 a 90.` }
      }
      if (lng < -180 || lng > 180) {
        return { tipo: 'erro', motivo: `Longitude ${lng} fora de −180 a 180.` }
      }
      return {
        tipo: 'coordenada',
        lat,
        lng,
        // Trocar latitude com longitude é o erro mais comum ao colar de
        // planilha. Não recusamos: avisamos e oferecemos a troca.
        invertidaProvavel: !dentroDoBrasil(lat, lng) && dentroDoBrasil(lng, lat),
      }
    }
  }

  // Sobrou texto: é nome de lugar.
  return { tipo: 'lugar', consulta: limpo }
}
