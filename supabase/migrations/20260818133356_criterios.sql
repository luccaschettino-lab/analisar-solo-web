-- ============================================================
-- Criterios de interpretacao editaveis
--
-- Ate aqui, o que era "bom" ou "ruim" vivia fixo em
-- src/config/parametros.js, com um aviso de que nao passara por
-- validacao agronomica. O mapa pintava com uma tabela generica que
-- ninguem assinava.
--
-- A partir daqui o config vira SEMENTE, nao verdade: quem responde
-- pela interpretacao e um consultor, que cria conjuntos nomeados e
-- aplica um deles em cada fazenda.
--
-- O que NAO muda de lugar: rotulo, unidade, casas decimais, grupo e
-- faixa plausivel continuam so no config. Aquilo e fato, nao juizo —
-- "calcio se mede em cmolc/dm3" nao e opiniao de ninguem. A regra da
-- fonte unica continua valendo para os fatos; so a interpretacao sai.
-- ============================================================

-- ------------------------------------------------------------
-- criterios
--
-- Por que jsonb e nao uma tabela de faixas:
-- as faixas nunca sao consultadas isoladamente. Carrega-se o conjunto
-- inteiro ao abrir a fazenda e pronto — nao existe "quais parametros
-- tem faixa acima de X". Em linhas, seriam ~100 registros por conjunto,
-- com coluna de ordem e a integridade da sequencia a manter na mao.
-- Em jsonb o formato fica identico ao do config, o que torna o
-- fallback uma linha de codigo. Precedente: analises.extras.
--
-- Formato de `parametros`, por chave de parametro:
--
--   {
--     "ph_h2o": {
--       "faixas": [
--         { "ate": 4.5,  "nivel": "muito_baixo", "rotulo": "Muito acido" },
--         { "ate": null, "nivel": "baixo",       "rotulo": "Alcalino" }
--       ],
--       "delta_minimo": 0.2
--     }
--   }
--
-- Tres estados por parametro, e a diferenca importa:
--   - chave ausente          -> usa o que esta no config
--   - "faixas": [ ... ]      -> substitui o do config
--   - "faixas": null         -> declara que NAO ha classificacao,
--                               mesmo que o config traga uma
--
-- O terceiro caso existe porque um consultor pode discordar da faixa
-- generica sem ter uma propria para por no lugar. Sem ele, a unica
-- saida seria deixar a faixa errada de pe.
-- ------------------------------------------------------------
create table public.criterios (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  descricao     text,
  parametros    jsonb not null default '{}'::jsonb
                check (jsonb_typeof(parametros) = 'object'),
  -- default auth.uid() pelo mesmo motivo de fazendas.criado_por: o
  -- cliente nunca manda a coluna, e a policy de insert consegue exigir
  -- que ela seja o proprio usuario.
  criado_por    uuid not null references auth.users(id) on delete cascade
                default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.criterios is
  'Conjunto nomeado de faixas de interpretacao. O config do front e a semente; isto e a verdade quando a fazenda aponta para um conjunto.';

comment on column public.criterios.parametros is
  'Faixas e delta_minimo por chave de parametro. Chave ausente cai no config; "faixas": null declara ausencia de classificacao.';

create index criterios_criado_por_idx on public.criterios (criado_por);

-- ------------------------------------------------------------
-- fazendas.criterio_id
--
-- on delete set null: apagar um conjunto nao pode derrubar a fazenda
-- nem deixa-la apontando para o vazio. Ela volta ao padrao do sistema,
-- que e o pior caso aceitavel — o mapa continua pintando, com o aviso
-- de classificacao preliminar de volta.
-- ------------------------------------------------------------
alter table public.fazendas
  add column criterio_id uuid references public.criterios(id) on delete set null;

comment on column public.fazendas.criterio_id is
  'Conjunto de criterios em vigor nesta fazenda. Null = padrao do sistema (src/config/parametros.js).';

-- Cobre o caminho "quais fazendas usam este conjunto", que a funcao de
-- visibilidade abaixo percorre a cada leitura de criterios.
create index fazendas_criterio_idx on public.fazendas (criterio_id);

-- ------------------------------------------------------------
-- Funcoes de autorizacao
--
-- Mesmas razoes das funcoes da migracao de RLS: SECURITY DEFINER para
-- a consulta nao reaplicar a policy da tabela lida, STABLE para o
-- planejador avaliar uma vez por consulta, e search_path = '' com todo
-- nome qualificado.
-- ------------------------------------------------------------

-- O conjunto esta aplicado em alguma fazenda que o usuario acessa?
--
-- E o que deixa o produtor ler o criterio que o consultor escreveu:
-- ele nao criou o conjunto, mas a cor do mapa dele depende dessas
-- faixas, e a legenda precisa mostrar de quem elas sao.
create or replace function public.criterio_em_fazenda_acessivel(c_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fazendas f
    join public.fazenda_membros fm on fm.fazenda_id = f.id
    where f.criterio_id = c_id
      and fm.usuario_id = (select auth.uid())
  )
$$;

-- O conjunto e do proprio usuario?
--
-- Usada na policy de fazendas para limitar QUAIS conjuntos podem ser
-- aplicados. Sem isso, bastaria adivinhar um uuid e aponta-lo na
-- propria fazenda para passar a enxergar o conjunto de outra pessoa —
-- a funcao acima o tornaria visivel no instante seguinte.
--
-- Nao da para resolver com "so aplique o que voce ja enxerga": a
-- verificacao roda depois da linha atualizada, quando o vinculo ja
-- existe e a resposta ja virou sim. Por isso o criterio e mais
-- estrito, e recai sobre a autoria.
create or replace function public.criterio_do_usuario(c_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.criterios c
    where c.id = c_id and c.criado_por = (select auth.uid())
  )
$$;

revoke execute on function
  public.criterio_em_fazenda_acessivel(uuid),
  public.criterio_do_usuario(uuid)
from public, anon;

grant execute on function
  public.criterio_em_fazenda_acessivel(uuid),
  public.criterio_do_usuario(uuid)
to authenticated;

-- ------------------------------------------------------------
-- atualizado_em
--
-- Em trigger e nao no cliente: a legenda vai mostrar quando o criterio
-- mudou pela ultima vez, e essa data e parte da prestacao de contas de
-- uma afirmacao sobre a terra de alguem. Data que o proprio cliente
-- escreve nao serve para isso.
--
-- O revoke repete a licao da migracao 20260814133412: funcao sem
-- argumentos no schema public fica exposta em /rest/v1/rpc/ se o
-- execute nao for retirado.
-- ------------------------------------------------------------
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

revoke execute on function public.tocar_atualizado_em() from public, anon, authenticated;

create trigger criterios_atualizado_em
  before update on public.criterios
  for each row execute function public.tocar_atualizado_em();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.criterios enable row level security;

revoke all on public.criterios from anon;
grant select, insert, update, delete on public.criterios to authenticated;

-- Le quem criou, e quem acessa uma fazenda onde o conjunto esta em uso.
--
-- O "criado_por" inline, e nao dentro da funcao, e a mesma precaucao da
-- policy de fazendas: no INSERT ... RETURNING que o supabase-js emite,
-- a policy de select e aplicada a linha devolvida antes de o conjunto
-- estar aplicado em fazenda nenhuma.
create policy "criterios: ler os proprios e os em uso"
  on public.criterios for select to authenticated
  using (
    criado_por = (select auth.uid())
    or public.criterio_em_fazenda_acessivel(id)
  );

create policy "criterios: criar em nome proprio"
  on public.criterios for insert to authenticated
  with check (criado_por = (select auth.uid()));

-- Editar e apagar so o autor. Um consultor nao mexe no criterio de
-- outro, mesmo dividindo a fazenda: a assinatura na legenda tem que
-- valer alguma coisa.
create policy "criterios: editar se autor"
  on public.criterios for update to authenticated
  using (criado_por = (select auth.uid()))
  with check (criado_por = (select auth.uid()));

create policy "criterios: apagar se autor"
  on public.criterios for delete to authenticated
  using (criado_por = (select auth.uid()));

-- ------------------------------------------------------------
-- fazendas: aplicar um conjunto
--
-- Em trigger, e nao no WITH CHECK da policy de update.
--
-- A tentacao era acrescentar `criterio_id is null or
-- criterio_do_usuario(criterio_id)` ao WITH CHECK. Isso quebraria a
-- edicao da fazenda: o WITH CHECK roda em TODO update, e o dono de uma
-- fazenda que usa o criterio do consultor nao conseguiria nem renomear
-- a propria fazenda — a condicao olharia um criterio que nao e dele e
-- barraria uma alteracao que nao tinha nada a ver com criterio.
--
-- A policy nao tem como saber que o campo nao mudou: WITH CHECK so
-- enxerga a linha nova. O trigger enxerga as duas, e so se mete quando
-- criterio_id de fato muda.
-- ------------------------------------------------------------
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
    -- `is distinct from` e nao `<>`: com null dos dois lados, `<>`
    -- devolveria null e a condicao passaria batido.
    aplicando := new.criterio_id is not null
                 and new.criterio_id is distinct from old.criterio_id;
  end if;

  if aplicando and not public.criterio_do_usuario(new.criterio_id) then
    raise exception 'So da para aplicar um conjunto de criterios que voce mesmo criou.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_criterio_da_fazenda() from public, anon, authenticated;

create trigger fazendas_validar_criterio
  before insert or update on public.fazendas
  for each row execute function public.validar_criterio_da_fazenda();
