/**
 * Os estados da comparação entre safras, sozinhos num módulo folha.
 *
 * Ficam separados porque o cálculo (`variacao.js`), a cor
 * (`escalaDivergente.js`) e os textos (`textosVariacao.js`) precisam todos
 * deles, e o cálculo precisa da cor. Mantê-los em `variacao.js` fecharia um
 * ciclo de imports entre os dois primeiros — funciona por acidente na ordem de
 * avaliação dos módulos ES, e quebra no dia em que alguém ler uma dessas
 * constantes no topo do arquivo em vez de dentro de uma função.
 *
 * `variacao.js` reexporta as duas, então quem importa de lá continua
 * funcionando: este arquivo é detalhe de organização, não uma quinta fonte.
 */

/** Situação do valor de um dos lados da comparação. */
export const LADO = {
  MEDIDO: 'medido', // tem número, inclusive quando o número é zero
  SEM_MEDICAO: 'sem_medicao', // análise existe, laboratório não mediu o parâmetro
  SEM_ANALISE: 'sem_analise', // nenhuma análise da gleba naquele ano e profundidade
}

/**
 * Situação da variação. Cinco, não três: os dois casos de ausência são
 * visualmente distintos no mapa — hachura para "falta um ano", cinza neutro
 * para "falta os dois" — e a diferença importa. Faltar um ano é lacuna de
 * coleta que dá para corrigir na próxima safra; faltar os dois é gleba que
 * nunca entrou na amostragem daquela profundidade.
 */
export const VARIACAO = {
  QUEDA: 'queda', // caiu mais que o limiar
  ESTAVEL: 'estavel', // mudou menos que o limiar, ou não mudou
  ALTA: 'alta', // subiu mais que o limiar
  SEM_UM_ANO: 'sem_um_ano', // medido em exatamente um dos dois anos
  SEM_OS_DOIS: 'sem_os_dois', // medido em nenhum dos dois
}
