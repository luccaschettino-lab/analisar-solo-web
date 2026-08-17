import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// Publishable key (sb_publishable_...), nao a anon key JWT legada.
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Nao lancamos aqui de proposito. Um throw no corpo do modulo acontece
// durante a avaliacao do import, antes de o React montar qualquer coisa —
// nenhum error boundary alcanca esse momento, e o usuario ve tela branca.
// Em vez disso exportamos o erro e deixamos o bootstrap decidir o que
// renderizar (ver src/main.jsx).
export const erroConfiguracao =
  !url || !publishableKey
    ? 'Variáveis de ambiente ausentes: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copie o .env.example para .env e reinicie o servidor de desenvolvimento.'
    : null

export const supabase = erroConfiguracao
  ? null
  : createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // PKCE devolve o token em ?code=... (query string), fora do fragmento.
        // Com o hash router o fragmento ja e nosso (#/login), entao o fluxo
        // implicito (#access_token=...) colidiria com a rota.
        flowType: 'pkce',
        detectSessionInUrl: true,
      },
    })
