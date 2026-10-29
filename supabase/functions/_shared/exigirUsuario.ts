// Barra chamadas de quem nao e um usuario logado.
//
// A chave publishable vai embutida no site, entao qualquer pessoa a tem: sem
// esta checagem, qualquer um poderia chamar as funcoes do Planet e gastar a
// cota da conta. O token de um usuario logado e o que as separa - a chave
// publishable sozinha nao e uma sessao e o Auth recusa.
//
// Devolve null quando esta tudo certo, ou a Response de erro pronta para
// retornar.
export async function exigirUsuario(req: Request): Promise<Response | null> {
  const negar = (status: number, erro: string) =>
    new Response(JSON.stringify({ erro }), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const cabecalho = req.headers.get("Authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
  if (!token) return negar(401, "Faça login para usar esta função.");

  const url = Deno.env.get("SUPABASE_URL");
  const chave = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !chave) return negar(500, "Função sem acesso ao Supabase Auth.");

  try {
    const resposta = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: chave },
    });
    if (!resposta.ok) return negar(401, "Sessão inválida ou expirada.");
    const usuario = await resposta.json();
    if (!usuario?.id) return negar(401, "Sessão inválida ou expirada.");
  } catch {
    return negar(502, "Não foi possível validar a sessão.");
  }

  return null;
}
