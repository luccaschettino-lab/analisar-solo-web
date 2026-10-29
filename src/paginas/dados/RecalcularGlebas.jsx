import { useState } from 'react'
import { useFazendaAtual } from '../../context/FazendaContext.jsx'
import { listarPontosColetaDaFazenda } from '../../dados/pontosColeta.js'
import { atualizarGleba } from '../../dados/glebas.js'
import { recalcularGlebasDosPontos } from '../../lib/pontosDeColeta.js'

/**
 * Refaz as glebas que já foram criadas a partir de pontos de amostra, para que
 * preencham o talhão (antes cada uma era só o contorno dos seus pontos).
 *
 * Duas etapas, como a importação: calcula e mostra o que mudaria, e só grava
 * ao confirmar. Glebas desenhadas à mão e as análises não são tocadas — só a
 * geometria e a área das glebas que vieram dos pontos.
 */
export default function RecalcularGlebas() {
  const { fazendaSelecionada, talhoes, glebas, aplicarGlebas } = useFazendaAtual()

  const [plano, setPlano] = useState(null)
  const [calculando, setCalculando] = useState(false)
  const [aplicando, setAplicando] = useState(null)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState('')

  async function verificar() {
    setErro('')
    setResultado('')
    setPlano(null)
    setCalculando(true)
    try {
      const pontos = await listarPontosColetaDaFazenda(fazendaSelecionada.id)
      setPlano(recalcularGlebasDosPontos(pontos, glebas, talhoes))
    } catch (e) {
      setErro(e.message)
    } finally {
      setCalculando(false)
    }
  }

  async function aplicar() {
    if (!plano || plano.atualizacoes.length === 0 || aplicando) return
    setErro('')
    const feitas = []
    setAplicando({ feito: 0, total: plano.atualizacoes.length })
    try {
      for (const a of plano.atualizacoes) {
        feitas.push(await atualizarGleba(a.glebaId, { geometria: a.geometria, areaHa: a.areaHa }))
        setAplicando({ feito: feitas.length, total: plano.atualizacoes.length })
      }
      setResultado(`${feitas.length} ${feitas.length === 1 ? 'gleba ajustada' : 'glebas ajustadas'} para preencher os talhões.`)
      setPlano(null)
    } catch (e) {
      setErro(`${e.message} ${feitas.length} de ${plano.atualizacoes.length} glebas foram ajustadas; pode verificar de novo para continuar.`)
    } finally {
      if (feitas.length > 0) aplicarGlebas(feitas)
      setAplicando(null)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 px-4 py-4 dark:border-white/10">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ajustar glebas já criadas ao talhão</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Refaz as glebas que vieram de pontos de amostra para que, juntas, preencham todo o talhão, sem vão entre elas. Só muda
          o desenho e a área: as análises e as glebas desenhadas à mão ficam como estão.
        </p>
      </div>

      {resultado && (
        <p role="status" className="rounded-md border border-solo-100 bg-solo-50 px-3 py-2 text-sm font-medium text-solo-800 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-300">
          {resultado}
        </p>
      )}
      {erro && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
          {erro}
        </p>
      )}

      {plano && (
        <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">{plano.atualizacoes.length}</strong>{' '}
            {plano.atualizacoes.length === 1 ? 'gleba será ajustada' : 'glebas serão ajustadas'}
          </li>
          {plano.emPedacos > 0 && (
            <li>
              {plano.emPedacos} {plano.emPedacos === 1 ? 'gleba fica' : 'glebas ficam'} em mais de um pedaço, porque os pontos dela
              se alternam com os de outras
            </li>
          )}
          {plano.talhoesIgnorados.length > 0 && (
            <li className="text-amber-700 dark:text-amber-300">
              Talhão {plano.talhoesIgnorados.join(', ')}: tem glebas desenhadas à mão junto com as de pontos, então foi deixado como está
            </li>
          )}
          {plano.atualizacoes.length === 0 && <li>Nenhuma gleba de pontos precisa de ajuste.</li>}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        {aplicando ? (
          <p role="status" aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
            Ajustando glebas: {aplicando.feito} de {aplicando.total}…
          </p>
        ) : <span />}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void verificar()}
            disabled={calculando || Boolean(aplicando)}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:ring-white/15 dark:hover:bg-white/10"
          >
            {calculando ? 'Calculando…' : plano ? 'Verificar de novo' : 'Verificar'}
          </button>
          {plano && plano.atualizacoes.length > 0 && (
            <button
              type="button"
              onClick={() => void aplicar()}
              disabled={Boolean(aplicando)}
              aria-busy={Boolean(aplicando)}
              className="rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-solo-600 dark:hover:bg-solo-700 dark:disabled:bg-slate-600"
            >
              {aplicando ? 'Ajustando…' : `Ajustar ${plano.atualizacoes.length} ${plano.atualizacoes.length === 1 ? 'gleba' : 'glebas'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
