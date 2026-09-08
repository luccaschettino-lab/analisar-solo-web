import { candidatosDoKml, sugerirCodigoNome, prepararLinhasDeImportacao } from '../src/lib/kml.js'

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

const CABECALHO = `<?xml version='1.0' encoding='UTF-8' ?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>`

const RODAPE = `  </Document>
</kml>`

const placemark = (nome, coordenadas) => `
    <Placemark>
      <name>${nome}</name>
      <description></description>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordenadas}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`

console.log('=== KML simples, como o QGIS exporta (1 polígono por Placemark) ===')
const quadrado = '-49.0,-9.0,0.0 -49.0,-9.1,0.0 -48.9,-9.1,0.0 -48.9,-9.0,0.0 -49.0,-9.0,0.0'
const kmlSimples = CABECALHO + placemark('Lote 12 - Antigo 19', quadrado) + RODAPE
const candidatosSimples = candidatosDoKml(kmlSimples)
ok('achou 1 candidato', candidatosSimples.length === 1, String(candidatosSimples.length))
ok('nome original preservado', candidatosSimples[0].nomeOriginal === 'Lote 12 - Antigo 19')
ok('geometria é uma Feature', candidatosSimples[0].geometria.type === 'Feature')
ok('geometria é Polygon', candidatosSimples[0].geometria.geometry.type === 'Polygon')
ok('anel externo tem os 5 pontos (fecha no início)',
   candidatosSimples[0].geometria.geometry.coordinates[0].length === 5)
ok('altitude descartada, sobra [lon, lat]',
   JSON.stringify(candidatosSimples[0].geometria.geometry.coordinates[0][0]) === '[-49,-9]')

console.log('\n=== vários Placemarks ===')
const kmlVarios = CABECALHO
  + placemark('Lote 10', quadrado)
  + placemark('Lote 11', quadrado)
  + placemark('Lote 12', quadrado)
  + RODAPE
ok('achou os 3', candidatosDoKml(kmlVarios).length === 3)

console.log('\n=== Placemark de ponto (marcador) é ignorado, não é área ===')
const kmlComPonto = CABECALHO + `
    <Placemark>
      <name>Sede</name>
      <Point><coordinates>-49.0,-9.0,0.0</coordinates></Point>
    </Placemark>` + placemark('Lote 8', quadrado) + RODAPE
const comPonto = candidatosDoKml(kmlComPonto)
ok('só o polígono entra, o ponto não', comPonto.length === 1 && comPonto[0].nomeOriginal === 'Lote 8',
   String(comPonto.length))

console.log('\n=== MultiGeometry (mesmo talhão em duas partes) ===')
const kmlMulti = CABECALHO + `
    <Placemark>
      <name>Lote 20</name>
      <MultiGeometry>
        <Polygon>
          <outerBoundaryIs><LinearRing><coordinates>${quadrado}</coordinates></LinearRing></outerBoundaryIs>
        </Polygon>
        <Polygon>
          <outerBoundaryIs><LinearRing><coordinates>${quadrado}</coordinates></LinearRing></outerBoundaryIs>
        </Polygon>
      </MultiGeometry>
    </Placemark>` + RODAPE
const multi = candidatosDoKml(kmlMulti)
ok('achou 1 candidato (as duas partes juntas)', multi.length === 1)
ok('virou MultiPolygon', multi[0].geometria.geometry.type === 'MultiPolygon')
ok('com as duas partes', multi[0].geometria.geometry.coordinates.length === 2)

console.log('\n=== buraco no polígono (innerBoundaryIs) ===')
const buraco = '-48.98,-9.02,0.0 -48.98,-9.08,0.0 -48.92,-9.08,0.0 -48.92,-9.02,0.0 -48.98,-9.02,0.0'
const kmlComBuraco = CABECALHO + `
    <Placemark>
      <name>Lote 30</name>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>${quadrado}</coordinates></LinearRing></outerBoundaryIs>
        <innerBoundaryIs><LinearRing><coordinates>${buraco}</coordinates></LinearRing></innerBoundaryIs>
      </Polygon>
    </Placemark>` + RODAPE
