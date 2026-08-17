/**
 * Conversão de texto digitado para número.
 *
 * A regra que atravessa o produto inteiro: **campo vazio vira `null`, nunca
 * zero**. Um laudo que não mediu fósforo não é um solo com fósforo zero, e
 * confundir os dois falsifica todo gráfico e toda média daí para frente.
 *
 * Aceita vírgula decimal porque é o que o produtor digita — e é o que os
 * laudos brasileiros imprimem.
 */

export function paraNumeroOuNulo(valor) {
  if (valor === null || valor === undefined) return null
  const texto = String(valor).trim().replace(',', '.')
  if (texto === '') return null
  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : null
}

/** Preenchido mas ilegível como número — o formulário barra antes de salvar. */
export function ehNumeroInvalido(valor) {
  if (valor === null || valor === undefined) return false
  const texto = String(valor).trim()
  if (texto === '') return false
  return !Number.isFinite(Number(texto.replace(',', '.')))
}

/** Valor numérico para dentro de um <input>: null vira string vazia. */
export function paraTextoDeCampo(valor) {
  if (valor === null || valor === undefined) return ''
  return String(valor).replace('.', ',')
}
