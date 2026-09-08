import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Diagnostico: confere o que a conta do Planet enxerga - se a chave e valida,
// e se o plano inclui Mosaics (produto pago a parte, que e o que permite
// pedir tiles de indice pronto - NDVI, NDWI etc. - sem baixar e processar a
// cena bruta). Nao e chamado pelo site; existe pra testar a conta pelo
// terminal sempre que o plano do Planet mudar.
Deno.serve(async (_req: Request) => {
  const apiKey = Deno.env.get("PLANET_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ erro: "PLANET_API_KEY não configurada no projeto." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const autorizacao = "Basic " + btoa(apiKey + ":");

  try {
    const resposta = await fetch("https://api.planet.com/basemaps/v1/mosaics/", {
      headers: { Authorization: autorizacao },
    });

    const corpo = await resposta.json();

    if (!resposta.ok) {
      return new Response(
        JSON.stringify({
          erro: "O Planet recusou a chave, ou a conta não tem acesso a Mosaics.",
          status_planet: resposta.status,
          detalhe: corpo,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const mosaicos = (corpo.mosaics ?? []).map((m: Record<string, unknown>) => ({
      id: m.id,
      nome: m.name,
      tipo: m.interval,
      inicio: m.first_acquired,
      fim: m.last_acquired,
    }));

    return new Response(JSON.stringify({ total: corpo.total_items ?? mosaicos.length, mosaicos }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ erro: "Falha ao contatar o Planet.", detalhe: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
