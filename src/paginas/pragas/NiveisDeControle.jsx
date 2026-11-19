import { useState } from 'react'
import { CULTURAS, METODOS, TIPOS } from '../../config/pragas.js'
import { chaveNova } from '../../lib/pragas.js'
import { salvarAjusteDePraga, removerAjusteDePraga } from '../../dados/pragas.js'
import { INPUT, SELECT, BOTAO, BOTAO_PRINCIPAL, Aviso } from './comum.jsx'

const numeroOuNulo = (txt) => {
  if (txt === '' || txt == null) return null
  const n = Number(String(txt).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) throw new Error('O nível precisa ser um número positivo (ou vazio, para não ter nível).')
  return n
}
const texto = (v) => (v == null ? '' : String(v).replace('.', ','))

function unidade(metodo) {
  return metodo === 'pano' ? 'por metro' : metodo === 'presenca' ? '(1 = achou)' : metodo === 'nota' ? '' : '%'
}

function textoNivel(p) {
  if (p.metodo === 'nota') return 'A própria nota'
  const u = p.metodo === 'pano' ? '/m' : p.metodo === 'presenca' ? '' : '%'
  if (p.metodo === 'presenca') return p.controle != null ? 'Achou = agir' : '—'
  const partes = []
  if (p.controle != null) partes.push(`${texto(p.controle)}${u}`)
  if (p.controle_reprodutivo != null) partes.push(`${texto(p.controle_reprodutivo)}${u} no reprodutivo`)
  return partes.length ? partes.join(' · ') : '—'
}

function Editor({ inicial, cultura, aoSalvar, aoCancelar, nova }) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'praga')
  const [metodo, setMetodo] = useState(inicial?.metodo ?? 'pano')
  const [controle, setControle] = useState(texto(inicial?.controle))
  const [reprodutivo, setReprodutivo] = useState(texto(inicial?.controle_reprodutivo))
  const [ativa, setAtiva] = useState(inicial?.ativa ?? true)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setErro(null)
    try {
      if (!nome.trim()) throw new Error('Dê um nome.')
      const c = metodo === 'nota' ? null : metodo === 'presenca' ? (controle ? 1 : null) : numeroOuNulo(controle)
      const r = cultura === 'soja' && !['nota', 'presenca'].includes(metodo) ? numeroOuNulo(reprodutivo) : null
      if (['percentual', 'contagem'].includes(metodo) && ((c ?? 0) > 100 || (r ?? 0) > 100)) throw new Error('Porcentagem vai até 100.')
      setSalvando(true)
      await aoSalvar({ nome: nome.trim(), tipo, metodo, controle: c, controle_reprodutivo: r, ativa })
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-solo-300 bg-solo-50/50 p-3 dark:border-solo-500/40 dark:bg-solo-500/5">
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_12rem]">
        <input value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} placeholder="Nome" aria-label="Nome" className={INPUT} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo" className={SELECT}>
          {TIPOS.map((t) => (
            <option key={t.chave} value={t.chave}>
              {t.rotulo}
            </option>
          ))}
        </select>
        <select value={metodo} onChange={(e) => setMetodo(e.target.value)} aria-label="Jeito de medir" className={SELECT}>
          {Object.entries(METODOS).map(([k, m]) => (
            <option key={k} value={k}>
              {m.rotulo}
            </option>
          ))}
        </select>
      </div>
      {metodo === 'presenca' ? (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={Boolean(controle)} onChange={(e) => setControle(e.target.checked ? '1' : '')} className="accent-solo-600" />
          Achou = agir (vermelho)
        </label>
      ) : metodo === 'nota' ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Na nota visual, a cor é a própria nota: baixo verde, médio amarelo, alto vermelho.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Nível de controle</span>
          <input value={controle} onChange={(e) => setControle(e.target.value)} inputMode="decimal" aria-label="Nível de controle" className={`${INPUT} w-24 text-right`} placeholder="sem" />
          <span>{unidade(metodo)}</span>
          {cultura === 'soja' && (
            <>
              <span className="ml-2">no reprodutivo (R1+)</span>
              <input value={reprodutivo} onChange={(e) => setReprodutivo(e.target.value)} inputMode="decimal" aria-label="Nível no reprodutivo" className={`${INPUT} w-24 text-right`} placeholder="igual" />
              <span>{unidade(metodo)}</span>
            </>
          )}
        </div>
      )}
      {!nova && (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="accent-solo-600" />
          Aparece na vistoria
        </label>
      )}
      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={aoCancelar} className={BOTAO}>
          Cancelar
        </button>
        <button type="button" onClick={() => void salvar()} disabled={salvando} className={BOTAO_PRINCIPAL}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

