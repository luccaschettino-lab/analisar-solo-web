import { PARAMETROS, NIVEIS } from '../../config/parametros.js'
import { interpretar, INDICES_SATELITE } from './montagem.js'

/**
 * Planilha da exportação (ExcelJS), com cara de relatório: logo do Moinho na
 * capa, cabeçalhos na cor da marca, primeira linha e colunas de identificação
 * fixas, filtro em todas as colunas, números com as casas certas e cada
 * valor de análise pintado pelo nível do critério da fazenda (as mesmas cores
 * do mapa, em tom claro para o número continuar legível).
 *
 * `ExcelJS` e `logo` (bytes do JPEG) vêm de fora: a biblioteca é carregada só
 * quando alguém exporta, e os testes rodam sem a logo.
 */

const AZUL = 'FF12456A' // solo-800
const AZUL_CLARO = 'FFEEF6FC' // solo-50
const CINZA_LINHA = 'FFF8FAFC'
const BORDA = { style: 'thin', color: { argb: 'FFE2E8F0' } }

// Tons claros por nível (fundo) + a cor forte para o texto.
const TOM = {
  '#b91c1c': { fundo: 'FFFEE2E2', texto: 'FF991B1B' },
  '#ea580c': { fundo: 'FFFFEDD5', texto: 'FF9A3412' },
  '#15803d': { fundo: 'FFDCFCE7', texto: 'FF166534' },
}

const formatoCasas = (casas) => (casas > 0 ? `0.${'0'.repeat(casas)}` : '0')
const rotuloParam = (p) => (p.unidade ? `${p.rotulo} (${p.unidade})` : p.rotulo)
const dataBr = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '')

function cabecalho(aba, colunas, { congelarColunas = 0 } = {}) {
  aba.columns = colunas.map((c) => ({ header: c.titulo, key: c.chave, width: c.largura ?? 14 }))
  const linha = aba.getRow(1)
  linha.height = 34
  linha.eachCell((celula) => {
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' }
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    celula.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    celula.border = { bottom: { style: 'medium', color: { argb: 'FF0C2F49' } } }
  })
  aba.views = [{ state: 'frozen', xSplit: congelarColunas, ySplit: 1 }]
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } }
  colunas.forEach((c, i) => {
    if (c.formato) aba.getColumn(i + 1).numFmt = c.formato
  })
}

function zebra(aba) {
  aba.eachRow((linha, n) => {
    if (n === 1) return
    linha.eachCell({ includeEmpty: true }, (celula) => {
      celula.border = { bottom: BORDA }
      if (!celula.fill || celula.fill.pattern !== 'solid') {
        if (n % 2 === 0) celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_LINHA } }
      }
      celula.font = { ...(celula.font ?? {}), size: 10, name: 'Calibri' }
      if (!celula.alignment) celula.alignment = { vertical: 'middle' }
    })
  })
}

function pintarPeloNivel(celula, chave, valor, parametrosDoCriterio) {
  const nivel = valor == null ? null : interpretar(chave, valor, parametrosDoCriterio)
  const tom = nivel?.cor ? TOM[nivel.cor] : null
  if (!tom) return
  celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tom.fundo } }
  celula.font = { color: { argb: tom.texto }, bold: nivel.nivel !== 'medio', size: 10, name: 'Calibri' }
  celula.note = undefined
}

const colunasParametros = () =>
  PARAMETROS.map((p) => ({ titulo: rotuloParam(p), chave: p.chave, largura: Math.max(9, Math.min(16, rotuloParam(p).length + 2)), formato: formatoCasas(p.casas) }))

