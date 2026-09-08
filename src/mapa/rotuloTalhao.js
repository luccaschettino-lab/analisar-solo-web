import { escapar } from './tooltipGleba.js'

/**
 * Rótulo fixo do talhão, desenhado sobre a geometria.
 *
 * Duas linhas: identificação em cima, área embaixo. A área vai na segunda
 * linha e em peso menor porque é consulta, não identidade — quem procura um
 * talhão procura pelo código, e a área é o que ele confere depois de achar.
 *
 * Chamamos de **talhão**, não de "lote". Lote é a coluna da planilha do
 * laboratório; talhão é a entidade do cadastro, com código próprio e
 * permanente. Misturar os dois nomes na tela reintroduz exatamente a tradução
 * mental que o modelo de dados existe para eliminar.
 */

/** Área com duas casas, como o laudo e o cadastro mostram: "46,31 ha". */
export function formatarArea(areaHa) {
  const numero = Number(areaHa)
  if (!Number.isFinite(numero)) return null
  return `${numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`
}

/**
 * HTML do rótulo. Código vem do cadastro, digitado pelo usuário, e o
 * tooltip do Leaflet aceita HTML — por isso passa por `escapar`.
 *
 * Só o código, sem o nome: com muitos talhões pequenos e vizinhos (comum
 * depois de uma importação de KML, onde cada polígono já chega com nome
 * próprio), "Talhão 12-2 (Antigo 19)" empilhado lado a lado de outros rótulos
 * do mesmo tamanho vira uma parede de texto ilegível. O nome continua
 * disponível — é só clicar no talhão — só não briga mais por espaço no mapa.
 *
 * Talhão sem área desenhada (geometria ausente ou degenerada) sai só com a
 * identificação, sem "0,00 ha". Área zero e área desconhecida são coisas
 * diferentes, e a segunda não deve ser exibida como número.
 */
export function conteudoRotuloTalhao(talhao) {
  const titulo = escapar(`Talhão ${talhao.codigo}`)

  const area = formatarArea(talhao.area_ha)
  if (!area) return titulo

  return `${titulo}<br><span class="rotulo-area">${escapar(area)}</span>`
}
