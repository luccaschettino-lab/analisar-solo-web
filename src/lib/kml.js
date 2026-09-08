import { areaEmHectares } from './geo.js'

/**
 * Leitura de KML (Google Earth, QGIS) para importar talhões e glebas.
 *
 * Sem DOMParser nem lib de XML: o formato que essas ferramentas exportam é
 * regular o bastante (Placemark > Polygon > outerBoundaryIs > coordinates)
 * para extrair com regex, na mesma linha dos outros parsers deste projeto
 * (ver lib/busca.js). Evita puxar uma dependência inteira só pra isso — e
 * funciona igual no navegador e no `node testes/kml.mjs`.
 */

function extrairTag(bloco, nome) {
  const m = bloco.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`, 'i'))
  return m ? m[1] : null
}

function extrairTodos(bloco, nome) {
  const re = new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`, 'gi')
  const out = []
  let m
  while ((m = re.exec(bloco))) out.push(m[1])
  return out
}

function textoSimples(valor) {
  if (valor == null) return ''
  return valor
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

// "lon,lat" ou "lon,lat,altitude" por ponto, separados por espaço ou quebra
// de linha — a altitude é descartada, o mapa é 2D.
function anelDeCoordenadas(texto) {
  return texto
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((par) => {
      const [lon, lat] = par.split(',').map(Number)
      return [lon, lat]
    })
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
}

// Um <Polygon> vira a lista de anéis do GeoJSON: o externo primeiro, depois
// os buracos (innerBoundaryIs), se houver.
function aneisDoPoligono(blocoPoligono) {
  const externo = extrairTag(blocoPoligono, 'outerBoundaryIs')
  const coordExterno = externo && extrairTag(externo, 'coordinates')
  if (!coordExterno) return null

  const anelExterno = anelDeCoordenadas(coordExterno)
  // Um anel fechado precisa de pelo menos 4 pontos (3 vértices + o de
  // fechamento) — menos que isso é lixo de exportação, não polígono.
  if (anelExterno.length < 4) return null

  const aneis = [anelExterno]
  for (const interno of extrairTodos(blocoPoligono, 'innerBoundaryIs')) {
    const coordInterno = extrairTag(interno, 'coordinates')
    const anelInterno = coordInterno && anelDeCoordenadas(coordInterno)
    if (anelInterno?.length >= 4) aneis.push(anelInterno)
  }
  return aneis
}

/**
 * Lê os Placemarks de área de um KML (Polygon, sozinho ou dentro de um
 * MultiGeometry) e devolve um candidato por polígono, pronto para virar
 * talhão ou gleba. Placemark de ponto ou linha (marcador, trilha) é
 * ignorado — não tem área para desenhar.
 *
 * Lança se o arquivo não for KML, ou se não achar nenhum polígono nele —
 * as duas situações em que não há nada a importar.
 */
export function candidatosDoKml(textoKml) {
  if (typeof textoKml !== 'string' || !/<kml[\s>]/i.test(textoKml)) {
    throw new Error('Isso não parece um arquivo KML.')
  }

  const candidatos = []
  for (const bloco of extrairTodos(textoKml, 'Placemark')) {
    const nomeOriginal = textoSimples(extrairTag(bloco, 'name'))

    const poligonos = extrairTodos(bloco, 'Polygon').map(aneisDoPoligono).filter(Boolean)
    if (poligonos.length === 0) continue

    const geometry =
      poligonos.length === 1
        ? { type: 'Polygon', coordinates: poligonos[0] }
        : { type: 'MultiPolygon', coordinates: poligonos }

    candidatos.push({
      nomeOriginal,
      geometria: { type: 'Feature', properties: {}, geometry },
    })
  }

  if (candidatos.length === 0) {
    throw new Error('Nenhum polígono encontrado neste KML — só pontos ou linhas, ou o arquivo está vazio.')
  }
  return candidatos
}

/**
 * "Lote 12 - Antigo 19" -> { codigo: '12', nome: 'Antigo 19' }.
 *
 * O código do talhão é a coluna "Lote" do laudo (mesma convenção de
 * FormTalhao), e é assim que o QGIS do produtor já nomeia os polígonos —
 * reaproveitar poupa digitar tudo de novo na hora de revisar a importação.
 * Sem esse padrão no nome, o nome inteiro vira o código sugerido, e quem
 * revisa ajusta à mão.
 */
export function sugerirCodigoNome(nomeOriginal) {
  const m = nomeOriginal.match(/^lote\s+(\S+)\s*-?\s*(.*)$/i)
  if (m) return { codigo: m[1], nome: m[2].trim() }
  return { codigo: nomeOriginal.trim(), nome: '' }
}

/**
 * Monta as linhas que o assistente de importação mostra pra revisão, uma
 * por polígono do KML.
 *
 * O palpite é sempre "talhão novo" — mesmo quando o código se repete (o que
 * acontece: um Lote do produtor às vezes junta vários campos antigos de
 * nomes diferentes, e a exportação do QGIS não distingue "isso é uma
 * sub-área" de "isso é outro talhão"). Tentar adivinhar isso erraria caro —
 * já vimos os polígonos de um mesmo Lote serem vizinhos, não um dentro do
 * outro. Por isso quem decide se um polígono repetido vira gleba de outro é
 * a pessoa revisando a lista, trocando o tipo da linha.
 *
 * O que a função faz sozinha é só destravar a largada: quando o mesmo
 * código aparece em mais de um polígono, sufixa "-2", "-3"... nas repetições
 * (na ordem em que aparecem no arquivo, a primeira fica com o código
 * original), pra a lista já nascer sem "código repetido" bloqueando tudo.
 * Continua editável linha a linha — é só um ponto de partida, não veredito.
 */
export function prepararLinhasDeImportacao(candidatos) {
  const linhas = candidatos.map((candidato, indice) => {
    const { codigo, nome } = sugerirCodigoNome(candidato.nomeOriginal)
    return {
      id: `kml-${indice}`,
      incluir: true,
      tipo: 'talhao',
      codigo,
      nome,
      nomeOriginal: candidato.nomeOriginal,
      geometria: candidato.geometria,
      areaHa: areaEmHectares(candidato.geometria),
      // Só usado quando tipo === 'gleba': id de outra linha deste lote (uma
      // que virou talhão) ou o id de um talhão já existente na fazenda.
      talhaoPaiId: null,
    }
  })

  desambiguarCodigos(linhas)
  return linhas
}

function desambiguarCodigos(linhas) {
  const ocorrencias = new Map() // codigo original -> quantas vezes já apareceu
  for (const linha of linhas) {
    const base = linha.codigo
    if (!base) continue
    const numero = (ocorrencias.get(base) ?? 0) + 1
    ocorrencias.set(base, numero)
    if (numero > 1) linha.codigo = `${base}-${numero}`
  }
}
