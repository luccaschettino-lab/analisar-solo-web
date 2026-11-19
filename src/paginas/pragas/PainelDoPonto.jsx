import { useEffect, useMemo, useRef, useState } from 'react'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { METODOS, NOTAS, TIPOS } from '../../config/pragas.js'
import { paraFeature } from '../../lib/geo.js'
import { reduzirImagem } from '../../lib/imagem.js'
import { salvarPonto, enviarFotoDoPonto, apagarFoto } from '../../dados/pragas.js'
import { INPUT, SELECT, BOTAO, BOTAO_PRINCIPAL, Aviso } from './comum.jsx'

let proximaLinha = 1
const linhaNova = (praga) => ({ id: proximaLinha++, praga: praga.chave, metodo: praga.metodo, valor: '', amostra: praga.metodo === 'pano' ? '1' : '' })

const numero = (txt) => {
  if (txt === '' || txt == null) return null
  const n = Number(String(txt).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Converte as linhas da tela em registros do banco. Linha em branco (ou
 * "não achou") = a praga não estava neste ponto: não grava nada para ela.
 */
function registrosDasLinhas(linhas, nomeDe) {
  const registros = []
  for (const l of linhas) {
    const nome = nomeDe(l.praga)
    if (l.metodo === 'presenca') {
      if (l.valor === '1') registros.push({ praga: l.praga, metodo: 'presenca', valor: 1 })
      continue
    }
    if (l.metodo === 'nota') {
      if (l.valor) registros.push({ praga: l.praga, metodo: 'nota', valor: Number(l.valor) })
      continue
    }
    const valor = numero(l.valor)
    if (valor == null) continue
    if (Number.isNaN(valor) || valor < 0) throw new Error(`${nome}: o valor precisa ser um número positivo.`)
    if (l.metodo === 'percentual') {
      if (valor > 100) throw new Error(`${nome}: a porcentagem vai até 100.`)
      registros.push({ praga: l.praga, metodo: 'percentual', valor })
      continue
    }
    const amostra = numero(l.amostra)
    if (l.metodo === 'pano') {
      if (amostra != null && (Number.isNaN(amostra) || amostra <= 0)) throw new Error(`${nome}: os metros de pano precisam ser maiores que zero.`)
      registros.push({ praga: l.praga, metodo: 'pano', valor, amostra: amostra ?? 1 })
      continue
    }
    // contagem
    if (amostra == null || Number.isNaN(amostra) || amostra <= 0) throw new Error(`${nome}: diga quantos foram olhados.`)
    if (valor > amostra) throw new Error(`${nome}: atacados (${valor}) não podem passar dos olhados (${amostra}).`)
    registros.push({ praga: l.praga, metodo: 'contagem', valor, amostra })
  }
  return registros
}

function CamposDaLinha({ linha, mudar }) {
  if (linha.metodo === 'presenca') {
    return (
      <div className="flex gap-1">
        {[
          ['1', 'Achou'],
          ['0', 'Não achou'],
        ].map(([v, rotulo]) => (
          <button
            key={v}
            type="button"
            onClick={() => mudar({ valor: v })}
            className={`flex-1 rounded-md border px-2 py-1.5 text-sm font-medium ${
              linha.valor === v
                ? 'border-solo-600 bg-solo-50 text-solo-800 dark:border-solo-500 dark:bg-solo-500/15 dark:text-solo-200'
                : 'border-slate-300 text-slate-600 dark:border-white/15 dark:text-slate-300'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>
    )
  }
  if (linha.metodo === 'nota') {
    return (
      <div className="flex gap-1">
        {NOTAS.map((n) => (
          <button
            key={n.valor}
            type="button"
            onClick={() => mudar({ valor: linha.valor === String(n.valor) ? '' : String(n.valor) })}
            className={`flex-1 rounded-md border px-2 py-1.5 text-sm font-medium ${
              linha.valor === String(n.valor)
                ? 'border-solo-600 bg-solo-50 text-solo-800 dark:border-solo-500 dark:bg-solo-500/15 dark:text-solo-200'
                : 'border-slate-300 text-slate-600 dark:border-white/15 dark:text-slate-300'
            }`}
          >
            {n.rotulo}
          </button>
        ))}
      </div>
    )
  }
  const campo = (props) => <input inputMode="decimal" className={`${INPUT} text-right tabular-nums`} {...props} />
  if (linha.metodo === 'percentual') {
    return (
      <div className="flex items-center gap-2">
        {campo({ value: linha.valor, placeholder: '0', onChange: (e) => mudar({ valor: e.target.value }), 'aria-label': 'Porcentagem' })}
        <span className="text-sm text-slate-500">%</span>
      </div>
    )
  }
  if (linha.metodo === 'pano') {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        {campo({ value: linha.valor, placeholder: '0', onChange: (e) => mudar({ valor: e.target.value }), 'aria-label': 'Insetos no pano' })}
        <span className="shrink-0">insetos em</span>
        {campo({ value: linha.amostra, onChange: (e) => mudar({ amostra: e.target.value }), 'aria-label': 'Metros de pano', className: `${INPUT} w-16 text-right tabular-nums` })}
        <span className="shrink-0">m</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      {campo({ value: linha.valor, placeholder: '0', onChange: (e) => mudar({ valor: e.target.value }), 'aria-label': 'Atacados' })}
      <span className="shrink-0">de</span>
      {campo({ value: linha.amostra, placeholder: '100', onChange: (e) => mudar({ amostra: e.target.value }), 'aria-label': 'Olhados' })}
    </div>
  )
}

/**
 * Lançar um ponto da vistoria: onde (GPS ou clique no mapa), o que achou em
 * cada praga, foto e observação. Depois de gravar, fica aberto para o
 * próximo ponto com as mesmas pragas e os valores em branco — no campo, o
 * monitor olha as mesmas pragas em todos os pontos.
 */
export default function PainelDoPonto({ fazendaId, vistoria, geometria, pragas, numeroDoPonto, local, aoLocal, aoPosicao, aoGravar, aoFechar }) {
  const [linhas, setLinhas] = useState([])
  const [escolha, setEscolha] = useState('')
  const [foto, setFoto] = useState(null) // { blob, url }
  const [observacao, setObservacao] = useState('')
  const [gps, setGps] = useState(null) // 'buscando' | mensagem de erro
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [gravado, setGravado] = useState(null)
  const entradaFoto = useRef(null)

  const daCultura = useMemo(() => pragas.filter((p) => p.cultura === vistoria.cultura && p.ativa), [pragas, vistoria.cultura])
  const nomeDe = (chave) => pragas.find((p) => p.chave === chave)?.nome ?? chave
  const disponiveis = daCultura.filter((p) => !linhas.some((l) => l.praga === p.chave))

  const fora = useMemo(() => {
    const f = paraFeature(geometria)
    if (!local || !f?.geometry) return false
    return !booleanPointInPolygon([local.lng, local.lat], f)
  }, [local, geometria])

  useEffect(() => () => foto?.url && URL.revokeObjectURL(foto.url), [foto])

  function usarGps() {
    if (!navigator.geolocation) return setGps('Este navegador não dá acesso ao GPS. Toque no mapa para marcar o ponto.')
    setGps('buscando')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: pos.coords.accuracy }
        setGps(null)
        aoPosicao(p)
        aoLocal(p)
      },
      (e) =>
        setGps(
          e.code === 1
            ? 'O navegador não deixou usar a localização. Libere nas permissões do site, ou toque no mapa para marcar.'
            : 'Não deu para pegar a posição agora. Tente de novo ou toque no mapa para marcar.',
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    )
  }

  function acrescentar(chave) {
    const praga = daCultura.find((p) => p.chave === chave)
    if (praga) setLinhas((ls) => [...ls, linhaNova(praga)])
    setEscolha('')
  }

  async function escolherFoto(e) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    try {
      const { blob } = await reduzirImagem(arquivo)
      setFoto({ blob, url: URL.createObjectURL(blob) })
    } catch (falha) {
      setErro(falha.message)
    }
  }

  async function gravar() {
    setErro(null)
    setGravado(null)
    if (!local) return setErro('Marque onde é o ponto: use o GPS ou toque no mapa.')
    let registros
    try {
      registros = registrosDasLinhas(linhas, nomeDe)
    } catch (falha) {
      return setErro(falha.message)
    }
    setSalvando(true)
    let caminho = null
    try {
      if (foto) caminho = await enviarFotoDoPonto(fazendaId, vistoria.id, foto.blob)
      const novos = await salvarPonto(vistoria.id, {
        ponto: numeroDoPonto,
        lat: local.lat,
        lng: local.lng,
        registros,
        foto: caminho,
        observacao: observacao.trim(),
      })
      aoGravar(novos)
      setGravado(registros.length ? `Ponto ${numeroDoPonto} gravado.` : `Ponto ${numeroDoPonto} gravado como "nada encontrado".`)
      // Próximo ponto: mesmas pragas, valores em branco.
      setLinhas((ls) => ls.map((l) => ({ ...l, valor: '', amostra: l.metodo === 'pano' ? l.amostra || '1' : l.metodo === 'contagem' ? l.amostra : '' })))
      setFoto(null)
      setObservacao('')
      aoLocal(null)
    } catch (falha) {
      if (caminho) await apagarFoto(caminho)
      setErro(falha.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ponto {numeroDoPonto}</h3>
        <button type="button" onClick={aoFechar} className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
          Terminar
        </button>
      </div>

      {/* Onde */}
      <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={usarGps} disabled={gps === 'buscando'} className={BOTAO_PRINCIPAL}>
            {gps === 'buscando' ? 'Buscando posição…' : '📍 Usar meu GPS'}
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">ou toque no mapa</span>
        </div>
        {local && (
          <p className="mt-2 text-xs tabular-nums text-slate-600 dark:text-slate-300">
            {local.lat.toFixed(6)}, {local.lng.toFixed(6)}
            {local.precisao ? ` · precisão de ${Math.round(local.precisao)} m` : ''}
          </p>
        )}
        {fora && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">Este ponto está fora do talhão.</p>}
        {gps && gps !== 'buscando' && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{gps}</p>}
      </div>

      {/* O que achou */}
      <div className="space-y-2">
        {linhas.map((l) => {
          const metodosDaLinha = Object.entries(METODOS)
          return (
            <div key={l.id} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{nomeDe(l.praga)}</span>
                <button
                  type="button"
                  aria-label={`Tirar ${nomeDe(l.praga)}`}
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.id !== l.id))}
                  className="text-slate-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
              <select
                value={l.metodo}
                onChange={(e) =>
                  setLinhas((ls) =>
                    ls.map((x) => (x.id === l.id ? { ...x, metodo: e.target.value, valor: '', amostra: e.target.value === 'pano' ? '1' : '' } : x)),
                  )
                }
                aria-label="Jeito de medir"
                className={`${SELECT} mb-2 text-xs`}
              >
                {metodosDaLinha.map(([chave, m]) => (
                  <option key={chave} value={chave}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
              <CamposDaLinha linha={l} mudar={(m) => setLinhas((ls) => ls.map((x) => (x.id === l.id ? { ...x, ...m } : x)))} />
            </div>
          )
        })}
        <select value={escolha} onChange={(e) => acrescentar(e.target.value)} className={SELECT} aria-label="Acrescentar praga">
          <option value="">+ Acrescentar praga, doença ou daninha…</option>
          {TIPOS.map((t) => {
            const doTipo = disponiveis.filter((p) => p.tipo === t.chave)
            if (doTipo.length === 0) return null
            return (
              <optgroup key={t.chave} label={t.plural}>
                {doTipo.map((p) => (
                  <option key={p.chave} value={p.chave}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Deixe em branco o que não achou neste ponto. Sem nada preenchido, o ponto fica como &quot;nada encontrado&quot; (conta como zero na média).
        </p>
      </div>

      {/* Foto e observação */}
      <div className="flex items-center gap-3">
        <input ref={entradaFoto} type="file" accept="image/*" capture="environment" className="hidden" onChange={escolherFoto} />
        <button type="button" onClick={() => entradaFoto.current?.click()} className={BOTAO}>
          📷 {foto ? 'Trocar foto' : 'Foto (opcional)'}
        </button>
        {foto && (
          <>
            <img src={foto.url} alt="Foto do ponto" className="h-12 w-12 rounded-md object-cover" />
            <button type="button" onClick={() => setFoto(null)} className="text-xs text-slate-500 hover:text-red-600">
              tirar
            </button>
          </>
        )}
      </div>
      <textarea
        value={observacao}
        maxLength={500}
        rows={2}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Observação (opcional)"
        className={INPUT}
      />

      {erro && <Aviso>{erro}</Aviso>}
      {gravado && (
        <p role="status" className="text-sm font-medium text-green-700 dark:text-green-300">
          ✓ {gravado}
        </p>
      )}
      <button type="button" onClick={() => void gravar()} disabled={salvando} className={`${BOTAO_PRINCIPAL} w-full`}>
        {salvando ? 'Gravando…' : `Gravar ponto ${numeroDoPonto}`}
      </button>
    </div>
  )
}
