/**
 * Parser do cadastro de glebas em lote.
 *
 * Formato por linha: `codigo, latitude, longitude` em graus decimais.
 *
 * Duas tolerâncias deliberadas, porque o texto quase sempre vem colado de
 * planilha e não digitado à mão:
 *
 *  - Separador: vírgula, ponto e vírgula ou tabulação. O Excel em português
 *    exporta CSV com ponto e vírgula, não com vírgula.
 *  - Decimal: ponto sempre; vírgula também, mas só quando o separador de
 *    campos não é a vírgula. `G1;-20,7546;-42,8825` é o que sai do Excel
 *    pt-BR, e recusar isso obrigaria o usuário a reformatar a planilha.
 *
 * Uma linha ruim nunca aborta as outras: volta em `erros` com o número da
 * linha, e as boas seguem em `itens`.
 */

function separarCampos(linha) {
  // Ponto e vírgula ou tabulação têm prioridade: quando estão presentes, são
  // o separador, e a vírgula que sobrar é decimal.
  if (/[;\t]/.test(linha)) {
    return { campos: linha.split(/[;\t]/), virgulaEhDecimal: true }
  }
  return { campos: linha.split(','), virgulaEhDecimal: false }
}

function paraNumero(bruto, virgulaEhDecimal) {
  let texto = String(bruto).trim()
  if (!texto) return NaN
  if (virgulaEhDecimal) texto = texto.replace(',', '.')
  // Rejeita "12.5.3", "1e5" e afins: coordenada é número simples com sinal.
  if (!/^[+-]?\d+(\.\d+)?$/.test(texto)) return NaN
  return Number(texto)
}

export function parsearLote(texto, { codigosExistentes = [] } = {}) {
  const itens = []
  const erros = []
  const jaVistos = new Map()
  const existentes = new Set(codigosExistentes.map((c) => String(c).trim().toLowerCase()))

  const linhas = String(texto ?? '').split(/\r?\n/)

  linhas.forEach((linhaBruta, indice) => {
    const numero = indice + 1
    const linha = linhaBruta.trim()
    if (!linha) return // linha em branco não é erro

    const { campos, virgulaEhDecimal } = separarCampos(linha)
    const partes = campos.map((c) => c.trim()).filter((c, i) => c !== '' || i < 3)

    if (partes.length < 3) {
      erros.push({ linha: numero, texto: linha, motivo: 'esperado código, latitude e longitude' })
      return
    }
    if (partes.length > 3) {
      erros.push({ linha: numero, texto: linha, motivo: `${partes.length} campos; esperado 3` })
      return
    }

    const [codigo, latBruta, lngBruta] = partes

    if (!codigo) {
      erros.push({ linha: numero, texto: linha, motivo: 'código vazio' })
      return
    }

    const lat = paraNumero(latBruta, virgulaEhDecimal)
    const lng = paraNumero(lngBruta, virgulaEhDecimal)

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      erros.push({ linha: numero, texto: linha, motivo: 'latitude ou longitude não é um número' })
      return
    }
    if (lat < -90 || lat > 90) {
      erros.push({ linha: numero, texto: linha, motivo: `latitude ${lat} fora de -90..90` })
      return
    }
    if (lng < -180 || lng > 180) {
      erros.push({ linha: numero, texto: linha, motivo: `longitude ${lng} fora de -180..180` })
      return
    }

    const chave = codigo.toLowerCase()
    if (jaVistos.has(chave)) {
      erros.push({
        linha: numero,
        texto: linha,
        motivo: `código "${codigo}" repetido (já na linha ${jaVistos.get(chave)})`,
      })
      return
    }
    if (existentes.has(chave)) {
      erros.push({
        linha: numero,
        texto: linha,
        motivo: `código "${codigo}" já existe neste talhão`,
      })
      return
    }

    jaVistos.set(chave, numero)
    itens.push({ linha: numero, codigo, lat, lng })
  })

  return { itens, erros }
}
