-- ============================================================
-- Triggers de consistencia
--
-- Ambos sao SECURITY DEFINER porque escrevem em tabelas que o
-- usuario, no instante em que o gatilho dispara, ainda nao tem
-- permissao de escrever: no cadastro nem sessao existe, e na
-- criacao da fazenda o vinculo de proprietario e justamente o que
-- esta sendo criado.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Perfil automatico no cadastro
--
-- O nome vem de raw_user_meta_data, preenchido pelo options.data do
-- signUp() no front. E o unico caminho: durante o signUp ainda nao ha
-- sessao, entao o cliente nao conseguiria inserir em perfis.
-- ------------------------------------------------------------
create or replace function public.criar_perfil_para_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome', '')), ''),
    new.email
  )
  -- Idempotente: um replay do trigger nao derruba o cadastro inteiro.
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_para_novo_usuario();

-- ------------------------------------------------------------
-- 2. Criador da fazenda vira proprietario
--
-- Precisa ser AFTER INSERT: fazenda_membros.fazenda_id tem FK para
-- fazendas, entao a linha da fazenda ja tem que existir. Um BEFORE
-- INSERT violaria a chave estrangeira.
-- ------------------------------------------------------------
create or replace function public.registrar_proprietario_fazenda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dono uuid := coalesce(new.criado_por, auth.uid());
begin
  -- Sem dono identificavel (ex: insercao por script administrativo),
  -- nao ha vinculo a criar. A fazenda fica sem membros, visivel
  -- apenas para a service_role.
  if dono is null then
    return new;
  end if;

  insert into public.fazenda_membros (fazenda_id, usuario_id, papel)
  values (new.id, dono, 'proprietario')
  on conflict (fazenda_id, usuario_id) do nothing;

  return new;
end;
$$;

create trigger ao_criar_fazenda
  after insert on public.fazendas
  for each row execute function public.registrar_proprietario_fazenda();
