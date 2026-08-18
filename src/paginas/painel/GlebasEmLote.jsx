import { useMemo, useState } from 'react'
import { Aviso } from '../../componentes/formulario.jsx'
import { parsearLote } from '../../lib/lote.js'
import { pontoFeature, glebaDentroDoTalhao } from '../../lib/geo.js'
import { criarGlebasEmLote } from '../../dados/glebas.js'
import { usePreviaLote } from '../../mapa/usePreviaLote.js'

const EXEMPLO = `G1, -20.7546, -42.8825
G2, -20.7550, -42.8830
G3, -20.7560, -42.8840`

/**
 * Cadastro de glebas em lote.
 *
 * Painel encostado à esquerda em vez de modal centralizado: a prévia dos
 * pontos precisa ficar visível no mapa enquanto o usuário confere o texto.
 */
export default function GlebasEmLote({ talhao, glebasExistentes, mapa, aoSalvar, aoFechar }) {
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const codigosExistentes = useMemo(
    () => glebasExistentes.map((g) => g.codigo),
    [glebasExistentes],
  )

  const { itens, erros } = useMemo(
    () => parsearLote(texto, { codigosExistentes }),
    [texto, codigosExistentes],
  )

  // Contenção **bloqueia**, como no cadastro individual. Era aviso; mudou a
  // pedido do responsável. Aqui são todos pontos, e ponto não tem divisa para
  // tolerar: ou caiu dentro do talhão, ou a coordenada está errada.
  const foraDoTalhao = useMemo(
    () =>
      itens.filter(
        (i) => glebaDentroDoTalhao(pontoFeature(i.lat, i.lng), talhao?.geometria) === false,
      ),
    [itens, talhao],
  )

  usePreviaLote(mapa, itens)

  async function gravar() {
    if (itens.length === 0 || foraDoTalhao.length > 0) return
    setErro('')
    setSalvando(true)
    try {
      const criadas = await criarGlebasEmLote(
        talhao.id,
        itens.map((i) => ({ codigo: i.codigo, geometria: pontoFeature(i.lat, i.lng) })),
      )
      aoSalvar(criadas)
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    // No celular ocupa a tela toda: 26rem é mais largo que um aparelho comum,
    // e a prévia dos pontos não caberia ao lado de qualquer jeito.
    <aside className="absolute inset-0 z-[2000] flex flex-col border-slate-200 bg-white shadow-xl sm:inset-y-0 sm:left-0 sm:right-auto sm:w-[26rem] sm:border-r">
      <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Glebas em lote · talhão {talhao.codigo}
          </h2>
          <p className="text-xs text-slate-500">Uma gleba por linha, como ponto de coleta.</p>
        </div>
        <button
          onClick={aoFechar}
          aria-label="Fechar"
          className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <label htmlFor="lote-texto" className="block text-xs font-medium text-slate-600">
          Cole no formato <code className="rounded bg-slate-100 px-1">código, latitude, longitude</code>
        </label>
        <textarea
          id="lote-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={EXEMPLO}
          spellCheck={false}
          disabled={salvando}
          rows={10}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 font-mono text-xs outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50"
        />
        <p className="mt-1 text-xs text-slate-400">
          Graus decimais. Ponto e vírgula e vírgula decimal, como o Excel exporta,
          também funcionam.
        </p>

        <Aviso>{erro}</Aviso>

        {itens.length > 0 && (
          <div className="mt-3 rounded-md border border-solo-100 bg-solo-50 px-3 py-2">
            <p className="text-sm font-medium text-solo-800">
              {itens.length} {itens.length === 1 ? 'gleba pronta' : 'glebas prontas'} para gravar
            </p>
            <p className="mt-0.5 text-xs text-solo-700">
              Confira a posição dos pontos no mapa antes de confirmar.
            </p>
          </div>
        )}

        {foraDoTalhao.length > 0 && (
          <div
            role="alert"
            className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900"
          >
            <p className="font-medium">
              {foraDoTalhao.length}{' '}
              {foraDoTalhao.length === 1 ? 'ponto está fora' : 'pontos estão fora'} do talhão{' '}
              {talhao.codigo}
            </p>
            <p className="mt-1">
              {foraDoTalhao.map((i) => i.codigo).join(', ')} — corrija as coordenadas para gravar.
              O lote inteiro é gravado de uma vez, então nada entra enquanto houver ponto fora.
            </p>
          </div>
        )}

        {erros.length > 0 && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs font-medium text-red-800">
              {erros.length} {erros.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}
            </p>
            <ul className="mt-1 space-y-1">
              {erros.map((e) => (
                <li key={e.linha} className="text-xs text-red-700">
                  <span className="font-mono">linha {e.linha}</span>: {e.motivo}
                  {e.texto && (
                    <span className="block truncate font-mono text-red-500">{e.texto}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-red-700">
              As demais linhas serão gravadas normalmente.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
        <button
          onClick={aoFechar}
          disabled={salvando}
          className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={gravar}
          disabled={salvando || itens.length === 0 || foraDoTalhao.length > 0}
          className="rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {salvando
            ? 'Gravando…'
            : itens.length === 0
              ? 'Nada para gravar'
              : `Gravar ${itens.length}`}
        </button>
      </div>
    </aside>
  )
}
