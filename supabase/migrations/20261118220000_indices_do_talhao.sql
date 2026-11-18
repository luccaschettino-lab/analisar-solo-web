-- Resumo dos índices de satélite por talhão e imagem (2026-11-18).
--
-- O Monitoramento calcula NDVI, EVI, SAVI e NDWI de um talhão numa imagem de
-- satélite (funções sentinel-indice e cbers-indice). Até aqui o resultado
-- vivia só na memória do navegador. Agora o RESUMO de cada cálculo
-- (estatísticas dos quatro índices e a qualidade: quanto do talhão estava sem
-- nuvem) fica guardado, e o gráfico da evolução abre na hora, com o que já foi
-- calculado — por qualquer pessoa da fazenda.
--
-- O mapa pixel a pixel NÃO é guardado (seriam ~150 KB por imagem e talhão):
-- ele é recalculado em segundos quando alguém escolhe a data.

create table public.indices_talhao (
  id            uuid primary key default gen_random_uuid(),
  talhao_id     uuid not null references public.talhoes(id) on delete cascade,
  fonte         text not null check (fonte in ('sentinel', 'cbers')),
  cena_id       text not null,
  data          timestamptz not null,
  estatisticas  jsonb not null,
  qualidade     jsonb not null,
  calculado_em  timestamptz not null default now(),
  unique (talhao_id, fonte, cena_id)
);

comment on table public.indices_talhao is
  'Resumo (estatísticas e qualidade) dos índices NDVI/EVI/SAVI/NDWI de um talhão numa imagem de satélite.';

create index indices_talhao_talhao_data_idx on public.indices_talhao (talhao_id, fonte, data);

alter table public.indices_talhao enable row level security;

create policy "indices do talhao: ler"
  on public.indices_talhao for select to authenticated
  using (public.tem_acesso_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "indices do talhao: criar"
  on public.indices_talhao for insert to authenticated
  with check (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "indices do talhao: editar"
  on public.indices_talhao for update to authenticated
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)))
  with check (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "indices do talhao: apagar"
  on public.indices_talhao for delete to authenticated
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

revoke all on public.indices_talhao from anon;
grant select, insert, update, delete on public.indices_talhao to authenticated;
