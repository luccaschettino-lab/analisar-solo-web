import { CHAVES_PARAMETROS } from '../config/parametros.js'

/**
 * Leitura do laudo de análise de solo da UFV (Departamento de Solos).
 *
 * Recebe o texto do PDF já separado em linhas, uma lista por página, e devolve
 * as amostras. Puro e sem PDF de propósito: a extração do texto fica em
 * `extrairLinhasPdf.js`, e aqui moram as regras que não podem errar.
 *
 * O laudo traz três tabelas por página, todas com o mesmo "Nº Lab" na primeira
 * coluna. Cada amostra é uma linha em cada uma, e as três se juntam por esse
 * número:
 *
 *   1. Nº Lab, I.U., Referência do Cliente, pH H2O, pH KCl, pH CaCl2, P, K, Na, Ca2+
 *   2. Nº Lab, Mg2+, Al3+, H+Al, SB, t, T, V, m, ISNa, MO, P-Rem
 *   3. Nº Lab, S, B, N, Cu, Mn, Fe, Zn, Cr, Ni, Cd, Pb
 *
 * Regras do contrato (README desta pasta de importação):
 *   - Valor ausente ("-") é `null`, nunca 0. Zero é um resultado medido.
 *   - Linha que não tem o número de colunas esperado NÃO é adivinhada: vira
 *     aviso e o valor fica nulo. Um laudo mal lido que entra sozinho corrompe a
 *     série histórica.
 *   - Nada é inventado por média ou interpolação.
 */

// Colunas numéricas de cada tabela, na ordem em que aparecem no laudo.
const T1_NUMERICAS = ['ph_h2o', 'ph_kcl', 'ph_cacl2', 'p', 'k', 'na', 'ca']
const T2 = ['mg', 'al', 'h_al', 'sb', 't_efetiva', 't_potencial', 'v', 'm', 'isna', 'mo', 'p_rem']
const T3 = ['s', 'b', 'n', 'cu', 'mn', 'fe', 'zn', 'cr', 'ni', 'cd', 'pb']

const COLUNAS_DO_APP = new Set(CHAVES_PARAMETROS)

export const PROFUNDIDADES_CONHECIDAS = ['0-20', '20-40', '40-60']

/** O texto parece ser um laudo da UFV? */
export function ehLaudoUfv(linhas) {
  return linhas.some((l) => /Universidade Federal de Vi[çc]osa/i.test(l))
}

/** "6,37" → 6.37; "-" → null; ilegível → undefined (quem chama avisa). */
function numero(token) {
  if (token === '-' || token === '') return null
  if (!/^-?\d+([.,]\d+)?$/.test(token)) return undefined
  return Number(token.replace(',', '.'))
}

function tipoDaTabela(cabecalho) {
  const texto = cabecalho.join(' ')
  if (/Refer[êe]ncia/i.test(texto)) return 1
  if (/Mg2\+?/i.test(texto) && /Al3\+?/i.test(texto)) return 2
  if (/\bCu\b/.test(texto) && /\bZn\b/.test(texto)) return 3
  return null
}

const ehLinhaDeAmostra = (tokens) => /^\d{3,6}$/.test(tokens[0] ?? '') && tokens.length >= 10

function dataIso(texto) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(texto ?? '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function cabecalhoDoLaudo(linhas) {
  const texto = linhas.join('\n')
  const solicitacao = /Solicita[çc][ãa]o\s*N[º°o]\s*:?\s*(\d+\/\d{4})/i.exec(texto)?.[1] ?? null
  const entrada = dataIso(/Entrada\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(texto)?.[1])
  const identificacao = /Identifica[çc][ãa]o\s*:?\s*([^\n]+)/i.exec(texto)?.[1]?.trim() ?? null
  return { solicitacao, entrada, identificacao }
}

/**
 * Ano-safra ("25-26") a partir de uma data ISO. A safra começa em setembro: de
 * setembro a dezembro é "AA-(AA+1)", de janeiro a agosto é "(AA-1)-AA". É um
 * palpite para pré-preencher — o laudo não diz a safra, e a tela deixa corrigir.
 */
export function anoSafraDaData(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? '')
  if (!m) return ''
  const ano = Number(m[1])
  const inicio = Number(m[2]) >= 9 ? ano : ano - 1
  const dois = (n) => String(n % 100).padStart(2, '0')
  return `${dois(inicio)}-${dois(inicio + 1)}`
}

function dividirReferencia(referencia) {
  const gleba = /Gleba\s*(\d+)/i.exec(referencia)?.[1]
  const profundidade = /\b(0-20|20-40|40-60)\b/.exec(referencia)?.[1] ?? null
  return { gleba: gleba ? Number(gleba) : null, profundidade }
}

/**
 * Soma de bases fecha com Ca + Mg + K/390 (+ Na/230)? É a conferência que acusa
 * coluna deslocada, que de outro jeito passaria batida. Só avisa, não altera.
 */
