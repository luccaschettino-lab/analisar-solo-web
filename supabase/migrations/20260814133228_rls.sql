-- ============================================================
-- Row Level Security
--
-- Toda a autorizacao deriva de fazenda_membros. As tabelas abaixo
-- de fazendas nao guardam dono: sobem a hierarquia ate a fazenda.
--
-- Por que funcoes SECURITY DEFINER e nao subconsultas nas policies:
--   1. Recursao. A policy de fazenda_membros precisa consultar
--      fazenda_membros. Feito com subconsulta direta, o Postgres
--      reaplica a policy sobre a propria consulta e estoura com
--      "infinite recursion detected in policy". Dentro de uma funcao
--      SECURITY DEFINER a consulta roda como dona da tabela, que nao
--      esta sujeita a RLS, e o ciclo se fecha.
--   2. Custo. A funcao e STABLE, entao o planejador a avalia uma vez
--      por consulta em vez de uma vez por linha.
--
-- search_path = '' em todas elas: sem isso, um schema malicioso no
-- search_path do chamador poderia sequestrar os nomes de tabela
-- dentro de uma funcao que roda com privilegio elevado. Por isso
-- todo nome aqui esta qualificado (public.x, auth.uid()).
-- ============================================================

-- ------------------------------------------------------------
-- Funcoes de autorizacao
-- ------------------------------------------------------------

