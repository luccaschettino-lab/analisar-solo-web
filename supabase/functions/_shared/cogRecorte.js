import { inflateSync } from 'node:zlib'

/**
 * Lê um RECORTE de um Cloud Optimized GeoTIFF em LADRILHOS, sem baixar o
 * arquivo inteiro.
 *
 * Feito para as bandas do Sentinel-2 L2A no repositório público da AWS
 * (sentinel-cogs): TIFF clássico (não BigTIFF), ladrilhos de 1024 (bandas de
 * 10 m) ou 512 (SCL, 20 m), 16 ou 8 bits sem sinal, compressão Deflate e
 * predictor horizontal (2). Lê só os ladrilhos que o talhão toca: alguns MB em
 * vez dos ~200 MB da banda.
 *
 * `buscar(inicio, fim)` devolve `{ bytes: Uint8Array, total }`, como em
 * `tiffRecorte.js`. Só aceita o que sabe ler; o resto vira erro claro.
 */

const TAMANHO_DO_TIPO = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 }
const LIMITE_LADRILHOS = 16 // um talhão nunca precisa de mais que isso

const erro = (mensagem) => Object.assign(new Error(mensagem), { status: 502 })
const visao = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

function ler(dv, tipo, posicao) {
  switch (tipo) {
    case 3: return dv.getUint16(posicao, true)
    case 4: return dv.getUint32(posicao, true)
    case 12: return dv.getFloat64(posicao, true)
    default: throw erro(`Tipo de campo ${tipo} não suportado no TIFF.`)
  }
}

