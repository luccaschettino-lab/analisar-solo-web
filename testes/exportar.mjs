// Exportação: as linhas (montagem), a planilha (ExcelJS), o KML e o Shapefile.
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import shpwrite from '@mapbox/shp-write'
import JSZip from 'jszip'
import { montarExportacao, interpretar } from '../src/lib/exportar/montagem.js'
import { gerarPlanilha } from '../src/lib/exportar/planilha.js'
import { camadasGeo, gerarKml, gerarShapefiles, kmlDasImagens } from '../src/lib/exportar/mapas.js'
const SO_SEMENTE = {} // = FazendaContext: só as faixas-semente

const quadrado = (x, y, l) => ({ type: 'Polygon', coordinates: [[[x, y], [x + l, y], [x + l, y + l], [x, y + l], [x, y]]] })
const ponto = (x, y) => ({ type: 'Point', coordinates: [x, y] })

const fazenda = { id: 'f1', nome: 'Fazenda Teste', municipio: 'Viçosa', uf: 'MG', exemplo: true }
const talhoes = [
  { id: 't1', codigo: '1', geometria: quadrado(-45, -20, 0.01) },
  { id: 't2', codigo: '2', geometria: { type: 'MultiPolygon', coordinates: [quadrado(-44.9, -20, 0.01).coordinates] } },
]
const glebas = [
  { id: 'g1', talhao_id: 't1', codigo: '1-1', geometria: quadrado(-45, -20, 0.005) },
  { id: 'g2', talhao_id: 't1', codigo: '1-2', geometria: quadrado(-44.995, -20, 0.005) },
  { id: 'g3', talhao_id: 't2', codigo: '2-1', geometria: quadrado(-44.9, -20, 0.01) },
]
const analise = (id, talhao, x, y, safra, prof, valores) => ({ id, talhao_id: talhao, geometria: ponto(x, y), ano_safra: safra, profundidade: prof, origem: 'manual', ...valores })
const analises = [
  analise('a1', 't1', -44.998, -19.998, '24-25', '0-20', { ph_h2o: 4.2, p: 3, v: 40 }),
  analise('a2', 't1', -44.998, -19.998, '25-26', '0-20', { ph_h2o: 5.6, p: 12, v: 55 }),
  analise('a3', 't1', -44.998, -19.998, '25-26', '20-40', { ph_h2o: 5.1 }),
  analise('a4', 't2', -44.895, -19.995, '25-26', '0-20', { ph_h2o: 6.0 }),
]
const pontos = [{ talhao_id: 't1', gleba_id: 'g1', geometria: ponto(-44.998, -19.998), propriedades: { amostra: '7' } }]
const indices = [{ talhao_id: 't1', fonte: 'sentinel', cena_id: 'S2', data: '2026-10-01T13:00:00Z', estatisticas: { ndvi: { media: 0.71, minimo: 0.2, maximo: 0.9 } }, qualidade: { pixelsNoTalhao: 100, validos: 90 } }]
const fotos = [{ gleba_id: 'g1', ano_safra: '25-26', profundidade: '0-20', caminho: 'f1/glebas/g1/x.jpg' }]

const dados = montarExportacao({
  fazenda, talhoes, glebas, analises, pontos, indices, fotos,
  parametrosDoCriterio: SO_SEMENTE,
  filtro: { talhoes: null, safras: null, profundidades: null },
  comparar: { safraA: '24-25', safraB: '25-26' },
})

// Gleba 1-1 tem 3 análises; 1-2 nenhuma (uma linha vazia); 2-1 uma.
assert.equal(dados.linhasGlebas.filter((l) => l.gleba === '1-1').length, 3)
assert.equal(dados.linhasGlebas.filter((l) => l.gleba === '1-2').length, 1)
assert.equal(dados.linhasGlebas.find((l) => l.gleba === '1-2').analise, null)
assert.equal(dados.linhasGlebas[0].safra, '25-26', 'safra mais recente primeiro')
assert.equal(dados.linhasGlebas.find((l) => l.gleba === '1-1').pontos, 1)
assert.equal(dados.totais.analises, 4)
assert.equal(Math.round(dados.linhasSatelite[0].limpoPct), 90)
// Comparação: só 1-1 / 0-20 tem as duas safras.
const ph = dados.linhasComparacao.find((l) => l.parametro.chave === 'ph_h2o')
assert.ok(ph && Math.abs(ph.variacao - 1.4) < 1e-9)
assert.equal(dados.fotos[0].gleba, '1-1')

