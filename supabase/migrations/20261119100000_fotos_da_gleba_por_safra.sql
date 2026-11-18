-- Fotos do perfil do solo por GLEBA (2026-11-19), no lugar das do talhão.
--
-- A foto do perfil é tirada em cada gleba (cada amostra), não no talhão: três
-- profundidades (0-20, 20-40, 40-60 cm) por safra, uma foto por gleba +
-- safra + profundidade; enviar de novo substitui.
--
-- Arquivos no mesmo bucket privado `fotos`, em fazenda_id/glebas/gleba_id/
-- uuid.jpg — as policies do bucket leem só a primeira pasta (a fazenda).
--
-- A tabela fotos_talhao (de 2026-11-18) sai: só tinha as 36 fotos
-- ilustrativas da 07/11, cujos arquivos são apagados à parte, pelo app.
-- As colunas antigas glebas.foto_path/foto_em (uma foto por gleba, nunca
-- usada) ficam, sem uso, até uma limpeza.

create table public.fotos_gleba (
  id           uuid primary key default gen_random_uuid(),
  gleba_id     uuid not null references public.glebas(id) on delete cascade,
  ano_safra    text not null check (ano_safra ~ '^\d{2}-\d{2}$'),
  profundidade text not null check (profundidade in ('0-20', '20-40', '40-60')),
  caminho      text not null,
  enviada_em   timestamptz not null default now(),
  criado_por   uuid default auth.uid() references auth.users(id),
  unique (gleba_id, ano_safra, profundidade)
);

comment on table public.fotos_gleba is
  'Foto do perfil do solo de uma gleba, por safra e profundidade. O arquivo está no bucket fotos, em `caminho`.';

create index fotos_gleba_gleba_idx on public.fotos_gleba (gleba_id);

alter table public.fotos_gleba enable row level security;

create policy "fotos da gleba: ler"
  on public.fotos_gleba for select to authenticated
  using (public.tem_acesso_fazenda(public.fazenda_da_gleba(gleba_id)));

create policy "fotos da gleba: criar"
  on public.fotos_gleba for insert to authenticated
  with check (public.pode_editar_fazenda(public.fazenda_da_gleba(gleba_id)));

create policy "fotos da gleba: editar"
  on public.fotos_gleba for update to authenticated
  using (public.pode_editar_fazenda(public.fazenda_da_gleba(gleba_id)))
  with check (public.pode_editar_fazenda(public.fazenda_da_gleba(gleba_id)));

create policy "fotos da gleba: apagar"
  on public.fotos_gleba for delete to authenticated
  using (public.pode_editar_fazenda(public.fazenda_da_gleba(gleba_id)));

revoke all on public.fotos_gleba from anon;
grant select, insert, update, delete on public.fotos_gleba to authenticated;

drop table if exists public.fotos_talhao;