function avisosDeCoerencia(p, extras) {
  const avisos = []
  const { ca, mg, k, sb, t_efetiva: tEf, t_potencial: tPot, al, h_al: hAl } = p
  if ([ca, mg, k, sb].every((v) => v != null)) {
    const calculada = ca + mg + k / 390 + (extras.na ?? 0) / 230
    if (Math.abs(calculada - sb) > 0.1) {
      avisos.push(`SB do laudo (${sb}) não confere com Ca + Mg + K (≈ ${calculada.toFixed(2)}): confira as colunas.`)
    }
  }
  if ([sb, al, tEf].every((v) => v != null) && Math.abs(sb + al - tEf) > 0.1) {
    avisos.push(`t do laudo (${tEf}) não confere com SB + Al (≈ ${(sb + al).toFixed(2)}).`)
  }
  if ([sb, hAl, tPot].every((v) => v != null) && Math.abs(sb + hAl - tPot) > 0.1) {
    avisos.push(`T do laudo (${tPot}) não confere com SB + H+Al (≈ ${(sb + hAl).toFixed(2)}).`)
  }
  return avisos
}

/**
 * @param {string[][]} paginas  linhas de texto de cada página, na ordem de leitura
 * @returns {{ laboratorio, solicitacao, entrada, identificacao, amostras, avisos }}
 */
export function lerLaudoUfv(paginas) {
  const todas = paginas.flat()
  const cabecalho = cabecalhoDoLaudo(todas)
  const porNumero = new Map()
  const avisosGerais = []

  const amostra = (nLab) => {
    if (!porNumero.has(nLab)) {
      porNumero.set(nLab, { n_lab: nLab, referencia: '', valores: {}, tabelas: new Set(), avisos: [] })
    }
    return porNumero.get(nLab)
  }

  for (const linhas of paginas) {
    // Um bloco é um trecho seguido de linhas de amostra; o que vem entre dois
    // blocos é o cabeçalho do próximo. A linha com os nomes das colunas pode vir
    // antes ou depois de "Nº Lab" (depende de como o PDF empilha o cabeçalho),
    // então o tipo da tabela sai de TODAS as linhas de cabeçalho do bloco.
    let cabecalho = []
    let tipo = null
    let dentroDoBloco = false

    for (const linha of linhas) {
      const tokens = linha.trim().split(/\s+/).filter(Boolean)
      if (tokens.length === 0) continue

      if (!ehLinhaDeAmostra(tokens)) {
        if (dentroDoBloco) {
          dentroDoBloco = false
          cabecalho = []
          tipo = null
        }
        cabecalho.push(linha)
        if (cabecalho.length > 12) cabecalho.shift()
        continue
      }

      if (!dentroDoBloco) {
        dentroDoBloco = true
        tipo = tipoDaTabela(cabecalho)
      }
      if (tipo === null) continue // linha numérica fora de qualquer tabela conhecida

      const nLab = tokens[0]
      const a = amostra(nLab)
      let nomes
      let corpo

      if (tipo === 1) {
        // 2 colunas de identificação (Nº Lab, I.U.), a referência (texto livre,
        // com espaços) e 7 numéricas no fim.
        if (tokens.length < 2 + 1 + T1_NUMERICAS.length) {
          a.avisos.push(`Linha ${nLab} da tabela de pH/P/K veio incompleta e foi ignorada.`)
          continue
        }
        a.referencia = tokens.slice(2, tokens.length - T1_NUMERICAS.length).join(' ')
        nomes = T1_NUMERICAS
        corpo = tokens.slice(tokens.length - T1_NUMERICAS.length)
      } else {
        nomes = tipo === 2 ? T2 : T3
        corpo = tokens.slice(1)
        if (corpo.length !== nomes.length) {
          a.avisos.push(
            `Linha ${nLab} da tabela ${tipo} tem ${corpo.length} valores e eram esperados ${nomes.length}; não foi lida.`,
          )
          continue
        }
      }

      a.tabelas.add(tipo)
      nomes.forEach((nome, i) => {
        const v = numero(corpo[i])
        if (v === undefined) {
          a.avisos.push(`Valor "${corpo[i]}" de ${nome} não é um número; ficou em branco.`)
          a.valores[nome] = null
        } else {
          a.valores[nome] = v
        }
      })
    }
  }

  const amostras = [...porNumero.values()].map((a) => {
    const parametros = {}
    for (const chave of CHAVES_PARAMETROS) parametros[chave] = a.valores[chave] ?? null
    // Tudo que o laudo mede e o app não tem coluna própria vai para `extras`,
    // sem perder o dado — só os valores presentes.
    const extras = {}
    for (const [chave, valor] of Object.entries(a.valores)) {
      if (!COLUNAS_DO_APP.has(chave) && valor != null) extras[chave] = valor
    }
    const faltando = [1, 2, 3].filter((t) => !a.tabelas.has(t))
    const avisos = [...a.avisos]
    if (faltando.length > 0) avisos.push(`Não encontrei a(s) tabela(s) ${faltando.join(', ')} desta amostra: parâmetros dela ficaram em branco.`)
    avisos.push(...avisosDeCoerencia(parametros, extras))

    return {
      n_lab: a.n_lab,
      referencia: a.referencia,
      ...dividirReferencia(a.referencia),
      parametros,
      extras,
      avisos,
    }
  })

  if (amostras.length === 0) avisosGerais.push('Nenhuma amostra encontrada: este PDF não parece um laudo da UFV.')

  return {
    laboratorio: 'UFV - Departamento de Solos',
    ...cabecalho,
    amostras,
    avisos: avisosGerais,
  }
}
