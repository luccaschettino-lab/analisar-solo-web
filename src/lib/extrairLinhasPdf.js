/**
 * Texto de um PDF em linhas, página por página, lido no próprio navegador: o
 * laudo não sai da máquina de quem o escolheu.
 *
 * O PDF.js entrega pedaços de texto soltos, cada um com a sua posição. Aqui
 * eles viram linhas: pedaços na mesma altura (y) são uma linha, e dentro dela
 * seguem da esquerda para a direita. Duas colunas de uma tabela ficam como
 * palavras separadas por espaço; pedaços colados (sem vão entre eles) se juntam.
 *
 * A biblioteca é grande, então só é carregada quando alguém escolhe um PDF.
 * `pdfjs` pode ser injetado — é como os testes rodam no Node.
 */

const LIMITE_PAGINAS = 60

// Dois pedaços estão na mesma linha se a diferença de altura é menor que isto
// (em pontos do PDF). Um corpo de texto tem ~8–12 pt; entre linhas de uma
// tabela há bem mais que 3 pt.
const TOLERANCIA_Y = 3

let biblioteca = null

async function carregarPdfjs() {
  if (biblioteca) return biblioteca
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
  // `?worker` faz o Vite empacotar o worker como um .js comum do próprio site —
  // um arquivo .mjs solto poderia ser servido com o tipo errado e o navegador
  // se recusaria a executá-lo. Um worker só, reaproveitado entre os PDFs.
  const { default: PdfWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')
  pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
  biblioteca = pdfjs
  return pdfjs
}

function linhasDaPagina(itens) {
  const textos = itens
    .filter((i) => typeof i.str === 'string' && i.str.trim() !== '')
    .map((i) => ({ texto: i.str, x: i.transform[4], y: i.transform[5], largura: i.width ?? 0, altura: i.height ?? 0 }))
    // De cima para baixo; o y do PDF cresce para cima.
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const linhas = []
  for (const t of textos) {
    const atual = linhas.at(-1)
    if (atual && Math.abs(atual.y - t.y) <= TOLERANCIA_Y) atual.pedacos.push(t)
    else linhas.push({ y: t.y, pedacos: [t] })
  }

  return linhas.map(({ pedacos }) => {
    pedacos.sort((a, b) => a.x - b.x)
    let texto = ''
    let fimAnterior = null
    for (const p of pedacos) {
      if (fimAnterior === null) texto = p.texto
      else {
        // Vão menor que ~15% da altura da letra = o mesmo trecho cortado ao meio.
        const vao = p.x - fimAnterior
        texto += vao < p.altura * 0.15 ? p.texto : ` ${p.texto}`
      }
      fimAnterior = p.x + p.largura
    }
    return texto.trim()
  })
}

/**
 * @param {ArrayBuffer} buffer conteúdo do PDF
 * @returns {Promise<string[][]>} linhas de cada página
 */
export async function extrairLinhasPdf(buffer, { pdfjs } = {}) {
  const lib = pdfjs ?? (await carregarPdfjs())
  const tarefa = lib.getDocument({
    // Cópia: com um worker de verdade o PDF.js toma posse do buffer (ele fica
    // inutilizável para quem chamou), e ler o mesmo arquivo duas vezes falharia.
    data: new Uint8Array(buffer.slice(0)),
    // Sem eval: a política de segurança do site não permite, e extrair texto não precisa.
    isEvalSupported: false,
  })
  const doc = await tarefa.promise

  try {
    if (doc.numPages > LIMITE_PAGINAS) {
      throw new Error(`O PDF tem ${doc.numPages} páginas; o limite é ${LIMITE_PAGINAS}. Isso não parece um laudo.`)
    }
    const paginas = []
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n)
      const conteudo = await pagina.getTextContent()
      paginas.push(linhasDaPagina(conteudo.items))
    }
    return paginas
  } finally {
    // Libera o documento e o worker, mesmo se a leitura falhou no meio.
    await tarefa.destroy()
  }
}