export async function gerarPlanilha(dados, { ExcelJS, logo, partes, parametrosDoCriterio, criterio, comparar }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Moinho'
  wb.created = new Date()
  const { fazenda, totais } = dados

  // ---------------- Resumo (capa) ----------------
  const capa = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: AZUL } }, views: [{ showGridLines: false }] })
  capa.columns = [{ width: 3 }, { width: 30 }, { width: 46 }, { width: 3 }]
  let linha = 2
  if (logo) {
    const id = wb.addImage({ buffer: logo, extension: 'jpeg' })
    capa.addImage(id, { tl: { col: 1, row: 1 }, ext: { width: 230, height: 92 } })
    linha = 8
  }
  const titulo = capa.getCell(`B${linha}`)
  titulo.value = 'Relatório de exportação'
  titulo.font = { size: 20, bold: true, color: { argb: AZUL }, name: 'Calibri' }
  capa.getCell(`B${linha + 1}`).value = `Fazenda ${fazenda.nome}`
  capa.getCell(`B${linha + 1}`).font = { size: 14, color: { argb: 'FF475569' }, name: 'Calibri' }
  linha += 3
  if (fazenda.exemplo) {
    const aviso = capa.getCell(`B${linha}`)
    capa.mergeCells(`B${linha}:C${linha}`)
    aviso.value = 'Fazenda de exemplo: dados fictícios, só para conhecer o sistema.'
    aviso.font = { bold: true, color: { argb: 'FF92400E' }, name: 'Calibri' }
    aviso.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    linha += 2
  }
  const info = [
    ['Município / UF', [fazenda.municipio, fazenda.uf].filter(Boolean).join(' / ') || '—'],
    ['Sede (lat, long)', fazenda.sede_lat != null ? `${Number(fazenda.sede_lat).toFixed(6)}, ${Number(fazenda.sede_lng).toFixed(6)}` : '—'],
    ['Critério de interpretação', criterio ? `${criterio.nome}${criterio.autor_nome ? ` — ${criterio.autor_nome}` : ''}` : 'Nenhum (análises sem classificação)'],
    ['Exportado em', new Date().toLocaleString('pt-BR')],
    ['Talhões', totais.talhoes],
    ['Glebas', totais.glebas],
    ['Análises', totais.analises],
    ['Pontos de amostra', totais.pontos],
    ['Imagens de satélite (resumos)', totais.imagensSatelite],
    ['Fotos do perfil do solo', totais.fotos],
  ]
  for (const [rotulo, valor] of info) {
    const a = capa.getCell(`B${linha}`)
    const b = capa.getCell(`C${linha}`)
    a.value = rotulo
    b.value = valor
    a.font = { bold: true, color: { argb: 'FF334155' }, name: 'Calibri' }
    a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
    for (const c of [a, b]) c.border = { bottom: BORDA }
    b.alignment = { horizontal: 'left' }
    linha++
  }
  linha += 1
  capa.getCell(`B${linha}`).value = 'Cores das análises'
  capa.getCell(`B${linha}`).font = { bold: true, size: 12, color: { argb: AZUL }, name: 'Calibri' }
  linha++
  for (const [cor, texto] of [
    ['#15803d', 'Ideal (médio)'],
    ['#ea580c', 'Baixo ou alto: afasta-se do ideal'],
    ['#b91c1c', 'Muito baixo ou muito alto'],
  ]) {
    const a = capa.getCell(`B${linha}`)
    a.value = texto
    a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOM[cor].fundo } }
    a.font = { color: { argb: TOM[cor].texto }, bold: true, name: 'Calibri' }
    linha++
  }
  capa.getCell(`B${linha}`).value = 'Sem cor: parâmetro sem classificação no critério, ou sem medição.'
  capa.getCell(`B${linha}`).font = { italic: true, color: { argb: 'FF64748B' }, name: 'Calibri' }
  linha += 2
  capa.getCell(`B${linha}`).value = 'Abas deste arquivo'
  capa.getCell(`B${linha}`).font = { bold: true, size: 12, color: { argb: AZUL }, name: 'Calibri' }
  const descricaoAbas = {
    glebas: ['Glebas', 'uma linha por gleba × safra × profundidade, com todos os parâmetros'],
    interpretacao: ['Interpretação', 'a mesma tabela, com o nível de cada valor escrito'],
    talhoes: ['Talhões', 'área, glebas, análises e safras de cada talhão'],
    analises: ['Análises', 'cada análise como foi lançada (laboratório, origem, posição)'],
    pontos: ['Pontos de amostra', 'cada coleta, com coordenadas'],
    satelite: ['Satélite', 'NDVI, EVI, SAVI e NDWI por talhão e data'],
    comparacao: ['Comparação de safras', comparar ? `${comparar.safraA} × ${comparar.safraB}, por gleba e parâmetro` : 'variação entre duas safras'],
    criterios: ['Critérios', 'as faixas de interpretação em vigor'],
  }
  linha++
  for (const [chave, [nome, texto]] of Object.entries(descricaoAbas)) {
    if (!partes.has(chave)) continue
    capa.getCell(`B${linha}`).value = nome
    capa.getCell(`B${linha}`).font = { bold: true, name: 'Calibri' }
    capa.getCell(`C${linha}`).value = texto
    capa.getCell(`C${linha}`).font = { color: { argb: 'FF475569' }, name: 'Calibri' }
    linha++
  }

  // ---------------- Glebas ----------------
  const colIdent = [
    { titulo: 'Talhão', chave: 'talhao', largura: 9 },
    { titulo: 'Gleba', chave: 'gleba', largura: 10 },
    { titulo: 'Nome', chave: 'nome', largura: 14 },
    { titulo: 'Área (ha)', chave: 'areaHa', largura: 10, formato: '0.00' },
    { titulo: 'Pontos de coleta', chave: 'pontos', largura: 10 },
    { titulo: 'Latitude (centro)', chave: 'lat', largura: 13, formato: '0.000000' },
    { titulo: 'Longitude (centro)', chave: 'lng', largura: 13, formato: '0.000000' },
    { titulo: 'Safra', chave: 'safra', largura: 9 },
    { titulo: 'Profundidade (cm)', chave: 'profundidade', largura: 12 },
  ]
  if (partes.has('glebas')) {
    const aba = wb.addWorksheet('Glebas', { properties: { tabColor: { argb: 'FF15803D' } } })
    cabecalho(aba, [...colIdent, ...colunasParametros()], { congelarColunas: 2 })
    for (const l of dados.linhasGlebas) {
      const valores = Object.fromEntries(PARAMETROS.map((p) => [p.chave, l.analise?.[p.chave] != null ? Number(l.analise[p.chave]) : null]))
      const r = aba.addRow({ ...l, ...valores })
      PARAMETROS.forEach((p) => pintarPeloNivel(r.getCell(p.chave), p.chave, valores[p.chave], parametrosDoCriterio))
    }
    zebra(aba)
  }

  // ---------------- Interpretação ----------------
  if (partes.has('interpretacao')) {
    const aba = wb.addWorksheet('Interpretação', { properties: { tabColor: { argb: 'FFEA580C' } } })
    cabecalho(aba, [...colIdent.filter((c) => !['lat', 'lng', 'pontos', 'nome'].includes(c.chave)), ...PARAMETROS.map((p) => ({ titulo: p.rotulo, chave: p.chave, largura: 13 }))], { congelarColunas: 2 })
    for (const l of dados.linhasGlebas) {
      const textos = {}
      const niveis = {}
      for (const p of PARAMETROS) {
        const v = l.analise?.[p.chave]
        const n = v == null ? null : interpretar(p.chave, v, parametrosDoCriterio)
        textos[p.chave] = v == null ? '' : n ? n.rotulo : 'sem classificação'
        niveis[p.chave] = v == null ? null : Number(v)
      }
      const r = aba.addRow({ ...l, ...textos })
      PARAMETROS.forEach((p) => pintarPeloNivel(r.getCell(p.chave), p.chave, niveis[p.chave], parametrosDoCriterio))
    }
    zebra(aba)
  }

  // ---------------- Talhões ----------------
  if (partes.has('talhoes')) {
    const aba = wb.addWorksheet('Talhões')
    cabecalho(aba, [
      { titulo: 'Talhão', chave: 'talhao', largura: 9 },
      { titulo: 'Nome', chave: 'nome', largura: 18 },
      { titulo: 'Área (ha)', chave: 'areaHa', largura: 11, formato: '0.00' },
      { titulo: 'Glebas', chave: 'glebas', largura: 9 },
      { titulo: 'Análises', chave: 'analises', largura: 10 },
      { titulo: 'Safras com análise', chave: 'safras', largura: 22 },
    ], { congelarColunas: 1 })
    dados.linhasTalhoes.forEach((l) => aba.addRow(l))
    zebra(aba)
  }

  // ---------------- Análises ----------------
  if (partes.has('analises')) {
    const aba = wb.addWorksheet('Análises')
    cabecalho(aba, [
      { titulo: 'Talhão', chave: 'talhao', largura: 9 },
      { titulo: 'Gleba', chave: 'gleba', largura: 10 },
      { titulo: 'Safra', chave: 'safra', largura: 9 },
      { titulo: 'Profundidade (cm)', chave: 'profundidade', largura: 12 },
      { titulo: 'Data da coleta', chave: 'dataColeta', largura: 12 },
      { titulo: 'Laboratório', chave: 'laboratorio', largura: 24 },
      { titulo: 'Nº da amostra', chave: 'numero', largura: 11 },
      { titulo: 'Origem', chave: 'origem', largura: 11 },
      { titulo: 'Latitude', chave: 'lat', largura: 12, formato: '0.000000' },
      { titulo: 'Longitude', chave: 'lng', largura: 12, formato: '0.000000' },
      ...colunasParametros(),
      { titulo: 'Observações', chave: 'observacoes', largura: 30 },
    ], { congelarColunas: 2 })
    for (const l of dados.linhasAnalises) {
      const valores = Object.fromEntries(PARAMETROS.map((p) => [p.chave, l.analise[p.chave] != null ? Number(l.analise[p.chave]) : null]))
      const r = aba.addRow({ ...l, dataColeta: l.dataColeta ? dataBr(l.dataColeta) : '', ...valores })
      PARAMETROS.forEach((p) => pintarPeloNivel(r.getCell(p.chave), p.chave, valores[p.chave], parametrosDoCriterio))
    }
    zebra(aba)
  }

  // ---------------- Pontos ----------------
  if (partes.has('pontos')) {
    const aba = wb.addWorksheet('Pontos de amostra')
    cabecalho(aba, [
      { titulo: 'Talhão', chave: 'talhao', largura: 9 },
      { titulo: 'Gleba', chave: 'gleba', largura: 10 },
      { titulo: 'Amostra', chave: 'amostra', largura: 10 },
      { titulo: 'Latitude', chave: 'lat', largura: 13, formato: '0.000000' },
      { titulo: 'Longitude', chave: 'lng', largura: 13, formato: '0.000000' },
    ], { congelarColunas: 1 })
    dados.linhasPontos.forEach((l) => aba.addRow(l))
    zebra(aba)
  }

  // ---------------- Satélite ----------------
  if (partes.has('satelite')) {
    const aba = wb.addWorksheet('Satélite', { properties: { tabColor: { argb: 'FF1F72AB' } } })
    const cols = [
      { titulo: 'Talhão', chave: 'talhao', largura: 9 },
      { titulo: 'Data', chave: 'data', largura: 12 },
      { titulo: 'Satélite', chave: 'satelite', largura: 12 },
      { titulo: '% do talhão sem nuvem', chave: 'limpoPct', largura: 12, formato: '0' },
    ]
    for (const ind of INDICES_SATELITE) {
      const N = ind.toUpperCase()
      cols.push({ titulo: `${N} médio`, chave: `${ind}_media`, largura: 10, formato: '0.000' })
      cols.push({ titulo: `${N} mínimo`, chave: `${ind}_min`, largura: 10, formato: '0.000' })
      cols.push({ titulo: `${N} máximo`, chave: `${ind}_max`, largura: 10, formato: '0.000' })
    }
    cabecalho(aba, cols, { congelarColunas: 2 })
    for (const l of dados.linhasSatelite) {
      const v = {}
      for (const ind of INDICES_SATELITE) {
        const e = l.estatisticas?.[ind]
        v[`${ind}_media`] = e?.media ?? null
        v[`${ind}_min`] = e?.minimo ?? null
        v[`${ind}_max`] = e?.maximo ?? null
      }
      aba.addRow({ ...l, data: dataBr(l.data), ...v })
    }
    zebra(aba)
  }

  // ---------------- Comparação ----------------
  if (partes.has('comparacao') && comparar) {
    const aba = wb.addWorksheet('Comparação de safras')
    cabecalho(aba, [
      { titulo: 'Talhão', chave: 'talhao', largura: 9 },
      { titulo: 'Gleba', chave: 'gleba', largura: 10 },
      { titulo: 'Profundidade (cm)', chave: 'profundidade', largura: 12 },
      { titulo: 'Parâmetro', chave: 'nomeParametro', largura: 26 },
      { titulo: `Safra ${comparar.safraA}`, chave: 'a', largura: 12, formato: '0.00' },
      { titulo: `Safra ${comparar.safraB}`, chave: 'b', largura: 12, formato: '0.00' },
      { titulo: 'Variação', chave: 'variacao', largura: 11, formato: '+0.00;-0.00;0.00' },
      { titulo: 'Variação (%)', chave: 'variacaoPct', largura: 11, formato: '+0.0;-0.0;0.0' },
    ], { congelarColunas: 2 })
    for (const l of dados.linhasComparacao) {
      const r = aba.addRow({ ...l, nomeParametro: rotuloParam(l.parametro) })
      pintarPeloNivel(r.getCell('a'), l.parametro.chave, l.a, parametrosDoCriterio)
      pintarPeloNivel(r.getCell('b'), l.parametro.chave, l.b, parametrosDoCriterio)
    }
    zebra(aba)
  }

  // ---------------- Critérios ----------------
  if (partes.has('criterios')) {
    const aba = wb.addWorksheet('Critérios')
    cabecalho(aba, [
      { titulo: 'Parâmetro', chave: 'nome', largura: 28 },
      { titulo: 'Unidade', chave: 'unidade', largura: 12 },
      ...[1, 2, 3, 4, 5].map((i) => ({ titulo: `Faixa ${i}`, chave: `f${i}`, largura: 22 })),
    ], { congelarColunas: 1 })
    for (const { parametro, faixas } of dados.linhasCriterios) {
      const linhaDados = { nome: parametro.rotulo, unidade: parametro.unidade || '—' }
      let anterior = null
      ;(faixas ?? []).forEach((f, i) => {
        const nome = f.rotulo ?? NIVEIS[f.nivel]?.rotulo ?? f.nivel
        const intervalo = f.ate === null ? `acima de ${anterior}` : anterior === null ? `até ${f.ate}` : `${anterior} a ${f.ate}`
        linhaDados[`f${i + 1}`] = `${nome}: ${intervalo}`
        anterior = f.ate
      })
      if (!faixas) linhaDados.f1 = 'sem classificação'
      const r = aba.addRow(linhaDados)
      ;(faixas ?? []).forEach((f, i) => {
        const tom = TOM[NIVEIS[f.nivel]?.cor]
        if (tom) {
          const c = r.getCell(`f${i + 1}`)
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tom.fundo } }
          c.font = { color: { argb: tom.texto }, size: 10, name: 'Calibri' }
        }
      })
    }
    zebra(aba)
  }

  return wb
}
