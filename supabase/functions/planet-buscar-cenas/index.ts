import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Lista as cenas PlanetScope mais recentes cobrindo um ponto (a gleba ou o
// talhao selecionado no Monitoramento).
//
// So a busca, de proposito: a conta ainda nao tem permissao de asset (ver
// planet-mosaicos), entao isto e o unico dado real que da pra mostrar hoje
// - data e nuvem de cada cena, sem imagem nenhuma. Quando a permissao vier,
// o passo seguinte e pedir o tile de cada `id` que isto devolve.
Deno.serve(async (req: Request) => {
  const apiKey = Deno.env.get("PLANET_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ erro: "PLANET_API_KEY não configurada no projeto." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let lat: number, lng: number;
  try {
    const corpo = await req.json();
    lat = Number(corpo.lat);
    lng = Number(corpo.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("lat/lng inválidos");
  } catch {
    return new Response(JSON.stringify({ erro: "Envie { lat, lng } no corpo da requisição." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ~300 m de folga ao redor do ponto - suficiente pra achar cenas que
  // cobrem a gleba sem virar uma busca regional.
  const d = 0.003;
  const poligono = {
    type: "Polygon",
    coordinates: [[
      [lng - d, lat - d],
      [lng + d, lat - d],
      [lng + d, lat + d],
      [lng - d, lat + d],
      [lng - d, lat - d],
    ]],
  };

  const hoje = new Date();
  const centoEVinteDiasAtras = new Date(hoje.getTime() - 120 * 24 * 60 * 60 * 1000);

  const corpoBusca = {
    item_types: ["PSScene"],
    filter: {
      type: "AndFilter",
      config: [
        { type: "GeometryFilter", field_name: "geometry", config: poligono },
        {
          type: "DateRangeFilter",
          field_name: "acquired",
          config: { gte: centoEVinteDiasAtras.toISOString(), lte: hoje.toISOString() },
        },
      ],
    },
  };

  try {
    const resposta = await fetch(
      "https://api.planet.com/data/v1/quick-search?_page_size=15&_sort=acquired%20desc",
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(apiKey + ":"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(corpoBusca),
      },
    );

    const corpo = await resposta.json();

    if (!resposta.ok) {
      return new Response(
        JSON.stringify({ erro: "O Planet recusou a busca.", detalhe: corpo }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const cenas = (corpo.features ?? []).map((f: Record<string, unknown>) => {
      const props = f.properties as Record<string, unknown> | undefined
      return {
        id: f.id,
        adquirida: props?.acquired,
        nuvem: props?.cloud_cover,
      }
    });

    return new Response(JSON.stringify({ cenas }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ erro: "Falha ao contatar o Planet.", detalhe: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
