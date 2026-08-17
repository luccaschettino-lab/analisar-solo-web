// Configuracao das camadas base e dos padroes do mapa.
// Fica separado do componente para que URLs e atribuicoes tenham um lugar
// unico — atribuicao de tile e obrigacao legal das duas fontes, nao enfeite.

export const CAMADAS_BASE = {
  satelite: {
    rotulo: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opcoes: {
      attribution:
        'Imagens &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      // O World Imagery cobre ate z19 na maior parte do Brasil. maxNativeZoom
      // deixa o Leaflet esticar o tile de 19 em vez de pedir um 404 ao Esri,
      // entao o usuario continua conseguindo aproximar para posicionar o ponto.
      maxNativeZoom: 19,
      maxZoom: 22,
    },
  },
  ruas: {
    rotulo: 'Ruas',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opcoes: {
      attribution:
        '&copy; contribuidores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxNativeZoom: 19,
      maxZoom: 22,
    },
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
