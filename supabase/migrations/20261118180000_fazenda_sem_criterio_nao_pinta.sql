-- Fazenda sem conjunto de critérios deixa de pintar o mapa (2026-11-18).
--
-- Até aqui, fazenda sem `criterio_id` usava sozinha a tabela de referência do
-- sistema (config/parametros.js). Agora o que é bom ou ruim só existe depois
-- que alguém (o agrônomo) aplica um conjunto à fazenda; sem conjunto, o mapa
-- fica sem cores e mostra onde definir. A mudança é do app — o banco não muda.
--
-- Esta migração só evita que as fazendas que JÁ existem percam as cores de
-- uma hora para a outra: cada dono ganha um conjunto "Referência inicial" com
-- `parametros = {}` (= exatamente a tabela que valia até hoje) e ele é
-- aplicado às fazendas dele que estavam sem conjunto. Dá para trocá-lo ou
-- tirá-lo depois, na tela de Critérios. Fazendas de exemplo (tutorial) ficam
-- de fora: o tutorial cria o conjunto delas.

-- O trigger exige que o conjunto aplicado seja de quem está logado
-- (auth.uid()), e no SQL Editor não há ninguém logado. Desligado só aqui.
alter table public.fazendas disable trigger fazendas_validar_criterio;

with donos as (
  select distinct f.criado_por
  from public.fazendas f
  where f.criterio_id is null and not f.exemplo and f.criado_por is not null
),
novos as (
  insert into public.criterios (nome, descricao, parametros, criado_por)
  select
    'Referência inicial',
    'A tabela de referência que o sistema usava sozinho até 18/11/2026. Revise com o agrônomo.',
    '{}'::jsonb,
    d.criado_por
  from donos d
  returning id, criado_por
)
update public.fazendas f
   set criterio_id = n.id
  from novos n
 where f.criado_por = n.criado_por
   and f.criterio_id is null
   and not f.exemplo;

alter table public.fazendas enable trigger fazendas_validar_criterio;
