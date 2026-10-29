import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Campo, BotaoPrincipal, Aviso, CabecalhoEntrada } from '../componentes/formulario.jsx'
import { IconeEmail, IconeCadeado, IconeSeta } from '../componentes/icones.jsx'

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
    <form onSubmit={aoEnviar} className="space-y-6">
      <CabecalhoEntrada
        rotulo="Bem-vindo de volta"
        titulo="Acesse sua conta"
        apoio="Suas fazendas, glebas e análises em um só lugar."
      />

      <Aviso>{erro}</Aviso>

      <Campo
        id="email"
        rotulo="E-mail"
        type="email"
        icone={<IconeEmail />}
        grande
        placeholder="voce@fazenda.com.br"
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
        icone={<IconeCadeado />}
        grande
        placeholder="Sua senha"
        acao={
          <Link to="/esqueci-senha" className="text-sm font-semibold text-solo-300 hover:underline">
            Esqueceu a senha?
          </Link>
        }
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="current-password"
        required
        disabled={enviando}
      />

      <BotaoPrincipal type="submit" tom="folha" grande disabled={enviando}>
        {enviando ? (
          'Entrando…'
        ) : (
          <>
            Entrar <IconeSeta />
          </>
        )}
      </BotaoPrincipal>
    </form>
  )
}
