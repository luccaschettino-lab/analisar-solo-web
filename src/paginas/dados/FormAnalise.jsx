import { useEffect, useState } from 'react'
import { Campo, Aviso } from '../../componentes/formulario.jsx'
import { PROFUNDIDADES, CHAVES_PARAMETROS } from '../../config/parametros.js'
import { ehNumeroInvalido, paraTextoDeCampo } from '../../lib/numeros.js'
import { pontoFeature, latLngDoPonto, glebaDentroDoTalhao } from '../../lib/geo.js'
import { interpretarBusca } from '../../lib/busca.js'
import { montarPayload, criarAnalise, atualizarAnalise } from '../../dados/analises.js'
import SeletorTalhao from './SeletorTalhao.jsx'
import MapaPontoColeta from './MapaPontoColeta.jsx'
import CamposParametros, { SugestaoTutorial } from './CamposParametros.jsx'
import { useTutorial } from '../../context/TutorialContext.jsx'
import { ANALISE_GUIADA } from '../../lib/fazendaExemplo.js'

const FORMATO_SAFRA = /^\d{2}-\d{2}$/
const VAZIO = { anoSafra: '', profundidade: '0-20', dataColeta: '', laboratorio: '', numeroAmostraLab: '', observacoes: '' }

const CARTAO = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5'
const TITULO = 'mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'
const CAMPO =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30 dark:disabled:bg-white/5'

const formatarPonto = (p) => (p ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : '')

/**
 * O ponto por coordenadas, a outra forma de marcar além do clique no mapa.
 * Os dois ficam ligados: clicar preenche o campo, e digitar (Enter ou
 * "Usar") move o ponto no mapa. Aceita o que a busca do mapa aceita
 * ("-20.7546, -42.8825", "-20,7546 -42,8825"), avisa latitude e longitude
 * trocadas e ponto fora do talhão — sem recusar, porque coletar na beira é
 * legítimo.
 */
function CoordenadasDoPonto({ ponto, talhao, aoEscolher, desabilitado }) {
  const [texto, setTexto] = useState(formatarPonto(ponto))
  const [problema, setProblema] = useState(null) // { texto, trocar? }

  // Clique ou arraste no mapa atualiza o campo.
  useEffect(() => {
    setTexto(formatarPonto(ponto))
  }, [ponto])

  const fora = ponto && talhao?.geometria && glebaDentroDoTalhao(pontoFeature(ponto.lat, ponto.lng), talhao.geometria) === false

  function usar() {
    const r = interpretarBusca(texto)
    if (r.tipo === 'erro') return setProblema({ texto: r.motivo })
    if (r.tipo !== 'coordenada') return setProblema({ texto: 'Digite a latitude e a longitude, por exemplo -20.7546, -42.8825.' })
    if (r.invertidaProvavel) {
      return setProblema({
        texto: 'Parece que latitude e longitude estão trocadas (a primeira é a latitude, que no Brasil vai de +5 a −34).',
        trocar: { lat: r.lng, lng: r.lat },
      })
    }
    setProblema(null)
    aoEscolher({ lat: r.lat, lng: r.lng })
  }

  return (
    <div className="mt-3">
      <label htmlFor="coordenadas-ponto" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Ou digite as coordenadas
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="coordenadas-ponto"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setProblema(null)
          }}
          onKeyDown={(e) => {
            // Enter aqui usa as coordenadas, não envia o formulário inteiro.
            if (e.key === 'Enter') {
              e.preventDefault()
              usar()
            }
          }}
          placeholder="latitude, longitude  (ex.: -20.7546, -42.8825)"
          disabled={desabilitado}
          className={`${CAMPO} min-w-0 flex-1 tabular-nums`}
        />
        <button
          type="button"
          onClick={usar}
          disabled={desabilitado || !texto.trim() || texto === formatarPonto(ponto)}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
        >
          Usar
        </button>
      </div>
      {problema ? (
        <p role="alert" className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">
          {problema.texto}{' '}
          {problema.trocar && (
            <button
              type="button"
              onClick={() => {
                setProblema(null)
                aoEscolher(problema.trocar)
              }}
              className="font-semibold underline"
            >
              Trocar e usar
            </button>
          )}
        </p>
      ) : fora ? (
        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">
          Este ponto fica fora do talhão {talhao.codigo}. Confira; dá para salvar assim.
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Clicar no mapa preenche este campo; digitar e apertar Enter move o ponto. Graus decimais, como o GPS mostra.
        </p>
      )}
    </div>
  )
}

function valoresDe(analise) {
  const valores = {}
  for (const chave of CHAVES_PARAMETROS) {
    valores[chave] = analise ? paraTextoDeCampo(analise[chave]) : ''
  }
  return valores
}

/**
 * Entrada manual de uma análise, em duas colunas como o Monitoramento: à
 * esquerda o talhão e o mapa grande para marcar o ponto (parado enquanto se
 * rola); à direita o laudo em cartões, com o botão de salvar sempre à vista
 * no rodapé.
 */
