-- Mesclar talhões numa transação só, levando TUDO o que é dos talhões absorvidos.
--
-- Antes, a tela movia só as glebas e depois apagava os outros talhões. Como
-- `analises.talhao_id` e `pontos_coleta.talhao_id` são `on delete cascade`,
-- as análises e os pontos de coleta dos talhões absorvidos eram apagados
-- junto, sem aviso (auditoria de 2026-11-07, P1). E eram várias chamadas do
-- navegador: uma queda de rede no meio deixava a mesclagem pela metade.
--
-- Aqui: glebas, análises e pontos mudam para o talhão base; só então os
-- outros talhões, já vazios, são apagados; e por fim a base recebe código,
-- nome, cor e a geometria combinada. Qualquer erro desfaz tudo.
--
-- SECURITY INVOKER (o padrão): roda com as permissões de quem chama, então as
-- políticas de RLS de cada tabela continuam valendo. A checagem explícita de
-- permissão abaixo só existe para dar uma mensagem clara em vez de "0 linhas".

create or replace function public.mesclar_talhoes(
  p_base_id     uuid,
  p_absorvidos  uuid[],
  p_codigo      text,
  p_nome        text,
  p_cor         text,
  p_geometria   jsonb,
  p_area_ha     numeric
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_fazenda         uuid;
  v_encontrados     integer;
  v_conflitos       text;
  v_glebas          integer;
  v_analises        integer;
  v_pontos          integer;
  v_apagados        integer;
  v_talhao          public.talhoes;
begin
  -- Um id repetido na lista faria as contagens abaixo não baterem.
  p_absorvidos := array(select distinct unnest(p_absorvidos));
  if p_absorvidos is null or cardinality(p_absorvidos) = 0 then
    raise exception 'Escolha pelo menos um talhão para juntar ao talhão base.';
  end if;
  if p_base_id = any(p_absorvidos) then
    raise exception 'O talhão base não pode estar entre os talhões absorvidos.';
  end if;
  if nullif(btrim(p_codigo), '') is null then
    raise exception 'Informe o código do talhão final.';
  end if;

  select t.fazenda_id into v_fazenda from public.talhoes t where t.id = p_base_id;
  if v_fazenda is null then
    raise exception 'O talhão base não existe mais. Recarregue a página.';
  end if;
  if not public.pode_editar_fazenda(v_fazenda) then
    raise exception 'Você não tem permissão para editar talhões nesta fazenda.'
      using errcode = '42501';
  end if;

  -- Todos os absorvidos precisam existir e ser da mesma fazenda da base.
  select count(*) into v_encontrados
  from public.talhoes t
  where t.id = any(p_absorvidos) and t.fazenda_id = v_fazenda;
  if v_encontrados <> cardinality(p_absorvidos) then
    raise exception 'Algum talhão escolhido não existe mais ou é de outra fazenda. Recarregue a página.';
  end if;

  -- Gleba com o mesmo código em dois dos talhões não pode ficar no mesmo
  -- talhão (unique talhao_id, codigo). Recusa antes de mexer em qualquer coisa.
  select string_agg(x.codigo, ', ' order by x.codigo) into v_conflitos
  from (
    select g.codigo
    from public.glebas g
    where g.talhao_id = p_base_id or g.talhao_id = any(p_absorvidos)
    group by g.codigo
    having count(*) > 1
  ) x;
  if v_conflitos is not null then
    raise exception 'Há glebas com o mesmo código em talhões diferentes (%). Renomeie uma delas antes de mesclar.', v_conflitos;
  end if;

  -- 1) Filhos mudam para a base. Glebas antes dos pontos: a política de
  --    pontos exige que a gleba do ponto seja do mesmo talhão do ponto.
  update public.glebas set talhao_id = p_base_id where talhao_id = any(p_absorvidos);
  get diagnostics v_glebas = row_count;

  update public.analises set talhao_id = p_base_id where talhao_id = any(p_absorvidos);
  get diagnostics v_analises = row_count;

  update public.pontos_coleta set talhao_id = p_base_id where talhao_id = any(p_absorvidos);
  get diagnostics v_pontos = row_count;

  -- 2) Os absorvidos, agora vazios. Antes de atualizar a base, para que ela
  --    possa herdar o código de um deles sem bater na unique (fazenda, código).
  delete from public.talhoes where id = any(p_absorvidos);
  get diagnostics v_apagados = row_count;
  if v_apagados <> cardinality(p_absorvidos) then
    raise exception 'Não foi possível apagar todos os talhões absorvidos. Nada foi alterado.';
  end if;

  -- 3) A base recebe os dados finais.
  update public.talhoes
  set codigo = btrim(p_codigo),
      nome = nullif(btrim(coalesce(p_nome, '')), ''),
      cor = coalesce(p_cor, cor),
      geometria = p_geometria,
      area_ha = p_area_ha
  where id = p_base_id
  returning * into v_talhao;

  return jsonb_build_object(
    'talhao', to_jsonb(v_talhao),
    'glebas_movidas', v_glebas,
    'analises_movidas', v_analises,
    'pontos_movidos', v_pontos
  );
end;
$$;

revoke execute on function public.mesclar_talhoes(uuid, uuid[], text, text, text, jsonb, numeric)
  from public, anon;
grant execute on function public.mesclar_talhoes(uuid, uuid[], text, text, text, jsonb, numeric)
  to authenticated;

comment on function public.mesclar_talhoes(uuid, uuid[], text, text, text, jsonb, numeric) is
  'Junta talhões no talhão base levando glebas, análises e pontos de coleta, numa transação. Ver auditoria 2026-11-07 (P1).';
