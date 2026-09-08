import FormFazenda from './FormFazenda.jsx'
import FormTalhao from './FormTalhao.jsx'
import ImportarArquivo from './ImportarArquivo.jsx'
import MesclarTalhoes from './MesclarTalhoes.jsx'
import ConfirmarExclusao from '../../componentes/ConfirmarExclusao.jsx'

/**
 * Todos os diálogos do painel. Ficam juntos porque nenhum deles tem estado
 * próprio relevante — são funções do estado que os hooks já mantêm — e
 * espalhá-los pelo Painel só fazia a árvore de JSX crescer.
 */
export default function ModaisDoPainel({
  fazendaSelecionada,
  talhoes,
  item,
  aplicarFazenda,
  aplicarTalhao,
  aplicarTalhoes,
  removerTalhao,
  mostrarAviso,
  formFazenda,
  aoFecharFormFazenda,
  aoSelecionarFazenda,
  confirmandoFazenda,
  aoFecharConfirmacaoFazenda,
  aoConfirmarExclusaoFazenda,
  importandoArquivo,
  aoFecharImportarArquivo,
  mesclandoTalhoes,
  aoFecharMesclarTalhoes,
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

      {mesclandoTalhoes && (
        <MesclarTalhoes
          talhoes={talhoes}
          aoFechar={aoFecharMesclarTalhoes}
          aoMesclado={({ talhao, removidos }) => {
            aplicarTalhao(talhao)
            for (const id of removidos) removerTalhao(id)
            mostrarAviso(`Talhão ${talhao.codigo} criado a partir da mesclagem de ${removidos.length + 1} talhões.`)
          }}
        />
      )}

      {item.editandoDados && item.itemSelecionado && fazendaSelecionada && (
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

      {item.confirmandoItem && item.itemSelecionado && (
        <ConfirmarExclusao
          titulo={`Excluir talhão ${item.itemSelecionado.codigo}?`}
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
