import { inflateSync } from 'node:zlib'

/**
 * Lê um RECORTE de um GeoTIFF de 8 bits, sem baixar o arquivo inteiro.
 *
 * Feito para as bandas do CBERS-4A MUX que o INPE serve: TIFF clássico, 8 bits,
 * compressão Deflate, UMA LINHA POR BLOCO (cada linha comprimida à parte) e a
 * tabela de metadados no FIM do arquivo (não é COG). Isso permite pedir só as
 * linhas do talhão por Range: ~1 MB em vez dos ~25 MB da banda.
 *
 * `buscar(inicio, fim)` devolve `{ bytes: Uint8Array, total }` com o intervalo
 * pedido (inclusive nas duas pontas). Quem chama decide como (fetch com Range,
 * arquivo local nos testes); este módulo não conhece rede.
 *
 * Só aceita o que sabe ler. Qualquer outra coisa (TIFF por ladrilhos, outra
 * compressão, 16 bits, predictor) lança erro claro, em vez de devolver lixo
 * que viraria um índice errado na tela.
 */

const TAMANHO_DO_TIPO = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 }
const LIMITE_BYTES_DO_RECORTE = 24 * 1024 * 1024 // acima disso o recorte não é "um talhão"

const erro = (mensagem) => Object.assign(new Error(mensagem), { status: 502 })

function ler(dv, tipo, posicao) {
  switch (tipo) {
    case 3: return dv.getUint16(posicao, true)
    case 4: return dv.getUint32(posicao, true)
    case 12: return dv.getFloat64(posicao, true)
    default: throw erro(`Tipo de campo ${tipo} não suportado no TIFF.`)
  }
}

const visao = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

