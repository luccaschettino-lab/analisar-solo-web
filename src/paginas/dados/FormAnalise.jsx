import { useEffect, useState } from 'react'
import { Campo, Aviso } from '../../componentes/formulario.jsx'
import { PROFUNDIDADES, CHAVES_PARAMETROS } from '../../config/parametros.js'
import { ehNumeroInvalido, paraTextoDeCampo } from '../../lib/numeros.js'
import {
  montarPayload,
  buscarConflito,
  criarAnalise,
  atualizarAnalise,
  excluirAnalise,
} from '../../dados/analises.js'
import SeletorGleba from './SeletorGleba.jsx'
import CamposParametros from './CamposParametros.jsx'
import ConfirmarSubstituicao from './ConfirmarSubstituicao.jsx'

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
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [conflito, setConflito] = useState(null)

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
    } else {
      setCabecalho(VAZIO)
      setValores(valoresDe(null))
    }
    setErro('')
  }, [emEdicao])

  function mudarCampo(chave, valor) {
    setCabecalho((atual) => ({ ...atual, [chave]: valor }))
  }

  function mudarParametro(chave, valor) {
    setValores((atual) => ({ ...atual, [chave]: valor }))
  }

  function montar() {
    return montarPayload({
      glebaId: selecao.glebaId,
      anoSafra: cabecalho.anoSafra,
      profundidade: cabecalho.profundidade,
      dataColeta: cabecalho.dataColeta,
      laboratorio: cabecalho.laboratorio,
      numeroAmostraLab: cabecalho.numeroAmostraLab,
      observacoes: cabecalho.observacoes,
      valores,
    })
  }

  async function enviar(evento) {
    evento.preventDefault()

    if (!selecao.glebaId) return setErro('Escolha a gleba antes de salvar.')
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
      const existente = await buscarConflito({
        glebaId: selecao.glebaId,
        anoSafra: cabecalho.anoSafra,
        profundidade: cabecalho.profundidade,
        ignorarId: emEdicao?.id ?? null,
      })

      if (existente) {
        // Nunca sobrescreve calado: quem decide é o usuário.
        setConflito(existente)
        setSalvando(false)
        return
      }

      const salva = emEdicao
        ? await atualizarAnalise(emEdicao.id, montar())
        : await criarAnalise(montar())
      aoSalvar(salva, emEdicao ? 'atualizada' : 'criada')
      setSalvando(false)
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  async function substituir() {
    const salva = await atualizarAnalise(conflito.id, montar())
    // Editando outra linha e movendo-a para uma chave ocupada: as duas
    // passariam a ocupar a mesma safra e profundidade, então a de origem sai.
    if (emEdicao && emEdicao.id !== conflito.id) await excluirAnalise(emEdicao.id)
    setConflito(null)
    aoSalvar(salva, 'substituída', emEdicao?.id !== conflito.id ? emEdicao?.id : null)
  }

  const bloqueado = salvando || !selecao.podeLancar

  return (
    <form onSubmit={enviar} className="space-y-5 p-6">
      {selecao.fazendaId && !selecao.podeLancar && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Seu papel nesta fazenda permite apenas consulta.
        </p>
      )}

      <SeletorGleba selecao={selecao} desabilitado={salvando || Boolean(emEdicao)} />
      {emEdicao && (
        <p className="text-xs text-slate-500">
          Editando uma análise existente — a gleba não pode ser trocada. Cancele para
          lançar em outra.
        </p>
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
          <label htmlFor="profundidade" className="block text-sm font-medium text-slate-700">
            Profundidade (cm)
          </label>
          <select
            id="profundidade"
            value={cabecalho.profundidade}
            onChange={(e) => mudarCampo('profundidade', e.target.value)}
            disabled={bloqueado}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50"
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

      <p className="-mt-2 text-xs text-slate-500">
        O número da amostra é a referência do laudo deste ano. A identidade da gleba é
        o cadastro dela, não esse número.
      </p>

      <CamposParametros valores={valores} aoMudar={mudarParametro} desabilitado={bloqueado} />

      <div>
        <label htmlFor="observacoes" className="block text-sm font-medium text-slate-700">
          Observações
        </label>
        <textarea
          id="observacoes"
          rows={2}
          value={cabecalho.observacoes}
          onChange={(e) => mudarCampo('observacoes', e.target.value)}
          disabled={bloqueado}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50"
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
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar edição
          </button>
        )}
      </div>

      {conflito && (
        <ConfirmarSubstituicao
          existente={conflito}
          anoSafra={cabecalho.anoSafra}
          profundidade={cabecalho.profundidade}
          moveria={Boolean(emEdicao && emEdicao.id !== conflito.id)}
          aoSubstituir={substituir}
          aoFechar={() => setConflito(null)}
        />
      )}
    </form>
  )
}
