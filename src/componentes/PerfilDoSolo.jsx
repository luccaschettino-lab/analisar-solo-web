import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import ConfirmarExclusao from './ConfirmarExclusao.jsx'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import { listarFotosDaGleba, enviarFotoDaGleba, removerFotoDaGleba } from '../dados/fotosGleba.js'
import { urlAssinada } from '../dados/fotos.js'
import { reduzirImagem } from '../lib/imagem.js'
import { anoSafraDaData } from '../lib/laudoUfv.js'

const PROFUNDIDADES = ['0-20', '20-40', '40-60']
const FORMATO_SAFRA = /^\d{2}-\d{2}$/

const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '')
const safraDeHoje = () => anoSafraDaData(new Date().toISOString().slice(0, 10))
const porSafra = (a, b) => b.localeCompare(a) // mais recente primeiro ("25-26" > "24-25")

/** Uma profundidade: a miniatura da foto, ou o espaço para enviar. */
function Faixa({ profundidade, foto, url, editor, ocupado, aoEscolher, aoAbrir, grande }) {
  const entrada = useRef(null)
  return (
    <li className="flex items-stretch gap-2">
      <span className="flex w-12 shrink-0 flex-col items-center justify-center rounded-md bg-amber-900/10 text-center text-xs font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
        {profundidade}
        <span className="font-normal">cm</span>
      </span>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          e.target.value = ''
          if (arquivo) aoEscolher(arquivo)
        }}
      />
      {foto ? (
        <button
          type="button"
          onClick={aoAbrir}
          className={`relative ${grande ? 'h-40' : 'h-20'} min-w-0 flex-1 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-noite-950`}
          title={`Ver a foto de ${profundidade} cm`}
        >
          {url ? (
            <img src={url} alt={`Perfil do solo, ${profundidade} cm`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-slate-500">carregando…</span>
          )}
          {ocupado && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white">{ocupado}</span>
          )}
        </button>
      ) : editor ? (
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={Boolean(ocupado)}
          className={`flex ${grande ? 'h-40' : 'h-20'} min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-solo-500 hover:text-solo-700 disabled:opacity-60 dark:border-white/15 dark:text-slate-400 dark:hover:border-solo-500 dark:hover:text-solo-300`}
        >
          {ocupado || <><span aria-hidden="true">📷</span> Adicionar foto</>}
        </button>
      ) : (
        <span className={`flex ${grande ? 'h-40' : 'h-20'} min-w-0 flex-1 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400 dark:border-white/15`}>
          sem foto
        </span>
      )}
      {/* Fica montado para "Trocar" no visualizador abrir o mesmo seletor. */}
      <span hidden data-abrir-envio={profundidade} onClick={() => entrada.current?.click()} />
    </li>
  )
}

/**
 * Fotos do perfil do solo da GLEBA (0-20, 20-40 e 40-60 cm), por safra.
 *
 * Empilhadas de cima para baixo, como o perfil: quem olha lê a coluna de solo.
 * Cada safra tem as suas, para comparar o antes e o depois — a mesma lógica
 * das análises. Começa na safra mais recente que tem foto. Aparece no painel
 * da gleba no mapa e na aba Foto da página da gleba (`grande`).
 */