export async function abrirTiff(buscar) {
  const cabecalho = await buscar(0, 7)
  const dc = visao(cabecalho.bytes)
  const total = cabecalho.total
  if (dc.getUint16(0, true) !== 0x4949 || dc.getUint16(2, true) !== 42) {
    throw erro('O arquivo da banda não é um TIFF clássico (esperava formato little-endian).')
  }
  if (!Number.isFinite(total)) throw erro('Não consegui saber o tamanho do arquivo da banda.')

  const inicioDaTabela = dc.getUint32(4, true)
  // 60 campos cobrem folgado uma banda (as do INPE têm ~15).
  const blocoDaTabela = await buscar(inicioDaTabela, Math.min(total - 1, inicioDaTabela + 2 + 60 * 12 + 3))
  const dt = visao(blocoDaTabela.bytes)
  const quantidade = dt.getUint16(0, true)

  const campos = new Map()
  for (let i = 0; i < quantidade; i++) {
    const base = 2 + i * 12
    const tag = dt.getUint16(base, true)
    const tipo = dt.getUint16(base + 2, true)
    const contagem = dt.getUint32(base + 4, true)
    const tamanho = (TAMANHO_DO_TIPO[tipo] ?? 1) * contagem
    campos.set(tag, {
      tipo,
      contagem,
      // até 4 bytes o valor mora no próprio campo; senão, o campo guarda onde está
      inline: tamanho <= 4 ? base + 8 : null,
      posicao: tamanho <= 4 ? null : dt.getUint32(base + 8, true),
    })
  }

  const simples = (tag, padrao) => {
    const c = campos.get(tag)
    if (!c) return padrao
    return ler(dt, c.tipo, c.inline)
  }

  if (campos.has(322) || campos.has(324)) throw erro('Banda em ladrilhos: este leitor só entende TIFF por linhas.')
  const largura = simples(256)
  const altura = simples(257)
  const bits = simples(258, 1)
  const compressao = simples(259, 1)
  const amostras = simples(277, 1)
  const linhasPorBloco = simples(278, altura)
  const predictor = simples(317, 1)
  if (bits !== 8 || amostras !== 1) throw erro(`Banda com ${bits} bits e ${amostras} amostra(s): só 8 bits e 1 amostra são lidos.`)
  if (compressao !== 8 && compressao !== 32946) throw erro(`Compressão ${compressao} não suportada (esperava Deflate).`)
  if (predictor !== 1) throw erro('Banda com predictor: não suportado.')

  const deslocamentos = campos.get(273)
  const tamanhos = campos.get(279)
  if (!deslocamentos || !tamanhos) throw erro('TIFF sem a tabela de blocos.')

  // Georreferência: três campos pequenos, buscados juntos.
  const lerDoubles = async (campo, n) => {
    if (!campo) return null
    const r = await buscar(campo.posicao, campo.posicao + 8 * n - 1)
    const dv = visao(r.bytes)
    return Array.from({ length: n }, (_, i) => dv.getFloat64(i * 8, true))
  }
  const [escala, amarracao, chaves] = await Promise.all([
    lerDoubles(campos.get(33550), 3),
    lerDoubles(campos.get(33922), 6),
    (async () => {
      const c = campos.get(34735)
      if (!c) return null
      const r = await buscar(c.posicao, c.posicao + 2 * c.contagem - 1)
      const dv = visao(r.bytes)
      return Array.from({ length: c.contagem }, (_, i) => dv.getUint16(i * 2, true))
    })(),
  ])
  if (!escala || !amarracao) throw erro('Banda sem georreferência (escala e ponto de amarração).')

  let epsg = null
  if (chaves) {
    for (let i = 0; i < chaves[3]; i++) {
      if (chaves[4 + i * 4] === 3072) epsg = chaves[7 + i * 4]
    }
  }

  const georef = {
    epsg,
    tamanhoX: escala[0],
    tamanhoY: escala[1],
    origemLeste: amarracao[3] - amarracao[0] * escala[0],
    origemNorte: amarracao[4] + amarracao[1] * escala[1],
  }

  const tamanhoOffsets = TAMANHO_DO_TIPO[deslocamentos.tipo]
  const tamanhoContagens = TAMANHO_DO_TIPO[tamanhos.tipo]

  /**
   * Os pixels das colunas [c0, c1) e linhas [l0, l1). Devolve Uint8Array de
   * (c1-c0)*(l1-l0), linha a linha. As coordenadas têm de estar dentro da imagem.
   */
  async function lerJanela(c0, l0, c1, l1) {
    if (c0 < 0 || l0 < 0 || c1 > largura || l1 > altura || c1 <= c0 || l1 <= l0) {
      throw erro('Janela fora da imagem da banda.')
    }
    const b0 = Math.floor(l0 / linhasPorBloco)
    const b1 = Math.floor((l1 - 1) / linhasPorBloco)
    const nBlocos = b1 - b0 + 1

    const [rOff, rCnt] = await Promise.all([
      buscar(deslocamentos.posicao + b0 * tamanhoOffsets, deslocamentos.posicao + (b1 + 1) * tamanhoOffsets - 1),
      buscar(tamanhos.posicao + b0 * tamanhoContagens, tamanhos.posicao + (b1 + 1) * tamanhoContagens - 1),
    ])
    const dOff = visao(rOff.bytes)
    const dCnt = visao(rCnt.bytes)
    const offs = Array.from({ length: nBlocos }, (_, i) => ler(dOff, deslocamentos.tipo, i * tamanhoOffsets))
    const cnts = Array.from({ length: nBlocos }, (_, i) => ler(dCnt, tamanhos.tipo, i * tamanhoContagens))

    const de = Math.min(...offs)
    const ate = Math.max(...offs.map((o, i) => o + cnts[i])) - 1
    if (ate - de + 1 > LIMITE_BYTES_DO_RECORTE) throw erro('O recorte pedido é grande demais para um talhão.')
    const dados = (await buscar(de, ate)).bytes

    const larguraJanela = c1 - c0
    const saida = new Uint8Array(larguraJanela * (l1 - l0))
    for (let k = 0; k < nBlocos; k++) {
      const comprimido = dados.subarray(offs[k] - de, offs[k] - de + cnts[k])
      const bloco = inflateSync(comprimido)
      const primeiraLinhaDoBloco = (b0 + k) * linhasPorBloco
      for (let linha = Math.max(l0, primeiraLinhaDoBloco); linha < Math.min(l1, primeiraLinhaDoBloco + linhasPorBloco); linha++) {
        const origem = (linha - primeiraLinhaDoBloco) * largura + c0
        saida.set(bloco.subarray(origem, origem + larguraJanela), (linha - l0) * larguraJanela)
      }
    }
    return saida
  }

  return { largura, altura, georef, lerJanela }
}
