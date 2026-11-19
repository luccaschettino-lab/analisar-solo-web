/**
 * Lista de referência de pragas, doenças e plantas daninhas (soja e café).
 *
 * Cada item tem o jeito de medir mais comum (`metodo`) e, quando há um
 * consenso técnico, o nível de controle nesse jeito. A fazenda pode mudar o
 * nível, o jeito, desligar um item ou acrescentar outros (tabela
 * pragas_da_fazenda, mesma `chave` substitui o daqui).
 *
 * Níveis conferidos em 2026-11-19:
 * - Soja: folder MIP-Soja da Embrapa Soja (2023): percevejos 2/m de pano em
 *   lavoura de grão (1/m em semente), a partir de R3; desfolha 30% no
 *   vegetativo e 15% no reprodutivo, ou 20 lagartas grandes/m.
 * - Café: bicho-mineiro 30% de folhas minadas (Epamig); broca-do-café 3% de
 *   frutos broqueados (Embrapa Rondônia / Epamig, 3 a 5%); ferrugem 5% de
 *   incidência nas folhas (Embrapa Café).
 * - Ferrugem-asiática da soja: não há nível de convívio; achou, controla.
 * Os demais itens vêm sem nível: registram e entram no mapa e no histórico,
 * e o agrônomo define um nível se quiser o semáforo.
 */

export const CULTURAS = [
  { chave: 'soja', rotulo: 'Soja' },
  { chave: 'cafe', rotulo: 'Café' },
]

export const TIPOS = [
  { chave: 'praga', rotulo: 'Praga', plural: 'Pragas' },
  { chave: 'doenca', rotulo: 'Doença', plural: 'Doenças' },
  { chave: 'daninha', rotulo: 'Planta daninha', plural: 'Plantas daninhas' },
]

/**
 * Os jeitos de medir. `unidade` acompanha o valor calculado do talhão;
 * `entrada` diz o que o monitor digita.
 */
export const METODOS = {
  pano: {
    rotulo: 'Pano de batida',
    unidade: '/m',
    entrada: 'Quantos insetos caíram no pano, em quantos metros de pano',
  },
  contagem: {
    rotulo: 'Contagem na amostra',
    unidade: '%',
    entrada: 'Quantos estavam atacados, de quantos olhados',
  },
  percentual: {
    rotulo: '% estimada',
    unidade: '%',
    entrada: 'Porcentagem estimada (desfolha, folhas com sintoma…)',
  },
  presenca: {
    rotulo: 'Presença',
    unidade: '',
    entrada: 'Achou ou não achou',
  },
  nota: {
    rotulo: 'Nota visual',
    unidade: '',
    entrada: 'Baixo, médio ou alto',
  },
}

export const NOTAS = [
  { valor: 1, rotulo: 'Baixo' },
  { valor: 2, rotulo: 'Médio' },
  { valor: 3, rotulo: 'Alto' },
]