export default function PerfilDoSolo({ gleba, fazendaId, editor, grande = false }) {
  const { anos } = useFazendaAtual()
  const [fotos, setFotos] = useState([])
  const [urls, setUrls] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [safra, setSafra] = useState('')
  const [novaSafra, setNovaSafra] = useState(null) // texto quando digitando outra safra
  const [ocupado, setOcupado] = useState({}) // profundidade -> texto
  const [erro, setErro] = useState('')
  const [aberta, setAberta] = useState(null) // profundidade no visualizador
  const [removendo, setRemovendo] = useState(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro('')
    setFotos([])
    setUrls({})
    listarFotosDaGleba(gleba.id)
      .then((lista) => ativo && setFotos(lista))
      .catch((e) => ativo && setErro(e.message))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [gleba.id])

  // Safras para escolher: as que já têm foto, as das análises e a de hoje.
  const safras = useMemo(() => {
    const todas = new Set([...fotos.map((f) => f.ano_safra), ...(anos ?? []), safraDeHoje()])
    if (safra) todas.add(safra)
    return [...todas].filter((s) => FORMATO_SAFRA.test(s)).sort(porSafra)
  }, [fotos, anos, safra])

  useEffect(() => {
    if (safra || carregando) return
    const comFoto = [...new Set(fotos.map((f) => f.ano_safra))].sort(porSafra)[0]
    setSafra(comFoto ?? safras[0] ?? safraDeHoje())
  }, [carregando, fotos, safras, safra])

  const daSafra = Object.fromEntries(fotos.filter((f) => f.ano_safra === safra).map((f) => [f.profundidade, f]))

  // URL temporária de cada foto visível (bucket privado).
  useEffect(() => {
    let ativo = true
    for (const foto of Object.values(daSafra)) {
      if (urls[foto.caminho]) continue
      urlAssinada(foto.caminho)
        .then((url) => ativo && url && setUrls((u) => ({ ...u, [foto.caminho]: url })))
        .catch(() => {})
    }
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos, safra])

  async function enviar(profundidade, arquivo) {
    setErro('')
    setOcupado((o) => ({ ...o, [profundidade]: 'Reduzindo…' }))
    try {
      const { blob } = await reduzirImagem(arquivo)
      setOcupado((o) => ({ ...o, [profundidade]: 'Enviando…' }))
      const anterior = daSafra[profundidade]
      const foto = await enviarFotoDaGleba({
        fazendaId,
        glebaId: gleba.id,
        anoSafra: safra,
        profundidade,
        blob,
        caminhoAnterior: anterior?.caminho,
      })
      setFotos((lista) => [...lista.filter((f) => f.id !== foto.id && !(f.ano_safra === safra && f.profundidade === profundidade)), foto])
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado((o) => ({ ...o, [profundidade]: '' }))
    }
  }

  async function remover() {
    const foto = removendo
    await removerFotoDaGleba({ id: foto.id, caminho: foto.caminho })
    setFotos((lista) => lista.filter((f) => f.id !== foto.id))
    setRemovendo(null)
    setAberta(null)
  }

  function confirmarNovaSafra() {
    const texto = (novaSafra ?? '').trim()
    if (!FORMATO_SAFRA.test(texto)) return setErro('A safra precisa estar no formato 25-26.')
    setErro('')
    setSafra(texto)
    setNovaSafra(null)
  }

  const fotoAberta = aberta ? daSafra[aberta] : null
  const quantas = Object.keys(daSafra).length

  return (
    <section className={grande ? '' : 'mt-3 border-t border-slate-200 pt-2.5 dark:border-white/10'} aria-label="Fotos do perfil do solo">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Perfil do solo</h3>
        {novaSafra === null ? (
          <select
            value={safra}
            onChange={(e) => (e.target.value === '__nova' ? setNovaSafra('') : setSafra(e.target.value))}
            aria-label="Safra das fotos"
            className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-white/15 dark:bg-noite-800 dark:text-slate-100"
          >
            {safras.map((s) => (
              <option key={s} value={s}>
                Safra {s}
                {fotos.some((f) => f.ano_safra === s) ? ' 📷' : ''}
              </option>
            ))}
            {editor && <option value="__nova">Outra safra…</option>}
          </select>
        ) : (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={novaSafra}
              onChange={(e) => setNovaSafra(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmarNovaSafra()}
              placeholder="ex.: 23-24"
              aria-label="Nova safra"
              className="w-20 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-white/15 dark:bg-noite-800 dark:text-slate-100"
            />
            <button type="button" onClick={confirmarNovaSafra} className="rounded-md bg-solo-700 px-2 py-1 text-xs font-medium text-white">
              OK
            </button>
            <button type="button" onClick={() => setNovaSafra(null)} className="px-1 text-xs text-slate-500">
              ✕
            </button>
          </span>
        )}
      </div>

      {erro && <p role="alert" className="mb-2 text-xs text-red-700 dark:text-red-400">{erro}</p>}

      {carregando ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Carregando fotos…</p>
      ) : (
        <ol className="space-y-1.5">
          {PROFUNDIDADES.map((p) => (
            <Faixa
              key={p}
              profundidade={p}
              foto={daSafra[p]}
              url={daSafra[p] ? urls[daSafra[p].caminho] : null}
              editor={editor}
              ocupado={ocupado[p]}
              aoEscolher={(arquivo) => void enviar(p, arquivo)}
              aoAbrir={() => setAberta(p)}
              grande={grande}
            />
          ))}
        </ol>
      )}
      {!carregando && quantas === 0 && (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {editor
            ? 'Toque em cada camada para adicionar a foto do solo desta safra. No celular, abre a câmera.'
            : 'Sem fotos do perfil nesta safra.'}
        </p>
      )}

      {fotoAberta && (
        <Modal titulo={`Gleba ${gleba.codigo} · ${aberta} cm · safra ${safra}`} aoFechar={() => setAberta(null)} largura="max-w-3xl">
          <img
            src={urls[fotoAberta.caminho]}
            alt={`Perfil do solo da gleba ${gleba.codigo}, ${aberta} cm, safra ${safra}`}
            className="max-h-[65vh] w-full rounded-md bg-slate-100 object-contain dark:bg-noite-950"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="mr-auto text-xs text-slate-500 dark:text-slate-400">Enviada em {dataCurta(fotoAberta.enviada_em)}</span>
            {PROFUNDIDADES.filter((p) => p !== aberta && daSafra[p]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAberta(p)}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Ver {p} cm
              </button>
            ))}
            {editor && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const alvo = aberta
                    setAberta(null)
                    document.querySelector(`[data-abrir-envio="${alvo}"]`)?.click()
                  }}
                  className="rounded-md bg-solo-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-solo-800 dark:bg-solo-600"
                >
                  Trocar foto
                </button>
                <button
                  type="button"
                  onClick={() => setRemovendo(fotoAberta)}
                  className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  Remover
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {removendo && (
        <ConfirmarExclusao
          titulo={`Remover a foto de ${removendo.profundidade} cm (safra ${removendo.ano_safra})?`}
          descricao="O arquivo da foto é apagado. Não há como desfazer."
          rotuloBotao="Remover"
          aoFechar={() => setRemovendo(null)}
          aoConfirmar={remover}
        />
      )}
    </section>
  )
}