/**
 * A lista de pragas da fazenda por cultura: o jeito de medir e o nível de
 * controle de cada uma. Proprietário e agrônomo ajustam; os outros só veem.
 */
export default function NiveisDeControle({ fazendaId, pragas, podeAjustar, aoMudar }) {
  const [cultura, setCultura] = useState('soja')
  const [editando, setEditando] = useState(null) // chave | 'nova'
  const [erro, setErro] = useState(null)
  const daCultura = pragas.filter((p) => p.cultura === cultura)

  async function salvar(praga, campos) {
    await salvarAjusteDePraga(fazendaId, { ...praga, ...campos })
    setEditando(null)
    aoMudar()
  }

  async function voltarAoPadrao(p) {
    setErro(null)
    try {
      await removerAjusteDePraga(fazendaId, p.chave)
      aoMudar()
    } catch (e) {
      setErro(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Cultura" className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/5">
          {CULTURAS.map((c) => (
            <button
              key={c.chave}
              type="button"
              role="radio"
              aria-checked={cultura === c.chave}
              onClick={() => {
                setCultura(c.chave)
                setEditando(null)
              }}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                cultura === c.chave ? 'bg-white text-slate-900 shadow-sm dark:bg-noite-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {c.rotulo}
            </button>
          ))}
        </div>
        {podeAjustar && editando !== 'nova' && (
          <button type="button" onClick={() => setEditando('nova')} className={BOTAO}>
            + Acrescentar
          </button>
        )}
        {!podeAjustar && (
          <p className="text-xs text-slate-500 dark:text-slate-400">Só o proprietário e o agrônomo mudam esta lista.</p>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Níveis de referência: Embrapa Soja (MIP-Soja 2023), Embrapa Café, Embrapa Rondônia e Epamig. &quot;Atenção&quot; (amarelo) começa em 70% do nível de controle.
        Itens sem nível só registram: entram no mapa e no histórico, sem semáforo.
      </p>

      {erro && <Aviso>{erro}</Aviso>}

      {editando === 'nova' && (
        <Editor
          nova
          cultura={cultura}
          aoCancelar={() => setEditando(null)}
          aoSalvar={(campos) =>
            salvar({ chave: chaveNova(cultura, campos.nome, pragas.map((p) => p.chave)), cultura, ativa: true }, campos)
          }
        />
      )}

      {TIPOS.map((t) => {
        const doTipo = daCultura.filter((p) => p.tipo === t.chave)
        if (doTipo.length === 0) return null
        return (
          <section key={t.chave}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.plural}</h3>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-white/5">
              {doTipo.map((p) => (
                <li key={p.chave} className={`px-3 py-2.5 ${p.ativa ? '' : 'opacity-60'}`}>
                  {editando === p.chave ? (
                    <Editor inicial={p} cultura={cultura} aoCancelar={() => setEditando(null)} aoSalvar={(campos) => salvar(p, campos)} />
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {p.nome}
                          {p.ajustada && <span className="ml-2 rounded bg-solo-100 px-1.5 py-0.5 text-[10px] font-semibold text-solo-800 dark:bg-solo-500/20 dark:text-solo-200">ajustada</span>}
                          {p.propria && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-500/20 dark:text-sky-200">da fazenda</span>}
                          {!p.ativa && <span className="ml-2 text-[11px] text-slate-500">(desligada)</span>}
                        </p>
                        {(p.nota || p.referencia?.nota) && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">Referência: {p.nota ?? p.referencia?.nota}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{METODOS[p.metodo]?.rotulo}</span>
                      <span className="w-40 text-right text-sm tabular-nums text-slate-800 dark:text-slate-200">{textoNivel(p)}</span>
                      {podeAjustar && (
                        <span className="flex gap-1">
                          <button type="button" onClick={() => setEditando(p.chave)} className="rounded px-2 py-1 text-xs font-medium text-solo-700 hover:bg-solo-50 dark:text-solo-300 dark:hover:bg-white/5">
                            Ajustar
                          </button>
                          {(p.ajustada || p.propria) && (
                            <button type="button" onClick={() => void voltarAoPadrao(p)} className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">
                              {p.propria ? 'Excluir' : 'Voltar ao padrão'}
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
