import { useMemo } from 'react'
import FormFazenda from './FormFazenda.jsx'
import FormTalhao from './FormTalhao.jsx'
import FormGleba from './FormGleba.jsx'
import EscolherTipoGleba from './EscolherTipoGleba.jsx'
import GlebasEmLote from './GlebasEmLote.jsx'
import ImportarArquivo from './ImportarArquivo.jsx'
import ImportarGlebas from './ImportarGlebas.jsx'
import MesclarTalhoes from './MesclarTalhoes.jsx'
import ConfirmarExclusao from '../../componentes/ConfirmarExclusao.jsx'
import Modal from '../../componentes/Modal.jsx'
import { glebasDoTalhao } from '../../hooks/useHierarquia.js'
import { pontosNaGleba } from '../../lib/pontosDeColeta.js'
import { usePontosColeta } from './usePontosColeta.js'
import PontosColetaNoMapa from './PontosColetaNoMapa.jsx'

/**
 * Todos os diálogos do painel. Ficam juntos porque nenhum deles tem estado
 * próprio relevante — são funções do estado que os hooks já mantêm — e
 * espalhá-los pelo Painel só fazia a árvore de JSX crescer.
 */
export default function ModaisDoPainel({
  fazendaSelecionada,
  talhoes,
  glebas,
  mapa,
  criacao,
  item,
  aplicarFazenda,
  aplicarTalhao,
  aplicarTalhoes,
  removerTalhao,
  aplicarGleba,
  aplicarGlebas,
  mostrarAviso,
  formFazenda,
  aoFecharFormFazenda,
  aoSelecionarFazenda,
  confirmandoFazenda,
  aoFecharConfirmacaoFazenda,
  aoConfirmarExclusaoFazenda,
  importandoArquivo,
  aoFecharImportarArquivo,
  importandoGlebas,
  aoFecharImportarGlebas,
  mesclandoTalhoes,
  aoFecharMesclarTalhoes,
  aoMudarPontosAmostra,
}) {
  const talhaoPontosId =
    criacao.talhaoDaEscolha?.id ??
    (criacao.desenhando?.tipo === 'gleba-pontos' ||
    criacao.pendente?.tipo === 'gleba-pontos'
      ? criacao.desenhando?.talhaoId ?? criacao.pendente?.talhaoId
      : null)
  const {
    pontos: pontosColeta,
    carregando: carregandoPontosColeta,
    erro: erroPontosColeta,
  } = usePontosColeta(talhaoPontosId)
  const pontosAgrupados = useMemo(
    () =>
      criacao.pendente?.tipo === 'gleba-pontos'
        ? pontosNaGleba(pontosColeta, criacao.pendente.geometria)
        : [],
    [pontosColeta, criacao.pendente],
  )

  return (
    <>
      {formFazenda && (
        <FormFazenda
          fazenda={formFazenda === 'editar' ? fazendaSelecionada : null}
          aoFechar={aoFecharFormFazenda}
          aoSalvar={(f) => {
            aplicarFazenda(f)
            aoSelecionarFazenda(f.id)
            aoFecharFormFazenda()
          }}
        />
      )}

      {criacao.talhaoDaEscolha && (
        <EscolherTipoGleba
          talhao={criacao.talhaoDaEscolha}
          pontosDisponiveis={pontosColeta.filter((ponto) => !ponto.gleba_id).length}
          carregandoPontos={carregandoPontosColeta}
          erroPontos={erroPontosColeta}
          aoEscolher={criacao.escolherForma}
          aoFechar={criacao.fecharEscolha}
        />
      )}

      {(criacao.desenhando?.tipo === 'gleba-pontos' ||
        criacao.pendente?.tipo === 'gleba-pontos') && (
        <PontosColetaNoMapa
          mapa={mapa}
          pontos={pontosColeta}
          pontosAgrupados={pontosAgrupados}
          carregando={carregandoPontosColeta}
          erro={erroPontosColeta}
          desenhando={criacao.desenhando?.tipo === 'gleba-pontos'}
          aoCancelar={
            criacao.desenhando?.tipo === 'gleba-pontos'
              ? criacao.abortar
              : criacao.fecharPendente
          }
        />
      )}

      {criacao.talhaoDoLote && (
        <GlebasEmLote
          talhao={criacao.talhaoDoLote}
          glebasExistentes={glebasDoTalhao(glebas, criacao.talhaoDoLote.id)}
          mapa={mapa}
          aoFechar={criacao.fecharLote}
          aoSalvar={(criadas) => {
            aplicarGlebas(criadas)
            criacao.fecharLote()
            mostrarAviso(
              `${criadas.length} ${criadas.length === 1 ? 'gleba criada' : 'glebas criadas'} no talhão ${criacao.talhaoDoLote.codigo}.`,
            )
          }}
        />
      )}

      {importandoArquivo && fazendaSelecionada && (
        <ImportarArquivo
          fazendaId={fazendaSelecionada.id}
          talhoes={talhoes}
          aoFechar={aoFecharImportarArquivo}
          aoImportado={({ talhoes: novosTalhoes }) => {
            if (novosTalhoes.length) aplicarTalhoes(novosTalhoes)
            mostrarAviso(
              `${novosTalhoes.length} ${novosTalhoes.length === 1 ? 'talhão importado' : 'talhões importados'}.`,
            )
          }}
        />
      )}

      {importandoGlebas && fazendaSelecionada && (
        <ImportarGlebas
          fazendaId={fazendaSelecionada.id}
          talhoes={talhoes}
          glebas={glebas}
          aoFechar={aoFecharImportarGlebas}
          aoImportado={({ glebas: novasGlebas, pontosLigados }) => {
            if (novasGlebas.length) aplicarGlebas(novasGlebas)
            mostrarAviso(
              `${novasGlebas.length} ${novasGlebas.length === 1 ? 'gleba importada' : 'glebas importadas'}` +
                (pontosLigados ? `, com ${pontosLigados} ${pontosLigados === 1 ? 'ponto de amostra ligado' : 'pontos de amostra ligados'}.` : '.'),
            )
          }}
        />
      )}

      {mesclandoTalhoes && (
        <MesclarTalhoes
          talhoes={talhoes}
          glebas={glebas}
          aoFechar={aoFecharMesclarTalhoes}
          aoMesclado={({ talhao, glebasMovidas, removidos, analisesMovidas, pontosMovidos }) => {
            aplicarTalhao(talhao)
            // Glebas antes de remover os talhões: removerTalhao tira do estado
            // as glebas que ainda apontam para o talhão apagado.
            if (glebasMovidas.length) aplicarGlebas(glebasMovidas)
            for (const id of removidos) removerTalhao(id)
            if (pontosMovidos > 0) aoMudarPontosAmostra?.()
            const levados = [
              glebasMovidas.length && `${glebasMovidas.length} ${glebasMovidas.length === 1 ? 'gleba' : 'glebas'}`,
              analisesMovidas && `${analisesMovidas} ${analisesMovidas === 1 ? 'análise' : 'análises'}`,
              pontosMovidos && `${pontosMovidos} ${pontosMovidos === 1 ? 'ponto de coleta' : 'pontos de coleta'}`,
            ].filter(Boolean)
            mostrarAviso(
              `Talhão ${talhao.codigo} criado a partir da mesclagem de ${removidos.length + 1} talhões` +
                (levados.length ? `, com ${levados.join(', ')} trazidos dos outros.` : '.'),
            )
          }}
        />
      )}

      {criacao.pendente?.tipo === 'talhao' && fazendaSelecionada && (
        <FormTalhao
          fazendaId={fazendaSelecionada.id}
          geometria={criacao.pendente.geometria}
          aoFechar={criacao.fecharPendente}
          aoSalvar={(talhao) => {
            aplicarTalhao(talhao)
            criacao.fecharPendente()
            item.selecionar({ tipo: 'talhao', id: talhao.id })
            mostrarAviso(`Talhão ${talhao.codigo} criado.`)
          }}
        />
      )}

      {criacao.pendente?.tipo === 'gleba' && criacao.talhaoPendente && (
        <FormGleba
          talhao={criacao.talhaoPendente}
          geometria={criacao.pendente.geometria}
          aoFechar={criacao.fecharPendente}
          aoSalvar={(gleba) => {
            aplicarGleba(gleba)
            criacao.fecharPendente()
            item.selecionar({ tipo: 'gleba', id: gleba.id })
            mostrarAviso(`Gleba ${gleba.codigo} criada.`)
          }}
        />
      )}

      {criacao.pendente?.tipo === 'gleba-pontos' && criacao.talhaoPendente && (
        <FormGleba
          talhao={criacao.talhaoPendente}
          geometria={criacao.pendente.geometria}
          pontosColetaIds={pontosAgrupados.map((ponto) => ponto.id)}
          carregandoPontosColeta={carregandoPontosColeta}
          erroPontosColeta={erroPontosColeta}
          aoFechar={criacao.fecharPendente}
          aoSalvar={(gleba) => {
            aplicarGleba(gleba)
            criacao.fecharPendente()
            item.selecionar({ tipo: 'gleba', id: gleba.id })
            mostrarAviso(
              `Gleba ${gleba.codigo} criada com ${pontosAgrupados.length} ponto(s) de amostra.`,
            )
          }}
        />
      )}

      {/* A geometria foi desenhada mas o talhão sumiu — apagado em outra aba,
          ou fazenda trocada no meio do fluxo. Sem isto a combinação não
          renderizava nada: o desenho era engolido em silêncio e a pessoa
          ficava olhando o mapa sem entender. */}
      {criacao.pendente?.tipo === 'gleba' && !criacao.talhaoPendente && (
        <Modal titulo="Talhão não encontrado" aoFechar={criacao.fecharPendente}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            O desenho foi concluído, mas o talhão a que ele pertenceria não está mais na lista —
            ele pode ter sido apagado em outra aba, ou a fazenda foi trocada no meio do caminho.
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            A gleba <strong>não foi criada</strong>. Recarregue a página e desenhe de novo.
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={criacao.fecharPendente}
              className="rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800"
            >
              Entendi
            </button>
          </div>
        </Modal>
      )}

      {item.editandoDados === 'talhao' && item.itemSelecionado && fazendaSelecionada && (
        <FormTalhao
          talhao={item.itemSelecionado}
          aoFechar={item.fecharEdicaoDados}
          aoSalvar={(talhao) => {
            aplicarTalhao(talhao)
            item.fecharEdicaoDados()
            mostrarAviso(`Talhão ${talhao.codigo} atualizado.`)
          }}
        />
      )}

      {item.editandoDados === 'gleba' && item.itemSelecionado && (
        <FormGleba
          talhao={item.talhaoPai}
          gleba={item.itemSelecionado}
          aoFechar={item.fecharEdicaoDados}
          aoSalvar={(gleba) => {
            aplicarGleba(gleba)
            item.fecharEdicaoDados()
            mostrarAviso(`Gleba ${gleba.codigo} atualizada.`)
          }}
        />
      )}

      {item.divisaPendente && (
        <DialogoDaDivisa
          plano={item.divisaPendente.plano}
          aoLevarJunto={() => item.confirmarDivisa(true)}
          aoSoEsta={() => item.confirmarDivisa(false)}
          aoVoltar={item.voltarAEditar}
        />
      )}

      {item.descartePendente && (
        <Modal titulo="Descartar o que você mexeu?" aoFechar={item.continuarEditando}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Você arrastou vértices da {item.descartePendente.rotulo} e ainda não gravou. Se for para
              outro item, essas alterações são perdidas.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={item.descartarEIr}
                className="rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Descartar e ir
              </button>
              <button
                onClick={item.continuarEditando}
                autoFocus
                className="rounded-md bg-solo-700 px-3 py-2 text-sm font-medium text-white hover:bg-solo-800 dark:bg-solo-600 dark:hover:bg-solo-700"
              >
                Continuar editando
              </button>
            </div>
          </div>
        </Modal>
      )}

      {item.confirmandoItem && item.itemSelecionado && (
        <ConfirmarExclusao
          titulo={`Excluir ${item.selecionado.tipo === 'talhao' ? 'talhão' : 'gleba'} ${item.itemSelecionado.codigo}?`}
          descricao={
            item.selecionado.tipo === 'gleba'
              ? 'As análises e os pontos de coleta dela continuam no talhão; só a gleba sai. Não há como desfazer.'
              : 'Não há como desfazer.'
          }
          consequencias={item.confirmandoItem.consequencias}
          aoFechar={item.fecharExclusao}
          aoConfirmar={item.confirmarExclusao}
        />
      )}

      {confirmandoFazenda && fazendaSelecionada && (
        <ConfirmarExclusao
          titulo={`Excluir "${fazendaSelecionada.nome}"?`}
          descricao="A fazenda e tudo que está dentro dela serão apagados. Não há como desfazer."
          consequencias={[
            { rotulo: 'talhões', quantidade: confirmandoFazenda.talhoes },
            { rotulo: 'glebas', quantidade: confirmandoFazenda.glebas },
            { rotulo: 'análises', quantidade: confirmandoFazenda.analises },
            { rotulo: 'pontos de coleta', quantidade: confirmandoFazenda.pontos },
          ]}
          aoFechar={aoFecharConfirmacaoFazenda}
          aoConfirmar={aoConfirmarExclusaoFazenda}
        />
      )}
    </>
  )
}

