import { PARAMETROS } from '../config/parametros.js'

/**
 * Laudo PDF FICTÍCIO no formato da UFV, para o tutorial guiado ensinar a
 * importação de laudo. É lido pelo mesmo `lerLaudoUfv` dos laudos de verdade:
 * "Universidade Federal de Viçosa" no cabeçalho e as três tabelas ligadas pelo
 * Nº Lab, com "Gleba N 0-20" na referência do cliente.
 *
 * O PDF é escrito à mão (texto puro, fonte Helvetica padrão), sem biblioteca:
 * são poucas dezenas de linhas, e o leitor só precisa do texto e da posição.
 */

const CASAS = Object.fromEntries(PARAMETROS.map((p) => [p.chave, p.casas]))

function num(valor, chave, casas = CASAS[chave] ?? 2) {
  if (valor == null || !Number.isFinite(valor)) return '-'
  return valor.toFixed(casas).replace('.', ',')
}

// ---- Escrita do PDF ----

const latin1 = (texto) => texto.replace(/[^\x20-\xff]/g, '?')
const escapar = (texto) => latin1(texto).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

/**
 * `paginas`: [[{ x, y, texto, tamanho?, negrito? }]] em pontos (A4: 595×842,
 * y cresce para cima). Devolve os bytes do PDF.
 */
export function pdfDeTexto(paginas) {
  const objetos = []
  const novo = (corpo) => {
    objetos.push(corpo)
    return objetos.length
  }
  const catalogo = novo(null)
  const raiz = novo(null)
  const fonte = novo('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const negrito = novo('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')

  const filhos = []
  for (const itens of paginas) {
    const fluxo = itens
      .map((i) => `BT /${i.negrito ? 'F2' : 'F1'} ${i.tamanho ?? 8} Tf ${i.x.toFixed(1)} ${i.y.toFixed(1)} Td (${escapar(i.texto)}) Tj ET`)
      .join('\n')
    const conteudo = novo(`<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`)
    filhos.push(
      novo(
        `<< /Type /Page /Parent ${raiz} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fonte} 0 R /F2 ${negrito} 0 R >> >> /Contents ${conteudo} 0 R >>`,
      ),
    )
  }
  objetos[catalogo - 1] = `<< /Type /Catalog /Pages ${raiz} 0 R >>`
  objetos[raiz - 1] = `<< /Type /Pages /Kids [${filhos.map((f) => `${f} 0 R`).join(' ')}] /Count ${filhos.length} >>`

  let texto = '%PDF-1.4\n'
  const deslocamentos = []
  objetos.forEach((corpo, i) => {
    deslocamentos.push(texto.length)
    texto += `${i + 1} 0 obj\n${corpo}\nendobj\n`
  })
  const inicioXref = texto.length
  texto += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  texto += deslocamentos.map((d) => `${String(d).padStart(10, '0')} 00000 n \n`).join('')
  texto += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`

  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i) & 0xff
  return bytes
}

// ---- O laudo ----

const COLUNAS = {
  1: { cabecalho: ['Nº Lab', 'I.U.', 'Referência do Cliente', 'pH H2O', 'pH KCl', 'pH CaCl2', 'P', 'K', 'Na', 'Ca2+'], x: [40, 82, 112, 232, 276, 320, 364, 404, 444, 484] },
  2: { cabecalho: ['Nº Lab', 'Mg2+', 'Al3+', 'H+Al', 'SB', 't', 'T', 'V', 'm', 'ISNa', 'MO', 'P-Rem'], x: [40, 90, 130, 170, 210, 250, 290, 330, 370, 410, 450, 490] },
  3: { cabecalho: ['Nº Lab', 'S', 'B', 'N', 'Cu', 'Mn', 'Fe', 'Zn', 'Cr', 'Ni', 'Cd', 'Pb'], x: [40, 90, 130, 170, 210, 250, 290, 330, 370, 410, 450, 490] },
}

function celulas(tabela, a) {
  const v = a.valores
  if (tabela === 1) {
    const ph = v.ph_h2o
    return [
      a.nLab,
      String(a.iu),
      `Gleba ${a.gleba} ${a.profundidade}`,
      num(ph, 'ph_h2o', 2),
      num(ph != null ? ph - 0.85 : null, 'ph_h2o', 2),
      num(ph != null ? ph - 0.6 : null, 'ph_h2o', 2),
      num(v.p, 'p'),
      num(v.k, 'k'),
      '-',
      num(v.ca, 'ca'),
    ]
  }
  if (tabela === 2) {
    return [a.nLab, num(v.mg, 'mg'), num(v.al, 'al'), num(v.h_al, 'h_al'), num(v.sb, 'sb'), num(v.t_efetiva, 't_efetiva'), num(v.t_potencial, 't_potencial'), num(v.v, 'v'), num(v.m, 'm'), '-', num(v.mo, 'mo'), num(v.p_rem, 'p_rem')]
  }
  return [a.nLab, num(v.s, 's'), num(v.b, 'b'), '-', num(v.cu, 'cu'), num(v.mn, 'mn'), num(v.fe, 'fe'), num(v.zn, 'zn'), '-', '-', '-', '-']
}

/**
 * `amostras`: [{ gleba (número), profundidade, valores: { ph_h2o, p, k, … } }].
 * `entrada`: data de entrada no laboratório (dd/mm/aaaa) — a tela de importação
 * tira dela a safra sugerida.
 */
export function laudoExemploPdf({ amostras, entrada, identificacao }) {
  const numeradas = amostras.map((a, i) => ({ ...a, nLab: String(4001 + i), iu: 1 + i }))
  const POR_PAGINA = 16
  const paginas = []
  for (let inicio = 0; inicio < numeradas.length; inicio += POR_PAGINA) {
    const lote = numeradas.slice(inicio, inicio + POR_PAGINA)
    const itens = []
    let y = 800
    const linha = (x, texto, opcoes = {}) => itens.push({ x, y, texto, ...opcoes })
    linha(40, 'Universidade Federal de Viçosa', { tamanho: 11, negrito: true })
    y -= 14
    linha(40, 'Departamento de Solos - Laboratório de Análise de Solo  (LAUDO FICTÍCIO DO TUTORIAL)', { tamanho: 8 })
    y -= 14
    linha(40, 'Solicitação Nº: 999/2025', { tamanho: 8 })
    linha(250, `Entrada: ${entrada}`, { tamanho: 8 })
    y -= 12
    linha(40, `Identificação: ${identificacao}`, { tamanho: 8 })
    y -= 22

    for (const tabela of [1, 2, 3]) {
      const { cabecalho, x } = COLUNAS[tabela]
      cabecalho.forEach((titulo, i) => linha(x[i], titulo, { negrito: true }))
      y -= 13
      for (const a of lote) {
        celulas(tabela, a).forEach((valor, i) => linha(x[i], valor))
        y -= 11
      }
      y -= 14
    }
    paginas.push(itens)
  }
  return pdfDeTexto(paginas)
}
