import { useRouteError } from 'react-router-dom'
import ErroFatal from './ErroFatal.jsx'
import { ehSiteDesatualizado } from '../lib/versaoDoSite.js'

/**
 * Erro ao abrir uma tela. Sem isto o roteador mostra a própria página de erro
 * ("Unexpected Application Error!"), em inglês e com detalhes técnicos.
 *
 * O caso comum é o site ter sido publicado de novo com a aba aberta: a tela
 * pedida é de um arquivo que já não existe. O recarregamento automático
 * (`versaoDoSite.js`) resolve na primeira vez; isto aparece quando ele não
 * resolveu (sem internet, por exemplo).
 */
export default function ErroDeRota() {
  const erro = useRouteError()
  if (ehSiteDesatualizado(erro)) {
    return (
      <ErroFatal
        titulo="O site foi atualizado"
        detalhe={'Esta página foi aberta antes da versão nova do site.\nRecarregue para continuar. Se não resolver, confira a conexão com a internet.'}
      />
    )
  }
  return (
    <ErroFatal
      titulo="Não foi possível abrir esta tela"
      detalhe={`Recarregue a página. Se o erro continuar, avise o suporte com esta mensagem:\n${erro?.message ?? String(erro)}`}
    />
  )
}
