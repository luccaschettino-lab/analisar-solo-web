import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { validarSenha } from '../lib/senha.js'
import { Campo, BotaoPrincipal, Aviso, CabecalhoEntrada } from '../componentes/formulario.jsx'
import { IconeUsuario, IconeEmail, IconeCadeado, IconeSeta } from '../componentes/icones.jsx'

export default function Cadastro() {
  const { cadastrar } = useAuth()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')

    // Validações locais antes de gastar uma ida ao servidor.
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.')
      return
    }
    const problemaSenha = validarSenha(senha)
    if (problemaSenha) {
      setErro(problemaSenha)
      return
    }

    setEnviando(true)
    try {
      const { precisaConfirmarEmail } = await cadastrar(nome, email, senha)
      if (precisaConfirmarEmail) {
        setAguardandoConfirmacao(true)
        setEnviando(false)
      }
      // Caso contrário a sessão já veio: onAuthStateChange dispara, RotaPublica
      // detecta a sessão e redireciona para o painel. Nada a fazer aqui.
    } catch (e) {
      setErro(e.message)
      setEnviando(false)
    }
  }

  if (aguardandoConfirmacao) {
    return (
      <div className="space-y-6">
        <CabecalhoEntrada rotulo="Quase lá" titulo="Confirme seu e-mail" />
        <Aviso tipo="sucesso">
          Enviamos um link de confirmação para <strong>{email}</strong>. Abra o link para ativar a
          conta e depois faça login.
        </Aviso>
        <Link to="/login" className="block text-center text-sm font-semibold text-solo-300 hover:underline">
          Ir para o login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-5">
      <CabecalhoEntrada rotulo="Comece agora" titulo="Crie sua conta" apoio="Cadastre-se para gerenciar suas fazendas." />

      <Aviso>{erro}</Aviso>

      <Campo
        id="nome"
        icone={<IconeUsuario />}
        grande
        rotulo="Nome"
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        autoComplete="name"
        required
        disabled={enviando}
      />
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
      <Campo
        id="senha"
        icone={<IconeCadeado />}
        grande
        rotulo="Senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
        disabled={enviando}
      />
      <p className="-mt-2 text-xs text-slate-400">
        Mínimo de 8 caracteres, com letras e números.
      </p>
      <Campo
        id="confirmacao"
        icone={<IconeCadeado />}
        grande
        rotulo="Confirmar senha"
        type="password"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        autoComplete="new-password"
        required
        disabled={enviando}
      />

      <BotaoPrincipal type="submit" tom="folha" grande disabled={enviando}>
        {enviando ? (
          'Criando conta…'
        ) : (
          <>
            Criar conta <IconeSeta />
          </>
        )}
      </BotaoPrincipal>

    </form>
  )
}