export default function FormAnalise({ selecao, emEdicao, aoSalvar, aoCancelarEdicao }) {
  // Tutorial guiado, fase 6: o valor de cada campo aparece em cima dele.
  const { missao } = useTutorial()
  const guia = missao?.fase === 6 && !emEdicao ? ANALISE_GUIADA : null

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
    <form onSubmit={enviar} className="p-4 sm:p-6">
      {selecao.fazendaId && !selecao.podeLancar && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-noite-950 dark:text-slate-400">
          Seu papel nesta fazenda permite apenas consulta.
        </p>
      )}
      {guia && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          <strong>Tutorial:</strong> escolha a fazenda do tutorial e o <strong>talhão {guia.talhao}</strong>, marque o ponto e preencha os
          campos com o valor que aparece em amarelo em cima de cada um. Os outros podem ficar vazios.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Onde: talhão e ponto */}
        <section className={`${CARTAO} self-start lg:sticky lg:top-0`}>
          <h2 className={TITULO}>Onde a amostra foi coletada</h2>
          <SeletorTalhao selecao={selecao} desabilitado={salvando || Boolean(emEdicao)} />
          {emEdicao && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Editando uma análise existente — o talhão não pode ser trocado. Cancele para lançar em outro.
            </p>
          )}
          {selecao.talhao ? (
            <div className="mt-3">
              {guia && (
                <SugestaoTutorial
                  prefixo="Marque:"
                  valor={ponto ? 'ponto marcado' : `clique no canto de cima, à esquerda, do talhão ${guia.talhao}`}
                  feito={Boolean(ponto)}
                />
              )}
              <MapaPontoColeta
                talhao={selecao.talhao}
                ponto={ponto}
                aoEscolherPonto={setPonto}
                className="h-[22rem] lg:h-[calc(100vh-22rem)] lg:min-h-[20rem]"
              />
              <CoordenadasDoPonto ponto={ponto} talhao={selecao.talhao} aoEscolher={setPonto} desabilitado={bloqueado} />
            </div>
          ) : (
            <p className="mt-3 flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
              Escolha a fazenda e o talhão para marcar o ponto.
            </p>
          )}
        </section>

        {/* O laudo */}
        <div className="min-w-0 space-y-4">
          <section className={CARTAO}>
            <h2 className={TITULO}>Identificação da amostra</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                id="ano-safra"
                rotulo="Ano-safra"
                value={cabecalho.anoSafra}
                onChange={(e) => mudarCampo('anoSafra', e.target.value)}
                placeholder="ex.: 25-26"
                required
                disabled={bloqueado}
                acao={guia && <SugestaoTutorial valor={guia.safra} feito={cabecalho.anoSafra.trim() === guia.safra} />}
              />
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="profundidade" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Profundidade (cm)
                  </label>
                  {guia && <SugestaoTutorial valor={guia.profundidade} feito={cabecalho.profundidade === guia.profundidade} />}
                </div>
                <select
                  id="profundidade"
                  value={cabecalho.profundidade}
                  onChange={(e) => mudarCampo('profundidade', e.target.value)}
                  disabled={bloqueado}
                  className={CAMPO}
                >
                  {PROFUNDIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <Campo
                id="numero-amostra"
                rotulo="Nº da amostra"
                value={cabecalho.numeroAmostraLab}
                onChange={(e) => mudarCampo('numeroAmostraLab', e.target.value)}
                disabled={bloqueado}
                acao={guia && <SugestaoTutorial valor={guia.amostra} feito={cabecalho.numeroAmostraLab.trim() === guia.amostra} />}
              />
              <Campo
                id="data-coleta"
                rotulo="Data da coleta"
                type="date"
                value={cabecalho.dataColeta}
                onChange={(e) => mudarCampo('dataColeta', e.target.value)}
                disabled={bloqueado}
              />
              <div className="sm:col-span-2">
                <Campo
                  id="laboratorio"
                  rotulo="Laboratório"
                  value={cabecalho.laboratorio}
                  onChange={(e) => mudarCampo('laboratorio', e.target.value)}
                  disabled={bloqueado}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              O nº da amostra é a referência do laudo deste ano: o laboratório renumera a cada coleta.
            </p>
          </section>

          <CamposParametros valores={valores} aoMudar={mudarParametro} desabilitado={bloqueado} sugestoes={guia?.valores} cartoes />

          <section className={CARTAO}>
            <label htmlFor="observacoes" className={`block ${TITULO}`}>
              Observações
            </label>
            <textarea
              id="observacoes"
              rows={2}
              value={cabecalho.observacoes}
              onChange={(e) => mudarCampo('observacoes', e.target.value)}
              disabled={bloqueado}
              className={CAMPO}
            />
          </section>

          {/* Rodapé fixo: salvar sem rolar até o fim. */}
          <div className="vidro-forte sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 shadow-painel dark:border-white/10">
            <button
              type="submit"
              disabled={bloqueado}
              className="rounded-md bg-solo-700 px-5 py-2 text-sm font-semibold text-white hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-solo-600 dark:hover:bg-solo-700 dark:disabled:bg-slate-600"
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
            <div className="min-w-0 flex-1">
              <Aviso>{erro}</Aviso>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