/**
 * A divisa que a pessoa moveu também é de outras glebas. Levar junto mantém as
 * duas coladas; gravar só esta deixa um buraco entre elas. Se alguma vizinha
 * ficaria com a linha cruzada, não dá para levar junto, e o diálogo diz isso.
 */
function DialogoDaDivisa({ plano, aoLevarJunto, aoSoEsta, aoVoltar }) {
  const codigos = (lista) => lista.map((v) => v.gleba.codigo).join(', ')
  const impossivel = plano.invalidas.length > 0
  const botao = 'rounded-md px-3 py-2 text-sm font-medium'

  return (
    <Modal titulo="Esta divisa é compartilhada" aoFechar={aoVoltar}>
      <div className="space-y-4">
        {impossivel ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            O que você moveu também é divisa da gleba <strong>{codigos([...plano.afetadas, ...plano.invalidas])}</strong>, mas
            levar a divisa para a gleba <strong>{codigos(plano.invalidas)}</strong> faria a linha dela cruzar a si mesma.
            Mova um pouco menos, ou grave só esta gleba (isso deixa um buraco entre as duas).
          </p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            O que você moveu também é divisa da gleba <strong>{codigos(plano.afetadas)}</strong>. Levando a divisa junto, elas
            continuam coladas. Gravando só esta, abre-se um buraco entre as duas.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={aoSoEsta}
            className={`${botao} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10`}
          >
            Só nesta gleba
          </button>
          {impossivel ? (
            <button onClick={aoVoltar} autoFocus className={`${botao} bg-solo-700 text-white hover:bg-solo-800 dark:bg-solo-600 dark:hover:bg-solo-700`}>
              Voltar a editar
            </button>
          ) : (
            <>
              <button onClick={aoVoltar} className={`${botao} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10`}>
                Voltar a editar
              </button>
              <button onClick={aoLevarJunto} autoFocus className={`${botao} bg-solo-700 text-white hover:bg-solo-800 dark:bg-solo-600 dark:hover:bg-solo-700`}>
                Mover nas vizinhas também
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