-- Papel do usuario atual na fazenda, ou null se nao for membro.
-- E a unica que le fazenda_membros; as demais derivam dela.
create or replace function public.papel_na_fazenda(f_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select fm.papel
  from public.fazenda_membros fm
  where fm.fazenda_id = f_id
    and fm.usuario_id = (select auth.uid())
$$;

-- Exigida pela especificacao. Leitura: membro em qualquer papel.
create or replace function public.tem_acesso_fazenda(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.papel_na_fazenda(f_id) is not null
$$;

-- Escrita: proprietario ou editor. Leitor fica de fora.
create or replace function public.pode_editar_fazenda(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- coalesce: nao-membro devolve null, e null propagaria como null em vez
  -- de false. A policy trataria como negacao de qualquer forma, mas uma
  -- funcao booleana que devolve null e uma armadilha para quem a reusar.
  select coalesce(public.papel_na_fazenda(f_id) in ('proprietario','editor'), false)
$$;

-- Administracao da fazenda: gerir membros e apagar a fazenda.
create or replace function public.e_proprietario_fazenda(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.papel_na_fazenda(f_id) = 'proprietario', false)
$$;

-- Atalhos de hierarquia. Poderiam ser subconsultas nas policies, mas
-- ai a leitura de talhoes/glebas dispararia a policy dessas tabelas
-- dentro da policy da tabela filha — avaliacao aninhada desnecessaria.
create or replace function public.fazenda_do_talhao(t_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.fazenda_id from public.talhoes t where t.id = t_id
$$;

create or replace function public.fazenda_da_gleba(g_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.fazenda_id
  from public.glebas g
  join public.talhoes t on t.id = g.talhao_id
  where g.id = g_id
$$;

revoke execute on function
  public.papel_na_fazenda(uuid),
  public.tem_acesso_fazenda(uuid),
  public.pode_editar_fazenda(uuid),
  public.e_proprietario_fazenda(uuid),
  public.fazenda_do_talhao(uuid),
  public.fazenda_da_gleba(uuid)
from public, anon;

grant execute on function
  public.papel_na_fazenda(uuid),
  public.tem_acesso_fazenda(uuid),
  public.pode_editar_fazenda(uuid),
  public.e_proprietario_fazenda(uuid),
  public.fazenda_do_talhao(uuid),
  public.fazenda_da_gleba(uuid)
to authenticated;

-- ------------------------------------------------------------
-- Habilitar RLS e privilegios de tabela
--
-- RLS filtra linhas, mas so depois do GRANT deixar o role tocar a
-- tabela. Sem RLS o GRANT libera tudo, entao as duas camadas andam
-- juntas. anon nao acessa nada: o app inteiro exige login.
-- ------------------------------------------------------------
alter table public.perfis          enable row level security;
alter table public.fazendas        enable row level security;
alter table public.fazenda_membros enable row level security;
alter table public.talhoes         enable row level security;
alter table public.glebas          enable row level security;
alter table public.analises        enable row level security;

revoke all on public.perfis, public.fazendas, public.fazenda_membros,
              public.talhoes, public.glebas, public.analises
from anon;

grant select, insert, update, delete
on public.perfis, public.fazendas, public.fazenda_membros,
   public.talhoes, public.glebas, public.analises
to authenticated;

-- ------------------------------------------------------------
-- perfis
-- Sem policy de insert: quem cria a linha e o trigger de cadastro,
-- que roda como SECURITY DEFINER e nao passa por RLS.
-- Sem policy de delete: a linha morre por cascade de auth.users.
-- ------------------------------------------------------------
create policy "perfis: ler o proprio"
  on public.perfis for select to authenticated
  using (id = (select auth.uid()));

create policy "perfis: atualizar o proprio"
  on public.perfis for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ------------------------------------------------------------
-- fazendas
-- ------------------------------------------------------------

-- O "criado_por" no using nao e redundancia: no INSERT ... RETURNING
-- que o supabase-js emite (.insert().select()), o Postgres aplica a
-- policy de SELECT a linha devolvida. Nesse instante o trigger que
-- registra o criador como proprietario ainda nao rodou, entao
-- tem_acesso_fazenda() daria falso e o insert falharia na volta.
create policy "fazendas: ler as que o usuario acessa"
  on public.fazendas for select to authenticated
  using (
    criado_por = (select auth.uid())
    or public.tem_acesso_fazenda(id)
  );

-- Qualquer usuario autenticado cria fazenda, desde que em nome proprio.
create policy "fazendas: criar em nome proprio"
  on public.fazendas for insert to authenticated
  with check (criado_por = (select auth.uid()));

create policy "fazendas: editar se proprietario ou editor"
  on public.fazendas for update to authenticated
  using (public.pode_editar_fazenda(id))
  with check (public.pode_editar_fazenda(id));

-- Apagar fazenda derruba talhoes, glebas e analises em cascata.
-- Restrito ao proprietario.
create policy "fazendas: apagar se proprietario"
  on public.fazendas for delete to authenticated
  using (public.e_proprietario_fazenda(id));

-- ------------------------------------------------------------
-- fazenda_membros
-- Esta e a tabela do risco de recursao: as quatro policies leem
-- fazenda_membros atraves das funcoes SECURITY DEFINER acima.
-- ------------------------------------------------------------
create policy "membros: ler os da mesma fazenda"
  on public.fazenda_membros for select to authenticated
  using (public.tem_acesso_fazenda(fazenda_id));

create policy "membros: convidar se proprietario"
  on public.fazenda_membros for insert to authenticated
  with check (public.e_proprietario_fazenda(fazenda_id));

create policy "membros: mudar papel se proprietario"
  on public.fazenda_membros for update to authenticated
  using (public.e_proprietario_fazenda(fazenda_id))
  with check (public.e_proprietario_fazenda(fazenda_id));

-- Deliberadamente so o proprietario remove membros. Deixar o membro
-- se auto-remover permitiria que o unico proprietario saisse e a
-- fazenda ficasse orfa, sem ninguem capaz de reconquistar acesso.
create policy "membros: remover se proprietario"
  on public.fazenda_membros for delete to authenticated
  using (public.e_proprietario_fazenda(fazenda_id));

-- ------------------------------------------------------------
-- talhoes: fazenda_id esta na propria linha.
-- ------------------------------------------------------------
create policy "talhoes: ler"
  on public.talhoes for select to authenticated
  using (public.tem_acesso_fazenda(fazenda_id));

create policy "talhoes: criar"
  on public.talhoes for insert to authenticated
  with check (public.pode_editar_fazenda(fazenda_id));

-- using = quem pode mexer na linha atual;
-- with check = onde a linha pode parar depois. Os dois impedem
-- "mover" um talhao para uma fazenda em que o usuario nao escreve.
create policy "talhoes: editar"
  on public.talhoes for update to authenticated
  using (public.pode_editar_fazenda(fazenda_id))
  with check (public.pode_editar_fazenda(fazenda_id));

create policy "talhoes: apagar"
  on public.talhoes for delete to authenticated
  using (public.pode_editar_fazenda(fazenda_id));

-- ------------------------------------------------------------
-- glebas: sobem um nivel (gleba -> talhao -> fazenda).
-- ------------------------------------------------------------
create policy "glebas: ler"
  on public.glebas for select to authenticated
  using (public.tem_acesso_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "glebas: criar"
  on public.glebas for insert to authenticated
  with check (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "glebas: editar"
  on public.glebas for update to authenticated
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)))
  with check (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

create policy "glebas: apagar"
  on public.glebas for delete to authenticated
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

-- ------------------------------------------------------------
-- analises: sobem dois niveis (analise -> gleba -> talhao -> fazenda).
-- ------------------------------------------------------------
create policy "analises: ler"
  on public.analises for select to authenticated
  using (public.tem_acesso_fazenda(public.fazenda_da_gleba(gleba_id)));

create policy "analises: criar"
  on public.analises for insert to authenticated
  with check (public.pode_editar_fazenda(public.fazenda_da_gleba(gleba_id)));

create policy "analises: editar"
  on public.analises for update to authenticated
  using (public.pode_editar_fazenda(public.fazenda_da_gleba(gleba_id)))
  with check (public.pode_editar_fazenda(public.fazenda_da_gleba(gleba_id)));

create policy "analises: apagar"
  on public.analises for delete to authenticated
  using (public.pode_editar_fazenda(public.fazenda_da_gleba(gleba_id)));
