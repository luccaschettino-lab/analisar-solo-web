import assert from 'node:assert/strict'
import { lerLaudoUfv, ehLaudoUfv, anoSafraDaData } from '../src/lib/laudoUfv.js'
import { resolverAmostraDoLaudo, payloadDaAmostra, chaveDeDuplicidade, STATUS } from '../src/lib/importacaoLaudo.js'
import { pontoFeature } from '../src/lib/geo.js'

// Laudo sintético, no formato da UFV (números inventados). Repare na ordem: a linha com os nomes
// das colunas das tabelas 2 e 3 vem ANTES de "Nº Lab", como no PDF real.
const pagina = [
  'Universidade Federal de Viçosa',
  'Departamento de Solos',
  'Solicitação Nº: 301/2026',
  'Entrada: 15/10/2026',
  'Identificação: Fazenda Teste',
  'Resultados de Análise Química de Solo',
  'Nº Lab I.U. Referência do Cliente pH pH pH P K Na Ca2+',
  'H2O KCl CaCl2',
  'mg/dm3 mg/dm3 mg/dm3 cmolc/dm3',
  '1001 - Gleba 7 0-20 6,10 - - 12,5 80 - 3,00',
  '1002 - Gleba 7 20-40 5,90 5,2 - 0,0 40 3 2,00',
  '1003 - Gleba 8 0-20 6,50 - - 8,0 60 - 4,00',
  'Mg2+ Al3+ H + Al SB t T V m ISNa MO P-Rem',
  'Nº Lab',
  'cmolc/dm3 cmolc/dm3 cmolc/dm3',
  '1001 1,00 0,00 4,0 4,21 4,21 8,21 51,3 0,0 - 3,50 20,0',
  '1002 0,80 0,10 3,0 2,90 3,00 5,90 49,2 3,3 0,2 2,00 25,0',
  '1003 1,50 0,00 2,0 5,65 5,65 7,65 73,9 0,0 - 4,10 18,0',
  'S B N Cu Mn Fe Zn Cr Ni Cd Pb',
  'Nº Lab',
  'mg/dm3 mg/dm3',
  '1001 0,0 0,30 - 1,10 20,0 50,0 1,20 - - - -',
  '1002 5,5 0,25 0,1 0,90 15,0 40,0 0,80 2,5 - - -',
  '1003 8,0 0,40 - 1,30 25,0 60,0 1,50 - - - -',
]
const laudo = lerLaudoUfv([pagina])

assert.equal(ehLaudoUfv(pagina), true)
assert.equal(ehLaudoUfv(['Laboratório X']), false)
assert.equal(laudo.solicitacao, '301/2026')
assert.equal(laudo.entrada, '2026-10-15')
assert.equal(laudo.amostras.length, 3)

const a1 = laudo.amostras.find((a) => a.n_lab === '1001')
assert.equal(a1.referencia, 'Gleba 7 0-20')
assert.equal(a1.gleba, 7)
assert.equal(a1.profundidade, '0-20')
assert.equal(a1.parametros.ph_h2o, 6.1, 'vírgula decimal vira número')
assert.equal(a1.parametros.p, 12.5)
assert.equal(a1.parametros.k, 80)
assert.equal(a1.parametros.al, 0, 'zero medido continua zero')
assert.equal(a1.parametros.s, 0, 'enxofre 0,0 do laudo é um valor medido, não ausência')
assert.equal(a1.parametros.mo, 3.5)
assert.equal(a1.parametros.t_potencial, 8.21)
assert.deepEqual(a1.avisos, [], 'laudo coerente não gera aviso')

const a2 = laudo.amostras.find((a) => a.n_lab === '1002')
assert.equal(a2.profundidade, '20-40')
assert.equal(a2.parametros.p, 0)
assert.deepEqual(
  a2.extras,
  { ph_kcl: 5.2, na: 3, isna: 0.2, n: 0.1, cr: 2.5 },
  'o que não tem coluna no app vai para extras, só o que foi medido',
)
assert.deepEqual(a1.extras, {}, 'traço no laudo = nada em extras, nunca 0')

// "-" é ausência (null), não zero
const semAluminio = lerLaudoUfv([pagina.map((l) => (l.startsWith('1003 1,50') ? '1003 1,50 - 2,0 5,65 5,65 7,65 73,9 0,0 - 4,10 18,0' : l))])
assert.equal(semAluminio.amostras.find((a) => a.n_lab === '1003').parametros.al, null)

// Valores que não fecham (coluna deslocada): avisa, não altera
const defeituoso = lerLaudoUfv([pagina.map((l) => (l.startsWith('1001 1,00') ? '1001 1,00 0,00 4,0 9,99 4,21 8,21 51,3 0,0 - 3,50 20,0' : l))])
assert.ok(defeituoso.amostras.find((a) => a.n_lab === '1001').avisos.some((m) => m.includes('SB')), 'SB incoerente é avisado')
assert.equal(defeituoso.amostras.find((a) => a.n_lab === '1001').parametros.sb, 9.99, 'o valor lido não é "corrigido"')