export async function abrirCog(buscar) {
  const cabecalho = await buscar(0, 16383) // o COG põe a tabela no começo
  const dc = visao(cabecalho.bytes)
  if (dc.getUint16(0, true) !== 0x4949 || dc.getUint16(2, true) !== 42) {
    throw erro('A banda não é um TIFF clássico little-endian.')
  }
  const total = cabecalho.total
  const inicioDaTabela = dc.getUint32(4, true)
  let tabela = cabecalho.bytes
  if (inicioDaTabela + 2 + 60 * 12 > tabela.length) {
    tabela = (await buscar(0, Math.min(total - 1, inicioDaTabela + 2 + 60 * 12 + 3))).bytes
  }
  const dt = visao(tabela)
  const quantidade = dt.getUint16(inicioDaTabela, true)

  const campos = new Map()
  for (let i = 0; i < quantidade; i++) {
    const base = inicioDaTabela + 2 + i * 12
    const tag = dt.getUint16(base, true)
    const tipo = dt.getUint16(base + 2, true)
    const contagem = dt.getUint32(base + 4, true)
    const tamanho = (TAMANHO_DO_TIPO[tipo] ?? 1) * contagem
    campos.set(tag, { tipo, contagem, inline: tamanho <= 4 ? base + 8 : null, posicao: tamanho <= 4 ? null : dt.getUint32(base + 8, true) })
  }
  const simples = (tag, padrao) => {
    const c = campos.get(tag)
    return c ? ler(dt, c.tipo, c.inline) : padrao
  }

  const largura = simples(256)
  const altura = simples(257)
  const bits = simples(258, 1)
  const compressao = simples(259, 1)
  const amostras = simples(277, 1)
  const predictor = simples(317, 1)
  const formato = simples(339, 1)
  const lt = simples(322)
  const at = simples(323)
  if (!lt || !at) throw erro('Banda sem ladrilhos: este leitor só entende COG em ladrilhos.')
  if ((bits !== 8 && bits !== 16) || amostras !== 1 || formato !== 1) throw erro(`Banda com ${bits} bits/${amostras} amostra(s): só 8 ou 16 bits sem sinal.`)
  if (compressao !== 8 && compressao !== 32946) throw erro(`Compressão ${compressao} não suportada (esperava Deflate).`)
  if (predictor !== 1 && predictor !== 2) throw erro(`Predictor ${predictor} não suportado.`)

  // Campos grandes (fora da tabela inline): lê do que já veio, ou pede.
  const bytesDe = async (campo) => {
    const n = (TAMANHO_DO_TIPO[campo.tipo] ?? 1) * campo.contagem
    if (campo.posicao + n <= tabela.length) return visao(tabela.subarray(campo.posicao, campo.posicao + n))
    return visao((await buscar(campo.posicao, campo.posicao + n - 1)).bytes)
  }
  const lista = async (tag) => {
    const c = campos.get(tag)
    if (!c) return null
    if (c.inline !== null) return [ler(dt, c.tipo, c.inline)]
    const dv = await bytesDe(c)
    const passo = TAMANHO_DO_TIPO[c.tipo]
    return Array.from({ length: c.contagem }, (_, i) => ler(dv, c.tipo, i * passo))
  }

  const [offsets, contagens, escala, amarracao, chaves] = await Promise.all([lista(324), lista(325), lista(33550), lista(33922), lista(34735)])
  if (!offsets || !contagens) throw erro('COG sem a tabela de ladrilhos.')
  if (!escala || !amarracao) throw erro('Banda sem georreferência.')
  let epsg = null
  if (chaves) for (let i = 0; i < chaves[3]; i++) if (chaves[4 + i * 4] === 3072) epsg = chaves[7 + i * 4]

  const georef = {
    epsg,
    tamanhoX: escala[0],
    tamanhoY: escala[1],
    origemLeste: amarracao[3] - amarracao[0] * escala[0],
    origemNorte: amarracao[4] + amarracao[1] * escala[1],
  }
  const ladrilhosPorLinha = Math.ceil(largura / lt)
  const Tipo = bits === 16 ? Uint16Array : Uint8Array

  function decodificar(comprimido) {
    let cru = inflateSync(comprimido)
    // Uint16Array exige início em byte par; um Buffer de pool pode não estar.
    if (bits === 16 && cru.byteOffset % 2 !== 0) cru = new Uint8Array(cru)
    const valores = bits === 16 ? new Uint16Array(cru.buffer, cru.byteOffset, cru.byteLength / 2) : new Uint8Array(cru.buffer, cru.byteOffset, cru.byteLength)
    if (valores.length < lt * at) throw erro('Ladrilho menor que o esperado.')
    if (predictor === 2) {
      // Diferença horizontal: cada valor guarda a diferença para o da esquerda.
      for (let l = 0; l < at; l++) {
        const base = l * lt
        for (let c = 1; c < lt; c++) valores[base + c] = valores[base + c] + valores[base + c - 1]
      }
    }
    return valores
  }

  /** Pixels das colunas [c0, c1) e linhas [l0, l1), linha a linha. */
  async function lerJanela(c0, l0, c1, l1) {
    if (c0 < 0 || l0 < 0 || c1 > largura || l1 > altura || c1 <= c0 || l1 <= l0) throw erro('Janela fora da imagem da banda.')
    const tc0 = Math.floor(c0 / lt)
    const tc1 = Math.floor((c1 - 1) / lt)
    const tl0 = Math.floor(l0 / at)
    const tl1 = Math.floor((l1 - 1) / at)
    if ((tc1 - tc0 + 1) * (tl1 - tl0 + 1) > LIMITE_LADRILHOS) throw erro('O recorte pedido é grande demais para um talhão.')

    const larguraJanela = c1 - c0
    const saida = new Tipo(larguraJanela * (l1 - l0))
    const tarefas = []
    for (let tl = tl0; tl <= tl1; tl++) {
      for (let tc = tc0; tc <= tc1; tc++) {
        tarefas.push(
          (async () => {
            const k = tl * ladrilhosPorLinha + tc
            if (!contagens[k]) return // ladrilho vazio = sem dado (fica zero)
            const { bytes } = await buscar(offsets[k], offsets[k] + contagens[k] - 1)
            const ladrilho = decodificar(bytes)
            const x0 = tc * lt
            const y0 = tl * at
            for (let l = Math.max(l0, y0); l < Math.min(l1, y0 + at); l++) {
              const de = Math.max(c0, x0)
              const ate = Math.min(c1, x0 + lt)
              saida.set(ladrilho.subarray((l - y0) * lt + (de - x0), (l - y0) * lt + (ate - x0)), (l - l0) * larguraJanela + (de - c0))
            }
          })(),
        )
      }
    }
    await Promise.all(tarefas)
    return saida
  }

  return { largura, altura, bits, georef, lerJanela }
}
