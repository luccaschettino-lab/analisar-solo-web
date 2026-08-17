import { Link } from 'react-router-dom'
import { ehPonto } from '../../lib/geo.js'

function formatarArea(ha) {
  if (ha == null) return null
  return `${ha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
}

const BOTAO =
  'rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600'

/**
 * Detalhe do item selecionado, no rodapé do painel.
 *
 * Fica na coluna do painel em vez de flutuar sobre o mapa: um cartão sobre o
 * mapa taparia justamente a geometria que o usuário acabou de clicar.
 */
export default function PainelDetalhe({
  item,
  tipo,
  talhaoPai,
  quantidadeGlebas,
  editor,
  editandoGeometria,
  gravandoGeometria,
  carregandoExclusao,
  aoEditarDados,
  aoEditarGeometria,
  aoSalvarGeometria,
  aoCancelarGeometria,
  aoExcluir,
  aoFechar,
}) {
  if (!item) return null

  const ponto = ehPonto(item.geometria)
  const area = formatarArea(item.area_ha)

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {tipo === 'talhao' ? 'Talhão' : `Gleba · talhão ${talhaoPai?.codigo ?? '—'}`}
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {item.codigo}
            {item.nome && <span className="font-normal text-slate-500"> · {item.nome}</span>}
          </p>
        </div>
        <button
          onClick={aoFechar}
          aria-label="Fechar detalhe"
          className="shrink-0 rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      </div>

      <dl className="mt-2 space-y-0.5 text-xs text-slate-600">
        <div className="flex justify-between">
          <dt>Área</dt>
          <dd className="font-medium text-slate-800">
            {ponto ? 'ponto de coleta' : (area ?? 'sem geometria')}
          </dd>
        </div>
        {tipo === 'talhao' && (
          <div className="flex justify-between">
            <dt>Glebas</dt>
            <dd className="font-medium text-slate-800">{quantidadeGlebas}</dd>
          </div>
        )}
      </dl>

      {/* Fora do bloco de permissão: consultar análises é leitura, e um
          leitor tem tanto direito a isso quanto um proprietário. */}
      {tipo === 'gleba' && (
        <Link
          to={`/glebas/${item.id}`}
          className="mt-3 block rounded-md bg-solo-700 px-3 py-2 text-center text-xs font-medium text-white transition hover:bg-solo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600"
        >
          Ver análises
        </Link>
      )}

      {!editor ? (
        <p className="mt-3 text-xs text-slate-400">
          Seu papel nesta fazenda permite apenas consulta.
        </p>
      ) : editandoGeometria ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-md border border-solo-100 bg-solo-50 px-2 py-1.5 text-xs text-solo-800">
            {ponto
              ? 'Arraste o ponto para a posição correta.'
              : 'Arraste os vértices. Clique num vértice para removê-lo.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={aoSalvarGeometria}
              disabled={gravandoGeometria}
              className="flex-1 rounded-md bg-solo-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {gravandoGeometria ? 'Gravando…' : 'Gravar geometria'}
            </button>
            <button onClick={aoCancelarGeometria} disabled={gravandoGeometria} className={BOTAO}>
              Descartar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={aoEditarDados} className={BOTAO}>
            Editar dados
          </button>
          <button onClick={aoEditarGeometria} className={BOTAO}>
            Editar geometria
          </button>
          <button
            onClick={aoExcluir}
            disabled={carregandoExclusao}
            className="rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {carregandoExclusao ? 'Verificando…' : 'Excluir'}
          </button>
        </div>
      )}
    </div>
  )
}