/** Estádios para escolher na vistoria (texto livre também vale). */
export const ESTADIOS = {
  soja: ['VE', 'VC', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'],
  cafe: ['Vegetativo', 'Florada', 'Chumbinho', 'Expansão', 'Granação', 'Maturação', 'Colheita', 'Pós-colheita'],
}

const p = (chave, cultura, tipo, nome, metodo, controle = null, extra = {}) => ({
  chave,
  cultura,
  tipo,
  nome,
  metodo,
  controle,
  controle_reprodutivo: null,
  ativa: true,
  ...extra,
})

export const PRAGAS_REFERENCIA = [
  // ---------- Soja: pragas ----------
  p('soja-percevejo-marrom', 'soja', 'praga', 'Percevejo-marrom', 'pano', null, {
    controle_reprodutivo: 2,
    nota: '2/m em lavoura de grão, de R3 em diante (1/m em semente). Conta adulto e ninfa ≥ 0,5 cm.',
  }),
  p('soja-percevejo-verde-pequeno', 'soja', 'praga', 'Percevejo-verde-pequeno', 'pano', null, {
    controle_reprodutivo: 2,
    nota: '2/m em lavoura de grão, de R3 em diante (1/m em semente).',
  }),
  p('soja-percevejo-verde', 'soja', 'praga', 'Percevejo-verde', 'pano', null, {
    controle_reprodutivo: 2,
    nota: '2/m em lavoura de grão, de R3 em diante (1/m em semente).',
  }),
  p('soja-lagarta-da-soja', 'soja', 'praga', 'Lagarta-da-soja (Anticarsia)', 'pano', 20, {
    nota: '20 lagartas grandes (≥ 1,5 cm) por metro. Ou use a desfolha.',
  }),
  p('soja-falsa-medideira', 'soja', 'praga', 'Lagarta falsa-medideira', 'pano', 20, {
    nota: '20 lagartas grandes (≥ 1,5 cm) por metro. Ou use a desfolha.',
  }),
  p('soja-desfolha', 'soja', 'praga', 'Desfolha por lagartas', 'percentual', 30, {
    controle_reprodutivo: 15,
    nota: '30% de desfolha no vegetativo, 15% do florescimento em diante.',
  }),
  p('soja-helicoverpa', 'soja', 'praga', 'Helicoverpa', 'pano'),
  p('soja-spodoptera', 'soja', 'praga', 'Lagartas Spodoptera', 'pano'),
  p('soja-mosca-branca', 'soja', 'praga', 'Mosca-branca', 'nota'),
  p('soja-acaros', 'soja', 'praga', 'Ácaros', 'nota'),
  p('soja-tamandua-da-soja', 'soja', 'praga', 'Tamanduá-da-soja', 'contagem'),
  // ---------- Soja: doenças ----------
  p('soja-ferrugem-asiatica', 'soja', 'doenca', 'Ferrugem-asiática', 'presenca', 1, {
    nota: 'Sem nível de convívio: achou, é hora de agir.',
  }),
  p('soja-mancha-alvo', 'soja', 'doenca', 'Mancha-alvo', 'percentual'),
  p('soja-oidio', 'soja', 'doenca', 'Oídio', 'percentual'),
  p('soja-antracnose', 'soja', 'doenca', 'Antracnose', 'percentual'),
  p('soja-mofo-branco', 'soja', 'doenca', 'Mofo-branco', 'presenca'),
  // ---------- Soja: daninhas ----------
  p('soja-buva', 'soja', 'daninha', 'Buva', 'nota'),
  p('soja-capim-amargoso', 'soja', 'daninha', 'Capim-amargoso', 'nota'),
  p('soja-caruru', 'soja', 'daninha', 'Caruru', 'nota'),
  p('soja-capim-pe-de-galinha', 'soja', 'daninha', 'Capim-pé-de-galinha', 'nota'),
  p('soja-corda-de-viola', 'soja', 'daninha', 'Corda-de-viola', 'nota'),

  // ---------- Café: pragas ----------
  p('cafe-bicho-mineiro', 'cafe', 'praga', 'Bicho-mineiro', 'contagem', 30, {
    nota: '30% das folhas com mina intacta (sem rasgo de vespa), no terço médio/superior.',
  }),
  p('cafe-broca', 'cafe', 'praga', 'Broca-do-café', 'contagem', 3, {
    nota: '3% a 5% de frutos broqueados. Amostra mensal a partir do chumbinho.',
  }),
  p('cafe-acaro-vermelho', 'cafe', 'praga', 'Ácaro-vermelho', 'nota'),
  p('cafe-acaro-da-mancha-anular', 'cafe', 'praga', 'Ácaro-da-mancha-anular', 'nota'),
  p('cafe-cochonilhas', 'cafe', 'praga', 'Cochonilhas', 'nota'),
  p('cafe-cigarras', 'cafe', 'praga', 'Cigarras', 'nota'),
  // ---------- Café: doenças ----------
  p('cafe-ferrugem', 'cafe', 'doenca', 'Ferrugem do cafeeiro', 'contagem', 5, {
    nota: '5% das folhas com ferrugem (3º ou 4º par, terço médio).',
  }),
  p('cafe-cercosporiose', 'cafe', 'doenca', 'Cercosporiose', 'contagem'),
  p('cafe-phoma', 'cafe', 'doenca', 'Phoma', 'percentual'),
  // ---------- Café: daninhas ----------
  p('cafe-trapoeraba', 'cafe', 'daninha', 'Trapoeraba', 'nota'),
  p('cafe-capim-colchao', 'cafe', 'daninha', 'Capim-colchão', 'nota'),
  p('cafe-buva', 'cafe', 'daninha', 'Buva', 'nota'),
]
