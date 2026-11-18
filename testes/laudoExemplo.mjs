import assert from 'node:assert/strict'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { laudoExemploPdf } from '../src/lib/laudoExemplo.js'
import { extrairLinhasPdf } from '../src/lib/extrairLinhasPdf.js'
import { lerLaudoUfv, ehLaudoUfv, anoSafraDaData } from '../src/lib/laudoUfv.js'
import { valoresExemplo } from '../src/lib/fazendaExemplo.js'

// 22 glebas × 2 profundidades, menos a amostra 1 0-20 (digitada no tutorial).
const amostras = []
for (let gleba = 1; gleba <= 22; gleba++) {
  for (const profundidade of ['0-20', '20-40']) {
    if (gleba === 1 && profundidade === '0-20') continue
    amostras.push({
      gleba,
      profundidade,
      valores: valoresExemplo({ x: (gleba % 6) / 5, y: Math.floor(gleba / 6) / 4, talhao: '2', safra: '25-26', profundidade, amostra: gleba }),
    })
  }
}

const bytes = laudoExemploPdf({ amostras, entrada: '15/09/2025', identificacao: 'Fazenda do tutorial' })
const paginas = await extrairLinhasPdf(bytes.buffer, { pdfjs })
assert.ok(ehLaudoUfv(paginas.flat()), 'reconhecido como laudo da UFV')

const laudo = lerLaudoUfv(paginas)
assert.equal(anoSafraDaData(laudo.entrada), '25-26', 'a entrada sugere a safra 25-26')
assert.equal(laudo.amostras.length, amostras.length)
const comAviso = laudo.amostras.filter((a) => a.avisos.length > 0)
assert.deepEqual(comAviso.map((a) => [a.referencia, a.avisos]), [], 'nenhuma amostra com aviso (colunas e SB conferem)')

for (const lida of laudo.amostras) {
  const original = amostras.find((a) => a.gleba === lida.gleba && a.profundidade === lida.profundidade)
  assert.ok(original, `amostra ${lida.referencia} existe`)
  for (const chave of ['ph_h2o', 'p', 'k', 'ca', 'mg', 'v', 'mo']) {
    const esperado = original.valores[chave]
    if (esperado == null) assert.equal(lida.parametros[chave], null, `${chave} vazio continua vazio`)
    else assert.ok(Math.abs(lida.parametros[chave] - esperado) < 0.011, `${lida.referencia} ${chave}: ${lida.parametros[chave]} ≈ ${esperado}`)
  }
}
console.log(`laudo de exemplo: PDF de ${paginas.length} páginas lido pelo leitor da UFV, ${laudo.amostras.length} amostras sem aviso OK`)
