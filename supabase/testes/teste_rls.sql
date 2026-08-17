-- ============================================================
-- Teste de RLS — rode no SQL Editor DEPOIS das tres migracoes.
--
-- Roda inteiro dentro de uma transacao que termina em ROLLBACK:
-- nada fica no banco. Se algum invariante quebrar, o script para
-- com uma excecao dizendo qual. Chegou ao fim sem erro = tudo passou.
--
-- Cobre:
--   1. trigger que cria perfil no cadastro
--   2. trigger que registra o criador como proprietario
--   3. RECURSAO em fazenda_membros (o risco apontado na spec)
--   4. INSERT ... RETURNING em fazendas (o caso que exige o
--      "criado_por" na policy de select)
--   5. isolamento: usuario B nao enxerga nada do usuario A
--   6. escrita negada para quem nao e membro
-- ============================================================

begin;

-- UUIDs fixos para nao precisar carregar ids entre os passos.
-- A = dono, B = estranho, F = a fazenda de A.

-- ------------------------------------------------------------
-- Dois usuarios de teste
-- ------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'produtor@teste.local', '{"nome":"Produtor Teste"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   'bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'intruso@teste.local', '{"nome":"Intruso"}'::jsonb, now(), now());

-- (1) O trigger de cadastro criou os perfis, com o nome vindo do metadado?
do $$
begin
  if (select count(*) from public.perfis
      where id in ('aaaaaaaa-0000-0000-0000-000000000001',
                   'bbbbbbbb-0000-0000-0000-000000000002')) <> 2 then
    raise exception 'FALHOU (1): trigger nao criou os perfis';
  end if;
  if (select nome from public.perfis
      where id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 'Produtor Teste' then
    raise exception 'FALHOU (1): nome nao veio de raw_user_meta_data';
  end if;
  raise notice 'OK (1) perfis criados por trigger';
end $$;

-- ------------------------------------------------------------
-- Passa a agir como o usuario A
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

-- (4) INSERT ... RETURNING: e o que o supabase-js emite em .insert().select().
-- Se a policy de select de fazendas dependesse so de tem_acesso_fazenda(),
-- isto falharia — o trigger que cria o vinculo de proprietario ainda nao
-- rodou no instante em que o RETURNING e avaliado.
do $$
declare
  devolvido uuid;
begin
  insert into public.fazendas (id, nome, municipio, uf)
  values ('ffffffff-0000-0000-0000-000000000003', 'Fazenda Teste', 'Vicosa', 'MG')
  returning id into devolvido;

  if devolvido is null then
    raise exception 'FALHOU (4): INSERT ... RETURNING nao devolveu a fazenda';
  end if;
  raise notice 'OK (4) insert com returning passou pela policy de select';
end $$;

-- (2) O trigger registrou o criador como proprietario?
-- (3) E este SELECT e o teste de recursao: a policy de fazenda_membros
--     consulta fazenda_membros. Sem SECURITY DEFINER, aqui estouraria
--     "infinite recursion detected in policy for relation fazenda_membros".
do $$
begin
  if (select count(*) from public.fazenda_membros
      where fazenda_id = 'ffffffff-0000-0000-0000-000000000003'
        and usuario_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        and papel = 'proprietario') <> 1 then
    raise exception 'FALHOU (2): criador nao virou proprietario';
  end if;
  raise notice 'OK (2) criador registrado como proprietario';
  raise notice 'OK (3) fazenda_membros consultada sem recursao';
end $$;

-- Monta a hierarquia completa como usuario A.
insert into public.talhoes (id, fazenda_id, codigo, nome, area_ha)
values ('11111111-0000-0000-0000-000000000004',
        'ffffffff-0000-0000-0000-000000000003', '8', 'Talhao 8', 42.5);

insert into public.glebas (id, talhao_id, codigo, nome)
values ('22222222-0000-0000-0000-000000000005',
        '11111111-0000-0000-0000-000000000004', 'G1', 'Gleba 1');

-- Duas safras na MESMA gleba, com numeros de amostra diferentes.
-- E disto que o produto vive: o laboratorio renumerou, a gleba nao mudou.
insert into public.analises (gleba_id, ano_safra, profundidade, numero_amostra_lab, ph_h2o, p, k, v)
values
  ('22222222-0000-0000-0000-000000000005', '24-25', '0-20', '1043', 5.4, 12.3,  88, 48.2),
  ('22222222-0000-0000-0000-000000000005', '25-26', '0-20', '2871', 5.9, 18.7, 104, 57.1);

do $$
begin
  if (select count(*) from public.analises) <> 2 then
    raise exception 'FALHOU: usuario A nao le as proprias analises';
  end if;
  if (select count(distinct numero_amostra_lab) from public.analises) <> 2 then
    raise exception 'FALHOU: as duas safras deveriam ter numeros de amostra distintos';
  end if;
  if (select count(distinct gleba_id) from public.analises) <> 1 then
    raise exception 'FALHOU: as duas safras deveriam apontar para a MESMA gleba';
  end if;
  raise notice 'OK duas safras na mesma gleba, numeros de amostra diferentes';
end $$;

-- A chave natural (gleba, safra, profundidade) impede laudo duplicado.
do $$
begin
  begin
    insert into public.analises (gleba_id, ano_safra, profundidade)
    values ('22222222-0000-0000-0000-000000000005', '25-26', '0-20');
    raise exception 'FALHOU: aceitou analise duplicada na chave natural';
  exception
    when unique_violation then
      raise notice 'OK chave natural (gleba, safra, profundidade) bloqueia duplicata';
  end;
end $$;

-- ------------------------------------------------------------
-- (5) Agora como usuario B, que nao e membro de nada
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.fazendas)        <> 0 then raise exception 'VAZAMENTO: B ve fazendas'; end if;
  if (select count(*) from public.fazenda_membros) <> 0 then raise exception 'VAZAMENTO: B ve membros'; end if;
  if (select count(*) from public.talhoes)         <> 0 then raise exception 'VAZAMENTO: B ve talhoes'; end if;
  if (select count(*) from public.glebas)          <> 0 then raise exception 'VAZAMENTO: B ve glebas'; end if;
  if (select count(*) from public.analises)        <> 0 then raise exception 'VAZAMENTO: B ve analises'; end if;
  if (select count(*) from public.perfis)          <> 1 then raise exception 'VAZAMENTO: B ve perfil alheio'; end if;
  raise notice 'OK (5) usuario B nao enxerga nada do usuario A';
end $$;

-- (6) B conhece o uuid da fazenda e tenta escrever nela.
do $$
begin
  begin
    insert into public.talhoes (fazenda_id, codigo)
    values ('ffffffff-0000-0000-0000-000000000003', 'INVASOR');
    raise exception 'FALHOU (6): B inseriu talhao em fazenda alheia';
  exception
    when insufficient_privilege then
      raise notice 'OK (6) escrita de B bloqueada pela RLS';
  end;
end $$;

reset role;
rollback;
