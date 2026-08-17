import FormFazenda from './FormFazenda.jsx'
import FormTalhao from './FormTalhao.jsx'
import FormGleba from './FormGleba.jsx'
import EscolherTipoGleba from './EscolherTipoGleba.jsx'
import GlebasEmLote from './GlebasEmLote.jsx'
import ConfirmarExclusao from '../../componentes/ConfirmarExclusao.jsx'
import { glebasDoTalhao } from '../../hooks/useHierarquia.js'

/**
 * Todos os diálogos do painel. Ficam juntos porque nenhum deles tem estado
 * próprio relevante — são funções do estado que os hooks já mantêm — e
 * espalhá-los pelo Painel só fazia a árvore de JSX crescer.
 */
export default function ModaisDoPainel({
  fazendaSelecionada,
  glebas,
  mapa,
  criacao,
  item,
  aplicarFazenda,
  aplicarTalhao,
  aplicarGleba,
  aplicarGlebas,
  mostrarAviso,
  formFazenda,
  aoFecharFormFazenda,
  aoSelecionarFazenda,
  confirmandoFazenda,
  aoFecharConfirmacaoFazenda,
  aoConfirmarExclusaoFazenda,
}) {
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
          aoEscolher={criacao.escolherForma}
          aoFechar={criacao.fecharEscolha}
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

      {item.editandoDados === 'talhao' && item.itemSelecionado && fazendaSelecionada && (
        <FormTalhao
          fazendaId={fazendaSelecionada.id}
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

      {item.confirmandoItem && item.itemSelecionado && (
        <ConfirmarExclusao
          titulo={`Excluir ${item.selecionado.tipo === 'talhao' ? 'talhão' : 'gleba'} ${item.itemSelecionado.codigo}?`}
          descricao="Não há como desfazer."
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
          ]}
          aoFechar={aoFecharConfirmacaoFazenda}
          aoConfirmar={aoConfirmarExclusaoFazenda}
        />
      )}
    </>
  )
}
