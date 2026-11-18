-- Gleba pode atravessar a divisa entre talhões (2026-11-18).
--
-- A gleba criada dos pontos de amostra segue a AMOSTRA, não o talhão: quando
-- parte das coletas de uma amostra caiu do outro lado da divisa, a gleba é uma
-- só e ocupa os dois talhões. Ela continua pertencendo a um talhão (o da
-- maioria dos pontos: dono, permissão, código "talhão-número"), mas os pontos
-- ligados a ela podem estar em outro talhão da MESMA fazenda.
--
-- Antes, duas regras exigiam ponto e gleba no mesmo talhão, e a amostra 51
-- (9 pontos no talhão 14, 1 no 12) virava duas glebas, 14-51 e 12-51 — o
-- mesmo com a 63 (6 pontos no 15, 4 no 17).

-- 1) Política dos pontos: a gleba tem de ser da mesma fazenda do ponto.
alter policy "pontos de coleta: criar" on public.pontos_coleta
  with check (
    public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id))
    and (gleba_id is null or public.fazenda_da_gleba(gleba_id) = public.fazenda_do_talhao(talhao_id))
  );

alter policy "pontos de coleta: editar" on public.pontos_coleta
  with check (
    public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id))
    and (gleba_id is null or public.fazenda_da_gleba(gleba_id) = public.fazenda_do_talhao(talhao_id))
  );

-- 2) Criar gleba com pontos: aceita pontos de qualquer talhão da fazenda.
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
    and public.fazenda_do_talhao(talhao_id) = public.fazenda_do_talhao(p_talhao_id)
    and gleba_id is null;

  get diagnostics pontos_vinculados = row_count;
  if pontos_vinculados <> cardinality(p_ponto_ids) then
    raise exception 'Um ou mais pontos já foram usados ou não são desta fazenda. Atualize a lista e tente novamente.';
  end if;

  return nova_gleba;
end;
$$;

revoke execute on function public.criar_gleba_com_pontos(uuid, text, text, jsonb, numeric, uuid[])
  from public, anon;
grant execute on function public.criar_gleba_com_pontos(uuid, text, text, jsonb, numeric, uuid[])
  to authenticated;

-- 3) Dados: junta as amostras que tinham virado duas glebas.
--    Em cada fazenda que tem o par, os pontos da gleba menor passam para a
--    maior, a análise que estava na média dos pontos da maior vai para a média
--    de todos (a mesma regra da importação de laudo) e a gleba menor sai.
--    O desenho das glebas é refeito depois, no app ("Ajustar glebas já
--    criadas ao talhão", em Dados > Pontos de amostra).
do $$
declare
  par record;
  antes record;
  depois record;
begin
  for par in
    select g_menor.id as menor, g_maior.id as maior, g_maior.talhao_id as talhao_maior
    from (values ('12-51', '14-51'), ('17-63', '15-63')) as v(cod_menor, cod_maior)
    join public.glebas g_menor on g_menor.codigo = v.cod_menor
    join public.talhoes t_menor on t_menor.id = g_menor.talhao_id
    join public.glebas g_maior on g_maior.codigo = v.cod_maior
    join public.talhoes t_maior on t_maior.id = g_maior.talhao_id and t_maior.fazenda_id = t_menor.fazenda_id
  loop
    select avg((geometria -> 'geometry' -> 'coordinates' ->> 0)::float8) as lng,
           avg((geometria -> 'geometry' -> 'coordinates' ->> 1)::float8) as lat
      into antes
      from public.pontos_coleta where gleba_id = par.maior;

    update public.pontos_coleta set gleba_id = par.maior where gleba_id = par.menor;

    select avg((geometria -> 'geometry' -> 'coordinates' ->> 0)::float8) as lng,
           avg((geometria -> 'geometry' -> 'coordinates' ->> 1)::float8) as lat
      into depois
      from public.pontos_coleta where gleba_id = par.maior;

    if antes.lng is not null then
      update public.analises
         set geometria = jsonb_set(geometria, '{geometry,coordinates}', jsonb_build_array(depois.lng, depois.lat))
       where talhao_id = par.talhao_maior
         and abs((geometria -> 'geometry' -> 'coordinates' ->> 0)::float8 - antes.lng) < 1e-6
         and abs((geometria -> 'geometry' -> 'coordinates' ->> 1)::float8 - antes.lat) < 1e-6;
    end if;

    delete from public.glebas where id = par.menor;
  end loop;
end;
$$;
