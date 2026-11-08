import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { validarSenha } from '../lib/senha.js'
import { Campo, BotaoPrincipal, Aviso, CabecalhoEntrada } from '../componentes/formulario.jsx'

/**
 * Destino do link do e-mail de "Esqueci minha senha".
 *
 * O link abre uma sessão só para isto: enquanto `recuperando` estiver ligado,
 * as guardas de rota mandam para cá. Aberta sem link, a página leva ao login
 * (ou ao mapa, se já houver sessão comum). Link vencido ou já usado não abre
 * sessão: a página diz isso e oferece pedir outro.
 */
export default function NovaSenha() {
  const { sessao, recuperando, carregando, erroRecuperacao, definirNovaSenha, cancelarRecuperacao } = useAuth()
  const navegar = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (carregando) return <p className="text-center text-sm text-slate-400">Carregando…</p>

  if (!sessao && (recuperando || erroRecuperacao)) {
    return (
      <div className="space-y-6">
        <CabecalhoEntrada rotulo="Recuperar acesso" titulo="Link inválido" />
        <Aviso>{erroRecuperacao ?? 'Este link venceu ou já foi usado. Peça um novo.'}</Aviso>
        <Link
          to="/esqueci-senha"
          onClick={() => cancelarRecuperacao()}
          className="block text-center text-sm font-semibold text-solo-300 hover:underline"
        >
          Pedir um novo link
        </Link>
      </div>
    )
  }

  if (!recuperando) return <Navigate to={sessao ? '/' : '/login'} replace />

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.')
      return
    }
    const problema = validarSenha(senha)
    if (problema) {
      setErro(problema)
      return
    }
    setEnviando(true)
    try {
      await definirNovaSenha(senha)
      navegar('/', { replace: true })
    } catch (e) {
      setErro(e.message)
      setEnviando(false)
    }
  }

  async function desistir() {
    setEnviando(true)
    try {
      await cancelarRecuperacao()
    } finally {
      navegar('/login', { replace: true })
    }
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-6">
      <CabecalhoEntrada
        rotulo="Recuperar acesso"
        titulo="Criar nova senha"
        apoio={`Escolha a senha que você vai usar daqui para frente${sessao?.user?.email ? ` em ${sessao.user.email}` : ''}.`}
      />

      <Aviso>{erro}</Aviso>

      <div className="space-y-2">
        <Campo
          id="nova-senha"
          grande
          rotulo="Nova senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          disabled={enviando}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">Mínimo de 8 caracteres, com letras e números.</p>
      </div>
      <Campo
        id="confirmar-nova-senha"
        grande
        rotulo="Confirmar nova senha"
        type="password"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        autoComplete="new-password"
        required
        disabled={enviando}
      />

      <BotaoPrincipal type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Salvar nova senha'}
      </BotaoPrincipal>

      <p className="text-center text-sm">
        <button
          type="button"
          onClick={desistir}
          disabled={enviando}
          className="font-semibold text-solo-300 hover:underline disabled:opacity-50"
        >
          Cancelar e voltar ao login
        </button>
      </p>
    </form>
  )
}
