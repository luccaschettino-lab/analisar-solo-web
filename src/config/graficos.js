/**
 * Cores e opções dos gráficos de evolução.
 *
 * A série é a **profundidade**, que é ordinal — 0-20 é mais raso que 20-40,
 * que é mais raso que 40-60. Por isso uma rampa de um matiz só, do claro ao
 * escuro: mais fundo, mais escuro. Cor categórica desperdiçaria a ordem.
 *
 * `outro` fica fora da sequência e por isso ganha um matiz diferente — não
 * pode ser confundido com uma posição no perfil.
 *
 * Paleta validada com o script do skill de dataviz (rampa ordinal, superfície
 * clara): lightness monotônica, degraus visíveis (ΔL ≥ 0,06), matiz único
 * (3° de dispersão) e a ponta clara separando da superfície. O laranja separa
 * dos dois extremos da rampa com ΔE 23,1 e 27,7 em deuteranopia e
 * protanopia — bem acima do piso de 8.
 *
 * O tom mais claro fica em 2,06:1 contra o fundo, abaixo de 3:1. O alívio
 * exigido está atendido: legenda sempre presente e a aba Análises é a mesma
 * informação em tabela.
 */
export const COR_PROFUNDIDADE = {
  '0-20': '#86b6ef',
  '20-40': '#2a78d6',
  '40-60': '#104281',
  outro: '#eb6834',
}

export const COR_PROFUNDIDADE_PADRAO = '#64748b'

export function corDaProfundidade(profundidade) {
  return COR_PROFUNDIDADE[profundidade] ?? COR_PROFUNDIDADE_PADRAO
}

// Tinta do texto: rótulo e valor nunca vestem a cor da série. A identidade
// quem carrega é a marca colorida ao lado.
const TINTA = '#475569'
const TINTA_FRACA = '#94a3b8'
const GRADE = '#e2e8f0'

export function opcoesDoGrafico({ rotuloEixoY, formatarValor }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    // O buraco não é ligado: um ano sem medição não vira reta entre os
    // vizinhos. É a regra que mais importa nesta tela.
    spanGaps: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: TINTA, padding: 12 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const valor = ctx.parsed.y
            if (valor === null || valor === undefined) return `${ctx.dataset.label}: sem medição`
            return `${ctx.dataset.label}: ${formatarValor(valor)}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: TINTA_FRACA, font: { size: 11 } },
        border: { color: GRADE },
      },
      y: {
        title: rotuloEixoY
          ? { display: true, text: rotuloEixoY, color: TINTA_FRACA, font: { size: 11 } }
          : { display: false },
        grid: { color: GRADE, drawTicks: false },
        ticks: { color: TINTA_FRACA, font: { size: 11 }, padding: 6 },
        border: { display: false },
        // Não força começar em zero: numa faixa de pH entre 5 e 6, ancorar em
        // zero achataria a variação que o produtor precisa enxergar.
        beginAtZero: false,
      },
    },
    elements: {
      line: { borderWidth: 2, tension: 0 },
      point: { radius: 4, hoverRadius: 6, borderWidth: 2, backgroundColor: '#ffffff' },
    },
  }
}
