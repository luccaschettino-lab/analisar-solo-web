// Camadas de aviso sobre o mapa: convite inicial, banners de modo e o toast.
// z-[1100] fica acima dos controles do Leaflet (1000) e abaixo dos diálogos.

function Banner({ children }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[1100] flex justify-center">
      <div className="pointer-events-auto rounded-md bg-slate-900/85 px-3 py-2 text-sm text-white shadow">
        {children}
      </div>
    </div>
  )
}

export default function SobreposicoesDoMapa({
  semReferencia,
  editor,
  marcandoSede,
  gravandoSede,
  desenhando,
  aviso,
  aoMarcarSede,
  aoCancelarMarcacao,
  aoAbortarDesenho,
}) {
  return (
    <>
      {semReferencia && !marcandoSede && !gravandoSede && (
        // O padding compensa o painel lateral, que só existe a partir de md.
        // No celular o painel é gaveta sobreposta, e um pl-80 empurraria o
        // cartão para fora da tela.
        <div className="pointer-events-none absolute inset-0 z-[1050] flex items-center justify-center p-4 md:pl-80">
          <div className="pointer-events-auto max-w-sm rounded-xl border border-slate-200 bg-white/95 p-5 text-center shadow-lg backdrop-blur">
            <h3 className="text-sm font-semibold text-slate-900">Onde fica a propriedade?</h3>
            <p className="mt-1 text-sm text-slate-600">
              Navegue até a fazenda no mapa e marque a sede. Ela aparece no mapa
              com o nome da fazenda, e é por ela que o mapa abre enquanto não houver
              talhões desenhados.
            </p>
            {editor && (
              <button
                onClick={aoMarcarSede}
                className="mt-4 rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800"
              >
                Marcar sede
              </button>
            )}
          </div>
        </div>
      )}

      {marcandoSede && (
        <Banner>
          Clique no mapa para marcar a sede da fazenda.{' '}
          <button onClick={aoCancelarMarcacao} className="ml-2 underline">
            cancelar
          </button>
        </Banner>
      )}

      {gravandoSede && <Banner>Gravando a sede da fazenda…</Banner>}

      {desenhando && (
        <Banner>
          {desenhando.forma === 'ponto'
            ? 'Clique no ponto onde a amostra é coletada.'
            : 'Clique para marcar os vértices. Dê duplo clique para fechar.'}{' '}
          <button onClick={aoAbortarDesenho} className="ml-2 underline">
            cancelar
          </button>
        </Banner>
      )}

      {aviso && (
        <div
          role="status"
          className="absolute bottom-6 left-1/2 z-[1100] -translate-x-1/2 rounded-md bg-slate-900/85 px-3 py-2 text-sm text-white shadow"
        >
          {aviso}
        </div>
      )}
    </>
  )
}
