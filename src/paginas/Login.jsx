import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Campo, BotaoPrincipal, Aviso } from '../componentes/formulario.jsx'

export default function Login() {
  const { entrar } = useAuth()
  const navegar = useNavigate()
  const local = useLocation()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await entrar(email, senha)
      // Volta para a rota que o usuário tentou abrir antes do login.
      navegar(local.state?.de ?? '/', { replace: true })
    } catch (e) {
      setErro(e.message)
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Entrar</h1>
        <p className="text-sm text-slate-500">Acesse suas análises de solo.</p>
      </header>

      <Aviso>{erro}</Aviso>

      <Campo
        id="email"
        rotulo="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        disabled={enviando}
      />
      <Campo
        id="senha"
        rotulo="Senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="current-password"
        required
        disabled={enviando}
      />

      <BotaoPrincipal type="submit" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </BotaoPrincipal>

      <p className="text-center text-sm text-slate-500">
        Não tem conta?{' '}
        <Link to="/cadastro" className="font-medium text-solo-700 hover:underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  )
}
