import { useEffect, useState } from 'react'
import { Campo, Aviso } from '../../componentes/formulario.jsx'
import { PROFUNDIDADES, CHAVES_PARAMETROS } from '../../config/parametros.js'
import { ehNumeroInvalido, paraTextoDeCampo } from '../../lib/numeros.js'
import { pontoFeature, latLngDoPonto } from '../../lib/geo.js'
import { montarPayload, criarAnalise, atualizarAnalise } from '../../dados/analises.js'
import SeletorTalhao from './SeletorTalhao.jsx'
import MapaPontoColeta from './MapaPontoColeta.jsx'
import CamposParametros from './CamposParametros.jsx'

const FORMATO_SAFRA = /^\d{2}-\d{2}$/
const VAZIO = { anoSafra: '', profundidade: '0-20', dataColeta: '', laboratorio: '', numeroAmostraLab: '', observacoes: '' }

function valoresDe(analise) {
  const valores = {}
  for (const chave of CHAVES_PARAMETROS) {
    valores[chave] = analise ? paraTextoDeCampo(analise[chave]) : ''
  }
  return valores
}

export default function FormAnalise({ selecao, emEdicao, aoSalvar, aoCancelarEdicao }) {
  const [cabecalho, setCabecalho] = useState(VAZIO)
  const [valores, setValores] = useState(() => valoresDe(null))
  const [ponto, setPonto] = useState(null) // { lat, lng } | null
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Entrar ou sair da edição repovoa o formulário inteiro.
  useEffect(() => {
    if (emEdicao) {
      setCabecalho({
        anoSafra: emEdicao.ano_safra ?? '',
        profundidade: emEdicao.profundidade ?? '0-20',
        dataColeta: emEdicao.data_coleta ?? '',
        laboratorio: emEdicao.laboratorio ?? '',
        numeroAmostraLab: emEdicao.numero_amostra_lab ?? '',
        observacoes: emEdicao.observacoes ?? '',
      })
      setValores(valoresDe(emEdicao))
      const [lat, lng] = latLngDoPonto(emEdicao.geometria) ?? [null, null]
      setPonto(lat != null ? { lat, lng } : null)
    } else {
      setCabecalho(VAZIO)
      setValores(valoresDe(null))
      setPonto(null)
    }
    setErro('')
  }, [emEdicao])

  function mudarCampo(chave, valor) {
    setCabecalho((atual) => ({ ...atual, [chave]: valor }))
  }

  function mudarParametro(chave, valor) {
    setValores((atual) => ({ ...atual, [chave]: valor }))
  }

  async function enviar(evento) {
    evento.preventDefault()

    if (!selecao.talhaoId) return setErro('Escolha o talhão antes de salvar.')
    if (!ponto) return setErro('Marque no mapa o ponto onde a amostra foi coletada.')
    if (!FORMATO_SAFRA.test(cabecalho.anoSafra.trim())) {
      return setErro('O ano-safra precisa estar no formato 25-26.')
    }
    // Número ilegível bloqueia; fora da faixa plausível, não. São coisas
    // diferentes: um é dado que o banco não aceita, o outro é dado estranho.
    const ilegiveis = CHAVES_PARAMETROS.filter((c) => ehNumeroInvalido(valores[c]))
    if (ilegiveis.length > 0) {
      return setErro(`Corrija os campos que não são número: ${ilegiveis.join(', ')}.`)
    }

    setErro('')
    setSalvando(true)
    try {
      const payload = montarPayload({
        talhaoId: selecao.talhaoId,
        geometria: pontoFeature(ponto.lat, ponto.lng),
        anoSafra: cabecalho.anoSafra,
        profundidade: cabecalho.profundidade,
        dataColeta: cabecalho.dataColeta,
        laboratorio: cabecalho.laboratorio,
        numeroAmostraLab: cabecalho.numeroAmostraLab,
        observacoes: cabecalho.observacoes,
        valores,
      })
      const salva = emEdicao ? await atualizarAnalise(emEdicao.id, payload) : await criarAnalise(payload)
      aoSalvar(salva, emEdicao ? 'atualizada' : 'criada')
      setSalvando(false)
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  const bloqueado = salvando || !selecao.podeLancar

  return (
    <form onSubmit={enviar} className="space-y-5 p-6">
      {selecao.fazendaId && !selecao.podeLancar && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-noite-950 dark:text-slate-400">
          Seu papel nesta fazenda permite apenas consulta.
        </p>
      )}

      <SeletorTalhao selecao={selecao} desabilitado={salvando || Boolean(emEdicao)} />
      {emEdicao && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Editando uma análise existente — o talhão não pode ser trocado. Cancele para
          lançar em outro.
        </p>
      )}

      {selecao.talhao && (
        <div>
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Ponto de coleta
          </span>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Clique no mapa pra marcar onde a amostra foi coletada dentro do talhão. Alimenta
            o mapa de calor — cada ponto marcado separadamente, mesmo no mesmo talhão.
          </p>
          <div className="mt-1.5">
            <MapaPontoColeta talhao={selecao.talhao} ponto={ponto} aoEscolherPonto={setPonto} />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Campo
          id="ano-safra"
          rotulo="Ano-safra"
          value={cabecalho.anoSafra}
          onChange={(e) => mudarCampo('anoSafra', e.target.value)}
          placeholder="25-26"
          required
          disabled={bloqueado}
        />
        <div>
          <label htmlFor="profundidade" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Profundidade (cm)
          </label>
          <select
            id="profundidade"
            value={cabecalho.profundidade}
            onChange={(e) => mudarCampo('profundidade', e.target.value)}
            disabled={bloqueado}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30 dark:disabled:bg-white/5"
          >
            {PROFUNDIDADES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <Campo
          id="data-coleta"
          rotulo="Data da coleta"
          type="date"
          value={cabecalho.dataColeta}
          onChange={(e) => mudarCampo('dataColeta', e.target.value)}
          disabled={bloqueado}
        />
        <Campo
          id="laboratorio"
          rotulo="Laboratório"
          value={cabecalho.laboratorio}
          onChange={(e) => mudarCampo('laboratorio', e.target.value)}
          disabled={bloqueado}
        />
        <Campo
          id="numero-amostra"
          rotulo="Nº da amostra"
          value={cabecalho.numeroAmostraLab}
          onChange={(e) => mudarCampo('numeroAmostraLab', e.target.value)}
          disabled={bloqueado}
        />
      </div>

      <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
        O número da amostra é a referência do laudo deste ano — o laboratório renumera a
        cada coleta, então serve só de referência, nunca para identificar o ponto.
      </p>

      <CamposParametros valores={valores} aoMudar={mudarParametro} desabilitado={bloqueado} />

      <div>
        <label htmlFor="observacoes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Observações
        </label>
        <textarea
          id="observacoes"
          rows={2}
          value={cabecalho.observacoes}
          onChange={(e) => mudarCampo('observacoes', e.target.value)}
          disabled={bloqueado}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30 dark:disabled:bg-white/5"
        />
      </div>

      <Aviso>{erro}</Aviso>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={bloqueado}
          className="rounded-md bg-solo-700 px-4 py-2 text-sm font-medium text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {salvando ? 'Salvando…' : emEdicao ? 'Salvar alterações' : 'Salvar análise'}
        </button>
        {emEdicao && (
          <button
            type="button"
            onClick={aoCancelarEdicao}
            disabled={salvando}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          >
            Cancelar edição
          </button>
        )}
      </div>
    </form>
  )
}
