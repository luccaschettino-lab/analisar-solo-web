import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

// Convite para a equipe de uma fazenda, por link de uso único.
//
// Corpo (POST):
//   { acao: "ver", token }                         -> fazenda, cargo, quem convidou
//   { acao: "aceitar", token }  + sessão (Bearer)  -> entra na fazenda com a conta logada
//   { acao: "criar-conta", token, nome, email, senha } -> cria a conta e entra
//
// Roda com a service role: o cadastro do site é fechado, e é aqui que uma
// conta nova pode nascer — só com um convite válido. verify_jwt fica
// desligado porque quem ainda não tem conta também abre o link; a sessão,
// quando precisa, é conferida aqui dentro.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responder = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const ROTULO: Record<string, string> = {
  proprietario: "Proprietário",
  agronomo: "Agrônomo",
  editor: "Editor",
  leitor: "Leitor",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Convite = {
  id: string;
  fazenda_id: string;
  papel: string;
  criado_por: string | null;
  expira_em: string;
  usado_em: string | null;
};

/** Convite válido (ou a Response de erro). */
async function buscarConvite(token: string): Promise<{ convite: Convite; fazenda: { id: string; nome: string } } | Response> {
  if (!/^[0-9a-f]{64}$/.test(token)) return responder(404, { erro: "Este link de convite não é válido." });
  const { data: convite } = await admin
    .from("fazenda_convites")
    .select("id, fazenda_id, papel, criado_por, expira_em, usado_em")
    .eq("token", token)
    .maybeSingle();
  if (!convite) return responder(404, { erro: "Este convite não existe mais. Peça um link novo a quem convidou você." });
  if (convite.usado_em) return responder(410, { erro: "Este convite já foi usado. Cada link vale para uma pessoa só; peça um novo." });
  if (Date.parse(convite.expira_em) < Date.now()) return responder(410, { erro: "Este convite venceu (vale 7 dias). Peça um link novo." });
  const { data: fazenda } = await admin.from("fazendas").select("id, nome").eq("id", convite.fazenda_id).maybeSingle();
  if (!fazenda) return responder(404, { erro: "A fazenda deste convite não existe mais." });
  return { convite, fazenda };
}

/** Marca o convite como usado — só se ninguém usou antes (dois cliques ao mesmo tempo). */
async function consumir(conviteId: string, usuarioId: string): Promise<boolean> {
  const { data } = await admin
    .from("fazenda_convites")
    .update({ usado_em: new Date().toISOString(), usado_por: usuarioId })
    .eq("id", conviteId)
    .is("usado_em", null)
    .select("id");
  return Boolean(data?.length);
}

async function entrarNaFazenda(convite: Convite, usuarioId: string) {
  const { error } = await admin
    .from("fazenda_membros")
    .insert({ fazenda_id: convite.fazenda_id, usuario_id: usuarioId, papel: convite.papel });
  if (error) throw new Error("Não foi possível colocar você na fazenda.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return responder(405, { erro: "Use POST." });

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return responder(400, { erro: "Corpo inválido." });
  }
  const acao = String(corpo.acao ?? "");
  const token = String(corpo.token ?? "").trim().toLowerCase();

  const achado = await buscarConvite(token);
  if (achado instanceof Response) return achado;
  const { convite, fazenda } = achado;

  try {
    if (acao === "ver") {
      let convidadoPor: string | null = null;
      if (convite.criado_por) {
        const { data: perfil } = await admin.from("perfis").select("nome, email").eq("id", convite.criado_por).maybeSingle();
        convidadoPor = perfil?.nome || perfil?.email || null;
      }
      return responder(200, {
        fazenda: fazenda.nome,
        papel: convite.papel,
        cargo: ROTULO[convite.papel] ?? convite.papel,
        convidadoPor,
        expiraEm: convite.expira_em,
      });
    }

    if (acao === "aceitar") {
      const cabecalho = req.headers.get("Authorization") ?? "";
      const jwt = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
      const { data: quem } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
      const usuario = quem?.user;
      if (!usuario) return responder(401, { erro: "Entre com a sua conta para aceitar o convite." });

      const { data: jaMembro } = await admin
        .from("fazenda_membros")
        .select("papel")
        .eq("fazenda_id", convite.fazenda_id)
        .eq("usuario_id", usuario.id)
        .maybeSingle();
      if (jaMembro) {
        return responder(200, { fazendaId: fazenda.id, jaMembro: true, cargo: ROTULO[jaMembro.papel] ?? jaMembro.papel });
      }
      if (!(await consumir(convite.id, usuario.id))) return responder(410, { erro: "Este convite acabou de ser usado." });
      await entrarNaFazenda(convite, usuario.id);
      return responder(200, { fazendaId: fazenda.id, cargo: ROTULO[convite.papel] });
    }

    if (acao === "criar-conta") {
      const nome = String(corpo.nome ?? "").trim();
      const email = String(corpo.email ?? "").trim().toLowerCase();
      const senha = String(corpo.senha ?? "");
      if (nome.length < 2 || nome.length > 80) return responder(400, { erro: "Digite o seu nome." });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responder(400, { erro: "E-mail inválido." });
      if (senha.length < 8) return responder(400, { erro: "A senha precisa ter pelo menos 8 caracteres." });

      const { data: criado, error } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true, // o link do convite já é a prova: sem e-mail de confirmação
        user_metadata: { nome },
      });
      if (error || !criado?.user) {
        if (/already|registered|exists/i.test(error?.message ?? "")) {
          return responder(409, { erro: "Este e-mail já tem conta no Moinho. Use \"Já tenho conta\" e entre com ele." });
        }
        if (/password/i.test(error?.message ?? "")) return responder(400, { erro: "Senha fraca demais. Use letras e números." });
        return responder(500, { erro: "Não foi possível criar a conta." });
      }
      const usuarioId = criado.user.id;
      if (!(await consumir(convite.id, usuarioId))) {
        await admin.auth.admin.deleteUser(usuarioId);
        return responder(410, { erro: "Este convite acabou de ser usado." });
      }
      await entrarNaFazenda(convite, usuarioId);
      return responder(200, { fazendaId: fazenda.id, cargo: ROTULO[convite.papel] });
    }

    return responder(400, { erro: "Ação desconhecida." });
  } catch (e) {
    return responder(500, { erro: (e as Error).message || "Erro inesperado." });
  }
});
