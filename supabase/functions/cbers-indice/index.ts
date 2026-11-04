import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { exigirUsuario } from "../_shared/exigirUsuario.ts";
import { calcularIndicesDoTalhao } from "../_shared/indicesCbers.js";

// NDVI, EVI, SAVI e NDWI de um talhao numa cena CBERS-4A MUX do INPE.
//
// Corpo: { cenaId, geometria } (GeoJSON do talhao, em lat/lng).
// Segredo: INPE_EMAIL - o e-mail do cadastro no INPE, exigido para baixar as
// bandas. Nunca vai na resposta nem em mensagem de erro.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responder = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const negado = await exigirUsuario(req);
  if (negado) {
    for (const [k, v] of Object.entries(CORS)) negado.headers.set(k, v);
    return negado;
  }

  const email = Deno.env.get("INPE_EMAIL");
  if (!email) return responder(500, { erro: "INPE_EMAIL não configurada no projeto." });

  let cenaId: string, geometria: unknown;
  try {
    const corpo = await req.json();
    cenaId = String(corpo.cenaId ?? "");
    geometria = corpo.geometria;
    if (!cenaId || !geometria) throw new Error("faltam campos");
  } catch {
    return responder(400, { erro: "Envie { cenaId, geometria } no corpo da requisição." });
  }

  try {
    return responder(200, await calcularIndicesDoTalhao({ cenaId, geometria, email }));
  } catch (e) {
    const status = typeof (e as { status?: number }).status === "number" ? (e as { status: number }).status : 500;
    const mensagem = status === 500 ? "Erro inesperado ao calcular os índices." : (e as Error).message;
    return responder(status, { erro: mensagem });
  }
});
