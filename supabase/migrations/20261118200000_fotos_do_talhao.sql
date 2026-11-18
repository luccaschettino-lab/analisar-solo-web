-- Fotos do perfil do solo por talhão (2026-11-18).
--
-- Três profundidades (0-20, 20-40, 40-60 cm) por safra, para ver como o
-- perfil muda de um ano para o outro, como as análises. Uma foto por
-- talhão + safra + profundidade; enviar de novo substitui.
--
-- Os arquivos vão para o mesmo bucket privado `fotos` das glebas, no caminho
-- fazenda_id/talhoes/talhao_id/uuid.jpg. As policies do bucket leem só a
-- primeira pasta (a fazenda), então nada muda nelas: quem acessa a fazenda
-- vê, quem pode editar envia e apaga.

create table public.fotos_talhao (
  id           uuid primary key default gen_random_uuid(),
  talhao_id    uuid not null references public.talhoes(id) on delete cascade,
  ano_safra    text not null check (ano_safra ~ '^\d{2}-\d{2}$'),
  profundidade text not null check (profundidade in ('0-20', '20-40', '40-60')),
  caminho      text not null,
  enviada_em   timestamptz not null default now(),
  criado_por   uuid default auth.uid() references auth.users(id),
  unique (talhao_id, ano_safra, profundidade)
);

comment on table public.fotos_talhao is
  'Foto do perfil do solo de um talhão, por safra e profundidade. O arquivo está no bucket fotos, em `caminho`.';

create index fotos_talhao_talhao_idx on public.fotos_talhao (talhao_id);

alter table public.fotos_talhao enable row level security;

create policy "fotos do talhao: ler"
  on public.fotos_talhao for select to authenticated
  using (public.tem_acesso_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "fotos do talhao: criar"
  on public.fotos_talhao for insert to authenticated
  with check (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "fotos do talhao: editar"
  on public.fotos_talhao for update to authenticated
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)))
  with check (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "fotos do talhao: apagar"
  on public.fotos_talhao for delete to authenticated
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

revoke all on public.fotos_talhao from anon;
grant select, insert, update, delete on public.fotos_talhao to authenticated;
