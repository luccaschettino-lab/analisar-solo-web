-- ============================================================
-- Equipe da fazenda: cargo Agrônomo, convites por link e trava do último
-- proprietário.
--
-- Cargos (fazenda_membros.papel):
--   proprietario  tudo + equipe + excluir a fazenda (pode haver mais de um)
--   agronomo      edita tudo + critérios de interpretação (não mexe na equipe)
--   editor        lança dados, desenha, fotos (não mexe em critérios)
--   leitor        só vê e exporta
--
-- Convite: o proprietário gera um link de uso único com o cargo escolhido.
-- Quem abre o link cria a conta (ou entra com a que já tem) e vira membro —
-- isso acontece na função `convite`, que roda com a service role; daqui o
-- navegador só cria, lista e cancela convites.
-- ============================================================

-- ---------- Cargo Agrônomo ----------
alter table public.fazenda_membros drop constraint if exists fazenda_membros_papel_check;
alter table public.fazenda_membros
  add constraint fazenda_membros_papel_check
  check (papel in ('proprietario', 'agronomo', 'editor', 'leitor'));

create or replace function public.pode_editar_fazenda(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.papel_na_fazenda(f_id) in ('proprietario', 'agronomo', 'editor'), false)
$$;

-- Quem escolhe (ou tira) o critério de interpretação da fazenda.
create or replace function public.pode_definir_criterio(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.papel_na_fazenda(f_id) in ('proprietario', 'agronomo'), false)
$$;

-- O editor continua podendo mudar nome, município e sede (policy de update da
-- fazenda), mas trocar o critério muda as cores de todo mundo: só proprietário
-- e agrônomo. Sem usuário (SQL Editor, scripts) passa.
create or replace function public.validar_criterio_da_fazenda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  aplicando boolean;
begin
  if tg_op = 'INSERT' then
    aplicando := new.criterio_id is not null;
  else
    aplicando := new.criterio_id is not null
                 and new.criterio_id is distinct from old.criterio_id;
    if new.criterio_id is distinct from old.criterio_id
       and (select auth.uid()) is not null
       and not public.pode_definir_criterio(new.id) then
      raise exception 'Só o proprietário ou o agrônomo da fazenda trocam o critério de interpretação.'
        using errcode = '42501';
    end if;
  end if;

  if aplicando and not public.criterio_do_usuario(new.criterio_id) then
    raise exception 'So da para aplicar um conjunto de criterios que voce mesmo criou.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------- Nunca sem proprietário ----------
-- Tirar ou rebaixar o ÚLTIMO proprietário deixaria a fazenda sem ninguém
-- capaz de gerenciar a equipe. Exceções: a fazenda está sendo apagada
-- (cascade) ou a conta do usuário está sendo apagada.
create or replace function public.manter_um_proprietario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.papel <> 'proprietario' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.papel = 'proprietario' then
    return new;
  end if;
  -- Apagado em cascata (a fazenda ou a conta sumindo): o DELETE vem de dentro
  -- do gatilho da chave estrangeira, então a profundidade é maior que 1.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if not exists (select 1 from public.fazendas where id = old.fazenda_id) then
    return coalesce(new, old);
  end if;
  if not exists (select 1 from auth.users where id = old.usuario_id) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1 from public.fazenda_membros
    where fazenda_id = old.fazenda_id
      and papel = 'proprietario'
      and usuario_id <> old.usuario_id
  ) then
    raise exception 'A fazenda precisa de pelo menos um proprietário. Torne outra pessoa proprietária antes.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists manter_um_proprietario on public.fazenda_membros;
create trigger manter_um_proprietario
  before update of papel or delete on public.fazenda_membros
  for each row execute function public.manter_um_proprietario();

revoke execute on function public.manter_um_proprietario() from public, anon, authenticated;

-- ---------- Quem está na equipe (com nome e e-mail) ----------
-- Os perfis dos outros não são legíveis pela RLS; o proprietário vê os da
-- própria fazenda por aqui.
create or replace function public.equipe_da_fazenda(f_id uuid)
returns table (usuario_id uuid, nome text, email text, papel text, desde timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select fm.usuario_id, p.nome, p.email, fm.papel, fm.criado_em
  from public.fazenda_membros fm
  left join public.perfis p on p.id = fm.usuario_id
  where fm.fazenda_id = f_id
    and public.e_proprietario_fazenda(f_id)
  order by case fm.papel when 'proprietario' then 0 when 'agronomo' then 1 when 'editor' then 2 else 3 end,
           coalesce(p.nome, p.email)
$$;

revoke execute on function public.equipe_da_fazenda(uuid) from public, anon;
grant execute on function public.equipe_da_fazenda(uuid) to authenticated;

-- ---------- Convites ----------
create table if not exists public.fazenda_convites (
  id          uuid primary key default gen_random_uuid(),
  fazenda_id  uuid not null references public.fazendas(id) on delete cascade,
  papel       text not null check (papel in ('proprietario', 'agronomo', 'editor', 'leitor')),
  -- Para quem é (só um lembrete na lista de convites): "João, agrônomo".
  para        text check (para is null or char_length(para) <= 80),
  -- 64 caracteres hex (~244 bits aleatórios): impossível de adivinhar.
  token       text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  criado_por  uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '7 days',
  usado_por   uuid references auth.users(id) on delete set null,
  usado_em    timestamptz
);

create index if not exists fazenda_convites_fazenda on public.fazenda_convites (fazenda_id);

alter table public.fazenda_convites enable row level security;
revoke all on public.fazenda_convites from anon;
grant select, insert, delete on public.fazenda_convites to authenticated;

drop policy if exists "convites: ver se proprietario" on public.fazenda_convites;
create policy "convites: ver se proprietario"
  on public.fazenda_convites for select to authenticated
  using (public.e_proprietario_fazenda(fazenda_id));

drop policy if exists "convites: criar se proprietario" on public.fazenda_convites;
create policy "convites: criar se proprietario"
  on public.fazenda_convites for insert to authenticated
  with check (public.e_proprietario_fazenda(fazenda_id) and usado_por is null and usado_em is null);

drop policy if exists "convites: cancelar se proprietario" on public.fazenda_convites;
create policy "convites: cancelar se proprietario"
  on public.fazenda_convites for delete to authenticated
  using (public.e_proprietario_fazenda(fazenda_id));
