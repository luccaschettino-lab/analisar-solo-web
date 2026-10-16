create table public.pontos_coleta (
  id uuid primary key default gen_random_uuid(),
  talhao_id uuid not null references public.talhoes(id) on delete cascade,
  geometria jsonb not null,
  propriedades jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  check (coalesce(
    geometria->'geometry'->>'type' = 'Point'
    and jsonb_typeof(geometria->'geometry'->'coordinates') = 'array',
    false
  ))
);

create index pontos_coleta_talhao_idx on public.pontos_coleta (talhao_id);

comment on table public.pontos_coleta is
  'Pontos importados de coleta, independentes de glebas e de análises.';

alter table public.pontos_coleta enable row level security;

revoke all on public.pontos_coleta from anon;
grant select, insert, update, delete on public.pontos_coleta to authenticated;

create policy "pontos de coleta: ler"
  on public.pontos_coleta for select to authenticated
  using (public.tem_acesso_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "pontos de coleta: criar"
  on public.pontos_coleta for insert to authenticated
  with check (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "pontos de coleta: editar"
  on public.pontos_coleta for update to authenticated
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)))
  with check (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "pontos de coleta: apagar"
  on public.pontos_coleta for delete to authenticated
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));
