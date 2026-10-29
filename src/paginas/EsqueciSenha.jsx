import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconeEmail } from '../componentes/icones.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Campo, BotaoPrincipal, Aviso, CabecalhoEntrada } from '../componentes/formulario.jsx'

export default function EsqueciSenha() {
  const { pedirRecuperacaoDeSenha } = useAuth()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await pedirRecuperacaoDeSenha(email)
      setEnviado(true)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="space-y-6">
        <CabecalhoEntrada rotulo="Quase lá" titulo="Verifique seu e-mail" />
        {/* Mesma resposta exista a conta ou não: dizer "e-mail não cadastrado"
            deixaria qualquer um descobrir quem tem conta. */}
        <Aviso tipo="sucesso">
          Se existir uma conta para <strong>{email}</strong>, enviamos um link para criar uma nova senha. Ele vale por
          1 hora.
        </Aviso>
        <Link to="/login" className="block text-center text-sm font-semibold text-solo-300 hover:underline">
          Voltar ao login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-6">
      <CabecalhoEntrada
        rotulo="Recuperar acesso"
        titulo="Esqueci minha senha"
        apoio="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha."
      />

      <Aviso>{erro}</Aviso>

      <Campo
        id="email"
        icone={<IconeEmail />}
        grande
        rotulo="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        disabled={enviando}
      />

      <BotaoPrincipal type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar link'}
      </BotaoPrincipal>

      <p className="text-center text-sm">
        <Link to="/login" className="font-semibold text-solo-300 hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  )
}