// Filtro por safra e talhão.
const so2 = montarExportacao({ fazenda, talhoes, glebas, analises, pontos, indices, fotos, parametrosDoCriterio: SO_SEMENTE, filtro: { talhoes: new Set(['t2']), safras: new Set(['25-26']), profundidades: null }, comparar: null })
assert.equal(so2.totais.talhoes, 1)
assert.equal(so2.totais.analises, 1)
assert.equal(so2.totais.fotos, 0)

// Planilha: todas as abas, a capa e a cor do nível.
const partes = new Set(['glebas', 'interpretacao', 'talhoes', 'analises', 'pontos', 'satelite', 'comparacao', 'criterios'])
const wb = await gerarPlanilha(dados, { ExcelJS, logo: null, partes, parametrosDoCriterio: SO_SEMENTE, criterio: null, comparar: { safraA: '24-25', safraB: '25-26' } })
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Resumo', 'Glebas', 'Interpretação', 'Talhões', 'Análises', 'Pontos de amostra', 'Satélite', 'Comparação de safras', 'Critérios'])
const buf = await wb.xlsx.writeBuffer()
assert.ok(buf.byteLength > 5000)
const lido = new ExcelJS.Workbook()
await lido.xlsx.load(buf)
const abaG = lido.getWorksheet('Glebas')
assert.equal(abaG.getRow(1).getCell(1).value, 'Talhão')
const colPh = abaG.getRow(1).values.indexOf('pH em água')
assert.ok(colPh > 0)
const nivelPh = interpretar('ph_h2o', 5.6, SO_SEMENTE)
const celula = abaG.getRow(2).getCell(colPh)
assert.equal(celula.value, 5.6)
if (nivelPh) assert.ok(celula.fill?.fgColor?.argb, 'valor com nível ganha cor')

// Mapas.
const camadas = camadasGeo(dados)
assert.equal(camadas.talhoes.features.length, 2)
assert.equal(camadas.glebas.features.length, 3)
assert.equal(camadas.glebas.features.find((f) => f.properties.gleba === '1-1').properties.ph_h2o, 5.6, 'última safra, camada mais rasa')
const kml = gerarKml(camadas, { nomeFazenda: 'A & B' })
assert.ok(kml.includes('A &amp; B') && kml.includes('<Folder><name>Glebas</name>') && kml.includes('<Point>'))
const shps = await gerarShapefiles(camadas, shpwrite)
for (const chave of ['talhoes', 'glebas', 'pontos']) {
  const z = await JSZip.loadAsync(shps[chave])
  const nomes = Object.keys(z.files).map((n) => n.split('/').pop())
  assert.ok(nomes.some((n) => n.endsWith('.shp')) && nomes.some((n) => n.endsWith('.dbf')), `shapefile de ${chave}`)
}
// Talhão Polygon + MultiPolygon: as duas feições precisam sobreviver.
const zt = await JSZip.loadAsync(shps.talhoes)
const dbf = await Object.values(zt.files).find((f) => f.name.endsWith('.dbf')).async('uint8array')
assert.equal(new DataView(dbf.buffer).getUint32(4, true), 2, 'os dois talhões no .dbf')

const kmlImg = kmlDasImagens([{ talhao: '1', indice: 'ndvi', data: '01/10/2026', arquivo: 'imagens/ndvi/t1.png', bbox: [-45, -20, -44.99, -19.99] }], { nomeFazenda: 'F' })
assert.ok(kmlImg.includes('<west>-45</west>') && kmlImg.includes('<north>-19.99</north>'))

console.log('exportar: ok')
