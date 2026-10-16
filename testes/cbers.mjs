import {
  bboxDaGeometria,
  listarCenasCbers,
} from '../src/dados/cbers.js'

let falhas = 0
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`)
  if (!condicao) falhas++
}

const cena = (id, data, bbox = [-43, -21, -42, -20], extra = {}) => ({
  id,
  bbox,
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [bbox[0], bbox[1]],
      [bbox[2], bbox[1]],
      [bbox[2], bbox[3]],
      [bbox[0], bbox[3]],
      [bbox[0], bbox[1]],
    ]],
  },
  properties: { datetime: data, cloud_cover: 20 },
  assets: { thumbnail: { href: `https://www.dgi.inpe.br/datastore/${id}.png` } },
  ...extra,
})

const fetchOriginal = globalThis.fetch
try {
  console.log('=== consulta de cenas CBERS ===')
  let urlConsultada
  globalThis.fetch = async (url) => {
    urlConsultada = new URL(url)
    return new Response(JSON.stringify({
      context: { matched: 1 },
      features: [cena('recente', '2026-09-28T00:00:00Z')],
    }))
  }

  const cenasConsultadas = await listarCenasCbers([-43, -21, -42, -20], {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[-43, -21], [-42, -21], [-42, -20], [-43, -20], [-43, -21]]],
    },
  })
  ok('mantém a data da aquisição', cenasConsultadas[0]?.data === '2026-09-28T00:00:00Z')
  ok('usa coleção CBERS-4A MUX L4', urlConsultada.pathname.endsWith('/CBERS4A_MUX_L4_DN/items'))
  ok('solicita o máximo de 1000 cenas para a linha do tempo', urlConsultada.searchParams.get('limit') === '1000')
  ok('consulta bbox do talhão', urlConsultada.searchParams.get('bbox') === '-43,-21,-42,-20')

  console.log('\n=== linha do tempo de cenas CBERS ===')
  globalThis.fetch = async (url) => {
    urlConsultada = new URL(url)
    return new Response(JSON.stringify({
      context: { matched: 2 },
      features: [
        cena('recente', '2026-09-28T00:00:00Z'),
        cena('antiga', '2026-08-01T00:00:00Z'),
      ],
    }))
  }
  const geometriaTalhao = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[-43, -21], [-42.5, -21], [-42.5, -20.5], [-43, -20.5], [-43, -21]]],
    },
  }
  const cronologia = await listarCenasCbers([-43, -21, -42, -20], geometriaTalhao)
  ok('consulta cenas dentro da área do talhão', urlConsultada.searchParams.get('bbox') === '-43,-21,-42,-20')
  ok('ordena da mais antiga para a mais recente', cronologia[0]?.id === 'antiga' && cronologia[1]?.id === 'recente')
  ok('preserva a cobertura de nuvens em percentual', cronologia[0]?.nuvens === 20)

  globalThis.fetch = async () => new Response(JSON.stringify({
    context: { matched: 2 },
    features: [
      cena('nao-cruza-area', '2026-09-30T00:00:00Z', [-43, -21, -42, -20], {
        geometry: {
          type: 'Polygon',
          coordinates: [[[-42.7, -20.7], [-42.6, -20.7], [-42.6, -20.6], [-42.7, -20.6], [-42.7, -20.7]]],
        },
      }),
      cena('cruza-area', '2026-09-28T00:00:00Z', [-43, -21, -42, -20]),
    ],
  }))
  const cenasCruzadas = await listarCenasCbers([-43, -21, -42, -20], {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[-43, -21], [-42.8, -21], [-42.8, -20.8], [-43, -20.8], [-43, -21]]],
    },
  })
  ok('ignora cena cuja bbox cruza, mas cujo polígono não cruza o talhão', cenasCruzadas.length === 1 && cenasCruzadas[0].id === 'cruza-area')

  console.log('\n=== caixa delimitadora da geometria ===')
  const geojson = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[-43, -21], [-42, -21], [-42, -20], [-43, -20], [-43, -21]]],
    },
  }
  ok('extrai bbox da geometria GeoJSON', JSON.stringify(bboxDaGeometria(geojson)) === '[-43,-21,-42,-20]')
  ok('devolve null sem polígono válido', bboxDaGeometria({ type: 'Point', coordinates: [-42, -21] }) === null)
} finally {
  globalThis.fetch = fetchOriginal
}

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' FALHA(S)'}`)
process.exit(falhas === 0 ? 0 : 1)