const comBuraco = candidatosDoKml(kmlComBuraco)
ok('anel externo + anel do buraco', comBuraco[0].geometria.geometry.coordinates.length === 2)

console.log('\n=== polígono degenerado (menos de 4 pontos) some da lista ===')
const kmlDegenerado = CABECALHO
  + placemark('Lote quebrado', '-49.0,-9.0,0.0 -48.9,-9.0,0.0')
  + placemark('Lote 9', quadrado)
  + RODAPE
const semDegenerado = candidatosDoKml(kmlDegenerado)
ok('só o válido sobrou', semDegenerado.length === 1 && semDegenerado[0].nomeOriginal === 'Lote 9')

console.log('\n=== rejeita o que não é KML ===')
let capturou = false
try { candidatosDoKml('<gpx></gpx>') } catch { capturou = true }
ok('lança erro', capturou)

console.log('\n=== rejeita KML sem nenhum polígono ===')
let capturouVazio = false
try { candidatosDoKml(CABECALHO + RODAPE) } catch { capturouVazio = true }
ok('lança erro', capturouVazio)

console.log('\n=== sugerirCodigoNome: convenção "Lote N - resto" ===')
ok('com resto', JSON.stringify(sugerirCodigoNome('Lote 12 - Antigo 19')) === JSON.stringify({ codigo: '12', nome: 'Antigo 19' }))
ok('sem resto', JSON.stringify(sugerirCodigoNome('Lote 14')) === JSON.stringify({ codigo: '14', nome: '' }))
ok('nome composto depois do traço',
   JSON.stringify(sugerirCodigoNome('Lote 14 - Antigo 35, 50 e 150'))
     === JSON.stringify({ codigo: '14', nome: 'Antigo 35, 50 e 150' }))
ok('sem "Lote": nome inteiro vira código',
   JSON.stringify(sugerirCodigoNome('Fundo da fazenda')) === JSON.stringify({ codigo: 'Fundo da fazenda', nome: '' }))
ok('maiúsculo/minúsculo não importa',
   sugerirCodigoNome('LOTE 7').codigo === '7')

console.log('\n=== prepararLinhasDeImportacao: uma linha por polígono, palpite "talhão" ===')
const candidatosParaLinhas = candidatosDoKml(kmlVarios) // Lote 10, 11, 12
const linhas = prepararLinhasDeImportacao(candidatosParaLinhas)
ok('uma linha por candidato', linhas.length === 3)
ok('todas incluídas por padrão', linhas.every((l) => l.incluir === true))
ok('todas como talhão por padrão', linhas.every((l) => l.tipo === 'talhao'))
ok('sem talhão pai por padrão', linhas.every((l) => l.talhaoPaiId === null))
ok('ids únicos', new Set(linhas.map((l) => l.id)).size === 3)
ok('código veio do nome', linhas.map((l) => l.codigo).join(',') === '10,11,12')
ok('área calculada', linhas.every((l) => l.areaHa > 0))

console.log('\n=== prepararLinhasDeImportacao: código repetido ganha sufixo automático ===')
const kmlComLoteRepetido = CABECALHO
  + placemark('Lote 9 - Antigo 3', quadrado)
  + placemark('Lote 9 - Antigo 4', quadrado)
  + placemark('Lote 9 - Antigo 5', quadrado)
  + RODAPE
const linhasRepetidas = prepararLinhasDeImportacao(candidatosDoKml(kmlComLoteRepetido))
ok('a primeira mantém o código original',
   linhasRepetidas[0].codigo === '9', linhasRepetidas.map((l) => l.codigo).join(','))
ok('as seguintes ganham -2, -3... na ordem em que aparecem no arquivo',
   linhasRepetidas[1].codigo === '9-2' && linhasRepetidas[2].codigo === '9-3',
   linhasRepetidas.map((l) => l.codigo).join(','))
ok('todas continuam como talhão — o sufixo só destrava, não decide gleba',
   linhasRepetidas.every((l) => l.tipo === 'talhao'))
ok('códigos já sem repetição (Lote 10/11/12) não ganham sufixo',
   linhas.every((l) => !l.codigo.includes('-')), linhas.map((l) => l.codigo).join(','))

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' FALHA(S)'}`)
process.exit(falhas === 0 ? 0 : 1)
