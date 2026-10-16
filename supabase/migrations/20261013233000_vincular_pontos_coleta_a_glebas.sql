alter table public.pontos_coleta
  add column gleba_id uuid references public.glebas(id) on delete set null;

revoke all on public.pontos_coleta from anon;
grant select, insert, update, delete on public.pontos_coleta to authenticated;

create index pontos_coleta_gleba_idx on public.pontos_coleta (gleba_id);

create or replace function public.talhao_da_gleba(g_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.talhao_id
  from public.glebas g
  where g.id = g_id
$$;

revoke execute on function public.talhao_da_gleba(uuid) from public, anon;
grant execute on function public.talhao_da_gleba(uuid) to authenticated;

drop policy "pontos de coleta: editar" on public.pontos_coleta;

create policy "pontos de coleta: editar"
  on public.pontos_coleta for update to authenticated
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)))
  with check (
    public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id))
    and (gleba_id is null or public.talhao_da_gleba(gleba_id) = talhao_id)
  );

create or replace function public.criar_gleba_com_pontos(
  p_talhao_id uuid,
  p_codigo text,
  p_nome text,
  p_geometria jsonb,
  p_area_ha numeric,
  p_ponto_ids uuid[]
)
returns public.glebas
language plpgsql
set search_path = ''
as $$
declare
  nova_gleba public.glebas;
  pontos_vinculados integer;
begin
  if p_ponto_ids is null or cardinality(p_ponto_ids) = 0 then
    raise exception 'Selecione pelo menos um ponto de coleta.';
  end if;

  insert into public.glebas (talhao_id, codigo, nome, geometria, area_ha)
  values (p_talhao_id, btrim(p_codigo), nullif(btrim(p_nome), ''), p_geometria, p_area_ha)
  returning * into nova_gleba;

  update public.pontos_coleta
  set gleba_id = nova_gleba.id
  where id = any(p_ponto_ids)
    and talhao_id = p_talhao_id
    and gleba_id is null;

  get diagnostics pontos_vinculados = row_count;
  if pontos_vinculados <> cardinality(p_ponto_ids) then
    raise exception 'Um ou mais pontos já foram usados ou não pertencem a este talhão. Atualize a lista e tente novamente.';
  end if;

  return nova_gleba;
end;
$$;

revoke execute on function public.criar_gleba_com_pontos(uuid, text, text, jsonb, numeric, uuid[])
  from public, anon;
grant execute on function public.criar_gleba_com_pontos(uuid, text, text, jsonb, numeric, uuid[])
  to authenticated;
