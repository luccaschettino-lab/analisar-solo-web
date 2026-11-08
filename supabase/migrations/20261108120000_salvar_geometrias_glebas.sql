-- Grava a geometria de várias glebas numa transação só (auditoria de
-- 2026-11-07, P9).
--
-- Usada quando uma mudança de desenho envolve mais de uma gleba:
--   * mover a divisa compartilhada ("Mover nas vizinhas também"): a gleba
--     editada e as vizinhas precisam mudar juntas. Antes, cada uma era gravada
--     por uma chamada do navegador; se a segunda falhasse, a divisa ficava
--     nova numa e velha na outra, com buraco ou sobreposição entre elas;
--   * "Ajustar glebas já criadas ao talhão" (recalcular a partir dos pontos).
--
-- Se qualquer gleba falhar (não existe mais, ou a pessoa não pode editá-la),
-- nenhuma muda.
--
-- SECURITY INVOKER (o padrão): as políticas de RLS de `glebas` continuam
-- valendo; uma gleba de fazenda sem permissão de edição "não é encontrada" e
-- desfaz tudo.
--
-- p_itens: [{ "id": uuid, "geometria": GeoJSON, "area_ha": número ou null }, …]

create or replace function public.salvar_geometrias_glebas(p_itens jsonb)
returns setof public.glebas
language plpgsql
set search_path = ''
as $$
declare
  v_item  jsonb;
  v_linha public.glebas;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Nenhuma gleba para gravar.';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    update public.glebas
       set geometria = v_item -> 'geometria',
           area_ha   = nullif(v_item ->> 'area_ha', '')::numeric
     where id = (v_item ->> 'id')::uuid
    returning * into v_linha;

    if not found then
      raise exception 'Uma das glebas não existe mais ou você não tem permissão para editá-la. Nada foi gravado.';
    end if;
    return next v_linha;
  end loop;
end;
$$;

revoke execute on function public.salvar_geometrias_glebas(jsonb) from public, anon;
grant execute on function public.salvar_geometrias_glebas(jsonb) to authenticated;

comment on function public.salvar_geometrias_glebas(jsonb) is
  'Grava geometria e área de várias glebas numa transação (divisa compartilhada, recalcular glebas). Auditoria 2026-11-07, P9.';
