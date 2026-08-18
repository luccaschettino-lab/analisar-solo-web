/**
 * Redução de foto no navegador, antes de subir.
 *
 * Uma foto de celular tem 4 a 12 MB. No 3G do campo — que é onde o produtor
 * está quando fotografa o solo — isso é a diferença entre o envio completar e
 * a pessoa desistir. Reduzida para 1600 px no maior lado e JPEG 0,8, a mesma
 * foto fica em 200-400 KB, sem perda visível para o que ela serve: mostrar cor,
 * textura e estrutura do solo.
 *
 * O cálculo das dimensões é separado do desenho no canvas de propósito: ele é
 * a parte com regra e é testável fora do navegador (`testes/imagem.mjs`). O
 * canvas depende de DOM e fica sem teste, como o resto de `src/mapa/`.
 */

/** Maior lado da imagem gravada. Acima disso não se ganha nada para este uso. */
export const MAX_LADO = 1600

/** Qualidade do JPEG. 0,8 é o ponto em que o artefato deixa de ser visível. */
export const QUALIDADE = 0.8

/**
 * Tamanho máximo do arquivo de entrada, antes mesmo de decodificar.
 *
 * Decodificar uma imagem de 60 MP num celular barato trava a aba. Recusar
 * antes é melhor que travar — e nenhuma câmera de celular produz isso por
 * acidente.
 */
export const MAX_ENTRADA_BYTES = 25 * 1024 * 1024

/**
 * Dimensões finais, preservando a proporção.
 *
 * **Nunca amplia.** Uma foto de 800 px que virasse 1600 px ocuparia quatro
 * vezes mais bytes sem um pixel a mais de informação — só borrão interpolado.
 * Imagem menor que o limite passa intacta.
 */
export function dimensoesAlvo(largura, altura, maxLado = MAX_LADO) {
  if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) {
    return null
  }

  const maior = Math.max(largura, altura)
  if (maior <= maxLado) return { largura: Math.round(largura), altura: Math.round(altura) }

  const fator = maxLado / maior
  return {
    // Math.max(1, ...) protege o caso degenerado de uma imagem muito alongada,
    // em que o lado menor arredondaria para zero e o canvas recusaria.
    largura: Math.max(1, Math.round(largura * fator)),
    altura: Math.max(1, Math.round(altura * fator)),
  }
}

/** Extensão sempre .jpg: a saída é sempre JPEG, qualquer que seja a entrada. */
export function nomeDoArquivo(uuid) {
  return `${uuid}.jpg`
}

/**
 * Decodifica respeitando a rotação gravada no EXIF.
 *
 * Foto de celular quase sempre vem com os pixels na orientação do sensor e um
 * campo EXIF dizendo como girar. O `<img>` da tela respeita esse campo, mas o
 * canvas desenha os pixels crus — sem isto, metade das fotos sobe deitada.
 *
 * `createImageBitmap` com `imageOrientation: 'from-image'` resolve nos
 * navegadores atuais. O caminho alternativo existe para os que não suportam a
 * opção: lá a foto pode subir girada, o que é ruim mas não impede o envio.
 */
async function decodificar(arquivo) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
    } catch {
      // Segue para o caminho alternativo.
    }
  }

  const url = URL.createObjectURL(arquivo)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Não foi possível ler esta imagem.'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Reduz e recomprime, devolvendo o blob a enviar.
 *
 * Devolve também os tamanhos, que a tela mostra: ver "4,2 MB → 310 KB" explica
 * a espera de uma forma que uma barra de progresso não explica.
 */
export async function reduzirImagem(arquivo, { maxLado = MAX_LADO, qualidade = QUALIDADE } = {}) {
  if (!arquivo?.type?.startsWith('image/')) {
    throw new Error('O arquivo escolhido não é uma imagem.')
  }
  if (arquivo.size > MAX_ENTRADA_BYTES) {
    throw new Error('Imagem grande demais. Escolha uma foto de até 25 MB.')
  }

  const fonte = await decodificar(arquivo)
  const largura = fonte.width
  const altura = fonte.height
  const alvo = dimensoesAlvo(largura, altura, maxLado)
  if (!alvo) throw new Error('Não foi possível ler as dimensões desta imagem.')

  const canvas = document.createElement('canvas')
  canvas.width = alvo.largura
  canvas.height = alvo.altura

  const ctx = canvas.getContext('2d')
  // Melhora visível ao reduzir bastante, que é justamente o nosso caso.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fonte, 0, 0, alvo.largura, alvo.altura)

  // Libera a memória do bitmap antes de gerar o blob: em celular apertado, os
  // dois vivos ao mesmo tempo é o que estoura.
  fonte.close?.()

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao processar a imagem.'))),
      'image/jpeg',
      qualidade,
    )
  })

  return {
    blob,
    largura: alvo.largura,
    altura: alvo.altura,
    tamanhoOriginal: arquivo.size,
    tamanhoFinal: blob.size,
  }
}

/** "310 KB", "4,2 MB" — para a tela explicar o que aconteceu com o arquivo. */
export function formatarTamanho(bytes) {
  if (!Number.isFinite(bytes)) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}
