// Camadas de aviso sobre o mapa: convite inicial, banners de modo e o toast.
// z-[1100] fica acima dos controles do Leaflet (1000) e abaixo dos diálogos.

// Sempre escuro nos dois temas: toast e banners ficam sobre a foto de
// satélite, não sobre o chrome do app — precisam de contraste contra
// qualquer cor que a imagem tiver embaixo, igual ao aviso de InfoImagem.
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
      {semReferencia && !marcandoSede && !gravandoSede && !desenhando && (
        // O padding compensa o painel lateral, que só existe a partir de md.
        // No celular o painel é gaveta sobreposta, e um pl-80 empurraria o
        // cartão para fora da tela.
        //
        // `!desenhando` é obrigatório, não estético: sem geometria nenhuma
        // ainda, `semReferencia` fica true durante o desenho do primeiro
        // talhão inteiro. O cartão fica centralizado e com pointer-events —
        // exatamente onde a pessoa clica para começar o polígono — e engolia
        // o clique antes de chegar ao mapa. Para quem usava, o desenho
        // simplesmente não começava.
        <div className="pointer-events-none absolute inset-0 z-[1050] flex items-center justify-center p-4 md:pl-80">
          <div className="vidro-forte pointer-events-auto max-w-sm rounded-xl border border-slate-200 p-5 text-center shadow-painel dark:border-white/15">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Onde fica a propriedade?</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Navegue até a fazenda no mapa e marque a sede. Ela aparece no mapa
              com o nome da fazenda, e é por ela que o mapa abre enquanto não houver
              talhões desenhados.
            </p>
            {editor && (
              <button
                onClick={aoMarcarSede}
                className="mt-4 rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800 dark:bg-solo-600 dark:hover:bg-solo-700"
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
