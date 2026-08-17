import Modal from '../../componentes/Modal.jsx'

/**
 * A escolha vem antes do desenho porque muda a ferramenta: ponto usa marcador,
 * sub-área usa polígono. Perguntar depois obrigaria a redesenhar.
 */
export default function EscolherTipoGleba({ talhao, aoEscolher, aoFechar }) {
  return (
    <Modal titulo={`Nova gleba no talhão ${talhao.codigo}`} aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Como esta gleba será registrada no mapa?</p>

        <button
          onClick={() => aoEscolher('ponto')}
          className="w-full rounded-lg border border-slate-300 p-3 text-left transition hover:border-solo-600 hover:bg-solo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600"
        >
          <span className="block text-sm font-medium text-slate-900">Ponto de coleta</span>
          <span className="block text-sm text-slate-500">
            Um clique marca onde a amostra foi tirada. Sem área.
          </span>
        </button>

        <button
          onClick={() => aoEscolher('poligono')}
          className="w-full rounded-lg border border-slate-300 p-3 text-left transition hover:border-solo-600 hover:bg-solo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600"
        >
          <span className="block text-sm font-medium text-slate-900">Sub-área</span>
          <span className="block text-sm text-slate-500">
            Desenhe o pedaço do talhão que a amostra representa. A área é calculada.
          </span>
        </button>

        <button
          onClick={() => aoEscolher('lote')}
          className="w-full rounded-lg border border-slate-300 p-3 text-left transition hover:border-solo-600 hover:bg-solo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600"
        >
          <span className="block text-sm font-medium text-slate-900">Colar lista de pontos</span>
          <span className="block text-sm text-slate-500">
            Várias glebas de uma vez, a partir de coordenadas. Para quem já tem a
            lista em planilha.
          </span>
        </button>

        <div className="flex justify-end pt-1">
          <button
            onClick={aoFechar}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}
