import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import { useCriterios } from '../hooks/useCriterios.js'
import { useAviso } from '../hooks/useAviso.js'
import { validarCriterio } from '../lib/criterios.js'
import { aplicarCriterioNaFazenda } from '../dados/criterios.js'
import EditorCriterio from './criterios/EditorCriterio.jsx'

const BOTAO =
  'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300'
const BOTAO_PRIMARIO =
  'rounded-md bg-solo-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-solo-800 disabled:cursor-not-allowed disabled:bg-slate-300'
const CAMPO =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100'

/**
 * Critérios de interpretação: onde o consultor define o que é bom e o que é
 * ruim.
 *
 * Até a Fase 7 isso vivia fixo em `config/parametros.js`, com um aviso de que
 * não passara por validação agronômica — o mapa pintava com uma tabela
 * genérica que ninguém assinava. Aqui um consultor cria conjuntos nomeados,
 * ajusta os parâmetros que quiser e aplica um deles em cada fazenda.
 *
 * **O config não sumiu: virou semente.** Parâmetro que o conjunto não toca
 * continua vindo dele, e a legenda do mapa diz isso, parâmetro a parâmetro.
 */
export default function Criterios() {
  const { usuario } = useAuth()
  const { fazendaSelecionada, editor, recarregarCriterio, aplicarFazenda } = useFazendaAtual()
  const { criterios, carregando, erro, criar, salvar, excluir } = useCriterios()
  const { aviso, mostrar: mostrarAviso } = useAviso()

  const [idAberto, setIdAberto] = useState(null)
  const [rascunho, setRascunho] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [aplicando, setAplicando] = useState(false)

  const aberto = criterios.find((c) => c.id === idAberto) ?? null
  const souAutor = aberto?.criado_por === usuario?.id

  // Abre o conjunto aplicado à fazenda, se houver — é o que a pessoa veio ver.
  useEffect(() => {
    if (idAberto || criterios.length === 0) return
    setIdAberto(fazendaSelecionada?.criterio_id ?? criterios[0].id)
  }, [criterios, fazendaSelecionada, idAberto])

  // O rascunho é uma cópia local: editar 24 parâmetros gravando a cada tecla
  // seria uma escrita por caractere. Grava no botão.
  useEffect(() => {
    setRascunho(
      aberto ? { nome: aberto.nome, descricao: aberto.descricao ?? '', parametros: aberto.parametros ?? {} } : null,
    )
  }, [aberto])

  const validacao = useMemo(
    () => (rascunho ? validarCriterio(rascunho.parametros) : { valido: true, porParametro: {} }),
    [rascunho],
  )

  const sujo =
    rascunho &&
    aberto &&
    (rascunho.nome !== aberto.nome ||
      rascunho.descricao !== (aberto.descricao ?? '') ||
      JSON.stringify(rascunho.parametros) !== JSON.stringify(aberto.parametros ?? {}))

  function mudarParametro(chave, entrada) {
    setRascunho((atual) => {
      const parametros = { ...atual.parametros }
      // `undefined` remove a chave: é assim que o parâmetro volta ao config.
      if (entrada === undefined) delete parametros[chave]
      else parametros[chave] = entrada
      return { ...atual, parametros }
    })
  }

  async function novoConjunto() {
    try {
      const novo = await criar({ nome: 'Novo conjunto', descricao: '', parametros: {} })
      setIdAberto(novo.id)
      mostrarAviso('Conjunto criado. Comece personalizando os parâmetros abaixo.')
    } catch (e) {
      mostrarAviso(e.message)
    }
  }

  async function duplicar() {
    if (!aberto) return
    try {
      const copia = await criar({
        nome: `${aberto.nome} (cópia)`,
        descricao: aberto.descricao ?? '',
        parametros: aberto.parametros ?? {},
      })
      setIdAberto(copia.id)
      mostrarAviso('Cópia criada, assinada por você.')
    } catch (e) {
      mostrarAviso(e.message)
    }
  }

  async function gravar() {
    if (!aberto || !validacao.valido || salvando) return
    setSalvando(true)
    try {
      await salvar(aberto.id, rascunho)
      // Se este for o conjunto em vigor na fazenda aberta, o mapa precisa
      // repintar com o que acabou de mudar.
      if (fazendaSelecionada?.criterio_id === aberto.id) await recarregarCriterio()
      mostrarAviso('Critérios salvos.')
    } catch (e) {
      mostrarAviso(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function apagar() {
    if (!aberto) return
    if (!window.confirm(`Apagar "${aberto.nome}"? As fazendas que o usam voltam ao padrão do sistema.`)) return
    try {
      await excluir(aberto.id)
      setIdAberto(null)
      if (fazendaSelecionada?.criterio_id === aberto.id) {
        aplicarFazenda({ ...fazendaSelecionada, criterio_id: null })
        await recarregarCriterio()
      }
      mostrarAviso('Conjunto apagado.')
    } catch (e) {
      mostrarAviso(e.message)
    }
  }

  async function aplicarNaFazenda(idCriterio) {
    if (!fazendaSelecionada || aplicando) return
    setAplicando(true)
    try {
      await aplicarCriterioNaFazenda(fazendaSelecionada.id, idCriterio)
      aplicarFazenda({ ...fazendaSelecionada, criterio_id: idCriterio })
      await recarregarCriterio()
      mostrarAviso(idCriterio ? 'Conjunto aplicado nesta fazenda.' : 'Fazenda voltou ao padrão do sistema.')
    } catch (e) {
      mostrarAviso(e.message)
    } finally {
      setAplicando(false)
    }
  }

  const emVigor = fazendaSelecionada?.criterio_id === idAberto

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-4xl px-3 py-4 sm:px-4">
        <header>
          <h1 className="text-lg font-semibold text-slate-900">Critérios de interpretação</h1>
          <p className="mt-1 text-sm text-slate-600">
            O que é <strong>muito baixo</strong>, <strong>bom</strong> ou <strong>muito bom</strong> em
            cada parâmetro. Interpretação de solo depende de cultura, textura e método de extração —
            por isso são conjuntos nomeados, e não uma tabela só.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Parâmetro que você não personalizar continua usando a tabela preliminar do sistema, e a
            legenda do mapa diz isso.
          </p>
        </header>

        {erro && (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            aria-label="Conjunto de critérios"
            value={idAberto ?? ''}
            onChange={(e) => setIdAberto(e.target.value || null)}
            disabled={carregando}
            className={`${CAMPO} max-w-xs`}
          >
            <option value="">
              {carregando ? 'carregando…' : criterios.length ? 'selecione…' : 'nenhum conjunto ainda'}
            </option>
            {criterios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.criado_por !== usuario?.id && c.autor_nome ? ` — de ${c.autor_nome}` : ''}
              </option>
            ))}
          </select>

          <button type="button" onClick={novoConjunto} className={BOTAO}>
            + Novo
          </button>
          <button type="button" onClick={duplicar} disabled={!aberto} className={BOTAO}>
            Duplicar
          </button>
          <button type="button" onClick={apagar} disabled={!aberto || !souAutor} className={BOTAO}>
            Apagar
          </button>
        </div>

        {fazendaSelecionada && aberto && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
            <span className="text-xs text-slate-600">
              Em <strong>{fazendaSelecionada.nome}</strong>:{' '}
              {emVigor ? 'este conjunto está em vigor.' : 'usando o padrão do sistema ou outro conjunto.'}
            </span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => aplicarNaFazenda(aberto.id)}
                disabled={emVigor || aplicando || !editor}
                className={BOTAO_PRIMARIO}
              >
                Aplicar nesta fazenda
              </button>
              {emVigor && (
                <button
                  type="button"
                  onClick={() => aplicarNaFazenda(null)}
                  disabled={aplicando || !editor}
                  className={BOTAO}
                >
                  Voltar ao padrão
                </button>
              )}
            </div>
          </div>
        )}

        {!editor && fazendaSelecionada && (
          <p className="mt-2 text-xs text-slate-500">
            Você tem acesso de leitura nesta fazenda, então não pode trocar o conjunto em vigor.
          </p>
        )}

        {aberto && rascunho && (
          <div className="mt-4">
            {!souAutor && (
              <p className="mb-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                Este conjunto é de <strong>{aberto.autor_nome ?? 'outro usuário'}</strong>. Você o vê
                porque ele está aplicado a uma fazenda sua, mas só o autor edita. Use{' '}
                <strong>Duplicar</strong> para partir dele e assinar a sua versão.
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Nome</span>
                <input
                  value={rascunho.nome}
                  disabled={!souAutor}
                  onChange={(e) => setRascunho((a) => ({ ...a, nome: e.target.value }))}
                  className={`${CAMPO} mt-1`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Descrição</span>
                <input
                  value={rascunho.descricao}
                  disabled={!souAutor}
                  placeholder="cultura, textura, laboratório…"
                  onChange={(e) => setRascunho((a) => ({ ...a, descricao: e.target.value }))}
                  className={`${CAMPO} mt-1`}
                />
              </label>
            </div>

            <div className="sticky top-0 z-10 -mx-1 mt-3 flex flex-wrap items-center gap-2 bg-slate-50/95 px-1 py-2 backdrop-blur">
              <button
                type="button"
                onClick={gravar}
                disabled={!souAutor || !sujo || !validacao.valido || salvando}
                className={BOTAO_PRIMARIO}
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
              {sujo && <span className="text-xs text-amber-800">alterações não salvas</span>}
              {!validacao.valido && (
                <span className="text-xs font-medium text-red-700">
                  Corrija os erros antes de salvar.
                </span>
              )}
            </div>

            <div className="mt-2">
              <EditorCriterio
                parametros={rascunho.parametros}
                aoMudar={mudarParametro}
                problemas={validacao.porParametro}
                somenteLeitura={!souAutor}
              />
            </div>
          </div>
        )}

        {!carregando && criterios.length === 0 && (
          <p className="mt-6 rounded-md border border-slate-200 bg-white px-3 py-4 text-sm text-slate-600">
            Nenhum conjunto ainda. Crie o primeiro em <strong>+ Novo</strong>: ele nasce usando a
            tabela do sistema em tudo, e você personaliza só os parâmetros que quiser mudar.
          </p>
        )}
      </div>

      {aviso && (
        <div className="fixed inset-x-0 bottom-4 z-[1200] flex justify-center px-3">
          <p role="status" className="rounded-md bg-slate-900/90 px-3 py-1.5 text-xs text-white shadow">
            {aviso}
          </p>
        </div>
      )}
    </div>
  )
}
