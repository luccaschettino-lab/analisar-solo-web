import assert from 'node:assert/strict'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { talhoesExemplo, pontosExemplo, analisesExemplo, sedeExemplo, SAFRAS_EXEMPLO } from '../src/lib/fazendaExemplo.js'
import { agruparPontosEmGlebas } from '../src/lib/pontosDeColeta.js'
import { PARAMETROS } from '../src/config/parametros.js'

const talhoes = talhoesExemplo().map((t, i) => ({ ...t, id: `t${i + 1}` }))
assert.equal(talhoes.length, 4)
for (const t of talhoes) assert.ok(t.areaHa > 80 && t.areaHa < 95, `talhão ${t.codigo} com ${t.areaHa} ha`)

const porCodigo = pontosExemplo()
const pontos = talhoes.flatMap((t) =>
  porCodigo.get(t.codigo).map((p, i) => ({ ...p, id: `${t.id}-p${i}`, talhao_id: t.id })),
)
assert.equal(pontos.length, 4 * 6 * 5)
for (const p of pontos) {
  const t = talhoes.find((x) => x.id === p.talhao_id)
  assert.ok(booleanPointInPolygon(p.geometria, t.geometria), 'todo ponto cai no seu talhão')
}
const sede = sedeExemplo()
assert.ok(talhoes.every((t) => !booleanPointInPolygon([sede.lng, sede.lat], t.geometria)), 'sede fora dos talhões')

const { glebas, entreTalhoes, semCodigo } = agruparPontosEmGlebas(pontos, talhoes)
assert.equal(glebas.length, 24)
assert.equal(entreTalhoes, 0)
assert.equal(semCodigo, 0)
assert.deepEqual(glebas.slice(0, 3).map((g) => g.codigo), ['1-1', '1-2', '1-3'])
const somaTalhoes = talhoes.reduce((s, t) => s + t.areaHa, 0)
const somaGlebas = glebas.reduce((s, g) => s + g.areaHa, 0)
assert.ok(Math.abs(somaGlebas - somaTalhoes) / somaTalhoes < 0.005, 'glebas cobrem os talhões')

const pontoPorId = new Map(pontos.map((p) => [p.id, p]))
const analises = analisesExemplo(
  glebas.map((g) => ({
    codigo: g.codigo,
    talhaoId: g.talhaoId,
    codigoTalhao: talhoes.find((t) => t.id === g.talhaoId).codigo,
    pontos: g.pontoIds.map((id) => pontoPorId.get(id).geometria.geometry.coordinates),
  })),
)
assert.equal(analises.length, 22 * 2 * 2, '22 glebas com análise, 2 safras, 2 profundidades')
const chaves = new Set(analises.map((a) => JSON.stringify([a.talhao_id, a.ano_safra, a.profundidade, a.numero_amostra_lab])))
assert.equal(chaves.size, analises.length, 'nenhuma análise repete a chave única do banco')

// Todo valor dentro da faixa plausível do parâmetro.
for (const a of analises) {
  for (const par of PARAMETROS) {
    const v = a[par.chave]
    if (v == null) continue
    assert.ok(v >= par.plausivel.min && v <= par.plausivel.max, `${par.chave}=${v} fora do plausível`)
  }
}

// O calcário do talhão 2 aparece na comparação.
const media = (lista, chave) => lista.reduce((s, a) => s + a[chave], 0) / lista.length
const t2 = (safra) => analises.filter((a) => a.talhao_id === 't2' && a.ano_safra === safra && a.profundidade === '0-20')
assert.ok(media(t2(SAFRAS_EXEMPLO[1]), 'ph_h2o') - media(t2(SAFRAS_EXEMPLO[0]), 'ph_h2o') > 0.4)

// O mapa de calor tem o que mostrar: pH varia entre as glebas.
const phs = analises.filter((a) => a.profundidade === '0-20').map((a) => a.ph_h2o)
assert.ok(Math.max(...phs) - Math.min(...phs) > 0.8, 'pH varia pela fazenda')

console.log('fazenda de exemplo: talhões, pontos, 24 glebas e análises coerentes OK')
