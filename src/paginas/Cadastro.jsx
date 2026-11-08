import { Link } from 'react-router-dom'
import { Aviso, CabecalhoEntrada } from '../componentes/formulario.jsx'

/**
 * O cadastro público foi fechado (auditoria de 2026-11-07, P8): com ele
 * aberto, qualquer pessoa na internet criava conta e usava o armazenamento, o
 * envio de e-mails e a conta do INPE do projeto. Agora a conta nasce por
 * convite (Supabase > Authentication > Users > Invite user) e a pessoa cria a
 * senha pelo link do e-mail (ver `NovaSenha.jsx`).
 *
 * A rota continua existindo só para quem tiver o endereço antigo salvo.
 */
export default function Cadastro() {
  return (
    <div className="space-y-6">
      <CabecalhoEntrada
        rotulo="Acesso"
        titulo="Acesso só por convite"
        apoio="Novas contas são criadas por quem administra o sistema."
      />
      <Aviso tipo="info">
        Peça um convite ao responsável pela sua fazenda. Você vai receber um e-mail com um link para criar a sua senha.
      </Aviso>
      <Link to="/login" className="block text-center text-sm font-semibold text-solo-300 hover:underline">
        Já tenho conta: entrar
      </Link>
    </div>
  )
}
