import shp from 'shpjs'
import JSZip from 'jszip'
import { candidatosDoKml } from './kml.js'

/**
 * Leitura de talhões a partir de qualquer formato de arquivo geoespacial
 * comum entre agrônomos e ferramentas de agricultura de precisão — não só
 * KML.
 *
 * Todo formato converge para a mesma saída de `candidatosDoKml`:
 * `[{ nomeOriginal, geometria }]`, um por polígono. Quem revisa e grava
 * (`prepararLinhasDeImportacao`, `ImportarArquivo.jsx`) não sabe nem precisa
 * saber de onde o polígono veio.
 */

function extensaoDe(nomeArquivo) {
  const m = /\.[^.]+$/.exec(nomeArquivo.toLowerCase())
  return m ? m[0] : ''
}

/**
 * KMZ é um KML zipado — o mesmo formato que o Google Earth e apps de GPS de
 * campo exportam por padrão. Só precisa achar o .kml de dentro e reusar o
 * parser que já existe.
 */
async function candidatosDoKmz(buffer, opcoes) {
  const zip = await JSZip.loadAsync(buffer)
  const entrada = Object.values(zip.files).find((f) => !f.dir && /\.kml$/i.test(f.name))
  if (!entrada) throw new Error('Não encontrei nenhum .kml dentro deste .kmz.')
  const texto = await entrada.async('text')
  return candidatosDoKml(texto, opcoes)
}

// Primeiro atributo que pareça um nome ou código de talhão, na ordem em que
// um DBF de shapefile ou as properties de um GeoJSON costumam trazer isso.
// Sem nenhum, cai num nome genérico — a pessoa revisando ainda digita o
// código à mão, só perde a sugestão.
function nomeDaFeature(properties, indice, rotuloPadrao = 'Polígono', paraGlebas = false) {
  const chaves = [
    'name', 'Name', 'NOME', 'nome', 'Lote', 'lote', 'LOTE', 'codigo', 'CODIGO', 'talhao', 'TALHAO',
    // Arquivos de glebas costumam trazer o número da gleba/amostra. Só na
    // importação de glebas: em talhões, um `id` qualquer viraria código sugerido.
    ...(paraGlebas ? ['gleba', 'Gleba', 'GLEBA', 'amostra', 'Amostra', 'id', 'ID'] : []),
  ]
  for (const chave of chaves) {
    const valor = properties?.[chave]
    if (valor != null && String(valor).trim()) return String(valor).trim()
  }
  return `${rotuloPadrao} ${indice + 1}`
}

/**
 * De uma FeatureCollection (GeoJSON puro, ou já convertido de shapefile) para
 * os candidatos — só as features de área, na mesma regra do KML: ponto e
 * linha não têm o que desenhar. Com `{ pontos: true }` (glebas, que também
 * podem ser pontos) as features de ponto entram como candidatos Point.
 */
function candidatosDeColecao(colecao, { pontos = false } = {}) {
  const features =
    colecao?.type === 'FeatureCollection' ? (colecao.features ?? [])
    : colecao?.type === 'Feature' ? [colecao]
    : colecao?.type ? [{ type: 'Feature', properties: {}, geometry: colecao }]
    : []

  const candidatos = []
  features.forEach((feature, indice) => {
    const geometry = feature?.geometry
    if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') {
      candidatos.push({
        nomeOriginal: nomeDaFeature(feature.properties, indice, 'Polígono', pontos),
        geometria: { type: 'Feature', properties: {}, geometry },
      })
      return
    }
    if (!pontos) return
    const coordenadas =
      geometry?.type === 'Point' ? [geometry.coordinates]
      : geometry?.type === 'MultiPoint' ? geometry.coordinates
      : []
    coordenadas.forEach((coordenada) => {
      if (!Array.isArray(coordenada) || !Number.isFinite(coordenada[0]) || !Number.isFinite(coordenada[1])) return
      candidatos.push({
        nomeOriginal: nomeDaFeature(feature.properties, indice, 'Ponto', true),
        geometria: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [coordenada[0], coordenada[1]] } },
      })
    })
  })
  return candidatos
}

function candidatosDoGeoJson(texto, opcoes) {
  let json
  try {
    json = JSON.parse(texto)
  } catch {
    throw new Error('Isso não parece um arquivo GeoJSON válido — não deu para ler como JSON.')
  }
  const candidatos = candidatosDeColecao(json, opcoes)
  if (candidatos.length === 0) {
    throw new Error(
      opcoes?.pontos
        ? 'Nenhum polígono nem ponto encontrado neste GeoJSON — só linhas, ou o arquivo está vazio.'
        : 'Nenhum polígono encontrado neste GeoJSON — só pontos ou linhas, ou o arquivo está vazio.',
    )
  }
  return candidatos
}

/**
 * Shapefile chega sempre zipado (.shp + .dbf + .shx + .prj juntos) — é como
 * toda ferramenta de agricultura de precisão exporta. `shpjs` lê o zip
 * inteiro e, crucialmente, reprojeta pelas coordenadas do .prj: shapefile
 * brasileiro quase sempre vem em UTM/SIRGAS 2000, nunca em lat/lng direto, e
 * reprojetar à mão é a parte que dá errado se reinventada aqui.
 */
async function candidatosDoShapefile(buffer, opcoes) {
  const resultado = await shp(buffer)
  // Um zip com mais de uma camada .shp volta como array de coleções.
  const colecoes = Array.isArray(resultado) ? resultado : [resultado]
  const candidatos = colecoes.flatMap((colecao) => candidatosDeColecao(colecao, opcoes))
  if (candidatos.length === 0) {
    throw new Error(opcoes?.pontos ? 'Nenhum polígono nem ponto encontrado neste shapefile.' : 'Nenhum polígono encontrado neste shapefile.')
  }
  return candidatos
}

export const EXTENSOES_ACEITAS = '.kml,.kmz,.geojson,.json,.zip'

/**
 * Ponto de entrada único: olha a extensão e chama o leitor certo. Lança com
 * mensagem em português sempre que o formato não é nenhum dos aceitos, ou
 * quando o leitor específico não acha nada dentro do arquivo.
 *
 * `opcoes.pontos`: aceita também pontos (importação de glebas). Para talhões
 * fica desligado, e só polígonos entram.
 */
export async function candidatosDoArquivo(arquivo, opcoes = {}) {
  const ext = extensaoDe(arquivo.name)

  if (ext === '.kml') return candidatosDoKml(await arquivo.text(), opcoes)
  if (ext === '.kmz') return candidatosDoKmz(await arquivo.arrayBuffer(), opcoes)
  if (ext === '.geojson' || ext === '.json') return candidatosDoGeoJson(await arquivo.text(), opcoes)
  if (ext === '.zip') return candidatosDoShapefile(await arquivo.arrayBuffer(), opcoes)

  throw new Error('Formato não reconhecido. Use .kml, .kmz, .geojson ou um .zip de shapefile.')
}
