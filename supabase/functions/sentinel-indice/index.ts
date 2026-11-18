import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { exigirUsuario } from "../_shared/exigirUsuario.ts";
import { calcularIndicesSentinel } from "../_shared/indicesSentinel.js";

// NDVI, EVI, SAVI e NDWI de um talhao numa cena Sentinel-2 L2A (Earth Search,
// repositorio publico da AWS). Sem segredo: os arquivos sao abertos.
//
// Corpo: { cenaId, geometria } (GeoJSON do talhao, em lat/lng).
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
    return responder(200, await calcularIndicesSentinel({ cenaId, geometria }));
  } catch (e) {
    const status = typeof (e as { status?: number }).status === "number" ? (e as { status: number }).status : 500;
    const mensagem = status === 500 ? "Erro inesperado ao calcular os índices." : (e as Error).message;
    return responder(status, { erro: mensagem });
  }
});