// Linha com número de colunas errado não é adivinhada
const curta = lerLaudoUfv([pagina.map((l) => (l.startsWith('1002 0,80') ? '1002 0,80 0,10 3,0 2,90 3,00 5,90 49,2 3,3 0,2 2,00' : l))])
const a2c = curta.amostras.find((a) => a.n_lab === '1002')
assert.equal(a2c.parametros.mg, null, 'linha da tabela 2 incompleta fica em branco')
assert.ok(a2c.avisos.some((m) => m.includes('tabela(s) 2') || m.includes('tabela 2')))

// Safra a partir da data de entrada: a safra vira em setembro
assert.equal(anoSafraDaData('2026-06-26'), '25-26')
assert.equal(anoSafraDaData('2026-10-15'), '26-27')
assert.equal(anoSafraDaData('2026-09-01'), '26-27')
assert.equal(anoSafraDaData('2026-08-31'), '25-26')
assert.equal(anoSafraDaData(null), '')

// --- Ligação com as glebas da fazenda ---
const glebas = [
  { id: 'g7', talhao_id: 't1', codigo: '1-7', geometria: pontoFeature(-9, -49) },
  { id: 'g8a', talhao_id: 't1', codigo: '1-8', geometria: pontoFeature(-9.5, -49.5) },
  { id: 'g8b', talhao_id: 't2', codigo: '2-8', geometria: pontoFeature(-8.5, -48.5) },
]
const ponto = (id, gleba, lat, lng) => ({ id, gleba_id: gleba, geometria: pontoFeature(lat, lng) })
const pontos = [
  ponto('p1', 'g7', -9.0, -49.0),
  ponto('p2', 'g7', -9.2, -49.2), // média -9.1, -49.1
  ponto('p3', 'g8a', -9.5, -49.5),
  ponto('p4', 'g8a', -9.6, -49.6),
  ponto('p5', 'g8a', -9.7, -49.7), // 3 pontos
  ponto('p6', 'g8b', -8.5, -48.5), // 1 ponto
]
const contexto = { glebas, pontos, anoSafra: '26-27', existentes: new Set() }

const r1 = resolverAmostraDoLaudo(a1, null, contexto)
assert.equal(r1.status, STATUS.PRONTA)
assert.equal(r1.gleba.id, 'g7')
assert.equal(r1.talhaoId, 't1')
const [lng1, lat1] = r1.geometria.geometry.coordinates
assert.ok(Math.abs(lat1 - -9.1) < 1e-9 && Math.abs(lng1 - -49.1) < 1e-9, 'posição = média dos pontos da gleba')

const a3 = laudo.amostras.find((a) => a.n_lab === '1003') // gleba 8: existe em 2 talhões
const r3 = resolverAmostraDoLaudo(a3, null, contexto)
assert.equal(r3.status, STATUS.PRONTA)
assert.equal(r3.gleba.id, 'g8a', 'vale a gleba com mais pontos')
assert.ok(r3.motivo?.includes('mais pontos'), 'a escolha pela maioria é explicada')

const empate = resolverAmostraDoLaudo(a3, null, { ...contexto, pontos: pontos.filter((p) => p.id !== 'p4' && p.id !== 'p5') })
assert.equal(empate.status, STATUS.AMBIGUA, 'empate não se decide sozinho')
const escolhida = resolverAmostraDoLaudo(a3, { glebaId: 'g8b' }, { ...contexto, pontos: [] })
assert.equal(escolhida.status, STATUS.PRONTA, 'a pessoa escolhendo resolve; sem pontos usa o desenho da gleba')
assert.equal(escolhida.talhaoId, 't2')

assert.equal(resolverAmostraDoLaudo({ ...a1, gleba: 99 }, null, contexto).status, STATUS.SEM_GLEBA)
assert.equal(resolverAmostraDoLaudo({ ...a1, profundidade: null }, null, contexto).status, STATUS.SEM_PROFUNDIDADE)
assert.equal(resolverAmostraDoLaudo({ ...a1, profundidade: null }, { profundidade: '20-40' }, contexto).status, STATUS.PRONTA)

// Já gravada = duplicada
const existentes = new Set([chaveDeDuplicidade({ talhaoId: 't1', anoSafra: '26-27', profundidade: '0-20', numeroAmostraLab: '1001' })])
assert.equal(resolverAmostraDoLaudo(a1, null, { ...contexto, existentes }).status, STATUS.DUPLICADA)
assert.equal(resolverAmostraDoLaudo(a2, null, { ...contexto, existentes }).status, STATUS.PRONTA, 'outra profundidade não é duplicada')

// Payload gravável
const payload = payloadDaAmostra(r1, { anoSafra: '26-27', laboratorio: laudo.laboratorio, solicitacao: laudo.solicitacao })
assert.equal(payload.talhao_id, 't1')
assert.equal(payload.origem, 'pdf')
assert.equal(payload.ano_safra, '26-27')
assert.equal(payload.numero_amostra_lab, '1001')
assert.equal(payload.laboratorio, 'UFV - Departamento de Solos')
assert.equal(payload.data_coleta, null)
assert.equal(payload.observacoes, 'Laudo UFV 301/2026 - Gleba 7 0-20')
assert.equal(payload.al, 0)
assert.equal(payload.argila, null, 'parâmetro que o laudo não traz é null explícito, nunca 0')
assert.equal('gleba_id' in payload, false)
console.log('laudo UFV: leitura, ligação com glebas e payload OK')
