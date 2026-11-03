/**
 * Lembra onde o mapa estava, por fazenda, entre as telas que têm mapa.
 *
 * Cada tela (Mapa, Filtros, Comparar) cria a sua própria instância do Leaflet,
 * que nasce no centro padrão do app. Sem isto, trocar de tela jogava o mapa
 * para longe da fazenda, e voltar reenquadrava tudo, perdendo o zoom que a
 * pessoa tinha dado. Fica em memória do módulo, não em localStorage: vale
 * enquanto o app está aberto, e um F5 recomeça pelo enquadramento da fazenda.
 */
const vistas = new Map() // fazendaId -> { centro: [lat, lng], zoom }

export function guardarVista(fazendaId, mapa) {
  if (!fazendaId || !mapa) return
  const centro = mapa.getCenter()
  const zoom = mapa.getZoom()
  if (!Number.isFinite(centro?.lat) || !Number.isFinite(centro?.lng) || !Number.isFinite(zoom)) return
  vistas.set(fazendaId, { centro: [centro.lat, centro.lng], zoom })
}

export function lerVista(fazendaId) {
  return vistas.get(fazendaId) ?? null
}
