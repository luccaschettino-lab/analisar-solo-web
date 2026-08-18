import { GRUPOS, PROFUNDIDADES } from '../../config/parametros.js'
import { parametro, parametrosDoGrupo } from '../../lib/parametros.js'

const SELECT =
  'mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50 disabled:text-slate-400'

function Campo({ id, rotulo, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {rotulo}
      </label>
      {children}
    </div>
  )
}

function SeletorParametro({ id, valor, aoMudar }) {
  return (
    <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} className={SELECT}>
      <option value="">Selecione…</option>
      {GRUPOS.map((grupo) => (
        <optgroup key={grupo.chave} label={grupo.rotulo}>
          {parametrosDoGrupo(grupo.chave).map((p) => (
            <option key={p.chave} value={p.chave}>
              {p.rotulo}
              {p.unidade ? ` (${p.unidade})` : ''}
              {/* Sem faixa no config, o parâmetro ainda compara — só não
                  classifica, e o limiar de estabilidade cai para zero. */}
              {p.faixas ? '' : ' — sem classificação'}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

/**
 * Os seletores da comparação: fazenda, os dois anos, profundidade e parâmetro.
 *
 * A fazenda também aparece na barra lateral e é o mesmo estado — o
 * `FazendaContext` guarda um só. Duas entradas para a mesma coisa se justifica
 * porque no celular a barra é uma gaveta fechada, e trocar de fazenda no meio
 * de uma comparação não deveria exigir abrir outro painel.
 *
 * A validação de anos iguais chega pronta em `erroAnos`: quem decide é o
 * `useFiltroComparacao`, e a tela só mostra.
 */
export default function FiltrosComparacao({
  fazendas,
  idFazenda,
  aoSelecionarFazenda,
  carregandoFazendas,
  filtro,
  aoMudar,
  aoInverter,
  anos,
  carregandoAnalises,
  erroFazendas,
  erroHierarquia,
  erroAnalises,
  erroAnos,
}) {
  // Um lugar só para as três cargas que podem falhar. Cada uma quebra uma
  // parte diferente da tela, e duas delas falhavam em silêncio: sem a lista de
  // fazendas ou sem as glebas, a tela dizia "não tem" onde o certo era "não
  // deu para saber".
  const erros = [erroFazendas, erroHierarquia, erroAnalises].filter(Boolean)

  const semAnalises = !carregandoAnalises && anos.length === 0
  const escolhido = parametro(filtro.chaveParametro)
  const podeInverter = Boolean(filtro.anoA && filtro.anoB && filtro.anoA !== filtro.anoB)

  // O estado de carregamento e o de lista vazia moram no texto do placeholder,
  // não numa opção extra: duas opções com valor vazio no mesmo select fazem o
  // navegador escolher a primeira e a segunda virar item morto.
  const textoVazio = carregandoAnalises ? 'carregando…' : semAnalises ? 'sem análises' : 'Selecione…'

  const opcoesDeAno = anos.map((ano) => (
    <option key={ano} value={ano}>
      {ano}
    </option>
  ))

  return (
    <section className="border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
      {erros.length > 0 && (
        <ul role="alert" className="mb-2 space-y-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
        <Campo id="comparar-fazenda" rotulo="Fazenda">
          <select
            id="comparar-fazenda"
            value={idFazenda ?? ''}
            onChange={(e) => aoSelecionarFazenda(e.target.value)}
            disabled={carregandoFazendas || fazendas.length === 0}
            className={SELECT}
          >
            <option value="">
              {carregandoFazendas ? 'carregando…' : fazendas.length ? 'selecione…' : 'nenhuma fazenda'}
            </option>
            {fazendas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="comparar-ano-a" rotulo="Ano A (antes)">
          <select
            id="comparar-ano-a"
            value={filtro.anoA}
            onChange={(e) => aoMudar('anoA', e.target.value)}
            disabled={carregandoAnalises || semAnalises}
            className={SELECT}
          >
            <option value="">{textoVazio}</option>
            {opcoesDeAno}
          </select>
        </Campo>

        <Campo id="comparar-ano-b" rotulo="Ano B (depois)">
          <select
            id="comparar-ano-b"
            value={filtro.anoB}
            onChange={(e) => aoMudar('anoB', e.target.value)}
            disabled={carregandoAnalises || semAnalises}
            className={SELECT}
          >
            <option value="">{textoVazio}</option>
            {opcoesDeAno}
          </select>
        </Campo>

        <Campo id="comparar-profundidade" rotulo="Profundidade (cm)">
          <select
            id="comparar-profundidade"
            value={filtro.profundidade}
            onChange={(e) => aoMudar('profundidade', e.target.value)}
            className={SELECT}
          >
            <option value="">Selecione…</option>
            {PROFUNDIDADES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="comparar-parametro" rotulo="Parâmetro">
          <SeletorParametro
            id="comparar-parametro"
            valor={filtro.chaveParametro}
            aoMudar={(v) => aoMudar('chaveParametro', v)}
          />
        </Campo>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={aoInverter}
          disabled={!podeInverter}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          ⇄ Inverter os anos
        </button>

        {erroAnos && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {erroAnos}
          </p>
        )}

        {/* Aviso que muda a leitura do mapa inteiro: sem faixa, o limiar de
            estabilidade é zero e qualquer diferença vira cor. */}
        {escolhido && !escolhido.faixas && (
          <p className="text-xs text-amber-800">
            {escolhido.rotulo} não tem faixa de classificação. A variação é calculada normalmente,
            mas sem limiar de estabilidade — qualquer diferença aparece colorida — e a coluna de
            classificação fica vazia.
          </p>
        )}
      </div>
    </section>
  )
}
