import { Component } from 'react'
import ErroFatal from './ErroFatal.jsx'

// Precisa ser class component: React nao oferece equivalente em hooks para
// componentDidCatch. Captura erros lancados durante render, em efeitos e em
// construtores da arvore abaixo — nao captura erro assincrono solto nem erro
// de avaliacao de modulo (esse ultimo e tratado no main.jsx).
export default class ErrorBoundary extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    // Mantem o rastro completo no console para quem estiver depurando,
    // enquanto a tela mostra so a mensagem legivel.
    console.error('Erro nao tratado na aplicacao:', erro, info)
  }

  render() {
    if (this.state.erro) {
      return (
        <ErroFatal
          titulo="Algo quebrou"
          detalhe={
            (this.state.erro.message || String(this.state.erro)) +
            '\n\nSe o problema continuar, recarregue a página.'
          }
        />
      )
    }
    return this.props.children
  }
}
