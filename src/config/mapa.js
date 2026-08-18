// Configuracao das camadas base e dos padroes do mapa.
// Fica separado do componente para que URLs e atribuicoes tenham um lugar
// unico — atribuicao de tile e obrigacao legal das duas fontes, nao enfeite.

const ATRIB_ESRI =
  'Imagens &copy; <a href="https://www.esri.com/">Esri</a> — Esri, Maxar, Earthstar Geographics e a comunidade GIS'
const ATRIB_EOX =
  'Sentinel-2 cloudless por <a href="https://eox.at/">EOX</a> — contém dados Copernicus Sentinel modificados'
const ATRIB_OSM =
  '&copy; contribuidores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// maxNativeZoom evita pedir tile que a fonte não tem: o Leaflet estica o
// último nível disponível em vez de receber 404 e mostrar buraco cinza. Sem
// isso, aproximar para posicionar um ponto de coleta quebraria a tela.
const ZOOM_ALTA = { maxNativeZoom: 19, maxZoom: 22 }
const ZOOM_SENTINEL = { maxNativeZoom: 15, maxZoom: 22 }

/** Mosaico anual do Sentinel-2, um por ano. Serve para comparar uso da terra. */
function sentinel(ano) {
  return {
    rotulo: `Sentinel-2 · ${ano}`,
    url: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${ano}_3857/default/g/{z}/{y}/{x}.jpg`,
    opcoes: { attribution: ATRIB_EOX, ...ZOOM_SENTINEL },
    // A data não precisa ser consultada: é o próprio mosaico.
    info: { tipo: 'fixo', texto: `Mosaico anual ${ano} · 10 m/pixel` },
  }
}

/**
 * `info` diz como descobrir a data da imagem:
 *   { tipo: 'esri' }   consulta o serviço de metadados, por coordenada
 *   { tipo: 'fixo' }   a data é conhecida e constante
 *   ausente            camada sem data (mapa de ruas, relevo)
 */
export const CAMADAS_BASE = {
  satelite: {
    rotulo: 'Satélite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opcoes: { attribution: ATRIB_ESRI, ...ZOOM_ALTA },
    info: { tipo: 'esri' },
  },
  clarity: {
    rotulo: 'Satélite (Esri Clarity)',
    url: 'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opcoes: { attribution: ATRIB_ESRI, ...ZOOM_ALTA },
    // O Clarity não publica serviço de metadados — verificado, devolve 404.
    // Melhor não mostrar data nenhuma que mostrar a data da outra camada.
    info: { tipo: 'fixo', texto: 'Mosaico alternativo, data não publicada' },
  },
  s2_2024: sentinel(2024),
  s2_2021: sentinel(2021),
  s2_2018: sentinel(2018),
  relevo: {
    rotulo: 'Relevo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    opcoes: { attribution: ATRIB_ESRI, ...ZOOM_ALTA },
  },
  ruas: {
    rotulo: 'Ruas',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opcoes: { attribution: ATRIB_OSM, ...ZOOM_ALTA },
  },
}

// Satelite e o padrao: sem imagem aerea o produtor nao reconhece o talhao.
export const CAMADA_PADRAO = 'satelite'

// Usado quando a fazenda nao tem talhoes nem centro gravado. Vicosa-MG.
export const CENTRO_PADRAO = [-20.7546, -42.8825]
export const ZOOM_PADRAO = 13

// Zoom aplicado ao centralizar numa gleba do tipo ponto, que nao tem area
// para o fitBounds trabalhar.
export const ZOOM_PONTO = 17

// Folga ao redor da geometria no fitBounds, para o desenho nao encostar
// nas bordas nem ficar sob o painel lateral.
export const PADDING_FIT = [40, 40]

// Paleta do seletor de cor do talhao. A primeira e o default da coluna
// talhoes.cor no banco.
export const CORES_TALHAO = [
  '#2e7d32',
  '#1565c0',
  '#ef6c00',
  '#6a1b9a',
  '#c62828',
  '#00838f',
  '#f9a825',
  '#4e342e',
]

// Estilos das geometrias. Talhao translucido por baixo, gleba solida por cima.
export const ESTILO_TALHAO = { weight: 2, opacity: 0.9, fillOpacity: 0.25 }
export const ESTILO_TALHAO_DESTACADO = { weight: 4, opacity: 1, fillOpacity: 0.4 }
export const ESTILO_GLEBA = { color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.55 }
export const ESTILO_GLEBA_DESTACADA = { color: '#ffff00', weight: 3, opacity: 1, fillOpacity: 0.7 }
export const COR_GLEBA = '#ffb300'
export const RAIO_PONTO_GLEBA = 7

/**
 * Tons neutros das geometrias sem classificação.
 *
 * Ficam aqui, e só aqui, porque aparecem em três lugares que precisam
 * combinar: o preenchimento da gleba no mapa, o traço do padrão de hachura e
 * a amostra da hachura na legenda. Se a legenda deixar de bater com o mapa,
 * ela para de servir como chave de leitura — e foi o que quase aconteceu com
 * o fundo repetido à mão em dois arquivos.
 */
const ARDOSIA_400 = '#94a3b8'
const ARDOSIA_300 = '#cbd5e1'
const ARDOSIA_100 = '#f1f5f9'

/** Gleba com valor medido, mas parâmetro sem faixa no config. */
export const CINZA_NEUTRO = ARDOSIA_400
/** Cor lógica do estado "sem dado" — o desenho real é a hachura. */
export const CINZA_HACHURA = ARDOSIA_300
/** Fundo e traço do padrão de hachura, no SVG do mapa e no CSS da legenda. */
export const HACHURA_FUNDO = ARDOSIA_100
export const HACHURA_TRACO = ARDOSIA_400

/**
 * Gleba-ponto sem dado: círculo vazado, com traço tracejado.
 *
 * A hachura usada nos polígonos não serve aqui. O ladrilho tem 8 px e o
 * círculo tem 14 px de diâmetro — caberiam uma ou duas listras, que leem como
 * ruído e não como ausência. Num alvo pequeno, o que comunica "sem dado" é
 * estar visualmente vazio.
 */
export const ESTILO_PONTO_SEM_DADO = {
  color: '#64748b',
  weight: 2,
  opacity: 1,
  dashArray: '3 3',
  fillColor: '#ffffff',
  fillOpacity: 0.3,
}
